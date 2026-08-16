import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { careerStageDecisionSchema } from "../src/lib/careers/selection-process-validation";

const applicationId = "1bd72a78-d4da-41c6-b473-aea95eef55c6";
const jobId = "6e36ad17-5450-4cdd-81d8-ae029d1bbd93";

test("reprovação aceita observação interna opcional sem exceder o limite", () => {
  assert.equal(
    careerStageDecisionSchema.safeParse({
      applicationId,
      jobId,
      expectedStage: "interview",
      decision: "not_approve",
      internalNote: "Avaliação registrada internamente.",
    }).success,
    true,
  );
  assert.equal(
    careerStageDecisionSchema.safeParse({
      applicationId,
      jobId,
      expectedStage: "interview",
      decision: "not_approve",
      internalNote: "x".repeat(4001),
    }).success,
    false,
  );
});

test("painel mostra as duas decisões principais e confirma a transição", () => {
  const panel = readFileSync(
    new URL(
      "../src/components/admin/career-stage-decision-panel.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(panel, /Decisão desta etapa/i);
  assert.match(panel, /REPROVAR CANDIDATO/);
  assert.match(panel, /CONFIRMAR APROVAÇÃO/);
  assert.match(panel, /CONFIRMAR REPROVAÇÃO/);
  assert.match(panel, /Etapa atual/);
  assert.match(panel, /Próxima/);
  assert.match(panel, /name="internal_note"/);
  assert.match(panel, /Não será enviado ao candidato/i);
  assert.match(panel, /useFormStatus/);

  const detailPage = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/[applicationId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(detailPage, /EM ANÁLISE/);
  assert.match(detailPage, /APROVADO PARA PRÓXIMA FASE/);
  assert.match(detailPage, /REPROVADO/);
  assert.match(detailPage, /CONTRATADO/);
});

test("migration numera vagas, impede reutilização e bloqueia toda duplicidade", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608160004_career_decisions_vacancy_numbers.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /career_vacancy_number_seq/);
  assert.match(migration, /INN-%s-%s/);
  assert.match(migration, /vacancy_number set not null/);
  assert.match(migration, /career_jobs_vacancy_number_unique_idx/);
  assert.match(migration, /vacancy_number_is_immutable/);
  assert.match(
    migration,
    /career_job_applications_candidate_job_unique_idx[\s\S]*\(candidate_id, job_id\)/,
  );
  assert.doesNotMatch(
    migration,
    /career_job_applications_candidate_job_unique_idx[\s\S]{0,150}where\s+status/i,
  );
  assert.doesNotMatch(migration, /\btruncate\b|delete\s+from/i);
});

test("decisão atômica registra referência, nota, gestor e auditoria", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608160004_career_decisions_vacancy_numbers.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /add column if not exists candidate_id uuid/);
  assert.match(migration, /add column if not exists job_id uuid/);
  assert.match(migration, /add column if not exists vacancy_number text/);
  assert.match(migration, /add column if not exists internal_note text/);
  assert.match(migration, /for update of application/);
  assert.match(migration, /candidate_stage_changed/);
  assert.match(migration, /CANDIDATE_APPROVED_STAGE/);
  assert.match(migration, /CANDIDATE_REJECTED/);
  assert.match(migration, /CANDIDATE_HIRED/);
  assert.match(migration, /actor_id[\s\S]*auth\.uid\(\)/);
  assert.match(migration, /vacancy_number[\s\S]*vacancy_reference/);
});

test("portal usa a mesma vaga para bloquear nova candidatura e preservar histórico", () => {
  const reviewPage = readFileSync(
    new URL(
      "../src/app/carreiras/vagas/[slug]/candidatar/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const publicPage = readFileSync(
    new URL("../src/app/carreiras/vagas/[slug]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(reviewPage, /Você já possui uma candidatura para esta vaga\./);
  assert.doesNotMatch(reviewPage, /activeApplication/);
  assert.match(reviewPage, /existingApplication/);
  assert.match(reviewPage, /Esta vaga não está mais recebendo candidaturas\./);
  assert.match(publicPage, /job\.vacancy_number/);
  assert.match(publicPage, /Esta vaga não está mais recebendo candidaturas\./);
});

test("observação interna não é encaminhada ao serviço de e-mail", () => {
  const actions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const rejectedTemplate = readFileSync(
    new URL(
      "../src/lib/careers/communications/templates/rejected.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /p_internal_note:\s*parsed\.data\.internalNote/);
  assert.doesNotMatch(actions, /fields:\s*\{[\s\S]*?internalNote/);
  assert.doesNotMatch(rejectedTemplate, /internalNote|internal_note/);
});
