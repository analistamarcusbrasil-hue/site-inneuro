import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { mediaCommandAction, trashCommandAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/cms/auth";
import { cmsModules } from "@/lib/cms/modules";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const groups = await Promise.all(
    cmsModules.map(async (module) => {
      const { data = [] } = await supabase
        .from(module.table)
        .select("id, title, name, network, archived_at")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false });
      return { module, rows: data ?? [] };
    }),
  );
  const { data: archivedMedia = [] } = await supabase
    .from("media_assets")
    .select("id, original_name, archived_at")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  return (
    <>
      <AdminPageHeading
        title="Lixeira"
        description="Restaure conteúdos arquivados. A exclusão definitiva é restrita ao super_admin e exige confirmação."
      />
      {query.error ? (
        <p role="alert" className="bg-error/10 text-error mb-6 rounded-xl p-4">
          Operação não autorizada.
        </p>
      ) : null}
      <div className="space-y-8">
        {groups.map(({ module, rows }) => (
          <section key={module.key}>
            <h2 className="font-heading text-xl font-semibold">
              {module.label}
            </h2>
            <div className="mt-3 space-y-3">
              {rows.length ? (
                rows.map((item) => (
                  <article
                    key={item.id}
                    className="border-border-light flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4"
                  >
                    <div>
                      <h3 className="font-bold">
                        {item.title ?? item.name ?? item.network}
                      </h3>
                      <p className="text-muted mt-1 text-xs">
                        Arquivado em{" "}
                        {new Date(item.archived_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={trashCommandAction}>
                        <input
                          type="hidden"
                          name="table"
                          value={module.table}
                        />
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          name="command"
                          value="restore"
                          className="border-brand text-brand min-h-10 rounded-full border px-4 text-sm font-bold"
                        >
                          Restaurar
                        </button>
                      </form>
                      {profile.role === "super_admin" ? (
                        <ConfirmCommandForm
                          action={trashCommandAction}
                          message="Excluir definitivamente? Esta ação não pode ser desfeita."
                        >
                          <input
                            type="hidden"
                            name="table"
                            value={module.table}
                          />
                          <input type="hidden" name="id" value={item.id} />
                          <button
                            name="command"
                            value="delete"
                            className="bg-error min-h-10 rounded-full px-4 text-sm font-bold text-white"
                          >
                            Excluir definitivamente
                          </button>
                        </ConfirmCommandForm>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-muted border-border-light rounded-2xl border border-dashed bg-white p-4">
                  Nenhum item arquivado.
                </p>
              )}
            </div>
          </section>
        ))}
        <section>
          <h2 className="font-heading text-xl font-semibold">Mídias</h2>
          <div className="mt-3 space-y-3">
            {archivedMedia?.length ? (
              archivedMedia.map((item) => (
                <article
                  key={item.id}
                  className="border-border-light flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4"
                >
                  <div>
                    <h3 className="font-bold">{item.original_name}</h3>
                    <p className="text-muted mt-1 text-xs">Mídia arquivada</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={mediaCommandAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        name="command"
                        value="restore"
                        className="border-brand text-brand min-h-10 rounded-full border px-4 text-sm font-bold"
                      >
                        Restaurar
                      </button>
                    </form>
                    {profile.role === "super_admin" ? (
                      <ConfirmCommandForm
                        action={mediaCommandAction}
                        message="Excluir definitivamente esta mídia? A ação não pode ser desfeita."
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          name="command"
                          value="delete"
                          className="bg-error min-h-10 rounded-full px-4 text-sm font-bold text-white"
                        >
                          Excluir definitivamente
                        </button>
                      </ConfirmCommandForm>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="text-muted border-border-light rounded-2xl border border-dashed bg-white p-4">
                Nenhuma mídia arquivada.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
