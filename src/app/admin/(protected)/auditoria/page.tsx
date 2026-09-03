import Link from "next/link";
import { Search, ShieldCheck } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdminPermission } from "@/lib/cms/auth";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; modulo?: string }>;
}) {
  const filters = await searchParams;
  const { supabase } = await requireAdminPermission("audit.view");
  const { data = [] } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(250);
  const modules = [
    ...new Set((data ?? []).map((item) => String(item.entity_type))),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const search = normalize(filters.q?.trim() ?? "");
  const rows = (data ?? []).filter((item) => {
    if (filters.modulo && item.entity_type !== filters.modulo) return false;
    return (
      !search ||
      normalize(
        [item.action, item.entity_type, item.entity_id, item.actor_id]
          .filter(Boolean)
          .join(" "),
      ).includes(search)
    );
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="Sistema / Governança"
        title="Auditoria"
        description="Histórico das alterações administrativas. Tokens, cookies e senhas não são registrados."
      />

      <form className="border-border-light mb-5 grid gap-3 rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(3,37,27,.03)] sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
        <label className="relative">
          <span className="sr-only">Buscar nos registros de auditoria</span>
          <Search
            size={17}
            className="text-muted pointer-events-none absolute top-3.5 left-3"
            aria-hidden="true"
          />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="Buscar ação ou identificador..."
            className="border-border-light min-h-11 w-full rounded-lg border pr-3 pl-10 text-sm"
          />
        </label>
        <label>
          <span className="sr-only">Filtrar por módulo</span>
          <select
            name="modulo"
            defaultValue={filters.modulo}
            className="border-border-light min-h-11 w-full rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Todos os módulos</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {module}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="bg-brand min-h-11 rounded-lg px-5 text-sm font-bold text-white">
            Filtrar
          </button>
          {filters.q || filters.modulo ? (
            <Link
              href="/admin/auditoria"
              className="text-muted hover:text-brand-dark inline-flex min-h-11 items-center px-3 text-sm font-bold"
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      <section className="border-border-light overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(3,37,27,.03)]">
        <div className="border-border-light hidden grid-cols-[minmax(10rem,1fr)_10rem_minmax(12rem,1fr)_11rem] gap-4 border-b bg-slate-50/80 px-5 py-3 text-[0.68rem] font-extrabold tracking-wider text-slate-500 uppercase md:grid">
          <span>Ação</span>
          <span>Módulo</span>
          <span>Objeto</span>
          <span>Data e hora</span>
        </div>
        {rows.length ? (
          <ol>
            {rows.map((item) => (
              <li
                key={item.id}
                className="border-border-light hover:bg-surface/70 grid gap-2 border-b px-5 py-4 text-sm transition-colors last:border-0 md:grid-cols-[minmax(10rem,1fr)_10rem_minmax(12rem,1fr)_11rem] md:items-center md:gap-4"
              >
                <strong className="text-brand-dark">{item.action}</strong>
                <span className="w-fit rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                  {item.entity_type}
                </span>
                <div className="min-w-0">
                  <code className="block truncate text-xs">
                    {item.entity_id || "Sem identificador"}
                  </code>
                  <span className="text-muted mt-1 block truncate text-[0.68rem]">
                    Usuário: {item.actor_id || "Sistema"}
                  </span>
                </div>
                <time dateTime={item.created_at}>
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="grid min-h-56 place-items-center p-8 text-center">
            <div>
              <ShieldCheck
                className="text-brand mx-auto"
                size={28}
                aria-hidden="true"
              />
              <h2 className="font-heading text-brand-dark mt-4 font-semibold">
                Nenhum registro encontrado
              </h2>
              <p className="text-muted mt-2 text-sm">
                Ajuste os filtros para consultar outras ações administrativas.
              </p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
