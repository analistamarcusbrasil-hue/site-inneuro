"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  Image,
  Trash2,
  Users,
  ScrollText,
  LogOut,
  CalendarClock,
  ClipboardList,
  BriefcaseBusiness,
  MessageSquareText,
  Settings,
} from "lucide-react";
import { cmsModules } from "@/lib/cms/modules";
import { canAccessHr } from "@/lib/careers/hr-permissions";
import type { AdminProfile } from "@/types/cms";
import { logoutAction } from "@/app/admin/actions";
import {
  accessProfileLabels,
  hasAdminPermission,
} from "@/lib/admin/permissions";

const extraLinks = [
  {
    href: "/admin/fale-conosco",
    label: "Fale Conosco",
    icon: MessageSquareText,
  },
  {
    href: "/admin/solicitacoes",
    label: "Solicitações de agendamento",
    icon: ClipboardList,
  },
  {
    href: "/admin/horarios",
    label: "Horários dos exames",
    icon: CalendarClock,
  },
  { href: "/admin/midias", label: "Mídias", icon: Image },
  { href: "/admin/lixeira", label: "Lixeira", icon: Trash2 },
  { href: "/admin/usuarios", label: "Usuários e acessos", icon: Users },
  {
    href: "/admin/auditoria",
    label: "Auditoria",
    icon: ScrollText,
  },
  { href: "/admin/informacoes", label: "Configurações", icon: Settings },
];

export function AdminShell({
  profile,
  children,
}: {
  profile: AdminProfile;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const contentLinks = (
    hasAdminPermission(profile, "publications.view") ? cmsModules : []
  ).map((item) => ({
    href: `/admin/${item.key}`,
    label: item.label,
    icon: item.icon,
  }));
  const managementLinks = extraLinks.filter((item) => {
    if (item.href === "/admin/solicitacoes")
      return hasAdminPermission(profile, "scheduling.view");
    if (item.href === "/admin/fale-conosco")
      return hasAdminPermission(profile, "contact.view");
    if (["/admin/midias", "/admin/lixeira"].includes(item.href))
      return hasAdminPermission(profile, "publications.view");
    if (["/admin/horarios", "/admin/informacoes"].includes(item.href))
      return hasAdminPermission(profile, "settings.manage");
    if (item.href === "/admin/usuarios")
      return hasAdminPermission(profile, "users.manage");
    if (item.href === "/admin/auditoria")
      return hasAdminPermission(profile, "audit.view");
    return false;
  });
  const hrLinks = canAccessHr(profile)
    ? [
        {
          href: "/admin/rh",
          label: "RH / Recrutamento",
          icon: BriefcaseBusiness,
        },
      ]
    : [];
  const links = [
    { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
    ...contentLinks,
    ...hrLinks,
    ...managementLinks,
  ];
  const isLinkActive = (href: string) =>
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="bg-surface min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-sidebar"
        onClick={() => setOpen(true)}
        className="bg-brand-dark fixed top-4 left-4 z-40 grid size-12 place-items-center rounded-full text-white lg:hidden"
      >
        <Menu aria-hidden="true" />
        <span className="sr-only">Abrir menu administrativo</span>
      </button>
      {open ? (
        <button
          type="button"
          aria-label="Fechar menu administrativo"
          className="fixed inset-0 z-40 bg-black/45 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        id="admin-sidebar"
        className={`bg-brand-dark fixed inset-y-0 left-0 z-50 flex w-72 flex-col text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="font-heading text-xl font-bold tracking-wide"
            >
              INNEURO <span className="text-tech">Admin</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid size-11 place-items-center rounded-full lg:hidden"
            >
              <X aria-hidden="true" />
              <span className="sr-only">Fechar menu</span>
            </button>
          </div>
          <p className="text-mint mt-3 text-xs">
            {profile.full_name || "Usuário administrativo"}
          </p>
          <p className="text-tech mt-1 text-[0.65rem] font-bold tracking-widest uppercase">
            {profile.access_profile
              ? accessProfileLabels[profile.access_profile]
              : profile.role.replace("_", " ")}
          </p>
        </div>
        <nav aria-label="Administração" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            <li>
              <p className="px-3 pt-2 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                Comece aqui
              </p>
            </li>
            {links.slice(0, 1).map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isLinkActive(href) ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isLinkActive(href) ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
            {contentLinks.length ? (
              <li>
                <p className="px-3 pt-5 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                  Conteúdo do site
                </p>
              </li>
            ) : null}
            {contentLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isLinkActive(href) ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isLinkActive(href) ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
            {hrLinks.length ? (
              <li>
                <p className="px-3 pt-5 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                  Gestão de pessoas
                </p>
              </li>
            ) : null}
            {hrLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isLinkActive(href) ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isLinkActive(href) ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
            {managementLinks.length ? (
              <li>
                <p className="px-3 pt-5 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                  Organização e segurança
                </p>
              </li>
            ) : null}
            {managementLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={isLinkActive(href) ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${isLinkActive(href) ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={logoutAction} className="border-t border-white/10 p-4">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/80 hover:bg-white/10">
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="border-border-light sticky top-0 z-30 flex min-h-20 items-center border-b bg-white/95 px-6 pl-20 backdrop-blur lg:px-10">
          <p className="text-muted text-sm">
            Administração /{" "}
            <strong className="text-ink">
              {links.find((item) => isLinkActive(item.href))?.label ??
                "Conteúdo"}
            </strong>
          </p>
        </header>
        <main id="main-content" tabIndex={-1} className="p-5 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
