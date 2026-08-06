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
  Building2,
} from "lucide-react";
import { cmsModules } from "@/lib/cms/modules";
import type { AdminProfile } from "@/types/cms";
import { logoutAction } from "@/app/admin/actions";

const extraLinks = [
  {
    href: "/admin/informacoes",
    label: "Informações institucionais",
    icon: Building2,
  },
  { href: "/admin/midias", label: "Mídias", icon: Image },
  { href: "/admin/lixeira", label: "Lixeira", icon: Trash2 },
  { href: "/admin/usuarios", label: "Usuários", icon: Users, superOnly: true },
  {
    href: "/admin/auditoria",
    label: "Auditoria",
    icon: ScrollText,
    superOnly: true,
  },
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
  const contentLinks = cmsModules.map((item) => ({
    href: `/admin/${item.key}`,
    label: item.label,
    icon: item.icon,
  }));
  const managementLinks = extraLinks.filter(
    (item) => !item.superOnly || profile.role === "super_admin",
  );
  const links = [
    { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
    ...contentLinks,
    ...managementLinks,
  ];

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
              INNEURO <span className="text-tech">CMS</span>
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
            {profile.role.replace("_", " ")}
          </p>
        </div>
        <nav aria-label="Administração" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            <li>
              <p className="px-3 pt-2 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                Comece aqui
              </p>
            </li>
            {[links[0]].map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${pathname === href ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <p className="px-3 pt-5 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                Conteúdo do site
              </p>
            </li>
            {contentLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${pathname === href ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                >
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <p className="px-3 pt-5 pb-1 text-[0.65rem] font-bold tracking-widest text-white/45 uppercase">
                Organização e segurança
              </p>
            </li>
            {managementLinks.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === href ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${pathname === href ? "bg-tech text-brand-dark" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
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
              {links.find((item) => item.href === pathname)?.label ??
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
