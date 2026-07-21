import { ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { PartnersShowcase } from "@/components/partners/partners-showcase";
import { siteConfig } from "@/config/site";
import { createWhatsAppUrl } from "@/lib/whatsapp";

export function Insurance() {
  const whatsappUrl = createWhatsAppUrl(
    siteConfig.whatsapp.primary.number,
    "Olá! Acessei o site da INNEURO e gostaria de confirmar cobertura e autorização para um exame.",
  );
  return (
    <section
      id="convenios"
      aria-labelledby="insurance-title"
      className="bg-white py-16 sm:py-20 lg:py-28"
    >
      <Container>
        <div className="mb-10 max-w-3xl">
          <ShieldCheck
            className="text-brand"
            aria-hidden="true"
            size={34}
            strokeWidth={1.5}
          />
          <p className="text-brand mt-6 text-xs font-bold tracking-[.14em] uppercase">
            Atendimento
          </p>
          <h2
            id="insurance-title"
            className="font-heading text-ink mt-3 text-3xl font-semibold sm:text-4xl"
          >
            Convênios e parcerias
          </h2>
          <p className="text-muted mt-4 text-lg leading-relaxed">
            Consulte nossa equipe para confirmar cobertura, autorização e
            disponibilidade para o exame desejado.
          </p>
        </div>
        <PartnersShowcase />
        <div className="border-border-light bg-surface mt-10 flex flex-col gap-5 rounded-3xl border p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted max-w-2xl text-sm leading-relaxed">
            A cobertura pode variar conforme o plano, produto contratado e exame
            solicitado.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Consultar atendimento pelo WhatsApp — abre em nova aba"
              className="bg-brand inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
            >
              <MessageCircle aria-hidden="true" size={18} />
              Consultar atendimento
              <ExternalLink aria-hidden="true" size={15} />
            </a>
            <Link
              href="/convenios"
              className="border-brand/25 text-brand-dark inline-flex min-h-12 items-center rounded-full border px-6 text-sm font-bold"
            >
              Ver todos
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
