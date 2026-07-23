import { AtSign, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";
import { createWhatsAppUrl } from "@/lib/whatsapp";

const footerLinks = [
  { label: "Exames", href: "/exames" },
  { label: "Preparos", href: "/preparos" },
  { label: "Convênios", href: "/convenios" },
  { label: "Notícias", href: "/noticias" },
  { label: "Sobre", href: "/sobre" },
  { label: "Contato", href: "/contato" },
] as const;
const generalMessage =
  "Olá! Acessei o site da INNEURO e gostaria de informações sobre exames.";
const legalLinks = [
  { label: "Privacidade", href: "/politica-de-privacidade" },
  { label: "Termos de uso", href: "/termos-de-uso" },
  { label: "Cookies", href: "/politica-de-cookies" },
] as const;

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-dark text-white">
      <Container className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.1fr_.7fr_1.2fr] lg:py-18">
        <div className="max-w-sm">
          <Logo inverse />
          <p className="font-heading mt-5 text-lg font-semibold">
            {siteConfig.fullName}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/68">
            {siteConfig.description}
          </p>
          <p className="mt-5 flex gap-2 text-sm leading-relaxed text-white/72">
            <MapPin aria-hidden="true" size={16} className="shrink-0" />
            {siteConfig.address.formatted}
          </p>
        </div>
        <div>
          <h2 className="text-mint text-xs font-bold tracking-[.14em] uppercase">
            Navegação
          </h2>
          <nav className="mt-4 flex flex-col" aria-label="Navegação do rodapé">
            {footerLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center text-sm text-white/72 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <h2 className="text-mint text-xs font-bold tracking-[.14em] uppercase">
            Canais oficiais
          </h2>
          <div className="mt-4 flex flex-col">
            {Object.values(siteConfig.whatsapp).map((channel) => (
              <a
                key={channel.number}
                href={createWhatsAppUrl(channel.number, generalMessage)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${channel.label} ${channel.display} — abre em nova aba`}
                className="inline-flex min-h-11 items-center gap-2 text-sm text-white/72 hover:text-white"
              >
                <MessageCircle aria-hidden="true" size={16} />
                {channel.display}
                <ExternalLink aria-hidden="true" size={13} />
              </a>
            ))}
            <a
              href={siteConfig.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram da INNEURO — abre em nova aba"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-white/72 hover:text-white"
            >
              <AtSign aria-hidden="true" size={16} />
              {siteConfig.instagram.handle}
              <ExternalLink aria-hidden="true" size={13} />
            </a>
            <a
              href={siteConfig.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Como chegar pelo Google Maps — abre em nova aba"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-white/72 hover:text-white"
            >
              <MapPin aria-hidden="true" size={16} />
              Como chegar
              <ExternalLink aria-hidden="true" size={13} />
            </a>
            {siteConfig.patientPortal.url && (
              <a
                href={siteConfig.patientPortal.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Portal de Exames — abre em uma nova aba"
                className="inline-flex min-h-11 items-center gap-2 text-sm text-white/72"
              >
                Portal de Exames
                <ExternalLink aria-hidden="true" size={13} />
              </a>
            )}
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-4 py-5 text-xs text-white/70 lg:flex-row lg:items-center lg:justify-between">
          <p>© {year} INNEURO — Instituto de Neurologia do Amapá.</p>
          <nav
            aria-label="Informações legais"
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            {legalLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-11 items-center hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </Container>
      </div>
    </footer>
  );
}
