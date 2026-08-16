import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canManageSelectionCandidates,
  canTransitionSelectionProcess,
  selectionStageLabels,
  selectionStages,
} from "../src/lib/careers/selection-processes";
import { selectionProcessFormSchema } from "../src/lib/careers/selection-process-validation";

test("processo valida vaga, nome e período", () => {
  const valid = {
    name: "Processo Atendimento — Setembro 2026",
    jobId: "6e36ad17-5450-4cdd-81d8-ae029d1bbd93",
    startsOn: "2026-09-01",
    endsOn: "2026-09-30",
  };
  assert.equal(selectionProcessFormSchema.safeParse(valid).success, true);
  assert.equal(
    selectionProcessFormSchema.safeParse({
      ...valid,
      endsOn: "2026-08-31",
    }).success,
    false,
  );
});

test("ciclo permite abrir, iniciar, encerrar e cancelar sem reabrir finalizados", () => {
  assert.equal(canTransitionSelectionProcess("draft", "open"), true);
  assert.equal(canTransitionSelectionProcess("open", "in_progress"), true);
  assert.equal(canTransitionSelectionProcess("in_progress", "closed"), true);
  assert.equal(canTransitionSelectionProcess("draft", "cancelled"), true);
  assert.equal(canTransitionSelectionProcess("closed", "open"), false);
  assert.equal(canManageSelectionCandidates("in_progress"), true);
  assert.equal(canManageSelectionCandidates("draft"), false);
  assert.equal(canManageSelectionCandidates("cancelled"), false);
});

test("pipeline contém quatro etapas e dois resultados finais", () => {
  assert.deepEqual(selectionStages, [
    "resume",
    "interview",
    "practical_test",
    "hiring",
    "hired",
    "not_approved",
  ]);
  assert.equal(selectionStageLabels.resume, "Currículo");
  assert.equal(selectionStageLabels.practical_test, "Teste Prático");
  assert.equal(selectionStageLabels.hired, "Contratado");
  assert.equal(selectionStageLabels.not_approved, "Não aprovado");
});

test("migração protege dados internos e audita toda movimentação", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608160001_four_stage_recruitment_funnel.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /create table if not exists public\.career_application_stage_history/,
  );
  assert.match(migration, /decide_career_application_stage/);
  assert.match(migration, /from_stage/);
  assert.match(migration, /to_stage/);
  assert.match(migration, /admin_id/);
  assert.match(migration, /created_at/);
  assert.match(migration, /internal_notes/);
  assert.match(migration, /using \(public\.can_manage_hr\(\)\)/);
  assert.doesNotMatch(migration, /candidate reads selection/i);
  assert.doesNotMatch(migration, /score/i);
});

test("ações exigem permissão de processos e registram decisões humanas", () => {
  const actions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/processos/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /requireHrAccess\("processes:manage"\)/);
  assert.match(actions, /createSelectionProcessAction/);
  assert.match(actions, /transitionSelectionProcessAction/);
  assert.match(actions, /moveSelectionCandidateAction/);
  assert.match(actions, /saveSelectionCandidateNoteAction/);
  assert.match(actions, /audit_logs/);
  assert.doesNotMatch(actions, /automatic.*score|score.*automatic/i);
});
