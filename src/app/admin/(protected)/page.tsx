import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { cmsModules } from "@/lib/cms/modules";
import { requireAdmin } from "@/lib/cms/auth";

export default async function AdminDashboardPage() {
  const { supabase } = await requireAdmin();
  const cards = await Promise.all(
    cmsModules.map(async (module) => {
      const { count } = await supabase
        .from(module.table)
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      return { ...module, count: count ?? 0 };
    }),
  );
  return (
    <>
      <AdminPageHeading
        eyebrow="Painel administrativo"
        title="O que você quer atualizar?"
        description="Escolha uma área abaixo. Você poderá salvar, visualizar e confirmar antes de publicar no site."
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ key, label, count, icon: Icon }) => (
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
                conteúdo(s) cadastrado(s)
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
