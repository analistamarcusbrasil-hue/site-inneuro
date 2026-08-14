import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  Database,
  LayoutDashboard,
  Settings,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";

type HrNavigationKey = "dashboard" | "candidates";

type HrNavigationItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  href?: string;
};

const hrNavigationItems: HrNavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/admin/rh",
  },
  { key: "jobs", label: "Vagas", icon: BriefcaseBusiness },
  { key: "processes", label: "Processos Seletivos", icon: ClipboardList },
  {
    key: "candidates",
    label: "Candidatos",
    icon: Users,
    href: "/admin/rh/candidatos",
  },
  { key: "talent", label: "Banco de Talentos", icon: Database },
  { key: "evaluations", label: "Avaliações", icon: Star },
  { key: "reports", label: "Relatórios", icon: BarChart3 },
  { key: "settings", label: "Configurações", icon: Settings },
];

export function HrNavigation({
  current,
  canManageCandidates,
}: {
  current: HrNavigationKey;
  canManageCandidates: boolean;
}) {
  return (
    <nav aria-label="Módulos de RH" className="mb-8">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {hrNavigationItems.map(({ key, label, icon: Icon, href }) => {
          const allowedHref =
            key === "candidates" && !canManageCandidates ? undefined : href;
          const active = key === current;
          const className = `flex min-h-16 items-center gap-3 rounded-2xl border px-4 ${active ? "border-brand bg-brand text-white" : "border-border-light text-muted bg-white"}`;
          const content = (
            <>
              <Icon size={19} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-bold">{label}</span>
              {!allowedHref ? (
                <span className="text-[0.6rem] font-bold tracking-wide uppercase">
                  {key === "candidates"
                    ? "Acesso restrito"
                    : "Em desenvolvimento"}
                </span>
              ) : null}
            </>
          );

          return (
            <li key={key}>
              {allowedHref ? (
                <Link
                  href={allowedHref}
                  aria-current={active ? "page" : undefined}
                  className={className}
                >
                  {content}
                </Link>
              ) : (
                <div aria-disabled="true" className={className}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
