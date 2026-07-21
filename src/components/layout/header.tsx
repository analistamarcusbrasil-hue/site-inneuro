"use client";

import { ExternalLink, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

const menuId = "inneuro-mobile-menu";

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 20);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isMenuOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => firstLinkRef.current?.focus());
    } else if (!isMenuOpen && dialog.open) {
      dialog.close();
    }
  }, [isMenuOpen]);

  const closeMenu = () => dialogRef.current?.close();
  const lightHeader = !isScrolled && !isMenuOpen;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
        lightHeader
          ? "border-white/10 bg-transparent text-white"
          : "border-border-light/80 text-ink bg-white/92 shadow-[0_10px_35px_rgba(3,37,27,0.06)] backdrop-blur-xl",
      )}
    >
      <Container className="flex min-h-20 items-center justify-between gap-4 xl:min-h-24">
        <Link
          href="/"
          aria-label="INNEURO — página inicial"
          className="focus-visible:ring-tech shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          <Logo inverse={lightHeader} />
        </Link>

        <nav
          className="hidden items-center gap-1 xl:flex"
          aria-label="Navegação principal"
        >
          {siteConfig.navigation.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-tech relative rounded-full px-3 py-2 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  lightHeader
                    ? active
                      ? "bg-white/12 text-white"
                      : "text-white/72 hover:bg-white/8 hover:text-white"
                    : active
                      ? "bg-mint text-brand-dark"
                      : "text-muted hover:bg-mint/60 hover:text-brand-dark",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex">
          {siteConfig.patientPortal.url ? (
            <a
              href={siteConfig.patientPortal.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Portal de Exames — abre em uma nova aba"
              className={cn(
                "focus-visible:ring-tech inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                lightHeader
                  ? "text-white hover:bg-white/10"
                  : "text-brand-dark hover:bg-mint",
              )}
            >
              Portal de Exames <ExternalLink aria-hidden="true" size={15} />
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Portal de Exames indisponível no momento"
              className={cn(
                "inline-flex min-h-11 cursor-not-allowed items-center gap-2 rounded-full px-4 text-sm font-semibold opacity-45",
                lightHeader ? "text-white" : "text-muted",
              )}
            >
              Portal de Exames <ExternalLink aria-hidden="true" size={15} />
            </button>
          )}
          <Link
            href="/#agendamento"
            className="bg-tech text-brand-dark hover:bg-mint focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Agendar exame
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          onClick={() => setIsMenuOpen((current) => !current)}
          className={cn(
            "focus-visible:ring-tech grid min-h-12 min-w-12 place-items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none xl:hidden",
            lightHeader
              ? "border-white/25 text-white hover:bg-white/10"
              : "border-border-light text-brand-dark hover:bg-mint",
          )}
        >
          {isMenuOpen ? (
            <X aria-hidden="true" size={22} />
          ) : (
            <Menu aria-hidden="true" size={22} />
          )}
        </button>
      </Container>

      <dialog
        ref={dialogRef}
        id={menuId}
        aria-label="Menu principal"
        onClose={() => {
          setIsMenuOpen(false);
          menuButtonRef.current?.focus();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
          }
        }}
        className="border-border-light text-ink backdrop:bg-brand-dark/40 fixed inset-x-0 top-20 m-0 max-h-[calc(100dvh-5rem)] w-full max-w-none overflow-y-auto border-x-0 border-t bg-white px-5 pt-5 pb-8 shadow-2xl backdrop:backdrop-blur-[2px] sm:px-8 xl:hidden"
      >
        <div className="mx-auto flex w-full max-w-[1280px] justify-end">
          <button
            type="button"
            onClick={closeMenu}
            className="border-border-light text-brand-dark focus-visible:ring-brand grid min-h-12 min-w-12 place-items-center rounded-full border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label="Fechar menu"
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>
        <nav
          className="mx-auto flex w-full max-w-[1280px] flex-col"
          aria-label="Navegação para celular"
        >
          {siteConfig.navigation.map((item, index) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <Link
                ref={index === 0 ? firstLinkRef : undefined}
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={closeMenu}
                className={cn(
                  "focus-visible:ring-tech flex min-h-13 items-center rounded-2xl px-4 text-base font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  active
                    ? "bg-mint text-brand-dark"
                    : "text-ink hover:bg-surface",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="border-border-light mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2">
            {siteConfig.patientPortal.url ? (
              <a
                href={siteConfig.patientPortal.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Portal de Exames — abre em uma nova aba"
                onClick={closeMenu}
                className="border-brand/25 text-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-5 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                Portal de Exames <ExternalLink aria-hidden="true" size={16} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="border-border-light text-muted inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-full border px-5 text-sm font-bold opacity-60"
              >
                Portal de Exames <ExternalLink aria-hidden="true" size={16} />
              </button>
            )}
            <Link
              href="/#agendamento"
              onClick={closeMenu}
              className="bg-brand focus-visible:ring-tech inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
            >
              Agendar exame
            </Link>
          </div>
        </nav>
      </dialog>
    </header>
  );
}
