import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderCareerCommunication } from "../src/lib/careers/communications/templates";
import {
  mainSelectionStages,
  selectionStageApprovalLabels,
  selectionStageNext,
} from "../src/lib/careers/selection-processes";
import {
  careerStageDecisionSchema,
  careerStageEventSchema,
} from "../src/lib/careers/selection-process-validation";

const applicationId = "1bd72a78-d4da-41c6-b473-aea95eef55c6";
const jobId = "6e36ad17-5450-4cdd-81d8-ae029d1bbd93";
const variables = {
  candidateName: "Ana Souza",
  jobTitle: "Recepcionista",
  portalUrl: "https://inneuroap.com.br/carreiras",
};

test("funil avança apenas na ordem fixa das quatro etapas", () => {
  assert.deepEqual(mainSelectionStages, [
    "resume",
    "interview",
    "practical_test",
    "hiring",
  ]);
  assert.deepEqual(selectionStageNext, {
    resume: "interview",
    interview: "practical_test",
    practical_test: "hiring",
    hiring: "hired",
  });
  assert.equal(
    selectionStageApprovalLabels.practical_test,
    "APROVAR PARA CONTRATAÇÃO",
  );
  assert.equal(selectionStageApprovalLabels.hiring, "APROVAR CONTRATAÇÃO");
});

test("decisão humana aceita aprovação ou não aprovação em cada etapa ativa", () => {
  for (const expectedStage of mainSelectionStages) {
    for (const decision of ["approve", "not_approve"] as const) {
      assert.equal(
        careerStageDecisionSchema.safeParse({
          applicationId,
          jobId,
          expectedStage,
          decision,
          internalNote:
            decision === "not_approve" ? "Observação apenas do RH." : "",
        }).success,
        true,
      );
    }
  }
});

test("entrevista e teste prático exigem dados válidos de agendamento", () => {
  const base = {
    applicationId,
    jobId,
    scheduledDate: "2026-08-25",
    scheduledTime: "14:30",
    location: "INNEURO — Santa Rita",
    instructions: "Levar documento com foto.",
    internalNotes: "Confirmar presença.",
  };
  assert.equal(
    careerStageEventSchema.safeParse({ ...base, stage: "interview" }).success,
    true,
  );
  assert.equal(
    careerStageEventSchema.safeParse({ ...base, stage: "practical_test" })
      .success,
    true,
  );
  assert.equal(
    careerStageEventSchema.safeParse({
      ...base,
      stage: "interview",
      scheduledTime: "25:00",
    }).success,
    false,
  );
});

test("templates específicos comunicam cada avanço e convite", () => {
  assert.match(
    renderCareerCommunication("STAGE_1_APPROVED", variables).text,
    /2 de 4 — Entrevista/i,
  );
  assert.match(
    renderCareerCommunication("STAGE_2_APPROVED", variables).text,
    /teste prático/i,
  );
  assert.match(
    renderCareerCommunication("STAGE_3_APPROVED", variables).text,
    /4 de 4 — Contratação/i,
  );
  assert.match(
    renderCareerCommunication("FINAL_APPROVED", variables).text,
    /concluiu as 4 etapas/i,
  );
  const invite = renderCareerCommunication("PRACTICAL_TEST_INVITE", {
    ...variables,
    interviewDate: "2026-08-25",
    interviewTime: "14:30",
    location: "INNEURO — Santa Rita",
    instructions: "Chegar com 10 minutos de antecedência.",
  });
  assert.match(invite.text, /Data:|Horário:|Local:/);
});

test("Banco de Talentos só aparece na rejeição quando previamente autorizado", () => {
  const withoutConsent = renderCareerCommunication("REJECTED", variables);
  const withConsent = renderCareerCommunication("REJECTED", {
    ...variables,
    talentPoolAuthorized: true,
  });
  assert.doesNotMatch(withoutConsent.text, /Banco de Talentos/i);
  assert.match(withConsent.text, /autorizou previamente/i);
  assert.doesNotMatch(withConsent.text, /incluído automaticamente/i);
});

test("migração restringe decisões ao RH, protege histórico e expõe só contagem", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608160001_four_stage_recruitment_funnel.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /auth\.uid\(\) is null or not public\.can_manage_hr\(\)/,
  );
  assert.match(migration, /for update/);
  assert.match(migration, /invalid_candidate_stage_transition/);
  assert.match(migration, /career_application_stage_history/);
  assert.match(migration, /admin_id/);
  assert.match(migration, /get_candidate_application_stage_count/);
  assert.match(migration, /owner_id <> auth\.uid\(\)/);
  assert.match(migration, /count\(\*\)::integer/);
  assert.doesNotMatch(
    migration,
    /candidate reads application stage history|candidate.*career_application_stage_events/i,
  );
  assert.doesNotMatch(
    migration,
    /grant (update|delete).*career_application_stage_history/i,
  );
});

test("ações usam RPC atômica e chaves idempotentes por transição e convite", () => {
  const actions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /requireHrAccess\("jobs:manage"\)/);
  assert.match(actions, /decide_career_application_stage/);
  assert.match(actions, /p_internal_note:\s*parsed\.data\.internalNote/);
  assert.match(actions, /application:\$\{parsed\.data\.applicationId\}:stage:/);
  assert.match(
    actions,
    /application:\$\{parsed\.data\.applicationId\}:invite:/,
  );
  assert.match(actions, /INTERVIEW_INVITE/);
  assert.match(actions, /PRACTICAL_TEST_INVITE/);
});
