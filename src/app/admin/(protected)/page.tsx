import Link from "next/link";
import {
  BriefcaseBusiness,
  ClipboardList,
  MessageSquareText,
  Newspaper,
  Users,
} from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { requireAdmin } from "@/lib/cms/auth";
import { hasAdminPermission } from "@/lib/admin/permissions";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const cards: {
    href: string;
    label: string;
    description: string;
    count?: number;
    icon: typeof Newspaper;
  }[] = [];

  if (hasAdminPermission(profile, "publications.view")) {
    const { count } = await supabase
      .from("news_posts")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
    cards.push({
      href: "/admin/noticias",
      label: "Publicações",
      description: "Conteúdo institucional e do site",
      count: count ?? 0,
      icon: Newspaper,
    });
  }
  if (hasAdminPermission(profile, "hr.view")) {
    cards.push({
      href: "/admin/rh",
      label: "RH",
      description: "Recrutamento e gestão de candidatos",
      icon: BriefcaseBusiness,
    });
  }
  if (hasAdminPermission(profile, "scheduling.view")) {
    const { count } = await supabase
      .from("appointment_requests")
      .select("id", { count: "exact", head: true });
    cards.push({
      href: "/admin/solicitacoes",
      label: "Agendamentos",
      description: "Fila de solicitações e pendências",
      count: count ?? 0,
      icon: ClipboardList,
    });
  }
  if (hasAdminPermission(profile, "contact.view")) {
    const { count } = await supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "NEW");
    cards.push({
      href: "/admin/fale-conosco",
      label: "Fale Conosco",
      description: "Mensagens novas e em atendimento",
      count: count ?? 0,
      icon: MessageSquareText,
    });
  }
  if (hasAdminPermission(profile, "users.manage")) {
    cards.push({
      href: "/admin/usuarios",
      label: "Usuários e acessos",
      description: "Perfis, permissões e status",
      icon: Users,
    });
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="Painel administrativo"
        title={`Olá, ${profile.full_name?.split(" ")[0] || "equipe"}`}
        description="Estas são as áreas liberadas para sua conta."
      />
      {query.error === "permission" ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-xl p-4 font-bold"
        >
          Sua conta não possui acesso à área solicitada.
        </p>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ href, label, description, count, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="border-border-light group block rounded-3xl border bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#087a4d]"
            >
              <span className="bg-mint text-brand grid size-11 place-items-center rounded-2xl">
                <Icon aria-hidden="true" size={21} />
              </span>
              <p className="font-heading text-brand-dark mt-5 text-xl font-semibold">
                {label}
              </p>
              {typeof count === "number" ? (
                <p className="font-heading text-brand mt-2 text-3xl font-semibold">
                  {count.toLocaleString("pt-BR")}
                </p>
              ) : null}
              <p className="text-muted mt-2 text-sm">{description}</p>
              <span className="text-brand mt-5 inline-flex text-sm font-bold">
                Abrir módulo
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!cards.length ? (
        <p className="border-border-light text-muted rounded-2xl border bg-white p-6">
          Nenhum módulo foi liberado para esta conta. Procure o
          superadministrador.
        </p>
      ) : null}
    </>
  );
}
