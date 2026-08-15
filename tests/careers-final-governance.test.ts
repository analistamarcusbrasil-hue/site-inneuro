import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildCareerReportRows,
  type CareerReportApplication,
  type CareerReportJob,
} from "../src/lib/careers/reports";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608150007_careers_units_logistics_lgpd.sql",
    import.meta.url,
  ),
  "utf8",
);

test("migração final ativa RLS e restringe tabelas sensíveis", () => {
  for (const table of [
    "company_units",
    "career_application_logistics",
    "candidate_consents",
    "candidate_data_deletion_requests",
    "career_retention_policies",
  ]) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }
  assert.match(migration, /candidate_id = auth\.uid\(\)/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(migration, /application_consent_required/);
  assert.match(
    migration,
    /revoke execute on function public\.submit_career_job_application\(uuid\)[\s\S]*from public, anon, authenticated/,
  );
});

test("currículos permanecem privados e o acesso administrativo é auditado", () => {
  const profileMigration = readFileSync(
    new URL(
      "../supabase/migrations/202608140003_candidate_professional_profiles.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const route = readFileSync(
    new URL(
      "../src/app/api/admin/rh/curriculos/[id]/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(profileMigration, /'candidate-resumes'[\s\S]*false/);
  assert.match(route, /require.*candidates:manage|hasHrPermission/);
  assert.match(route, /candidate_resume_accessed/);
  assert.match(route, /createSignedUrl\([^,]+, 120\)/);
});

test("relatório aplica filtros sem incluir contato ou currículo", () => {
  const jobs: CareerReportJob[] = [
    { id: "job-1", title: "Vaga 1", area_id: "area-1", unit_id: "unit-1" },
    { id: "job-2", title: "Vaga 2", area_id: "area-2", unit_id: null },
  ];
  const applications: CareerReportApplication[] = [
    {
      id: "app-1",
      job_id: "job-1",
      status: "submitted",
      source: "site_inneuro",
      submitted_at: "2026-08-15T12:00:00.000Z",
    },
    {
      id: "app-2",
      job_id: "job-2",
      status: "screening",
      source: "referral",
      submitted_at: "2026-08-10T12:00:00.000Z",
    },
  ];
  const rows = buildCareerReportRows({
    applications,
    jobs,
    processCandidates: [],
    logistics: [],
    filters: { unidade: "unit-1", status: "submitted" },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.id, "app-1");
  assert.doesNotMatch(
    JSON.stringify(rows),
    /email|phone|whatsapp|resume|curriculo/i,
  );
});

test("feature flag do portal continua desabilitada no exemplo de ambiente", () => {
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(env, /^CAREERS_PORTAL_ENABLED=false$/m);
});
