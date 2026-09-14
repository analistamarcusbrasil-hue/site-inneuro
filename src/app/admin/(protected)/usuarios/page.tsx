import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  AdminUsersManager,
  type AdminUserRow,
} from "@/components/admin/admin-users-manager";
import { requireAdminPermission } from "@/lib/cms/auth";
import { isCmsAdminConfigured } from "@/lib/cms/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { user, profile } = await requireAdminPermission("users.manage");
  if (profile.role !== "super_admin") redirect("/admin?error=permission");
  const admin = createSupabaseAdminClient();
  const profilesResult = admin
    ? await admin
        .from("profiles")
        .select(
          "id, full_name, email, role, access_profile, permissions, active, must_change_password, last_login_at, created_at, updated_at, access_updated_at, access_updated_by",
        )
        .is("deleted_at", null)
        .order("access_updated_at", { ascending: false })
    : { data: [], error: new Error("Admin não configurado") };
  const profileRows = profilesResult.data ?? [];
  const actorIds = [
    ...new Set(
      profileRows.flatMap((row) =>
        row.access_updated_by ? [row.access_updated_by] : [],
      ),
    ),
  ];
  const actorsResult =
    admin && actorIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [], error: null };
  const actorNames = new Map(
    (actorsResult.data ?? []).map((actor) => [actor.id, actor.full_name]),
  );
  const users = profileRows.map((row) => ({
    ...row,
    last_updated_at: row.access_updated_at ?? row.created_at,
    last_updated_by: row.access_updated_by
      ? (actorNames.get(row.access_updated_by) ?? "Usuário administrativo")
      : "Sistema",
  }));
  const loadError = Boolean(profilesResult.error || actorsResult.error);
  const successMessages: Record<string, string> = {
    created: "Usuário criado com sucesso.",
    password: "Senha temporária redefinida com sucesso.",
    updated: "Usuário atualizado com sucesso.",
    activated: "Usuário ativado com sucesso.",
    deactivated: "Usuário desativado com sucesso.",
    deleted: "Usuário excluído com sucesso.",
  };
  const errorMessages: Record<string, string> = {
    "last-super-admin":
      "O último superadministrador ativo não pode ser desativado, excluído ou rebaixado.",
    self: "Sua própria conta não pode alterar perfil, permissões ou status.",
    exists: "Já existe uma conta com este e-mail.",
    "candidate-email":
      "Este e-mail pertence a uma conta de candidato e não pode ser utilizado como acesso administrativo.",
    concurrent:
      "Este usuário foi alterado por outra pessoa. A lista foi atualizada; tente novamente.",
    audit:
      "O usuário foi atualizado, mas não foi possível confirmar o registro de auditoria.",
    "not-found": "O usuário não existe mais ou já foi excluído.",
    "status-command":
      "Use as ações Ativar ou Desativar para mudar o status com segurança.",
    command: "Não foi possível realizar a operação. Tente novamente.",
  };
  const feedback = query.success
    ? { type: "success" as const, message: successMessages[query.success] }
    : query.error
      ? {
          type: "error" as const,
          message:
            errorMessages[query.error] ??
            "Não foi possível concluir a operação. Revise os dados e tente novamente.",
        }
      : undefined;
  return (
    <>
      <AdminPageHeading
        title="Usuários e acessos"
        description="Crie funcionários, escolha um perfil simples e libere somente as áreas necessárias."
      />
      {!isCmsAdminConfigured ? (
        <p
          role="status"
          className="border-warning/30 text-warning mb-6 rounded-xl border bg-white p-4"
        >
          A administração de acessos está indisponível porque a configuração
          segura do servidor não foi concluída.
        </p>
      ) : null}
      {isCmsAdminConfigured ? (
        <AdminUsersManager
          users={users as AdminUserRow[]}
          currentUserId={user.id}
          loadError={loadError}
          feedback={feedback?.message ? feedback : undefined}
        />
      ) : null}
    </>
  );
}
