import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adminPermissions,
  canOverrideSchedulingAssignment,
  hasAdminPermission,
  permissionsForProfile,
  permissionsToModuleLabels,
  type AdminPermission,
} from "../src/lib/admin/permissions";
import type { AdminProfile } from "../src/types/cms";

function profile(
  permissions: AdminPermission[],
  overrides: Partial<AdminProfile> = {},
): AdminProfile {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    full_name: "Usuário de teste",
    email: "teste@example.com",
    role: "editor",
    hr_role: null,
    active: true,
    access_profile: "custom",
    permissions,
    must_change_password: false,
    last_login_at: null,
    ...overrides,
  };
}

test("perfis rápidos liberam somente os módulos previstos", () => {
  assert.deepEqual(permissionsForProfile("reception"), [
    "scheduling.view",
    "scheduling.manage",
  ]);
  assert.deepEqual(permissionsForProfile("hr"), [
    "hr.view",
    "hr.evaluate",
    "hr.manage",
  ]);
  assert.deepEqual(permissionsForProfile("evaluator"), [
    "hr.view",
    "hr.evaluate",
  ]);
  assert.deepEqual(permissionsForProfile("publications"), [
    "publications.view",
    "publications.edit",
    "publications.publish",
  ]);
  assert.deepEqual(permissionsForProfile("attendance"), [
    "contact.view",
    "contact.manage",
  ]);
  assert.deepEqual(permissionsForProfile("custom"), []);
  assert.deepEqual(permissionsForProfile("manager"), [
    "publications.view",
    "publications.edit",
    "publications.publish",
    "hr.view",
    "hr.evaluate",
    "hr.manage",
    "scheduling.view",
    "scheduling.manage",
    "contact.view",
    "contact.manage",
  ]);
  assert.deepEqual(permissionsForProfile("super_admin"), adminPermissions);
});

test("recepção pode receber Fale Conosco sem ganhar outros módulos", () => {
  const combined = profile([
    ...permissionsForProfile("reception"),
    "contact.view",
    "contact.manage",
  ]);
  assert.equal(hasAdminPermission(combined, "scheduling.manage"), true);
  assert.equal(hasAdminPermission(combined, "contact.view"), true);
  assert.equal(hasAdminPermission(combined, "hr.view"), false);
  assert.equal(hasAdminPermission(combined, "publications.view"), false);
  assert.equal(hasAdminPermission(combined, "users.manage"), false);
  assert.deepEqual(permissionsToModuleLabels(combined.permissions ?? []), [
    "Agendamentos",
    "Fale Conosco",
  ]);
});

test("override de agendamento é administrativo e não vem de scheduling.manage", () => {
  assert.equal(
    canOverrideSchedulingAssignment(
      profile(["scheduling.view", "scheduling.manage"], {
        role: "reception",
        access_profile: "reception",
      }),
    ),
    false,
  );
  assert.equal(
    canOverrideSchedulingAssignment(
      profile(["scheduling.view", "scheduling.manage"], {
        role: "admin",
        access_profile: "manager",
      }),
    ),
    true,
  );
  assert.equal(
    canOverrideSchedulingAssignment(
      profile(["scheduling.view"], {
        role: "super_admin",
        access_profile: "super_admin",
      }),
    ),
    true,
  );
});

test("usuário inativo não possui permissão e legado permanece compatível", () => {
  assert.equal(
    hasAdminPermission(
      profile(["scheduling.view"], { active: false }),
      "scheduling.view",
    ),
    false,
  );
  assert.equal(
    hasAdminPermission(
      profile([], {
        role: "super_admin",
        access_profile: null,
        permissions: null,
      }),
      "audit.view",
    ),
    true,
  );
  assert.equal(
    hasAdminPermission(
      profile([], {
        role: "admin",
        access_profile: null,
        permissions: null,
      }),
      "scheduling.manage",
    ),
    true,
  );
  assert.equal(
    hasAdminPermission(
      profile([], {
        role: "editor",
        hr_role: "reviewer",
        access_profile: null,
        permissions: null,
      }),
      "hr.view",
    ),
    true,
  );
  assert.equal(
    hasAdminPermission(
      profile(["hr.view"], { access_profile: "custom" }),
      "hr.evaluate",
    ),
    false,
  );
  assert.equal(
    hasAdminPermission(
      profile(["hr.manage"], { access_profile: "custom" }),
      "hr.evaluate",
    ),
    true,
  );
});

test("criação e redefinição usam Supabase Auth server-side sem persistir senha", async () => {
  const actions = await readFile(
    new URL("../src/app/admin/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /auth\.admin\.createUser\(/);
  assert.doesNotMatch(actions, /inviteUserByEmail/);
  assert.match(actions, /email_confirm:\s*true/);
  assert.match(actions, /auth\.admin\.updateUserById/);
  assert.match(actions, /must_change_password:\s*true/);
  assert.doesNotMatch(
    actions,
    /after_data:\s*\{[^}]*\bpassword\s*:|before_data:\s*\{[^}]*\bpassword\s*:/,
  );
  assert.match(actions, /USER_CREATED/);
  assert.match(actions, /USER_PERMISSIONS_CHANGED/);
  assert.match(actions, /USER_PASSWORD_RESET/);
});

test("migration é aditiva, migra legado e aplica proteção no banco", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/202608160003_admin_users_permissions.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /add column if not exists access_profile text/);
  assert.match(migration, /add column if not exists permissions text\[\]/);
  assert.match(migration, /current_admin_permissions\(\)/);
  assert.match(migration, /has_admin_permission\(requested_permission text\)/);
  assert.match(migration, /protect_admin_profile_access/);
  assert.match(migration, /último superadministrador ativo/i);
  assert.match(migration, /contact\.view/);
  assert.match(migration, /scheduling\.manage/);
  assert.match(migration, /can_manage_hr/);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdrop table\b/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.profiles/i);
});

test("páginas e APIs sensíveis usam guards de permissão específicos", async () => {
  const files = await Promise.all(
    [
      ["../src/app/admin/(protected)/usuarios/page.tsx", "users.manage"],
      ["../src/app/admin/(protected)/auditoria/page.tsx", "audit.view"],
      ["../src/app/admin/(protected)/solicitacoes/page.tsx", "scheduling.view"],
      ["../src/app/admin/(protected)/fale-conosco/page.tsx", "contact.view"],
      ["../src/app/api/admin/solicitacoes/acoes/route.ts", "scheduling.manage"],
    ].map(async ([path, permission]) => ({
      permission,
      source: await readFile(new URL(path, import.meta.url), "utf8"),
    })),
  );
  for (const file of files)
    assert.match(file.source, new RegExp(file.permission));
});
