import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { inviteUserAction, updateUserRoleAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/cms/auth";
import { isCmsAdminConfigured } from "@/lib/cms/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const allRoles = ["editor", "admin", "super_admin", "reception"] as const;
const roleLabels: Record<(typeof allRoles)[number], string> = {
  editor: "Editor de conteúdo",
  admin: "Administrador",
  super_admin: "Superadministrador",
  reception: "Recepção",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { profile } = await requireAdmin(["super_admin", "admin"]);
  const admin = createSupabaseAdminClient();
  const { data = [] } = admin
    ? await admin
        .from("profiles")
        .select("id, full_name, email, role, active, created_at")
        .order("created_at", { ascending: false })
    : { data: [] };
  const assignableRoles =
    profile.role === "super_admin" ? allRoles : (["reception"] as const);
  const visibleUsers =
    profile.role === "super_admin"
      ? data
      : data?.filter((item) => item.role === "reception");

  return (
    <>
      <AdminPageHeading
        title="Usuários"
        description="Crie acessos individuais e mantenha somente as permissões necessárias para cada pessoa."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          {query.success === "role"
            ? "Usuário atualizado."
            : "Convite enviado."}
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="bg-error/10 text-error mb-6 rounded-xl p-4">
          Não foi possível concluir a operação. Revise os dados e tente
          novamente.
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
      <div className="grid gap-8 xl:grid-cols-[24rem_1fr]">
        <section>
          <h2 className="font-heading text-xl font-semibold">Criar acesso</h2>
          <form
            action={inviteUserAction}
            className="border-border-light mt-4 space-y-4 rounded-3xl border bg-white p-5"
          >
            <fieldset
              disabled={!isCmsAdminConfigured}
              className="space-y-4 disabled:opacity-60"
            >
              <label className="block text-sm font-bold">
                Nome
                <input
                  name="full_name"
                  required
                  minLength={2}
                  maxLength={120}
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
                />
              </label>
              <label className="block text-sm font-bold">
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
                />
              </label>
              <label className="block text-sm font-bold">
                Perfil
                <select
                  name="role"
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
                >
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-bold">
                Status
                <select
                  name="active"
                  defaultValue="active"
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <button className="bg-brand min-h-11 rounded-full px-5 text-sm font-bold text-white">
                Enviar convite
              </button>
            </fieldset>
          </form>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold">Equipe</h2>
          <div className="mt-4 space-y-3">
            {visibleUsers?.map((item) => {
              const roles =
                profile.role === "super_admin"
                  ? allRoles
                  : (["reception"] as const);
              return (
                <form
                  key={item.id}
                  action={updateUserRoleAction}
                  className="border-border-light grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 xl:grid-cols-[1.2fr_1.3fr_1fr_.8fr_auto] xl:items-end"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <label className="text-xs font-bold">
                    Nome
                    <input
                      name="full_name"
                      defaultValue={item.full_name ?? ""}
                      required
                      className="border-border-light mt-1 min-h-10 w-full rounded-xl border px-3 text-sm font-normal"
                    />
                  </label>
                  <div className="min-w-0 text-xs">
                    <strong>E-mail</strong>
                    <p className="text-muted mt-2 truncate text-sm">
                      {item.email || "Não registrado"}
                    </p>
                  </div>
                  <label className="text-xs font-bold">
                    Perfil
                    <select
                      name="role"
                      defaultValue={item.role}
                      disabled={!isCmsAdminConfigured}
                      className="border-border-light mt-1 min-h-10 w-full rounded-xl border px-3 text-sm font-normal"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold">
                    Status
                    <select
                      name="active"
                      defaultValue={item.active ? "active" : "inactive"}
                      disabled={!isCmsAdminConfigured}
                      className="border-border-light mt-1 min-h-10 w-full rounded-xl border px-3 text-sm font-normal"
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                    </select>
                  </label>
                  <button
                    disabled={!isCmsAdminConfigured}
                    className="border-brand text-brand min-h-10 rounded-full border px-4 text-sm font-bold disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
