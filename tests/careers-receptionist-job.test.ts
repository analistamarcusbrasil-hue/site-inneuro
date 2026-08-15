import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/202608150009_publish_receptionist_job.sql",
    import.meta.url,
  ),
  "utf8",
);

test("migration publica a vaga Recepcionista sem duplicidade", () => {
  assert.match(migration, /'recepcionista'/);
  assert.match(migration, /'Recepcionista'/);
  assert.match(migration, /where slug = 'recepcao'/);
  assert.match(migration, /on conflict \(slug\) do update/);
  assert.match(migration, /status = excluded\.status/);
});

test("vaga mantém somente os dados confirmados", () => {
  assert.match(migration, /'Macapá - AP'/);
  assert.match(migration, /'Ensino Médio Completo'/);
  assert.match(migration, /date '2026-08-15'/);
  assert.match(migration, /date '2026-09-30'/);
  assert.match(migration, /positions,\s+location[\s\S]+?null,\s+'Macapá - AP'/);
  assert.doesNotMatch(migration, /sal[aá]rio|benef[ií]cio|\bCLT\b|\bPJ\b/i);
});

test("vaga e candidatura respeitam o fuso de Macapá e RLS", () => {
  assert.match(migration, /America\/Belem/);
  assert.match(migration, /public reads available jobs/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /active_application_exists/);
});

test("portal exibe detalhes e permite candidatura com perfil ainda incompleto", () => {
  const detailPage = readFileSync(
    new URL("../src/app/carreiras/vagas/[slug]/page.tsx", import.meta.url),
    "utf8",
  );
  const applicationPage = readFileSync(
    new URL(
      "../src/app/carreiras/vagas/[slug]/candidatar/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const applicationAction = readFileSync(
    new URL("../src/app/carreiras/application-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(detailPage, /Candidatar-se/);
  assert.match(detailPage, /Empresa/);
  assert.match(detailPage, /siteConfig\.name/);
  assert.match(detailPage, /Requisitos obrigatórios/);
  assert.match(detailPage, /Inscrições previstas até/);
  assert.match(applicationPage, /Atualizar perfil/);
  assert.match(applicationPage, /Enviar candidatura/);
  assert.doesNotMatch(applicationPage, /CANDIDATE_PROFILE_SUFFICIENT_PERCENT/);
  assert.match(
    applicationAction,
    /submit_career_job_application_with_logistics/,
  );
});
