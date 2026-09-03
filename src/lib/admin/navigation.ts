import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  ContactRound,
  Database,
  FileQuestion,
  Flag,
  HeartHandshake,
  Images,
  LayoutDashboard,
  MessageSquareText,
  QrCode,
  ScrollText,
  Settings,
  Star,
  Trash2,
  UserRoundCog,
} from "lucide-react";
import { hasAdminPermission } from "@/lib/admin/permissions";
import {
  hasHrPermission,
  resolveHrAccessRole,
} from "@/lib/careers/hr-permissions";
import { cmsModules } from "@/lib/cms/modules";
import type { AdminProfile } from "@/types/cms";

export type AdminNavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  exact?: boolean;
  children?: AdminNavigationItem[];
};

export type AdminNavigationSection = {
  id: string;
  label: string;
  items: AdminNavigationItem[];
};

export function isAdminNavigationItemActive(
  item: Pick<AdminNavigationItem, "href" | "exact">,
  pathname: string,
) {
  if (!item.href) return false;
  return (
    item.href === pathname ||
    (!item.exact && pathname.startsWith(`${item.href}/`))
  );
}

export function getAdminNavigation(
  profile: AdminProfile,
): AdminNavigationSection[] {
  const canViewPublications = hasAdminPermission(profile, "publications.view");
  const hrRole = resolveHrAccessRole(profile);
  const contentChildren: AdminNavigationItem[] = canViewPublications
    ? [
        ...cmsModules.map((module) => ({
          id: `content-${module.key}`,
          href: `/admin/${module.key}`,
          label: module.label,
          icon: module.icon,
        })),
        {
          id: "content-media",
          href: "/admin/midias",
          label: "Mídias",
          icon: Images,
        },
        {
          id: "content-trash",
          href: "/admin/lixeira",
          label: "Lixeira",
          icon: Trash2,
        },
      ]
    : [];

  if (hasAdminPermission(profile, "settings.manage")) {
    contentChildren.push({
      id: "content-schedules",
      href: "/admin/horarios",
      label: "Horários dos exames",
      icon: CalendarRange,
    });
  }

  const siteItems: AdminNavigationItem[] = [];
  if (contentChildren.length) {
    siteItems.push({
      id: "site-content",
      label: "Conteúdo do site",
      icon: ClipboardList,
      children: contentChildren,
    });
  }
  if (hasAdminPermission(profile, "scheduling.view")) {
    siteItems.push({
      id: "scheduling",
      href: "/admin/solicitacoes",
      label: "Agendamentos",
      icon: CalendarDays,
    });
  }
  if (hasAdminPermission(profile, "contact.view")) {
    siteItems.push({
      id: "contact",
      href: "/admin/fale-conosco",
      label: "Fale Conosco",
      icon: MessageSquareText,
    });
  }

  const managementItems: AdminNavigationItem[] = [];
  if (hrRole) {
    const hrChildren: AdminNavigationItem[] = [
      {
        id: "hr-overview",
        href: "/admin/rh",
        exact: true,
        label: "Visão geral",
        icon: LayoutDashboard,
      },
    ];
    if (hasHrPermission(hrRole, "jobs:manage")) {
      hrChildren.push({
        id: "hr-jobs",
        href: "/admin/rh/vagas",
        label: "Vagas",
        icon: BriefcaseBusiness,
      });
    }
    if (hasHrPermission(hrRole, "candidates:manage")) {
      hrChildren.push({
        id: "hr-candidates",
        href: "/admin/rh/candidatos",
        label: "Candidatos",
        icon: ContactRound,
      });
    }
    if (hasHrPermission(hrRole, "processes:manage")) {
      hrChildren.push({
        id: "hr-processes",
        href: "/admin/rh/processos",
        label: "Processos",
        icon: ClipboardCheck,
      });
    }
    if (hasHrPermission(hrRole, "talent-bank:manage")) {
      hrChildren.push({
        id: "hr-talent",
        href: "/admin/rh/talentos",
        label: "Banco de talentos",
        icon: Database,
      });
    }
    if (hasHrPermission(hrRole, "assigned-candidates:evaluate")) {
      hrChildren.push({
        id: "hr-evaluations",
        href: "/admin/rh/avaliacoes",
        label: "Avaliações",
        icon: Star,
      });
    }
    if (hasHrPermission(hrRole, "reports:view")) {
      hrChildren.push({
        id: "hr-reports",
        href: "/admin/rh/relatorios",
        label: "Relatórios",
        icon: BarChart3,
      });
    }
    if (hasHrPermission(hrRole, "settings:manage")) {
      hrChildren.push({
        id: "hr-settings",
        href: "/admin/rh/configuracoes",
        label: "Configurações",
        icon: Settings,
      });
    }
    managementItems.push({
      id: "human-resources",
      label: "RH / Recrutamento",
      icon: BriefcaseBusiness,
      children: hrChildren,
    });
  }

  const surveyChildren: AdminNavigationItem[] = [];
  if (hasAdminPermission(profile, "surveys.view")) {
    surveyChildren.push(
      {
        id: "survey-overview",
        href: "/admin/pesquisas/satisfacao",
        exact: true,
        label: "Satisfação",
        icon: HeartHandshake,
      },
      {
        id: "survey-responses",
        href: "/admin/pesquisas/satisfacao/respostas",
        label: "Respostas",
        icon: ClipboardList,
      },
      {
        id: "survey-climate",
        href: "/admin/pesquisas/clima",
        label: "Clima institucional",
        icon: HeartHandshake,
      },
    );
  }
  if (hasAdminPermission(profile, "surveys.manage")) {
    surveyChildren.push({
      id: "survey-questions",
      href: "/admin/pesquisas/satisfacao/perguntas",
      label: "Perguntas",
      icon: FileQuestion,
    });
  }
  if (hasAdminPermission(profile, "surveys.qrcode")) {
    surveyChildren.push({
      id: "survey-qrcode",
      href: "/admin/pesquisas/satisfacao/qrcode",
      label: "QR Code",
      icon: QrCode,
    });
  }
  if (hasAdminPermission(profile, "surveys.reports")) {
    surveyChildren.push(
      {
        id: "survey-priorities",
        href: "/admin/pesquisas/satisfacao/prioridades",
        label: "Prioridades",
        icon: Flag,
      },
      {
        id: "survey-reports",
        href: "/admin/pesquisas/satisfacao/relatorios",
        label: "Relatórios",
        icon: BarChart3,
      },
    );
  }
  if (hasAdminPermission(profile, "surveys.manage")) {
    surveyChildren.push({
      id: "survey-settings",
      href: "/admin/pesquisas/satisfacao/configuracoes",
      label: "Configurações",
      icon: Settings,
    });
  }
  if (surveyChildren.length) {
    managementItems.push({
      id: "experience",
      label: "Experiência e Pesquisas",
      icon: HeartHandshake,
      children: surveyChildren,
    });
  }

  const systemItems: AdminNavigationItem[] = [];
  if (hasAdminPermission(profile, "users.manage")) {
    systemItems.push({
      id: "users",
      href: "/admin/usuarios",
      label: "Usuários e acessos",
      icon: UserRoundCog,
    });
  }
  if (hasAdminPermission(profile, "audit.view")) {
    systemItems.push({
      id: "audit",
      href: "/admin/auditoria",
      label: "Auditoria",
      icon: ScrollText,
    });
  }
  if (hasAdminPermission(profile, "settings.manage")) {
    systemItems.push({
      id: "settings",
      href: "/admin/informacoes",
      label: "Configurações",
      icon: Settings,
    });
  }

  return [
    {
      id: "principal",
      label: "Principal",
      items: [
        {
          id: "overview",
          href: "/admin",
          exact: true,
          label: "Visão geral",
          icon: LayoutDashboard,
        },
      ],
    },
    { id: "site", label: "Site", items: siteItems },
    { id: "management", label: "Gestão", items: managementItems },
    { id: "system", label: "Sistema", items: systemItems },
  ].filter((section) => section.items.length > 0);
}
