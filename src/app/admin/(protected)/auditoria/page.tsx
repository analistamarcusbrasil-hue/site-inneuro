import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdmin } from "@/lib/cms/auth";

export default async function AuditPage() {
  const { supabase } = await requireAdmin(["super_admin"]);
  const { data = [] } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(250);
  return (
    <>
      <AdminPageHeading
        title="Auditoria"
        description="Histórico das alterações administrativas. Tokens, cookies e senhas não são registrados."
      />
      <div className="border-border-light overflow-hidden rounded-3xl border bg-white">
        <div className="hidden grid-cols-[10rem_10rem_1fr_11rem] gap-4 border-b bg-[#f7faf8] p-4 text-xs font-bold tracking-wide uppercase md:grid">
          <span>Ação</span>
          <span>Entidade</span>
          <span>Identificador</span>
          <span>Data</span>
        </div>
        <ol>
          {data?.map((item) => (
            <li
              key={item.id}
              className="border-border-light grid gap-2 border-b p-4 text-sm last:border-0 md:grid-cols-[10rem_10rem_1fr_11rem] md:gap-4"
            >
              <strong>{item.action}</strong>
              <span>{item.entity_type}</span>
              <code className="min-w-0 truncate text-xs">
                {item.entity_id || "—"}
              </code>
              <time>{new Date(item.created_at).toLocaleString("pt-BR")}</time>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
