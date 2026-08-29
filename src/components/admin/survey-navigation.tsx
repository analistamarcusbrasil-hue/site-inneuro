import Link from "next/link";
import { hasAdminPermission } from "@/lib/admin/permissions";
import type { AdminProfile } from "@/types/cms";
import {
  BarChart3,
  ClipboardList,
  FileQuestion,
  Flag,
  LayoutDashboard,
  QrCode,
  Settings,
} from "lucide-react";

export type SurveyNavigationKey =
  | "dashboard"
  | "responses"
  | "questions"
  | "qrcode"
  | "priorities"
  | "reports"
  | "settings";

export function surveyNavigationPermissions(profile: AdminProfile) {
  return {
    canView: hasAdminPermission(profile, "surveys.view"),
    canManage: hasAdminPermission(profile, "surveys.manage"),
    canReports: hasAdminPermission(profile, "surveys.reports"),
    canQrCode: hasAdminPermission(profile, "surveys.qrcode"),
  };
}

const items = [
  { key: "dashboard", label: "Visão geral", icon: LayoutDashboard, href: "/admin/pesquisas/satisfacao", permission: "view" },
  { key: "responses", label: "Respostas", icon: ClipboardList, href: "/admin/pesquisas/satisfacao/respostas", permission: "view" },
  { key: "questions", label: "Perguntas", icon: FileQuestion, href: "/admin/pesquisas/satisfacao/perguntas", permission: "manage" },
  { key: "qrcode", label: "QR Code", icon: QrCode, href: "/admin/pesquisas/satisfacao/qrcode", permission: "qrcode" },
  { key: "priorities", label: "Prioridades", icon: Flag, href: "/admin/pesquisas/satisfacao/prioridades", permission: "reports" },
  { key: "reports", label: "Relatórios", icon: BarChart3, href: "/admin/pesquisas/satisfacao/relatorios", permission: "reports" },
  { key: "settings", label: "Configurações", icon: Settings, href: "/admin/pesquisas/satisfacao/configuracoes", permission: "manage" },
] as const;

export function SurveyNavigation({
  current,
  canView,
  canManage,
  canReports,
  canQrCode,
}: {
  current: SurveyNavigationKey;
  canView: boolean;
  canManage: boolean;
  canReports: boolean;
  canQrCode: boolean;
}) {
  return (
    <nav aria-label="Satisfação do Cliente" className="mb-8 overflow-x-auto pb-1">
      <ul className="flex min-w-max gap-2">
        {items.map(({ key, label, icon: Icon, href, permission }) => {
          const allowed =
            (permission === "view" && canView) ||
            (permission === "manage" && canManage) ||
            (permission === "reports" && canReports) ||
            (permission === "qrcode" && canQrCode);
          if (!allowed) return null;
          const active = current === key;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${active ? "border-brand bg-brand text-white" : "border-border-light bg-white text-slate-600 hover:border-emerald-500"}`}
              >
                <Icon size={16} aria-hidden="true" /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
