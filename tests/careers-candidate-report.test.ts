import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CareerJobApplication } from "../src/lib/careers/applications";
import {
  buildJobCandidateReportRows,
  filterAndSortJobCandidateReport,
  summarizeJobCandidateReport,
} from "../src/lib/careers/job-candidate-report";

const snapshot = {
  captured_at: "2026-08-16T12:00:00.000Z",
  candidate: { full_name: "Ana Ribeiro", email: "ana@example.com" },
  profile: {
    whatsapp: null,
    city: "Macapá",
    state: "AP",
    professional_objective: "Recepção",
    about: "Atuação com atendimento.",
    availability: "Disponibilidade de horário.",
  },
  experiences: [
    {
      company: "Empresa Exemplo",
      job_title: "Recepcionista",
      start_date: "2022-01-01",
      end_date: null,
      is_current: true,
      activities: "Atendimento ao público e orientação de clientes.",
    },
  ],
  education: [
    {
      education_level: "Ensino médio",
      course: "Ensino Médio Completo",
      institution: "Escola Exemplo",
      start_date: "2018-01-01",
      end_date: "2020-01-01",
      in_progress: false,
    },
  ],
  certifications: [],
  skills: ["Comunicação", "Organização"],
  resume: {
    original_name: "curriculo.pdf",
    size_bytes: 1000,
    mime_type: "application/pdf" as const,
    version: 1,
    created_at: "2026-08-16T12:00:00.000Z",
  },
};

const application = {
  id: "1bd72a78-d4da-41c6-b473-aea95eef55c6",
  candidate_id: "8dd5709e-cb5b-4d78-8f1c-5ebfe5b2f4f0",
  status: "submitted" as const,
  candidate_stage: "registered" as const,
  profile_snapshot: snapshot,
  submitted_at: "2026-08-16T12:00:00.000Z",
} satisfies Pick<
  CareerJobApplication,
  | "id"
  | "candidate_id"
  | "status"
  | "candidate_stage"
  | "profile_snapshot"
  | "submitted_at"
>;

test("relatório usa o snapshot estruturado e identifica evidências profissionais", () => {
  const rows = buildJobCandidateReportRows({
    applications: [application],
    matchRuns: [],
    resumes: [
      {
        id: "e76b90df-335e-4809-bcd6-b88e039976db",
        candidate_id: application.candidate_id,
        version: 1,
      },
    ],
    jobTitle: "Recepcionista",
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].education, "Ensino médio — Ensino Médio Completo");
  assert.equal(rows[0].hasCustomerServiceExperience, true);
  assert.equal(rows[0].hasSimilarRoleExperience, true);
  assert.deepEqual(rows[0].skills, ["Comunicação", "Organização"]);
  assert.equal(rows[0].resumeId, "e76b90df-335e-4809-bcd6-b88e039976db");
});

test("relatório filtra por critérios profissionais e resume faixas", () => {
  const rows = buildJobCandidateReportRows({
    applications: [application],
    matchRuns: [],
    resumes: [],
    jobTitle: "Recepcionista",
  });
  assert.equal(
    filterAndSortJobCandidateReport(rows, {
      education: "informed",
      customerService: "yes",
      similarRole: "yes",
      stage: "registered",
    }).length,
    1,
  );
  assert.equal(
    filterAndSortJobCandidateReport(rows, {
      customerService: "not_identified",
    }).length,
    0,
  );
  assert.deepEqual(summarizeJobCandidateReport(rows), {
    total: 1,
    high: 0,
    intermediate: 0,
    review: 1,
  });
});

test("painel expõe relatório explicável, filtros e currículo privado", () => {
  const page = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /Perfis dos candidatos/);
  assert.match(page, /Alta aderência/);
  assert.match(page, /Aderência intermediária/);
  assert.match(page, /Requer análise/);
  assert.match(page, /name="escolaridade"/);
  assert.match(page, /name="atendimento"/);
  assert.match(page, /name="funcao"/);
  assert.match(page, /name="etapa"/);
  assert.match(page, /\/api\/admin\/rh\/curriculos\//);
});
