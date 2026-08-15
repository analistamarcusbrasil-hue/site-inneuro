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

test("pipeline contém as seis etapas e os dois estados auxiliares", () => {
  assert.deepEqual(selectionStages, [
    "registered",
    "screening",
    "interview",
    "evaluation",
    "finalists",
    "selected",
    "talent_pool",
    "not_selected",
  ]);
  assert.equal(selectionStageLabels.registered, "Inscritos");
  assert.equal(selectionStageLabels.selected, "Selecionado");
  assert.equal(selectionStageLabels.talent_pool, "Banco de Talentos");
  assert.equal(selectionStageLabels.not_selected, "Não selecionado");
});

test("migração protege dados internos e audita toda movimentação", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150003_selection_process_workflow.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /create table if not exists public\.career_selection_processes/,
  );
  assert.match(migration, /career_selection_process_candidates/);
  assert.match(migration, /career_selection_movements/);
  assert.match(migration, /from_stage/);
  assert.match(migration, /to_stage/);
  assert.match(migration, /moved_by/);
  assert.match(migration, /moved_at/);
  assert.match(migration, /internal_note/);
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
