import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  matchesTalentPoolFilters,
  normalizeTalentPoolSearch,
  type TalentPoolFilters,
  type TalentPoolSearchRecord,
} from "../src/lib/careers/talent-pool";
import { talentPoolAreaSelectionSchema } from "../src/lib/careers/talent-pool-validation";

const areaId = "6e36ad17-5450-4cdd-81d8-ae029d1bbd93";
const record: TalentPoolSearchRecord = {
  candidateId: "6bd45560-d0cf-4652-9ce8-64faf2424807",
  fullName: "Candidato Exemplo",
  city: "Macapá",
  state: "AP",
  objective: "Atuação em atendimento",
  about: "Experiência com rotinas administrativas",
  availability: "Horário comercial",
  areaIds: [areaId],
  areaNames: ["Atendimento"],
  education: ["Administração Universidade Exemplo"],
  experiences: ["Assistente Empresa Exemplo atendimento ao público"],
  skills: ["Excel", "Atendimento"],
  certifications: ["Atendimento humanizado Instituição Exemplo"],
  professionalUpdatedAt: "2026-08-10T12:00:00.000Z",
};
const emptyFilters: TalentPoolFilters = {
  query: "",
  areaId: "",
  city: "",
  state: "",
  education: "",
  experience: "",
  skill: "",
  certification: "",
  availability: "",
  updatedWithinDays: null,
};

test("candidato precisa escolher ao menos uma área válida e sem duplicação", () => {
  assert.equal(talentPoolAreaSelectionSchema.safeParse([]).success, false);
  const parsed = talentPoolAreaSelectionSchema.safeParse([areaId, areaId]);
  assert.equal(parsed.success, true);
  if (parsed.success) assert.deepEqual(parsed.data, [areaId]);
});

test("busca profissional ignora acentos e combina filtros estruturados", () => {
  assert.equal(normalizeTalentPoolSearch("Macapá"), "macapa");
  assert.equal(
    matchesTalentPoolFilters(record, {
      ...emptyFilters,
      query: "administrativas",
      areaId,
      city: "macapa",
      state: "ap",
      skill: "excel",
      certification: "humanizado",
    }),
    true,
  );
  assert.equal(
    matchesTalentPoolFilters(record, { ...emptyFilters, skill: "PACS" }),
    false,
  );
});

test("filtro de atualização respeita a última mudança profissional", () => {
  const now = new Date("2026-08-15T12:00:00.000Z");
  assert.equal(
    matchesTalentPoolFilters(
      record,
      { ...emptyFilters, updatedWithinDays: 7 },
      now,
    ),
    true,
  );
  assert.equal(
    matchesTalentPoolFilters(
      record,
      { ...emptyFilters, updatedWithinDays: 3 },
      now,
    ),
    false,
  );
});

test("migração implementa consentimento, áreas compartilhadas, RLS e exclusão", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150004_inneuro_talent_pool.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /career_talent_pool_memberships/);
  assert.match(migration, /career_talent_pool_interests/);
  assert.match(migration, /references public\.career_job_areas/);
  assert.match(migration, /set_talent_pool_membership/);
  assert.match(migration, /leave_talent_pool/);
  assert.match(migration, /request_talent_pool_deletion/);
  assert.match(migration, /professional_updated_at/);
  assert.match(migration, /candidate_id = auth\.uid\(\)/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(migration, /status = 'deletion_requested'/);
  assert.doesNotMatch(
    migration,
    /\b(cpf|rg|religiao|religião|raca|raça|sexo|estado_civil)\b/i,
  );
});

test("painel exige permissão do Banco de Talentos e não expõe nota interna", () => {
  const page = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/talentos/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const detail = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/talentos/[id]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /requireHrAccess\("talent-bank:manage"\)/);
  assert.match(detail, /requireHrAccess\("talent-bank:manage"\)/);
  assert.match(page, /career_job_areas/);
  assert.match(detail, /career_selection_process_candidates/);
  assert.doesNotMatch(detail, /internal_note/);
  assert.doesNotMatch(
    page,
    /\b(cpf|rg|religiao|religião|raca|raça|sexo|estado civil|idade)\b/i,
  );
});
