"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { accessProfileLabels } from "@/lib/admin/permissions";
import {
  getAdminNavigation,
  isAdminNavigationItemActive,
  type AdminNavigationItem,
  type AdminNavigationSection,
} from "@/lib/admin/navigation";
import type { AdminProfile } from "@/types/cms";

type NavigationTrail = {
  section: AdminNavigationSection;
  item: AdminNavigationItem;
  child?: AdminNavigationItem;
};

function findNavigationTrail(
  navigation: AdminNavigationSection[],
  pathname: string,
) {
  const matches: NavigationTrail[] = [];
  for (const section of navigation) {
    for (const item of section.items) {
      if (isAdminNavigationItemActive(item, pathname)) {
        matches.push({ section, item });
      }
      for (const child of item.children ?? []) {
        if (isAdminNavigationItemActive(child, pathname)) {
          matches.push({ section, item, child });
        }
      }
    }
  }
  return matches.sort(
    (left, right) =>
      (right.child?.href ?? right.item.href ?? "").length -
      (left.child?.href ?? left.item.href ?? "").length,
  )[0];
}

function profileInitials(profile: AdminProfile) {
  const name = profile.full_name?.trim() || profile.email?.split("@")[0] || "A";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("pt-BR"))
    .join("");
}

export function AdminShell({
  profile,
  children,
}: {
  profile: AdminProfile;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const navigation = useMemo(() => getAdminNavigation(profile), [profile]);
  const trail = findNavigationTrail(navigation, pathname);
  const activeExpandableId = trail?.child ? trail.item.id : null;
  const [expansion, setExpansion] = useState<{
    pathname: string;
    itemId: string | null;
  }>({ pathname, itemId: activeExpandableId });
  const expandedItemId =
    expansion.pathname === pathname ? expansion.itemId : activeExpandableId;
  const currentLabel =
    trail?.child?.label ?? trail?.item.label ?? "Administração";
  const displayName = profile.full_name?.trim() || "Usuário administrativo";
  const accessLabel = profile.access_profile
    ? accessProfileLabels[profile.access_profile]
    : profile.role.replaceAll("_", " ");

  useEffect(() => {
    if (!mobileOpen) return;
    const opener = openButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const backgroundContent = contentRef.current;
    backgroundContent?.setAttribute("inert", "");
    const focusTarget =
      sidebarRef.current?.querySelector<HTMLElement>("button, a[href]");
    focusTarget?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusable = Array.from(
        sidebarRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (!sidebarRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      backgroundContent?.removeAttribute("inert");
      opener?.focus();
    };
  }, [mobileOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeWhenDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeWhenDesktop);
    return () => desktop.removeEventListener("change", closeWhenDesktop);
  }, []);

  const closeMobileNavigation = () => setMobileOpen(false);
  const setExpandedItem = (itemId: string | null) =>
    setExpansion({ pathname, itemId });

  return (
    <div className="bg-surface min-h-screen [--admin-sidebar-width:16rem] lg:grid lg:grid-cols-[var(--admin-sidebar-width)_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="bg-brand fixed top-3 left-3 z-[100] -translate-y-20 rounded-xl px-4 py-3 text-sm font-bold text-white transition focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>
      <button
        ref={openButtonRef}
        type="button"
        disabled={mobileOpen}
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
        onClick={() => setMobileOpen(true)}
        className="bg-brand-dark fixed top-3 left-3 z-40 grid size-11 place-items-center rounded-xl border border-white/10 text-white shadow-sm transition hover:bg-[#0a3528] lg:hidden"
      >
        <Menu aria-hidden="true" size={20} />
        <span className="sr-only">Abrir menu administrativo</span>
      </button>

      {mobileOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-[#021812]/55 backdrop-blur-[2px] lg:hidden"
          onMouseDown={closeMobileNavigation}
        />
      ) : null}

      <aside
        ref={sidebarRef}
        id="admin-sidebar"
        aria-label="Menu administrativo"
        className={`bg-brand-dark fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col text-white shadow-2xl transition-[transform,visibility] duration-200 lg:pointer-events-auto lg:visible lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none ${mobileOpen ? "visible translate-x-0" : "pointer-events-none invisible -translate-x-full"}`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <Link
              href="/admin"
              onClick={closeMobileNavigation}
              className="font-heading text-lg font-bold tracking-wide"
            >
              INNEURO <span className="text-tech">Admin</span>
            </Link>
            <button
              type="button"
              onClick={closeMobileNavigation}
              className="grid size-10 place-items-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden"
            >
              <X aria-hidden="true" size={20} />
              <span className="sr-only">Fechar menu</span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
            <span
              aria-hidden="true"
              className="bg-tech text-brand-dark grid size-9 shrink-0 place-items-center rounded-lg text-xs font-extrabold"
            >
              {profileInitials(profile)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">
                {displayName}
              </span>
              <span className="text-tech/90 mt-0.5 block truncate text-[0.65rem] font-bold tracking-wider uppercase">
                {accessLabel}
              </span>
            </span>
          </div>
        </div>

        <nav
          aria-label="Administração"
          className="flex-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.16)_transparent] overflow-y-auto overscroll-contain px-3 py-4"
        >
          <ul className="space-y-5">
            {navigation.map((section) => (
              <li key={section.id}>
                <p className="px-3 pb-2 text-[0.62rem] font-extrabold tracking-[0.16em] text-white/40 uppercase">
                  {section.label}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive = isAdminNavigationItemActive(
                      item,
                      pathname,
                    );
                    const childActive = (item.children ?? []).some((child) =>
                      isAdminNavigationItemActive(child, pathname),
                    );

                    if (item.children?.length) {
                      const expanded = expandedItemId === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={`admin-nav-${item.id}`}
                            onClick={() =>
                              setExpandedItem(expanded ? null : item.id)
                            }
                            className={`relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition ${childActive ? "bg-white/[0.09] text-white" : "text-white/75 hover:bg-white/[0.07] hover:text-white"}`}
                          >
                            {childActive ? (
                              <span className="bg-tech absolute inset-y-2 left-0 w-0.5 rounded-full" />
                            ) : null}
                            <ItemIcon size={18} aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate">
                              {item.label}
                            </span>
                            <ChevronDown
                              aria-hidden="true"
                              size={16}
                              className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                            />
                          </button>
                          <ul
                            id={`admin-nav-${item.id}`}
                            hidden={!expanded}
                            className="mt-1 space-y-0.5 pl-4"
                          >
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const active = isAdminNavigationItemActive(
                                child,
                                pathname,
                              );
                              return (
                                <li key={child.id}>
                                  <Link
                                    href={child.href!}
                                    onClick={closeMobileNavigation}
                                    aria-current={active ? "page" : undefined}
                                    className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[0.82rem] font-semibold transition ${active ? "bg-mint/95 text-brand-dark" : "text-white/65 hover:bg-white/[0.07] hover:text-white"}`}
                                  >
                                    <ChildIcon size={16} aria-hidden="true" />
                                    <span className="min-w-0 flex-1 truncate">
                                      {child.label}
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    }

                    return (
                      <li key={item.id}>
                        <Link
                          href={item.href!}
                          onClick={closeMobileNavigation}
                          aria-current={itemActive ? "page" : undefined}
                          className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${itemActive ? "bg-mint/95 text-brand-dark" : "text-white/75 hover:bg-white/[0.07] hover:text-white"}`}
                        >
                          {itemActive ? (
                            <span className="bg-tech absolute inset-y-2 left-0 w-0.5 rounded-full" />
                          ) : null}
                          <ItemIcon size={18} aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <form action={logoutAction} className="border-t border-white/10 p-3">
          <button className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-white/70 transition hover:bg-white/[0.07] hover:text-white">
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </form>
      </aside>

      <div ref={contentRef} className="min-w-0">
        <header className="border-border-light sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-white/95 px-4 pl-18 backdrop-blur sm:px-6 sm:pl-20 lg:px-8 lg:pl-8">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 text-xs sm:text-sm">
              <li className="text-muted hidden sm:block">Administração</li>
              {trail ? (
                <>
                  <li className="text-muted hidden sm:block" aria-hidden="true">
                    <ChevronRight size={14} />
                  </li>
                  {trail.section.id !== "principal" ? (
                    <>
                      <li className="text-muted hidden sm:block">
                        {trail.section.label}
                      </li>
                      <li
                        className="text-muted hidden sm:block"
                        aria-hidden="true"
                      >
                        <ChevronRight size={14} />
                      </li>
                    </>
                  ) : null}
                  {trail.child ? (
                    <>
                      <li className="text-muted hidden max-w-40 truncate md:block">
                        {trail.item.label}
                      </li>
                      <li
                        className="text-muted hidden md:block"
                        aria-hidden="true"
                      >
                        <ChevronRight size={14} />
                      </li>
                    </>
                  ) : null}
                </>
              ) : null}
              <li
                aria-current="page"
                className="text-ink max-w-[12rem] truncate font-semibold sm:max-w-xs"
              >
                {currentLabel}
              </li>
            </ol>
          </nav>
          <div className="hidden min-w-0 items-center gap-2 sm:flex">
            <span
              aria-hidden="true"
              className="bg-mint text-brand grid size-8 shrink-0 place-items-center rounded-lg text-[0.65rem] font-extrabold"
            >
              {profileInitials(profile)}
            </span>
            <span className="text-muted max-w-36 truncate text-xs font-semibold xl:max-w-52">
              {displayName}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 p-4 sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
