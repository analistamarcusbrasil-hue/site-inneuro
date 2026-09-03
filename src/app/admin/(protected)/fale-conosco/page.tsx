import Link from "next/link";
import { updateContactMessageAction } from "@/app/admin/actions";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  AdminButton,
  AdminEmptyState,
  AdminMetricCard,
  AdminPagination,
} from "@/components/admin/ui";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { requireAdminPermission } from "@/lib/cms/auth";

const statusLabels: Record<string, string> = {
  NEW: "Novo",
  IN_REVIEW: "Em análise",
  ANSWERED: "Respondido",
  CLOSED: "Encerrado",
};

const categoryLabels: Record<string, string> = {
  QUESTION: "Dúvida",
  SUGGESTION: "Sugestão",
  PRAISE: "Elogio",
  COMPLAINT: "Reclamação",
  SERVICE: "Atendimento",
  INSURANCE: "Convênio",
  FINANCIAL: "Financeiro",
  OTHER: "Outro",
};

export default async function ContactMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    status?: string;
    success?: string;
    error?: string;
    pagina?: string;
  }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdminPermission("contact.view");
  const pageSize = 25;
  const page = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  let request = supabase
    .from("contact_messages")
    .select(
      "id, protocol, name, email, phone, category, subject, message, status, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (query.status && Object.hasOwn(statusLabels, query.status))
    request = request.eq("status", query.status);
  const [messagesResult, counts] = await Promise.all([
    request,
    Promise.all(
      Object.keys(statusLabels).map(async (status) => {
        const { count } = await supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("status", status);
        return { status, count: count ?? 0 };
      }),
    ),
  ]);
  const data = messagesResult.data ?? [];
  const totalPages = Math.max(
    1,
    Math.ceil((messagesResult.count ?? 0) / pageSize),
  );
  const selected = data?.find((item) => item.id === query.id) ?? null;
  const canManage = hasAdminPermission(profile, "contact.manage");
  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (query.status) params.set("status", query.status);
    params.set("pagina", String(targetPage));
    return `/admin/fale-conosco?${params.toString()}`;
  };

  return (
    <>
      <AdminPageHeading
        eyebrow="Atendimento"
        title="Fale Conosco"
        description="Consulte as mensagens enviadas pelo site e acompanhe o atendimento pelo status."
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-6 rounded-xl p-4 font-bold"
        >
          Mensagem atualizada.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Não foi possível atualizar a mensagem.
        </p>
      ) : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {counts.map(({ status, count }) => (
          <AdminMetricCard
            key={status}
            href={`/admin/fale-conosco?status=${status}`}
            label={statusLabels[status]}
            value={count.toLocaleString("pt-BR")}
            description="Mensagens neste status"
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="border-border-light overflow-hidden rounded-3xl border bg-white">
          <div className="hidden grid-cols-[8rem_8rem_1fr_9rem] gap-3 border-b bg-[#f7faf8] p-4 text-xs font-bold uppercase md:grid">
            <span>Data</span>
            <span>Protocolo</span>
            <span>Mensagem</span>
            <span>Status</span>
          </div>
          <ol>
            {data?.map((item) => (
              <li
                key={item.id}
                className="border-border-light border-b last:border-0"
              >
                <Link
                  href={`/admin/fale-conosco?id=${item.id}${query.status ? `&status=${query.status}` : ""}`}
                  className="grid gap-2 p-4 text-sm md:grid-cols-[8rem_8rem_1fr_9rem] md:gap-3"
                >
                  <time>
                    {new Date(item.created_at).toLocaleDateString("pt-BR")}
                  </time>
                  <strong>{item.protocol}</strong>
                  <span>
                    <strong>{item.name}</strong>
                    <span className="text-muted mt-1 block">
                      {categoryLabels[item.category] ?? item.category} ·{" "}
                      {item.subject}
                    </span>
                  </span>
                  <span>{statusLabels[item.status] ?? item.status}</span>
                </Link>
              </li>
            ))}
          </ol>
          {!data.length ? (
            <AdminEmptyState
              className="m-4"
              title="Nenhuma mensagem encontrada"
              description="Ajuste o filtro de status ou aguarde novos contatos enviados pelo site."
            />
          ) : null}
          <AdminPagination
            className="border-border-light border-t p-4"
            page={page}
            totalPages={totalPages}
            previousHref={page > 1 ? pageHref(page - 1) : undefined}
            nextHref={page < totalPages ? pageHref(page + 1) : undefined}
          />
        </section>
        <aside className="border-border-light rounded-3xl border bg-white p-5 sm:p-6">
          {selected ? (
            <>
              <p className="text-brand text-xs font-bold tracking-widest uppercase">
                {selected.protocol}
              </p>
              <h2 className="font-heading text-brand-dark mt-2 text-2xl font-semibold">
                {selected.subject}
              </h2>
              <dl className="mt-5 grid gap-3 text-sm">
                <div>
                  <dt className="font-bold">Nome</dt>
                  <dd>{selected.name}</dd>
                </div>
                <div>
                  <dt className="font-bold">E-mail</dt>
                  <dd>{selected.email}</dd>
                </div>
                <div>
                  <dt className="font-bold">Telefone</dt>
                  <dd>{selected.phone || "Não informado"}</dd>
                </div>
                <div>
                  <dt className="font-bold">Categoria</dt>
                  <dd>
                    {categoryLabels[selected.category] ?? selected.category}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold">Data</dt>
                  <dd>
                    {new Date(selected.created_at).toLocaleString("pt-BR")}
                  </dd>
                </div>
              </dl>
              <div className="bg-surface mt-5 rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {selected.message}
              </div>
              {canManage ? (
                <form
                  action={updateContactMessageAction}
                  className="mt-5 flex gap-2"
                >
                  <input type="hidden" name="id" value={selected.id} />
                  <select
                    name="status"
                    defaultValue={selected.status}
                    className="border-border-light min-h-11 flex-1 rounded-xl border px-3"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <AdminButton type="submit">Salvar</AdminButton>
                </form>
              ) : (
                <p className="text-muted mt-5 text-sm">
                  Acesso somente para consulta.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted">
              Selecione uma mensagem para ver os detalhes.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
