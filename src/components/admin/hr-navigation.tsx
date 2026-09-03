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

type HrNavigationKey =
  | "dashboard"
  | "jobs"
  | "processes"
  | "candidates"
  | "talent"
  | "evaluations"
  | "reports"
  | "settings";

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
  {
    key: "jobs",
    label: "Vagas",
    icon: BriefcaseBusiness,
    href: "/admin/rh/vagas",
  },
  {
    key: "processes",
    label: "Processos Seletivos",
    icon: ClipboardList,
    href: "/admin/rh/processos",
  },
  {
    key: "candidates",
    label: "Candidatos",
    icon: Users,
    href: "/admin/rh/candidatos",
  },
  {
    key: "talent",
    label: "Banco de Talentos",
    icon: Database,
    href: "/admin/rh/talentos",
  },
  {
    key: "evaluations",
    label: "Avaliações",
    icon: Star,
    href: "/admin/rh/avaliacoes",
  },
  {
    key: "reports",
    label: "Relatórios",
    icon: BarChart3,
    href: "/admin/rh/relatorios",
  },
  {
    key: "settings",
    label: "Configurações",
    icon: Settings,
    href: "/admin/rh/configuracoes",
  },
];

export function HrNavigation({
  current,
  canManageJobs,
  canManageCandidates,
  canManageProcesses = canManageJobs,
  canManageTalentPool = canManageCandidates,
  canEvaluate = true,
  canViewReports = canManageCandidates,
  canManageSettings = false,
}: {
  current: HrNavigationKey;
  canManageJobs: boolean;
  canManageCandidates: boolean;
  canManageProcesses?: boolean;
  canManageTalentPool?: boolean;
  canEvaluate?: boolean;
  canViewReports?: boolean;
  canManageSettings?: boolean;
}) {
  return (
    <nav
      aria-label="Módulos de RH"
      className="admin-scrollbar border-border-light mb-7 overflow-x-auto border-b pb-3"
    >
      <ul className="flex min-w-max gap-1.5">
        {hrNavigationItems.map(({ key, label, icon: Icon, href }) => {
          const allowedHref =
            (key === "candidates" && !canManageCandidates) ||
            (key === "jobs" && !canManageJobs) ||
            (key === "processes" && !canManageProcesses) ||
            (key === "talent" && !canManageTalentPool) ||
            (key === "evaluations" && !canEvaluate) ||
            (key === "reports" && !canViewReports) ||
            (key === "settings" && !canManageSettings)
              ? undefined
              : href;
          if (!allowedHref) return null;
          const active = key === current;

          return (
            <li key={key}>
              <Link
                href={allowedHref}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors ${
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted hover:text-brand-dark hover:bg-white"
                }`}
              >
                <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
