import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260902023119_ats_operations_center.sql",
    import.meta.url,
  ),
  "utf8",
);
const rankingMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260902032553_ats_candidate_quick_actions_ranking.sql",
    import.meta.url,
  ),
  "utf8",
);
const exclusiveQueuesMigration = readFileSync(
  new URL(
    "../supabase/migrations/20260902093502_enforce_exclusive_career_stage_queues.sql",
    import.meta.url,
  ),
  "utf8",
);
const operationsCenter = readFileSync(
  new URL(
    "../src/components/admin/careers/candidate-operations-center.tsx",
    import.meta.url,
  ),
  "utf8",
);
const pipelineNav = readFileSync(
  new URL(
    "../src/components/admin/careers/candidate-pipeline-nav.tsx",
    import.meta.url,
  ),
  "utf8",
);
const operationsAction = readFileSync(
  new URL(
    "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions.ts",
    import.meta.url,
  ),
  "utf8",
);

test("central ATS usa busca, paginação e índices no servidor", () => {
  assert.match(migration, /search_career_job_applications/);
  assert.match(migration, /p_limit integer default 25/);
  assert.match(migration, /p_limit in \(25, 50, 100\)/);
  assert.match(migration, /career_job_applications_search_idx/);
  assert.match(
    migration,
    /left join lateral[\s\S]*career_application_match_runs/,
  );
  assert.match(migration, /count\(\*\) over\(\)/);
});

test("movimentação em lote é atômica e reaproveita a decisão auditada", () => {
  assert.match(migration, /bulk_decide_career_applications/);
  assert.match(migration, /foreach application_id in array unique_ids loop/);
  assert.match(migration, /public\.decide_career_application_stage/);
  assert.doesNotMatch(migration, /exception when others/i);
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /revoke all on function public\.bulk_decide/);
});

test("metadados operacionais não alteram o snapshot nem a pontuação", () => {
  assert.match(migration, /is_referred boolean/);
  assert.match(migration, /referred_by text/);
  assert.match(migration, /availability_shifts text\[\]/);
  assert.match(migration, /hiring_checklist jsonb/);
  assert.doesNotMatch(migration, /profile_snapshot\s*=/i);
});

test("matriz 2.0 e candidatura estruturada permanecem compatíveis", () => {
  const applicationAction = readFileSync(
    new URL("../src/app/carreiras/application-actions.ts", import.meta.url),
    "utf8",
  );
  const applicationPage = readFileSync(
    new URL(
      "../src/app/carreiras/vagas/[slug]/candidatar/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /jsonb_array_length\(new\.criteria\) not between 1 and 17/,
  );
  assert.match(migration, /coalesce\(item ->> 'kind', 'scoring'\)/);
  assert.match(applicationAction, /p_availability_shifts/);
  assert.match(applicationAction, /p_is_referred/);
  assert.match(applicationPage, /name="availability_shifts"/);
  assert.match(applicationPage, /name="referred_by"/);
  assert.match(
    applicationPage,
    /não\s+altera a pontuação\s+de aderência/i,
  );
});

test("melhores currículos aparecem primeiro com evidência suficiente", () => {
  assert.match(rankingMigration, /evidence_weighted_score/);
  assert.match(rankingMigration, /informationCoverage/);
  assert.match(
    rankingMigration,
    /evidence_weighted_score end desc nulls last[\s\S]*latest_match_score end desc nulls last[\s\S]*latest_match_coverage end desc nulls last[\s\S]*calculated_experience_months end desc/,
  );
  assert.match(rankingMigration, /auth\.uid\(\) is null/);
  assert.match(rankingMigration, /revoke all on function public\.search_career/);
});

test("cada linha oferece decisão humana rápida e confirmada", () => {
  assert.match(operationsCenter, />\s*Ver currículo\s*</);
  assert.match(operationsCenter, /\/api\/admin\/rh\/curriculos\/\$\{row\.resumeId\}/);
  assert.match(operationsCenter, /✓ Aprovar/);
  assert.match(operationsCenter, /✕ Reprovar/);
  assert.match(operationsCenter, /value="approve"/);
  assert.match(operationsCenter, /value="not_approve"/);
  assert.match(operationsCenter, /Aprovar e avançar para/);
  assert.match(operationsCenter, /será movido\(a\) para Não aprovados/);
  assert.match(operationsCenter, /window\.confirm/);
  assert.match(operationsCenter, /row\.name/);
  assert.match(operationsCenter, /<col className="w-\[290px\]"/);
  assert.match(operationsCenter, /row\.tags\.slice\(0, 2\)/);
  assert.doesNotMatch(operationsCenter, />Marcadores</);
});

test("cada fila usa exclusivamente a etapa atual da mesma candidatura", () => {
  assert.match(
    exclusiveQueuesMigration,
    /career_job_applications_candidate_job_unique_idx[\s\S]*candidate_id, job_id/,
  );
  assert.match(
    exclusiveQueuesMigration,
    /application\.candidate_stage = p_stage[\s\S]*application\.status <> 'withdrawn'/,
  );
  assert.match(
    exclusiveQueuesMigration,
    /select application\.candidate_stage, count\(\*\)[\s\S]*group by application\.candidate_stage/,
  );
  assert.doesNotMatch(
    exclusiveQueuesMigration,
    /career_application_stage_history[\s\S]*p_stage/,
  );
});

test("aprovação e reprovação atualizam a fila sem F5", () => {
  assert.match(exclusiveQueuesMigration, /'fromStage', p_expected_stage/);
  assert.match(exclusiveQueuesMigration, /'nextStage', next_stage/);
  assert.match(exclusiveQueuesMigration, /'movedCount', moved_count/);
  assert.match(
    exclusiveQueuesMigration,
    /application\.candidate_stage <> p_expected_stage[\s\S]*candidate_stage_changed/,
  );
  assert.match(operationsCenter, /setDisplayRows/);
  assert.match(operationsCenter, /notifyCandidatePipelineMovement/);
  assert.match(operationsCenter, /router\.refresh\(\)/);
  assert.match(pipelineNav, /current\[movement\.fromStage\] - movement\.movedCount/);
  assert.match(pipelineNav, /current\[movement\.toStage\] \+ movement\.movedCount/);
});

test("ação responde após o banco e processa comunicação sem bloquear a fila", () => {
  assert.match(operationsAction, /import \{ after \} from "next\/server"/);
  assert.match(operationsAction, /after\(async \(\) =>/);
  assert.match(operationsAction, /Candidato movido para Não aprovados/);
  assert.match(operationsAction, /Candidato aprovado para/);
  assert.match(
    operationsAction,
    /Este candidato já foi movimentado\. A lista será atualizada\./,
  );
  assert.match(operationsAction, /refreshRequired: stageChanged/);
});
