import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCareerApplicationEmail } from "../src/lib/careers/application-email";

test("e-mail de nova candidatura usa o destinatário oficial sem anexar currículo", () => {
  const message = buildCareerApplicationEmail({
    applicationId: "11111111-1111-4111-8111-111111111111",
    jobId: "22222222-2222-4222-8222-222222222222",
    jobTitle: "Atendimento",
    candidateName: "Maria & Silva",
    candidateEmail: "maria@example.com",
    submittedAt: new Date("2026-08-15T15:00:00.000Z"),
    siteUrl: "https://inneuroap.com.br",
  });
  assert.equal(message.subject, "[CARREIRAS] Nova candidatura — Atendimento");
  assert.equal(message.replyTo, "maria@example.com");
  assert.match(message.adminUrl, /\/admin\/rh\/vagas\/22222222/);
  assert.match(message.html, /Maria &amp; Silva/);
  assert.doesNotMatch(message.html, /currículo.*anexo/i);
});

test("migração registra entrega e restringe leitura ao RH", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150008_career_application_notifications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /career_application_notifications/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(migration, /grant all .*service_role/);
  assert.doesNotMatch(migration, /resume|curriculum|profile_snapshot/i);
});

test("env e ação conectam o envio ao fluxo confirmado", () => {
  const env = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const action = readFileSync(
    new URL("../src/app/carreiras/application-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    env,
    /CAREERS_APPLICATION_RECIPIENT_EMAIL=adm@inneuroap\.com\.br/,
  );
  assert.match(action, /notifyNewCareerApplication/);
  assert.match(action, /data: applicationId/);
});
