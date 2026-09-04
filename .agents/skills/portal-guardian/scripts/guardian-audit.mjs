import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    "supabase/migrations/20260904010518_portal_guardian_foundation.sql",
  ),
  "utf8",
);
const edge = readFileSync(
  resolve("supabase/functions/portal-guardian/index.ts"),
  "utf8",
);
const failures = [];
if (/delete\s+from\s+storage\.objects/i.test(migration))
  failures.push("Exclusão SQL direta em storage.objects.");
if (!/default false/i.test(migration))
  failures.push("Switches não iniciam desligados.");
if (!/p_dry_run/i.test(migration) || !/dryRun/i.test(edge))
  failures.push("Dry run ausente.");
if (!/\.storage\s*\.from\("scheduling-documents"\)\s*\.remove/s.test(edge))
  failures.push("Storage API de agendamentos ausente.");
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Portal Guardian: guardas estáticas aprovadas.");
