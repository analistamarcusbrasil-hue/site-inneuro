import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { inviteUserAction, updateUserRoleAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/cms/auth";
import { isCmsAdminConfigured } from "@/lib/cms/config";

const roles = ["editor", "admin", "super_admin"] as const;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { supabase } = await requireAdmin(["super_admin"]);
  const { data = [] } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });
  return (
    <>
      <AdminPageHeading
        title="Usuários"
        description="Convide usuários e defina o nível mínimo necessário. Não existe cadastro público."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          {query.success === "role" ? "Função atualizada." : "Convite enviado."}
        </p>
      ) : null}
      {query.error ? (
        <p role="alert" className="bg-error/10 text-error mb-6 rounded-xl p-4">
          Não foi possível concluir a operação.
        </p>
      ) : null}
      {!isCmsAdminConfigured ? (
        <p
          role="status"
          className="border-warning/30 text-warning mb-6 rounded-xl border bg-white p-4"
        >
          Convites e alterações de função dependem da variável secreta
          <code className="mx-1 font-mono">SUPABASE_SERVICE_ROLE_KEY</code> no
          servidor. Nenhuma chave deve ser informada nesta página.
        </p>
      ) : null}
      <div className="grid gap-8 xl:grid-cols-[22rem_1fr]">
        <section>
          <h2 className="font-heading text-xl font-semibold">Convidar</h2>
          <form
            action={inviteUserAction}
            className="border-border-light mt-4 space-y-4 rounded-3xl border bg-white p-5"
          >
            <fieldset
              disabled={!isCmsAdminConfigured}
              className="space-y-4 disabled:opacity-60"
            >
              <label className="block text-sm font-bold">
                E-mail
                <input
                  name="email"
                  type="email"
                  required
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3"
                />
              </label>
              <label className="block text-sm font-bold">
                Função
                <select
                  name="role"
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3"
                >
                  {roles.map((role) => (
                    <option key={role}>{role}</option>
                  ))}
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
            {data?.map((item) => (
              <article
                key={item.id}
                className="border-border-light flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4"
              >
                <div>
                  <p className="font-bold">
                    {item.full_name || "Convite ou perfil sem nome"}
                  </p>
                  <p className="text-muted mt-1 font-mono text-xs">{item.id}</p>
                </div>
                <form action={updateUserRoleAction} className="flex gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <select
                    name="role"
                    defaultValue={item.role}
                    disabled={!isCmsAdminConfigured}
                    className="border-border-light min-h-10 rounded-full border px-3 text-sm"
                  >
                    {roles.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                  <button
                    disabled={!isCmsAdminConfigured}
                    className="border-brand text-brand rounded-full border px-3 text-sm font-bold disabled:opacity-50"
                  >
                    Atualizar
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
