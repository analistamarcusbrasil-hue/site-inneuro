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
  const { data = [] } = admin
    ? await admin
        .from("profiles")
        .select(
          "id, full_name, email, role, access_profile, permissions, active, must_change_password, last_login_at, created_at",
        )
        .order("created_at", { ascending: false })
    : { data: [] };
  return (
    <>
      <AdminPageHeading
        title="Usuários e acessos"
        description="Crie funcionários, escolha um perfil simples e libere somente as áreas necessárias."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          {query.success === "created"
            ? "Usuário criado. A conta já pode entrar com a senha inicial."
            : query.success === "password"
              ? "Senha temporária redefinida. A troca será exigida no próximo acesso."
              : "Usuário atualizado."}
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="bg-error/10 text-error mb-6 rounded-xl p-4">
          {query.error === "last-super-admin"
            ? "O último superadministrador ativo não pode ser desativado ou rebaixado."
            : query.error === "self"
              ? "Sua própria conta não pode alterar perfil, permissões ou status."
              : query.error === "exists"
                ? "Já existe uma conta com este e-mail."
                : query.error === "candidate-email"
                  ? "Este e-mail pertence a uma conta de candidato e não pode ser utilizado como acesso administrativo."
                  : "Não foi possível concluir a operação. Revise os dados e tente novamente."}
        </p>
      ) : null}
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
          users={(data ?? []) as AdminUserRow[]}
          currentUserId={user.id}
        />
      ) : null}
    </>
  );
}
