import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  classifyProtectedPdf,
  hasMinimumSavings,
  isSchedulingAutoCloseEligible,
  retentionDueAt,
} from "../src/lib/portal-guardian/policy";

test("mantém 19 dias aberto e torna 20 dias elegível", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");
  const base = {
    completedAt: null,
    deletedAt: null,
    workflowStatus: "NOVO",
    now,
  };
  assert.equal(
    isSchedulingAutoCloseEligible({
      ...base,
      createdAt: "2026-08-15T12:00:01.000Z",
    }),
    false,
  );
  assert.equal(
    isSchedulingAutoCloseEligible({
      ...base,
      createdAt: "2026-08-14T12:00:00.000Z",
    }),
    true,
  );
  assert.equal(
    isSchedulingAutoCloseEligible({
      ...base,
      createdAt: "2026-08-01T12:00:00.000Z",
      completedAt: now.toISOString(),
    }),
    false,
  );
});

test("retenção começa no completed_at e vence sete dias depois", () => {
  assert.equal(
    retentionDueAt("2026-09-03T12:00:00.000Z").toISOString(),
    "2026-09-10T12:00:00.000Z",
  );
});

test("detecta PDF assinado e criptografado sem alterar bytes", () => {
  const signed = new TextEncoder().encode(
    "%PDF /ByteRange [0 10 20 30] /Contents <abc>",
  );
  const encrypted = new TextEncoder().encode("%PDF /Encrypt 9 0 R");
  assert.equal(classifyProtectedPdf(signed), "SKIPPED_SIGNED");
  assert.equal(classifyProtectedPdf(encrypted), "SKIPPED_ENCRYPTED");
  assert.equal(
    classifyProtectedPdf(new TextEncoder().encode("%PDF normal")),
    null,
  );
});

test("exige ganho absoluto ou percentual mínimo", () => {
  assert.equal(hasMinimumSavings(4_000_000, 3_700_000, 10, 200_000), true);
  assert.equal(hasMinimumSavings(1_000_000, 850_000, 10, 200_000), true);
  assert.equal(hasMinimumSavings(1_000_000, 950_000, 10, 200_000), false);
  assert.equal(hasMinimumSavings(1_000_000, 1_010_000, 10, 200_000), false);
});

test("migração nasce desligada, idempotente e sem exclusão SQL de Storage", () => {
  const sql = readFileSync(
    "supabase/migrations/20260904010518_portal_guardian_foundation.sql",
    "utf8",
  );
  assert.doesNotMatch(sql, /delete\s+from\s+storage\.objects/i);
  assert.match(sql, /auto_close_enabled boolean not null default false/i);
  assert.match(sql, /auto_purge_enabled boolean not null default false/i);
  assert.match(sql, /resume_optimizer_enabled boolean not null default false/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /AUTO_CLOSED_BY_SYSTEM_TIMEOUT/);
  assert.match(sql, /service_team_timeout/);
  assert.match(sql, /MISSING_ORIGINAL/);
  assert.match(sql, /storage_integrity_checked_at/);
  assert.match(sql, /if not enabled then return; end if;/i);
});

test("hotfix impede claim ativo quando purge está desligado", () => {
  const sql = readFileSync(
    "supabase/migrations/20260904021500_portal_guardian_claim_guard.sql",
    "utf8",
  );
  assert.match(sql, /if coalesce\(p_dry_run,true\) then/i);
  assert.match(sql, /if not enabled then return; end if;/i);
  assert.match(sql, /for update of d skip locked/i);
});

test("purge ignora referências já ausentes do Storage", () => {
  const sql = readFileSync(
    "supabase/migrations/20260904110814_portal_guardian_skip_missing_purge.sql",
    "utf8",
  );
  assert.match(
    sql,
    /storage_integrity_status in \('AVAILABLE','MISSING_PREVIEW'\)/i,
  );
  assert.doesNotMatch(sql, /delete\s+from\s+storage\.objects/i);
});

test("scanner não classifica arquivos do plano de controle como órfãos", () => {
  const source = readFileSync(
    "supabase/functions/portal-guardian/index.ts",
    "utf8",
  );
  assert.match(source, /!path\.startsWith\("uploads\/"\)/);
  assert.match(source, /!path\.startsWith\("corrections\/"\)/);
  assert.match(source, /documentRows\s*\.filter\(\(row\) => !row\.purged_at\)/);
});

test("cron diário é compatível com Vercel Hobby e alerta após 26 horas", () => {
  const vercel = readFileSync("vercel.json", "utf8");
  const sql = readFileSync(
    "supabase/migrations/20260904103500_portal_guardian_daily_cadence.sql",
    "utf8",
  );
  assert.match(vercel, /"schedule": "7 6 \* \* \*"/);
  assert.match(sql, /interval '26 hours'/);
  assert.match(sql, /interval '1 day'/);
});
