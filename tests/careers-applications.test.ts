import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applicationStatusLabels,
  canTransitionApplication,
  canWithdrawApplication,
  careerApplicationSnapshotSchema,
} from "../src/lib/careers/applications";

test("status público e transições administrativas seguem o fluxo definido", () => {
  assert.equal(applicationStatusLabels.submitted, "Enviada");
  assert.equal(applicationStatusLabels.screening, "Em triagem");
  assert.equal(applicationStatusLabels.in_process, "Em processo");
  assert.equal(applicationStatusLabels.finalized, "Finalizada");
  assert.equal(applicationStatusLabels.withdrawn, "Retirada");
  assert.equal(canTransitionApplication("submitted", "screening"), true);
  assert.equal(canTransitionApplication("screening", "submitted"), false);
  assert.equal(canTransitionApplication("withdrawn", "in_process"), false);
  assert.equal(canWithdrawApplication("in_process"), true);
  assert.equal(canWithdrawApplication("finalized"), false);
});

test("snapshot profissional exige estrutura conhecida e não contém notas internas", () => {
  const snapshot = {
    captured_at: "2026-08-15T12:00:00.000Z",
    candidate: { full_name: "Maria Silva", email: "maria@example.com" },
    profile: {
      whatsapp: null,
      city: "Macapá",
      state: "AP",
      professional_objective: null,
      about: null,
      availability: "Comercial",
    },
    experiences: [],
    education: [],
    certifications: [],
    skills: ["Atendimento"],
    resume: null,
  };
  assert.equal(
    careerApplicationSnapshotSchema.safeParse(snapshot).success,
    true,
  );
  assert.equal("internal_notes" in snapshot, false);
});

test("migração cria snapshot, bloqueia duplicidade ativa, aplica RLS e audita status", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150002_careers_job_applications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /create table if not exists public\.career_job_applications/,
  );
  assert.match(migration, /profile_snapshot jsonb not null/);
  assert.match(migration, /where status not in \('finalized', 'withdrawn'\)/);
  assert.match(migration, /submit_career_job_application/);
  assert.match(migration, /withdraw_career_job_application/);
  assert.match(migration, /candidate_id = auth\.uid\(\)/);
  assert.match(migration, /career_job_application_history/);
  assert.doesNotMatch(migration, /internal_notes/i);
});

test("ações separam envio do candidato e atualização protegida do RH", () => {
  const candidateActions = readFileSync(
    new URL("../src/app/carreiras/application-actions.ts", import.meta.url),
    "utf8",
  );
  const adminActions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(candidateActions, /requireCandidateSession\(\)/);
  assert.match(candidateActions, /submit_career_job_application/);
  assert.match(adminActions, /requireHrAccess\("jobs:manage"\)/);
  assert.match(adminActions, /audit_logs/);
});
