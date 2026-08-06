import Link from "next/link";
import { AdminContentForm } from "@/components/admin/admin-content-form";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { contentCommandAction } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/cms/auth";
import type { CmsModule } from "@/lib/cms/modules";

export async function AdminModuleView({
  module,
  searchParams,
}: {
  module: CmsModule;
  searchParams: Promise<{
    edit?: string;
    success?: string;
    error?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const displayField = [
    "convenios",
    "equipamentos",
    "exames",
    "preparos",
  ].includes(module.key)
    ? "name"
    : module.key === "redes-sociais"
      ? "network"
      : "title";
  let recordsRequest = supabase
    .from(module.table)
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (query.q)
    recordsRequest = recordsRequest.ilike(displayField, `%${query.q}%`);
  if (query.status) recordsRequest = recordsRequest.eq("status", query.status);
  const { data = [] } = await recordsRequest.limit(100);
  const selected = query.edit
    ? data?.find((item) => item.id === query.edit)
    : undefined;
  const { data: mediaRows = [] } = await supabase
    .from("media_assets")
    .select("id, original_name, storage_path")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  const media = (mediaRows ?? []).map((item) => ({
    id: item.id,
    label: item.original_name,
    url: supabase.storage.from("site-media").getPublicUrl(item.storage_path)
      .data.publicUrl,
  }));
  const canPublish = profile.role !== "editor";
  const supportsActive = module.fields.some((field) => field.name === "active");
  const { data: newsRows = [] } =
    module.key === "carrossel"
      ? await supabase
          .from("news_posts")
          .select("id,title,status")
          .is("deleted_at", null)
          .order("title")
      : { data: [] };
  const formModule = {
    key: module.key,
    label: module.label,
    singular: module.singular,
    table: module.table,
    fields: module.fields.map((field) =>
      field.name === "linked_news_id"
        ? {
            ...field,
            options: [
              { label: "Nenhuma matéria", value: "" },
              ...(newsRows ?? []).map((item) => ({
                label: `${item.title} (${item.status})`,
                value: item.id,
              })),
            ],
          }
        : field,
    ),
  };

  return (
    <>
      <AdminPageHeading
        title={module.label}
        description={`Crie, edite, organize, publique e arquive ${module.singular}. Registros arquivados ficam disponíveis na lixeira.`}
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          Pronto! A alteração foi salva com sucesso.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          {query.error === "validation"
            ? "Revise os campos destacados e tente novamente. Os campos obrigatórios precisam estar preenchidos."
            : query.error === "image-required"
              ? "Escolha uma imagem principal antes de publicar o slide."
              : query.error === "permission"
                ? "Sua conta pode salvar rascunhos, mas não tem permissão para publicar."
                : "Não foi possível concluir esta ação. Tente novamente ou peça ajuda ao administrador."}
        </p>
      ) : null}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(25rem,.95fr)]">
        <section aria-labelledby="records-title">
          <h2 id="records-title" className="font-heading text-xl font-semibold">
            Conteúdos cadastrados
          </h2>
          <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <input
              name="q"
              defaultValue={query.q}
              placeholder={`Buscar ${module.singular}`}
              className="border-border-light min-h-11 min-w-0 rounded-full border bg-white px-4 text-sm"
            />
            <select
              name="status"
              defaultValue={query.status}
              className="border-border-light min-h-11 rounded-full border bg-white px-3 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="draft">Rascunhos</option>
              <option value="scheduled">Agendados</option>
              <option value="published">Publicados</option>
              <option value="archived">Arquivados</option>
            </select>
            <button className="bg-brand-dark min-h-11 rounded-full px-4 text-sm font-bold text-white">
              Filtrar
            </button>
          </form>
          <div className="mt-4 space-y-3">
            {data?.length ? (
              data.map((item) => (
                <article
                  key={item.id}
                  className="border-border-light rounded-2xl border bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-bold">
                        {item.title ?? item.name ?? item.network}
                      </h3>
                      <p className="text-muted mt-1 text-xs font-bold tracking-wide uppercase">
                        {item.status} {item.active ? "· ativo" : ""}
                      </p>
                    </div>
                    <Link
                      href={`/admin/${module.key}?edit=${item.id}`}
                      className="text-brand min-h-10 rounded-full px-3 py-2 text-sm font-bold"
                    >
                      Editar
                    </Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      "duplicate",
                      "archive",
                      ...(canPublish ? ["publish"] : []),
                      ...(canPublish && supportsActive
                        ? [item.active ? "deactivate" : "activate"]
                        : []),
                    ].map((command) => (
                      <ConfirmCommandForm
                        key={command}
                        action={contentCommandAction}
                        message={
                          command === "publish"
                            ? "Publicar este conteúdo no site agora? Ele ficará visível para o público."
                            : command === "archive"
                              ? "Arquivar este conteúdo? Ele deixará de aparecer no site e poderá ser restaurado pela lixeira."
                              : command === "duplicate"
                                ? "Criar uma cópia deste conteúdo como rascunho?"
                                : command === "deactivate"
                                  ? "Ocultar este conteúdo do site?"
                                  : "Exibir este conteúdo no site?"
                        }
                      >
                        <input type="hidden" name="module" value={module.key} />
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          name="command"
                          value={command}
                          className="border-border-light min-h-9 rounded-full border px-3 text-xs font-bold"
                        >
                          {
                            {
                              duplicate: "Duplicar",
                              archive: "Arquivar",
                              publish: "Publicar",
                              activate: "Ativar",
                              deactivate: "Desativar",
                            }[command]
                          }
                        </button>
                      </ConfirmCommandForm>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="border-border-light text-muted rounded-2xl border border-dashed bg-white p-6">
                Nenhum conteúdo cadastrado no CMS.
              </div>
            )}
          </div>
        </section>
        <section aria-labelledby="form-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="form-title" className="font-heading text-xl font-semibold">
              {selected
                ? `Editar ${module.singular}`
                : `Novo ${module.singular}`}
            </h2>
          </div>
          <AdminContentForm
            module={formModule}
            initial={selected}
            media={media}
            canPublish={canPublish}
          />
        </section>
      </div>
    </>
  );
}
