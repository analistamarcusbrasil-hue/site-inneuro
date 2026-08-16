import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CareerApplicationSnapshot } from "../src/lib/careers/applications";
import type { CareerJob } from "../src/lib/careers/jobs";
import {
  calculateExplainableMatch,
  defaultMatchCriteria,
  getMatchAdherenceBand,
  matchMatrixCriteriaSchema,
} from "../src/lib/careers/matching";
import { matchMatrixFormSchema } from "../src/lib/careers/matching-validation";

const job: CareerJob = {
  id: "6e36ad17-5450-4cdd-81d8-ae029d1bbd93",
  slug: "assistente-atendimento",
  title: "Assistente de atendimento",
  area_id: "5c8491ed-c79e-4ad9-a926-ceca7ca27aec",
  positions: 1,
  location: "Macapá/AP",
  work_mode: "onsite",
  work_schedule: "Horário comercial",
  description: "Atuação em clínica com atendimento ao público.",
  activities: "Atendimento e suporte a convênios.",
  schooling: "Ensino médio completo.",
  desirable_experience: "Experiência em atendimento em clínica.",
  required_requirements: "Comunicação e organização.",
  desirable_requirements: null,
  skills: "Convênios, Excel",
  certifications: "COREN ativo quando aplicável.",
  opens_on: "2026-08-15",
  closes_on: null,
  status: "published",
  published_at: "2026-08-15T12:00:00.000Z",
  created_by: "34067c18-ad08-4f92-995f-88d0fd468c10",
  updated_by: "34067c18-ad08-4f92-995f-88d0fd468c10",
  published_by: "34067c18-ad08-4f92-995f-88d0fd468c10",
  created_at: "2026-08-15T12:00:00.000Z",
  updated_at: "2026-08-15T12:00:00.000Z",
  area: {
    id: "5c8491ed-c79e-4ad9-a926-ceca7ca27aec",
    name: "Atendimento",
    slug: "atendimento",
    is_active: true,
  },
};

const snapshot: CareerApplicationSnapshot = {
  captured_at: "2026-08-15T12:00:00.000Z",
  candidate: { full_name: "Candidato Exemplo", email: "candidato@example.com" },
  profile: {
    whatsapp: null,
    city: "Macapá",
    state: "AP",
    professional_objective: "Atendimento",
    about: "Experiência profissional em clínica.",
    availability: "Disponível em horário comercial.",
  },
  experiences: [
    {
      company: "Clínica Exemplo",
      job_title: "Atendente",
      start_date: "2022-01-01",
      end_date: null,
      is_current: true,
      activities: "Atendimento ao público e suporte a convênios.",
    },
  ],
  education: [
    {
      education_level: "Ensino médio",
      course: "Formação geral",
      institution: "Escola Exemplo",
      start_date: "2018-01-01",
      end_date: "2020-12-01",
      in_progress: false,
    },
  ],
  certifications: [
    {
      name: "COREN informado pelo candidato",
      institution: "Conselho regional",
      completion_year: 2024,
      expires_at: null,
    },
  ],
  skills: ["Convênios"],
  resume: null,
};

test("matriz exige sete critérios únicos com pesos totalizando 100%", () => {
  assert.equal(
    matchMatrixCriteriaSchema.safeParse(defaultMatchCriteria).success,
    true,
  );
  assert.equal(
    matchMatrixFormSchema.safeParse({
      jobId: job.id,
      weights: {
        related_experience: 25,
        technical_skills: 25,
        education: 15,
        sector_experience: 15,
        certifications: 10,
        availability: 9,
        operational_compatibility: 10,
      },
    }).success,
    false,
  );
});

test("calcula aderência específica à vaga e hard skills separadamente", () => {
  const result = calculateExplainableMatch({
    job,
    snapshot,
    criteria: defaultMatchCriteria,
  });
  assert.equal(result.hardSkillsScore, 50);
  assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
  assert.equal(result.sourcePolicy, "confirmed_application_snapshot");
  assert.equal(result.items.length, 7);
  assert.ok(result.items.some((item) => item.evidence.length > 0));
});

test("compatibilidade operacional não usa meio de transporte ou vale-transporte", () => {
  const result = calculateExplainableMatch({
    job,
    snapshot,
    criteria: defaultMatchCriteria,
    logistics: {
      application_id: "b748c94a-e6b9-4be2-885a-3e6f30ecb616",
      unit_id: null,
      unit_snapshot: null,
      candidate_neighborhood_snapshot: "Centro",
      candidate_city_snapshot: "Macapá",
      candidate_state_snapshot: "AP",
      commute_feasibility: "yes",
      commute_time: "up_to_30",
      transport_modes: ["public_transport"],
      transit_benefit: "yes",
      created_at: "2026-08-15T12:00:00.000Z",
    },
  });
  const operational = result.items.find(
    (item) => item.key === "operational_compatibility",
  );
  assert.equal(operational?.score, 100);
  assert.doesNotMatch(
    JSON.stringify(operational),
    /public_transport|transit_benefit|vale-transporte/i,
  );
});

test("registro profissional informado sempre requer validação oficial", () => {
  const result = calculateExplainableMatch({
    job,
    snapshot,
    criteria: defaultMatchCriteria,
  });
  const certification = result.items.find(
    (item) => item.key === "certifications",
  );
  assert.equal(certification?.status, "requires_validation");
  assert.match(certification?.pointsToVerify.join(" ") ?? "", /fonte oficial/i);
});

test("informação ausente é marcada como não informada sem invenção", () => {
  const result = calculateExplainableMatch({
    job,
    snapshot: { ...snapshot, certifications: [] },
    criteria: defaultMatchCriteria,
  });
  const certification = result.items.find(
    (item) => item.key === "certifications",
  );
  assert.equal(certification?.status, "not_informed");
  assert.deepEqual(certification?.evidence, []);
  const informed = result.items.filter(
    (item) => item.status !== "not_informed",
  );
  const expected = Math.round(
    (informed.reduce((total, item) => total + item.weightedScore, 0) /
      informed.reduce((total, item) => total + item.weight, 0)) *
      100,
  );
  assert.equal(result.overallScore, expected);
  assert.ok(result.informationCoverage < 100);
});

test("faixas do relatório são transparentes e incluem não calculados em análise", () => {
  assert.equal(getMatchAdherenceBand(82), "high");
  assert.equal(getMatchAdherenceBand(60), "intermediate");
  assert.equal(getMatchAdherenceBand(30), "review");
  assert.equal(getMatchAdherenceBand(null), "review");
  assert.equal(getMatchAdherenceBand(95, 20), "review");
});

test("migração preserva matriz, versão, evidências e histórico imutável", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150005_explainable_candidate_job_matching.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /career_job_match_matrices/);
  assert.match(migration, /career_application_match_runs/);
  assert.match(migration, /matrix_version/);
  assert.match(migration, /overall_score/);
  assert.match(migration, /hard_skills_score/);
  assert.match(migration, /matching_history_is_immutable/);
  assert.match(migration, /confirmed_application_snapshot/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.doesNotMatch(migration, /candidate reads.*match/i);
});

test("ações não alteram status nem rejeitam candidaturas automaticamente", () => {
  const actions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/aderencia/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(actions, /requireHrAccess\("jobs:manage"\)/);
  assert.match(actions, /career_application_match_runs/);
  assert.doesNotMatch(actions, /\.update\(\{[\s\S]{0,200}status:/);
  assert.doesNotMatch(actions, /reject|rejeit|aprova|selected/iu);
});

test("implementação não contém critérios pessoais protegidos", () => {
  const matching = readFileSync(
    new URL("../src/lib/careers/matching.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    matching,
    /\b(sexo|raça|raca|cor|religião|religiao|fotografia|aparência|aparencia|orientação sexual|orientacao sexual|estado civil|gravidez|informações médicas|informacoes medicas)\b/iu,
  );
});
