import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  HeartHandshake,
  MessageSquareText,
  Newspaper,
  ScrollText,
  Settings,
  UserRoundCog,
} from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { AdminMetricCard } from "@/components/admin/ui";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { requireAdmin } from "@/lib/cms/auth";

type DashboardMetric = {
  id: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  value: number;
};

type DashboardModule = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  const { supabase, profile } = await requireAdmin();
  const metricLoaders: {
    metric: Omit<DashboardMetric, "value">;
    load: () => PromiseLike<{
      count: number | null;
      error: { message: string } | null;
    }>;
  }[] = [];
  const modules: DashboardModule[] = [];

  if (hasAdminPermission(profile, "publications.view")) {
    metricLoaders.push({
      metric: {
        id: "publications",
        href: "/admin/noticias",
        label: "Publicações",
        description: "conteúdos cadastrados",
        icon: Newspaper,
      },
      load: () =>
        supabase
          .from("news_posts")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null),
    });
    modules.push({
      href: "/admin/noticias",
      label: "Conteúdo do site",
      description: "Gerencie notícias, exames, preparos, convênios e mídias.",
      icon: Newspaper,
    });
  }

  if (hasAdminPermission(profile, "hr.view")) {
    metricLoaders.push({
      metric: {
        id: "applications",
        href: "/admin/rh/candidatos",
        label: "Candidaturas",
        description: "registros no recrutamento",
        icon: BriefcaseBusiness,
      },
      load: () =>
        supabase
          .from("career_job_applications")
          .select("id", { count: "exact", head: true }),
    });
    modules.push({
      href: "/admin/rh",
      label: "RH / Recrutamento",
      description: "Acompanhe vagas, candidatos, processos e relatórios.",
      icon: BriefcaseBusiness,
    });
  }

  if (hasAdminPermission(profile, "scheduling.view")) {
    metricLoaders.push({
      metric: {
        id: "scheduling",
        href: "/admin/solicitacoes",
        label: "Agendamentos",
        description: "solicitações registradas",
        icon: CalendarDays,
      },
      load: () =>
        supabase
          .from("appointment_requests")
          .select("id", { count: "exact", head: true }),
    });
    modules.push({
      href: "/admin/solicitacoes",
      label: "Agendamentos",
      description: "Trabalhe a fila de solicitações e suas pendências.",
      icon: CalendarDays,
    });
  }

  if (hasAdminPermission(profile, "contact.view")) {
    metricLoaders.push({
      metric: {
        id: "contact",
        href: "/admin/fale-conosco",
        label: "Novas mensagens",
        description: "aguardando atendimento",
        icon: MessageSquareText,
      },
      load: () =>
        supabase
          .from("contact_messages")
          .select("id", { count: "exact", head: true })
          .eq("status", "NEW"),
    });
    modules.push({
      href: "/admin/fale-conosco",
      label: "Fale Conosco",
      description: "Consulte mensagens novas e atendimentos em andamento.",
      icon: MessageSquareText,
    });
  }

  if (hasAdminPermission(profile, "surveys.view")) {
    metricLoaders.push({
      metric: {
        id: "surveys",
        href: "/admin/pesquisas/satisfacao",
        label: "Satisfação",
        description: "respostas concluídas",
        icon: HeartHandshake,
      },
      load: () =>
        supabase
          .from("survey_responses")
          .select("id", { count: "exact", head: true })
          .not("completed_at", "is", null),
    });
  }
  if (
    hasAdminPermission(profile, "surveys.view") ||
    hasAdminPermission(profile, "surveys.qrcode")
  ) {
    modules.push({
      href: hasAdminPermission(profile, "surveys.view")
        ? "/admin/pesquisas/satisfacao"
        : "/admin/pesquisas/satisfacao/qrcode",
      label: "Experiência e Pesquisas",
      description: "Acesse satisfação, indicadores, respostas e QR Code.",
      icon: HeartHandshake,
    });
  }

  if (hasAdminPermission(profile, "users.manage")) {
    metricLoaders.push({
      metric: {
        id: "users",
        href: "/admin/usuarios",
        label: "Usuários ativos",
        description: "acessos administrativos",
        icon: UserRoundCog,
      },
      load: () =>
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
    });
    modules.push({
      href: "/admin/usuarios",
      label: "Usuários e acessos",
      description: "Administre perfis, permissões e status de acesso.",
      icon: UserRoundCog,
    });
  }
  if (hasAdminPermission(profile, "audit.view")) {
    modules.push({
      href: "/admin/auditoria",
      label: "Auditoria",
      description: "Consulte o histórico de ações administrativas.",
      icon: ScrollText,
    });
  }
  if (hasAdminPermission(profile, "settings.manage")) {
    modules.push({
      href: "/admin/informacoes",
      label: "Configurações",
      description: "Atualize informações institucionais e operacionais.",
      icon: Settings,
    });
  }

  const metricResults = await Promise.all(
    metricLoaders.map(async ({ metric, load }) => {
      const result = await load();
      return {
        metric,
        value: result.error ? null : result.count,
      };
    }),
  );
  const metrics = metricResults.flatMap(({ metric, value }) =>
    typeof value === "number" ? [{ ...metric, value }] : [],
  );
  const unavailableMetricCount = metricResults.length - metrics.length;

  return (
    <>
      <AdminPageHeading
        eyebrow="Painel administrativo"
        title={`Olá, ${profile.full_name?.split(" ")[0] || "equipe"}`}
        description="Acompanhe os indicadores e acesse rapidamente as áreas liberadas para sua conta."
      />

      {query.error === "permission" ? (
        <p
          role="alert"
          className="border-error/20 bg-error/10 text-error mb-6 rounded-xl border p-4 text-sm font-bold"
        >
          Sua conta não possui acesso à área solicitada.
        </p>
      ) : null}

      {metrics.length ? (
        <section aria-labelledby="admin-overview-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
                Visão geral
              </p>
              <h2
                id="admin-overview-title"
                className="font-heading text-brand-dark mt-1 text-xl font-semibold"
              >
                Indicadores dos módulos
              </h2>
            </div>
            <ChartNoAxesCombined
              aria-hidden="true"
              className="text-brand/55 hidden sm:block"
              size={22}
            />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {metrics.map(
              ({ id, href, label, description, value, icon: Icon }) => (
                <li key={id}>
                  <AdminMetricCard
                    href={href}
                    label={label}
                    value={value.toLocaleString("pt-BR")}
                    description={description}
                    icon={<Icon aria-hidden="true" size={19} />}
                  />
                </li>
              ),
            )}
          </ul>
        </section>
      ) : null}

      {unavailableMetricCount ? (
        <p role="status" className="text-muted mt-4 text-xs">
          Alguns indicadores estão temporariamente indisponíveis. Os módulos
          continuam acessíveis abaixo.
        </p>
      ) : null}

      {modules.length ? (
        <section
          aria-labelledby="admin-modules-title"
          className={metrics.length ? "mt-9" : ""}
        >
          <div className="mb-4">
            <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
              Navegação
            </p>
            <h2
              id="admin-modules-title"
              className="font-heading text-brand-dark mt-1 text-xl font-semibold"
            >
              Acesso rápido
            </h2>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {modules.map(({ href, label, description, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="border-border-light group flex h-full min-h-28 items-start gap-4 rounded-2xl border bg-white p-5 transition hover:border-[#87bca4] hover:bg-[#fbfdfc]"
                >
                  <span className="bg-surface text-brand border-border-light grid size-10 shrink-0 place-items-center rounded-xl border">
                    <Icon aria-hidden="true" size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-ink flex items-center justify-between gap-3 text-sm font-bold">
                      {label}
                      <ArrowRight
                        aria-hidden="true"
                        size={16}
                        className="text-muted group-hover:text-brand shrink-0 transition group-hover:translate-x-0.5"
                      />
                    </span>
                    <span className="text-muted mt-2 block text-xs leading-relaxed">
                      {description}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="border-border-light rounded-2xl border bg-white p-6">
          <h2 className="font-heading text-brand-dark text-lg font-semibold">
            Nenhum módulo disponível
          </h2>
          <p className="text-muted mt-2 text-sm">
            Nenhum módulo foi liberado para esta conta. Procure o
            superadministrador.
          </p>
        </section>
      )}
    </>
  );
}
