import Image from "next/image";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import {
  mediaCommandAction,
  updateMediaMetadataAction,
  uploadMediaAction,
} from "@/app/admin/actions";
import { requireAdmin } from "@/lib/cms/auth";

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    q?: string;
    kind?: string;
  }>;
}) {
  const query = await searchParams;
  const { supabase } = await requireAdmin();
  let request = supabase
    .from("media_assets")
    .select("*")
    .is("deleted_at", null)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (query.kind) request = request.eq("kind", query.kind);
  if (query.q) request = request.ilike("original_name", `%${query.q}%`);
  const { data = [] } = await request;
  const references = await Promise.all([
    supabase.from("carousel_slides").select("desktop_media_id,mobile_media_id"),
    supabase.from("news_posts").select("cover_media_id"),
    supabase.from("health_partners").select("logo_media_id"),
    supabase.from("social_posts").select("thumbnail_media_id"),
    supabase.from("equipment").select("cover_media_id,gallery_media_ids"),
  ]);
  const usage = new Map<string, number>();
  for (const result of references) {
    for (const row of result.data ?? []) {
      for (const value of Object.values(row)) {
        const ids = Array.isArray(value) ? value : [value];
        for (const id of ids) {
          if (typeof id === "string") usage.set(id, (usage.get(id) ?? 0) + 1);
        }
      }
    }
  }
  return (
    <>
      <AdminPageHeading
        title="Biblioteca de mídia"
        description="Envie fotografias, logos e miniaturas com origem, licença e acessibilidade documentadas."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          Mídia enviada com sucesso.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Arquivo recusado ou operação não permitida. Confira tipo, extensão e
          limite.
        </p>
      ) : null}
      <div className="grid gap-8 xl:grid-cols-[24rem_1fr]">
        <section>
          <h2 className="font-heading text-xl font-semibold">Enviar arquivo</h2>
          <form
            action={uploadMediaAction}
            className="border-border-light mt-4 space-y-4 rounded-3xl border bg-white p-5"
          >
            <label className="block text-sm font-bold">
              Arquivo
              <input
                name="file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                className="mt-2 block w-full text-sm"
              />
            </label>
            <label className="block text-sm font-bold">
              Tipo
              <select
                name="kind"
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3"
              >
                <option value="photo">Fotografia · 8 MB</option>
                <option value="logo">Logo · 2 MB</option>
                <option value="thumbnail">Miniatura · 4 MB</option>
              </select>
            </label>
            {[
              ["alt_text", "Texto alternativo"],
              ["caption", "Legenda"],
              ["credit", "Crédito"],
              ["license", "Licença"],
            ].map(([name, label]) => (
              <label key={name} className="block text-sm font-bold">
                {label}
                <input
                  name={name}
                  required={name === "alt_text"}
                  className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3"
                />
              </label>
            ))}
            <p className="text-muted text-xs leading-relaxed">
              Formatos aceitos: JPEG, PNG e WebP. SVG enviado por usuários não é
              aceito.
            </p>
            <button className="bg-brand min-h-11 rounded-full px-5 text-sm font-bold text-white">
              Enviar mídia
            </button>
          </form>
        </section>
        <section>
          <h2 className="font-heading text-xl font-semibold">
            Arquivos ativos
          </h2>
          <form className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={query.q}
              placeholder="Buscar por nome"
              className="border-border-light min-h-11 min-w-0 flex-1 rounded-full border bg-white px-4"
            />
            <select
              name="kind"
              defaultValue={query.kind}
              className="border-border-light rounded-full border bg-white px-3"
            >
              <option value="">Todos</option>
              <option value="photo">Fotos</option>
              <option value="logo">Logos</option>
              <option value="thumbnail">Miniaturas</option>
            </select>
            <button className="bg-brand-dark rounded-full px-4 text-sm font-bold text-white">
              Buscar
            </button>
          </form>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {data?.map((item) => {
              const url = supabase.storage
                .from("site-media")
                .getPublicUrl(item.storage_path).data.publicUrl;
              return (
                <li
                  key={item.id}
                  className="border-border-light overflow-hidden rounded-2xl border bg-white"
                >
                  <div className="bg-surface relative aspect-video">
                    <Image
                      src={url}
                      alt={item.alt_text}
                      fill
                      unoptimized
                      className="object-contain"
                    />
                  </div>
                  <div className="p-4">
                    <p className="truncate font-bold">{item.original_name}</p>
                    <p className="text-muted mt-1 text-xs">
                      {item.kind} · {(item.size_bytes / 1024 / 1024).toFixed(2)}{" "}
                      MB
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      Em uso em {usage.get(item.id) ?? 0} conteúdo(s)
                    </p>
                    <details className="mt-3">
                      <summary className="text-brand cursor-pointer text-sm font-bold">
                        Editar informações
                      </summary>
                      <form
                        action={updateMediaMetadataAction}
                        className="mt-3 space-y-2"
                      >
                        <input type="hidden" name="id" value={item.id} />
                        {[
                          ["alt_text", "Texto alternativo", item.alt_text],
                          ["caption", "Legenda", item.caption],
                          ["credit", "Crédito", item.credit],
                          ["license", "Licença", item.license],
                        ].map(([name, label, value]) => (
                          <label
                            key={String(name)}
                            className="block text-xs font-bold"
                          >
                            {label}
                            <input
                              name={String(name)}
                              defaultValue={String(value ?? "")}
                              required={name === "alt_text"}
                              className="border-border-light mt-1 min-h-10 w-full rounded-lg border px-2 font-normal"
                            />
                          </label>
                        ))}
                        <button className="border-brand text-brand min-h-9 rounded-full border px-3 text-xs font-bold">
                          Salvar informações
                        </button>
                      </form>
                    </details>
                    <ConfirmCommandForm
                      action={mediaCommandAction}
                      message="Arquivar esta mídia? Verifique antes onde ela está sendo utilizada."
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        name="command"
                        value="archive"
                        className="text-warning mt-3 min-h-9 text-sm font-bold"
                      >
                        Arquivar
                      </button>
                    </ConfirmCommandForm>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
