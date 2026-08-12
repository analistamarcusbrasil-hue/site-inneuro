import { AtSign, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Container } from "@/components/layout/container";
import type { SiteConfig } from "@/config/site";
import { createWhatsAppUrl } from "@/lib/whatsapp";
import type { SchedulingSettings } from "@/lib/scheduling/settings";

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
const vegaWhatsAppUrl =
  "https://wa.me/5596991493854?text=Ol%C3%A1%2C%20Marcus.%20Conheci%20seu%20trabalho%20pelo%20site%20da%20INNEURO%20e%20gostaria%20de%20conversar%20sobre%20uma%20solu%C3%A7%C3%A3o%20em%20tecnologia.";

export function Footer({
  config,
  scheduling,
}: {
  config: SiteConfig;
  scheduling: SchedulingSettings;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-dark text-white">
      <Container className="grid gap-12 py-14 sm:grid-cols-2 lg:grid-cols-[1.1fr_.7fr_1.2fr] lg:py-18">
        <div className="max-w-sm">
          <Logo inverse wordmark />
          <p className="font-heading mt-5 text-lg font-semibold">
            {config.fullName}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-white/68">
            {config.description}
          </p>
          <p className="mt-5 flex gap-2 text-sm leading-relaxed text-white/72">
            <MapPin aria-hidden="true" size={16} className="shrink-0" />
            {config.address.formatted}
          </p>
          <p className="text-mint mt-4 text-sm font-semibold">
            {scheduling.shortText}
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
            {Object.values(config.whatsapp).map((channel) => (
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
              href={config.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram da INNEURO — abre em nova aba"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-white/72 hover:text-white"
            >
              <AtSign aria-hidden="true" size={16} />
              {config.instagram.handle}
              <ExternalLink aria-hidden="true" size={13} />
            </a>
            <a
              href={config.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Como chegar pelo Google Maps — abre em nova aba"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-white/72 hover:text-white"
            >
              <MapPin aria-hidden="true" size={16} />
              Como chegar
              <ExternalLink aria-hidden="true" size={13} />
            </a>
            {config.patientPortal.url && (
              <a
                href={config.patientPortal.url}
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
        <Container className="grid justify-items-center gap-4 py-5 text-center text-xs text-white/70 lg:grid-cols-[1fr_auto] lg:items-end lg:text-left">
          <p className="lg:justify-self-start">
            © {year} INNEURO — Instituto de Neurologia do Amapá.
          </p>
          <div className="flex flex-col items-center gap-2 lg:items-end lg:justify-self-end">
            <nav
              aria-label="Informações legais"
              className="flex flex-wrap justify-center gap-x-5 gap-y-1 lg:justify-end"
            >
              {legalLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-9 items-center hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-2 text-[0.68rem] text-white/50">
              <span>Tecnologia por</span>
              <a
                href={vegaWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Falar com a VEGA Tecnologia pelo WhatsApp"
                className="group focus-visible:ring-tech relative inline-flex cursor-pointer items-center rounded-md opacity-75 transition-[opacity,transform] duration-200 hover:scale-[1.015] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#03251b] focus-visible:outline-none"
              >
                <Image
                  src="/images/vega-logo-footer.webp"
                  alt="VEGA Tecnologia"
                  width={1322}
                  height={606}
                  sizes="(max-width: 1023px) 72px, 86px"
                  className="h-auto w-[72px] object-contain lg:w-[86px]"
                />
                <ExternalLink
                  aria-hidden="true"
                  size={9}
                  className="absolute -top-0.5 -right-2.5 text-[#91c5a7]/65"
                />
              </a>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  );
}
