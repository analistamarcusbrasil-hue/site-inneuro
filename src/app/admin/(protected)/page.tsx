import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { cmsModules } from "@/lib/cms/modules";
import { requireAdmin } from "@/lib/cms/auth";

export default async function AdminDashboardPage() {
  const { supabase, profile } = await requireAdmin();
  const cards = await Promise.all(
    cmsModules.map(async (module) => {
      const [{ count }, { count: published }, { count: drafts }] =
        await Promise.all([
          supabase
            .from(module.table)
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null),
          supabase
            .from(module.table)
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("status", "published"),
          supabase
            .from(module.table)
            .select("id", { count: "exact", head: true })
            .is("deleted_at", null)
            .eq("status", "draft"),
        ]);
      return {
        ...module,
        count: count ?? 0,
        published: published ?? 0,
        drafts: drafts ?? 0,
      };
    }),
  );
  const [{ data: recent = [] }, { count: missingAlt }] = await Promise.all([
    supabase
      .from("audit_logs")
      .select("id,action,entity_type,created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("media_assets")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("alt_text", ""),
  ]);
  return (
    <>
      <AdminPageHeading
        eyebrow="Painel administrativo"
        title="O que você quer atualizar?"
        description="Escolha uma área abaixo. Você poderá salvar, visualizar e confirmar antes de publicar no site."
      />
      {missingAlt ? (
        <p
          role="status"
          className="border-warning/30 text-warning mb-6 rounded-2xl border bg-white p-4 text-sm font-bold"
        >
          Pendência: {missingAlt} imagem(ns) sem descrição acessível.
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ key, label, count, published, drafts, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/admin/${key}`}
              className="border-border-light group block rounded-3xl border bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#087a4d]"
            >
              <span className="bg-mint text-brand grid size-11 place-items-center rounded-2xl">
                <Icon aria-hidden="true" size={21} />
              </span>
              <p className="text-muted mt-6 text-sm">{label}</p>
              <p className="font-heading text-brand-dark mt-1 text-3xl font-semibold">
                {count}
              </p>
              <p className="text-muted mt-2 text-xs">
                {published} publicado(s) · {drafts} rascunho(s)
              </p>
              <span className="text-brand mt-5 inline-flex text-sm font-bold">
                Abrir módulo
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-9">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-xl font-semibold">
            Últimas alterações
          </h2>
          {profile.role === "super_admin" ? (
            <Link
              href="/admin/auditoria"
              className="text-brand text-sm font-bold"
            >
              Ver auditoria
            </Link>
          ) : null}
        </div>
        <ol className="border-border-light mt-4 divide-y rounded-3xl border bg-white">
          {(recent ?? []).length ? (
            recent?.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap justify-between gap-3 p-4 text-sm"
              >
                <span>
                  <strong>{item.action}</strong> · {item.entity_type}
                </span>
                <time className="text-muted">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </time>
              </li>
            ))
          ) : (
            <li className="text-muted p-5">Nenhuma alteração registrada.</li>
          )}
        </ol>
      </section>
    </>
  );
}
