import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("migration separa definitivamente candidatos e operadores", async () => {
  const migration = await read(
    "../supabase/migrations/20260821184327_separate_candidates_staff_and_hr_evaluators.sql",
  );
  assert.match(migration, /candidate_operator_overlap_requires_manual_review/);
  assert.match(migration, /account_type = 'candidate'[\s\S]*return new/);
  assert.match(migration, /account_type not in \('staff', 'admin'\)/);
  assert.match(migration, /profiles_reject_candidates/);
  assert.match(migration, /candidate_accounts_reject_operators/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.profiles/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.candidate_accounts/i);
});

test("hr.evaluate é independente de hr.view e exigido para avaliação", async () => {
  const [permissions, hrPermissions, actions] = await Promise.all([
    read("../src/lib/admin/permissions.ts"),
    read("../src/lib/careers/hr-permissions.ts"),
    read("../src/app/admin/(protected)/rh/avaliacoes/actions.ts"),
  ]);
  assert.match(permissions, /"hr\.evaluate"/);
  assert.match(permissions, /evaluator: \["hr\.view", "hr\.evaluate"\]/);
  assert.match(
    hrPermissions,
    /hasAdminPermission\(adminProfile, "hr\.evaluate"\)/,
  );
  assert.match(hrPermissions, /viewer: new Set\(\["dashboard:view"\]\)/);
  assert.match(actions, /hasAdminPermission\(profile, "hr\.evaluate"\)/);
  assert.match(actions, /career_application_evaluators/);
});

test("avaliadores e responsáveis são operadores ativos autorizados", async () => {
  const [helper, actions, page, migration] = await Promise.all([
    read("../src/lib/careers/operational-users.ts"),
    read("../src/app/admin/(protected)/rh/avaliacoes/actions.ts"),
    read("../src/app/admin/(protected)/rh/avaliacoes/[applicationId]/page.tsx"),
    read(
      "../supabase/migrations/20260821184327_separate_candidates_staff_and_hr_evaluators.sql",
    ),
  ]);
  assert.match(helper, /from\("candidate_accounts"\)/);
  assert.match(helper, /\.eq\("active", true\)/);
  assert.match(actions, /getOperationalEvaluator/);
  assert.match(page, /listOperationalEvaluators/);
  assert.match(migration, /operational_evaluator_required/);
  assert.match(migration, /career_candidate_interviews_require_operator/);
});

test("gestão administrativa de currículo preserva snapshots e audita ações", async () => {
  const [actions, page, migration] = await Promise.all([
    read("../src/app/admin/(protected)/rh/candidatos/actions.ts"),
    read("../src/app/admin/(protected)/rh/candidatos/[id]/page.tsx"),
    read(
      "../supabase/migrations/20260821184327_separate_candidates_staff_and_hr_evaluators.sql",
    ),
  ]);
  assert.match(actions, /requireAdminPermission\("hr\.manage"\)/);
  assert.match(actions, /admin_replace_candidate_resume/);
  assert.match(actions, /admin_delete_candidate_resume/);
  assert.match(actions, /CANDIDATE_PROFILE_UPDATED_BY_ADMIN/);
  assert.match(actions, /CANDIDATE_RESUME_REPLACED_BY_ADMIN/);
  assert.match(actions, /CANDIDATE_RESUME_DELETED_BY_ADMIN/);
  assert.doesNotMatch(actions, /career_job_applications/);
  assert.match(page, /Alteração administrativa/);
  assert.match(page, /Excluir currículo/);
  assert.match(migration, /snapshots históricos/);
});

test("cadastro classifica candidatos e operadores sem conceder autorização por metadata", async () => {
  const [candidateActions, adminActions] = await Promise.all([
    read("../src/app/carreiras/actions.ts"),
    read("../src/app/admin/actions.ts"),
  ]);
  assert.match(
    candidateActions,
    /app_metadata: \{ account_type: "candidate" \}/,
  );
  assert.match(adminActions, /app_metadata: \{ account_type: "staff" \}/);
  assert.match(adminActions, /candidate-email/);
  assert.match(adminActions, /from\("candidate_accounts"\)/);
});
