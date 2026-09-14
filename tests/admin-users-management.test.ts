import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("listagem usa dados reais, exclui soft deletes e identifica o último responsável", async () => {
  const page = await source("src/app/admin/(protected)/usuarios/page.tsx");
  assert.match(page, /requireAdminPermission\("users\.manage"\)/);
  assert.match(page, /profile\.role !== "super_admin"/);
  assert.match(page, /\.is\("deleted_at", null\)/);
  assert.match(page, /access_updated_at/);
  assert.match(page, /access_updated_by/);
  assert.match(page, /actorNames/);
  assert.match(page, /last_updated_at/);
  assert.match(page, /last_updated_by/);
  assert.match(page, /loadError/);
});

test("central oferece tabela desktop, cartões mobile, busca, filtros, ordenação e paginação", async () => {
  const manager = await source("src/components/admin/admin-users-manager.tsx");
  assert.match(manager, /window\.setTimeout\(\(\) => \{[\s\S]*setQuery/);
  assert.match(manager, /Buscar por nome ou e-mail\.\.\./);
  for (const label of [
    "Todos",
    "Ativos",
    "Inativos",
    "Recepção",
    "RH",
    "Publicações",
    "Atendimento",
    "Gestores",
  ]) {
    assert.match(manager, new RegExp(label));
  }
  assert.match(manager, /AdminTable/);
  assert.match(manager, /xl:hidden/);
  assert.match(manager, /SortButton/);
  assert.match(manager, /\[10, 25, 50, 100\]/);
  assert.match(manager, /Mostrando \{rangeStart\} a \{rangeEnd\}/);
  assert.match(manager, /permissionsToModuleLabels/);
  assert.match(manager, /\+\{remaining\}/);
});

test("ações principais respeitam estado, confirmação, loading e conta protegida", async () => {
  const manager = await source("src/components/admin/admin-users-manager.tsx");
  assert.match(manager, /Ativar usuário/);
  assert.match(manager, /Desativar usuário\?/);
  assert.match(manager, /Excluir usuário permanentemente\?/);
  assert.match(manager, /disabled=\{user\.active \|\| self\}/);
  assert.match(manager, /disabled=\{!user\.active \|\| protectedAction\}/);
  assert.match(manager, /lastActiveSuperAdmin/);
  assert.match(manager, /useFormStatus/);
  assert.match(manager, /Cancelar/);
  assert.match(manager, /expected_updated_at/);
  assert.doesNotMatch(
    manager,
    /<select[\s\S]{0,120}name="active"[\s\S]{0,500}Salvar alterações/,
  );
});

test("diálogo administrativo prende foco, aceita Escape e restaura o foco", async () => {
  const dialog = await source("src/components/admin/ui/admin-dialog.tsx");
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /returnFocus\?\.focus\(\)/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
});

test("comando de status é atômico, concorrente e auditado no banco", async () => {
  const migration = await source(
    "supabase/migrations/20260914193357_admin_user_access_management.sql",
  );
  assert.match(migration, /add column if not exists deleted_at timestamptz/);
  assert.match(migration, /access_updated_at timestamptz/);
  assert.match(migration, /access_updated_by uuid/);
  assert.match(migration, /profiles_deleted_state_check/);
  assert.match(migration, /manage_admin_user_status/);
  assert.match(migration, /security invoker/);
  assert.match(migration, /public\.has_admin_permission\('users\.manage'\)/);
  assert.match(migration, /p_target_id = actor_id/);
  assert.match(migration, /last_super_admin/);
  assert.match(migration, /admin_user_concurrent_update/);
  assert.match(migration, /USER_ACTIVATED/);
  assert.match(migration, /USER_DEACTIVATED/);
  assert.match(migration, /USER_DELETED/);
  assert.match(migration, /insert into public\.audit_logs/);
  assert.match(migration, /revoke all[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});

test("Server Actions repetem RBAC e delegam alterações atômicas ao banco", async () => {
  const actions = await source("src/app/admin/actions.ts");
  assert.match(actions, /adminUserCommandAction/);
  assert.match(actions, /requireSuperAdministrator\(\)/);
  assert.match(actions, /\.rpc\("manage_admin_user_status"/);
  assert.match(actions, /\.rpc\("update_admin_user_access"/);
  assert.match(actions, /error=status-command/);
  assert.doesNotMatch(actions, /auth\.admin\.deleteUser\(parsed\.data\.id/);
});

test("rota possui loading dedicado e estados vazios e de erro", async () => {
  const [loading, manager] = await Promise.all([
    source("src/app/admin/(protected)/usuarios/loading.tsx"),
    source("src/components/admin/admin-users-manager.tsx"),
  ]);
  assert.match(loading, /role="status"/);
  assert.match(loading, /Carregando usuários e acessos/);
  assert.match(manager, /Nenhum usuário cadastrado\./);
  assert.match(manager, /Nenhum usuário encontrado para esta pesquisa\./);
  assert.match(manager, /Não foi possível carregar os usuários\./);
  assert.match(manager, /Tentar novamente/);
});
