import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canTransitionJob,
  currentMacapaDate,
  isJobPubliclyAvailable,
  slugifyJobValue,
} from "../src/lib/careers/jobs";
import {
  careerJobFormSchema,
  containsProhibitedJobCriteria,
} from "../src/lib/careers/job-validation";

const validJob = {
  title: "Assistente de atendimento",
  areaId: "6e36ad17-5450-4cdd-81d8-ae029d1bbd93",
  unitId: "059a9c1d-9315-4c0e-9fed-f22fef91db1c",
  positions: 2,
  location: "Macapá/AP",
  workMode: "onsite",
  workSchedule: "Segunda a sexta, em horário informado pelo RH.",
  description:
    "Oportunidade para atuação em rotinas de atendimento e organização.",
  activities: "Atender solicitações e organizar informações da área.",
  schooling: "Ensino médio completo.",
  desirableExperience: "Experiência profissional em atendimento.",
  requiredRequirements: "Comunicação clara e organização.",
  desirableRequirements: "Conhecimento de ferramentas de escritório.",
  skills: "Atendimento, comunicação e organização.",
  certifications: "",
  opensOn: "2026-08-15",
  closesOn: "2026-09-15",
};

test("vaga válida contempla todos os campos profissionais previstos", () => {
  const parsed = careerJobFormSchema.safeParse(validJob);
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.positions, 2);
  assert.equal(parsed.data.certifications, null);
});

test("quantidade de posições pode permanecer não informada", () => {
  const parsed = careerJobFormSchema.safeParse({
    ...validJob,
    positions: "",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.positions, null);
});

test("datas inválidas e critérios pessoais protegidos são rejeitados", () => {
  assert.equal(
    careerJobFormSchema.safeParse({
      ...validJob,
      closesOn: "2026-08-14",
    }).success,
    false,
  );
  assert.equal(containsProhibitedJobCriteria("idade mínima de 25 anos"), true);
  assert.equal(
    careerJobFormSchema.safeParse({
      ...validJob,
      requiredRequirements: "Idade mínima de 25 anos.",
    }).success,
    false,
  );
});

test("ciclo de status permite publicar, pausar, republicar e encerrar", () => {
  assert.equal(canTransitionJob("draft", "published"), true);
  assert.equal(canTransitionJob("published", "paused"), true);
  assert.equal(canTransitionJob("paused", "published"), true);
  assert.equal(canTransitionJob("published", "closed"), true);
  assert.equal(canTransitionJob("closed", "published"), false);
  assert.equal(canTransitionJob("draft", "paused"), false);
});

test("slug é estável e vaga pública respeita status e período", () => {
  assert.equal(
    slugifyJobValue("Técnico de Radiologia"),
    "tecnico-de-radiologia",
  );
  assert.equal(
    isJobPubliclyAvailable(
      { status: "published", opens_on: "2026-08-01", closes_on: null },
      "2026-08-15",
    ),
    true,
  );
  assert.equal(
    isJobPubliclyAvailable(
      { status: "paused", opens_on: "2026-08-01", closes_on: null },
      "2026-08-15",
    ),
    false,
  );
  assert.equal(
    isJobPubliclyAvailable(
      {
        status: "published",
        opens_on: "2026-08-01",
        closes_on: "2026-08-14",
      },
      "2026-08-15",
    ),
    false,
  );
});

test("data operacional usa o fuso de Macapá", () => {
  assert.equal(
    currentMacapaDate(new Date("2026-10-01T01:30:00.000Z")),
    "2026-09-30",
  );
});

test("migração centraliza áreas e protege publicação com RLS", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150001_careers_job_management.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /create table if not exists public\.career_job_areas/,
  );
  assert.match(migration, /create table if not exists public\.career_jobs/);
  assert.match(
    migration,
    /status in \('draft', 'published', 'paused', 'closed'\)/,
  );
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(
    migration,
    /status = 'published'[\s\S]*opens_on <= current_date/,
  );
  assert.match(migration, /\('Corpo Médico', 'corpo-medico'/);
  assert.match(migration, /\('Apoio', 'apoio'/);
  assert.doesNotMatch(migration, /create policy[^;]+for insert[^;]+to anon/i);
});

test("ações cobrem criação, edição, publicação, pausa, encerramento e duplicação", () => {
  const actions = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  for (const action of [
    "createCareerJobAction",
    "updateCareerJobAction",
    "transitionCareerJobAction",
    "duplicateCareerJobAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${action}`));
  }
  assert.match(actions, /requireHrAccess\("jobs:manage"\)/);
  assert.match(actions, /status: "draft"/);
});

test("rotas públicas exigem flag ou prévia interna autorizada", () => {
  const guard = readFileSync(
    new URL("../src/lib/careers/jobs-access.ts", import.meta.url),
    "utf8",
  );
  assert.match(guard, /isCareersPortalEnabled\(\)/);
  assert.match(guard, /hasHrPermission\(role, "jobs:manage"\)/);
  assert.match(guard, /notFound\(\)/);
});
