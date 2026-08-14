import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateCandidateProfileCompletion,
  CANDIDATE_RESUME_MAX_BYTES,
  hasPdfMagicNumber,
} from "../src/lib/careers/profile";
import {
  candidateEducationSchema,
  candidateExperienceSchema,
  candidatePersonalProfileSchema,
} from "../src/lib/careers/profile-validation";

const validPersonalProfile = {
  fullName: "Maria da Silva",
  email: "maria@example.com",
  whatsapp: "(96) 99999-9999",
  city: "Macapá",
  state: "AP",
  professionalObjective: "Atuar na área administrativa.",
  about: "Experiência em atendimento e rotinas administrativas.",
  availability: "Segunda a sexta, manhã e tarde.",
};

test("perfil pessoal solicita somente os campos previstos para recrutamento", () => {
  assert.equal(
    candidatePersonalProfileSchema.safeParse(validPersonalProfile).success,
    true,
  );
  assert.deepEqual(
    Object.keys(candidatePersonalProfileSchema.shape).sort(),
    [
      "about",
      "availability",
      "city",
      "email",
      "fullName",
      "professionalObjective",
      "state",
      "whatsapp",
    ].sort(),
  );
});

test("experiência valida datas e permite trabalho atual", () => {
  const base = {
    company: "Empresa Exemplo",
    jobTitle: "Assistente",
    startMonth: "2023-01",
    endMonth: "2024-01",
    isCurrent: false,
    activities: "Atendimento e organização de documentos.",
  };
  assert.equal(candidateExperienceSchema.safeParse(base).success, true);
  assert.equal(
    candidateExperienceSchema.safeParse({
      ...base,
      endMonth: "",
      isCurrent: true,
    }).success,
    true,
  );
  assert.equal(
    candidateExperienceSchema.safeParse({ ...base, endMonth: "2022-12" })
      .success,
    false,
  );
});

test("formação em andamento não exige conclusão", () => {
  assert.equal(
    candidateEducationSchema.safeParse({
      educationLevel: "Graduação",
      course: "Administração",
      institution: "Instituição Exemplo",
      startMonth: "2024-02",
      endMonth: "",
      inProgress: true,
    }).success,
    true,
  );
});

test("completude mede somente preenchimento e chega a 100%", () => {
  assert.equal(
    calculateCandidateProfileCompletion({
      fullName: "Maria da Silva",
      email: "maria@example.com",
      profile: {
        whatsapp: "(96) 99999-9999",
        city: "Macapá",
        state: "AP",
        professional_objective: "Atuar na área administrativa.",
        about: "Experiência profissional.",
        availability: "Disponível pela manhã.",
      },
      experienceCount: 1,
      educationCount: 1,
      skillCount: 1,
      resumeCount: 1,
    }),
    100,
  );
});

test("currículo exige assinatura PDF e limite de 10 MB", () => {
  assert.equal(CANDIDATE_RESUME_MAX_BYTES, 10 * 1024 * 1024);
  assert.equal(hasPdfMagicNumber(new TextEncoder().encode("%PDF-1.7")), true);
  assert.equal(hasPdfMagicNumber(new TextEncoder().encode("texto")), false);
});

test("migração mantém dados por usuário, RH autorizado e bucket privado", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608140003_candidate_professional_profiles.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /candidate_id = auth\.uid\(\)/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(migration, /'candidate-resumes',[\s\S]*false,[\s\S]*10485760/);
  assert.doesNotMatch(migration, /create policy[^;]+to anon/i);
});
