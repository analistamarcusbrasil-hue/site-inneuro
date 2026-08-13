import { CalendarPlus, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import {
  getPublicInstitutionalContent,
  getPublicSchedulingSettings,
} from "@/lib/cms/public-content";
import { PartnerLogoCard } from "@/components/partners/partner-logo-card";
import { convenios } from "@/data/convenios";
import { createPageMetadata } from "@/lib/metadata";
import { createWhatsAppUrl } from "@/lib/whatsapp";

const coverageMessage =
  "Olá! Acessei o site da INNEURO e gostaria de confirmar a cobertura do meu plano para um exame.";

export const metadata = createPageMetadata({
  title: "Convênios e parcerias da INNEURO | Macapá",
  description:
    "Consulte convênios e parcerias apresentados pela INNEURO e confirme cobertura para seu exame.",
  path: "/convenios",
});

export default async function InsurancePage() {
  const [institutional, scheduling] = await Promise.all([
    getPublicInstitutionalContent(),
    getPublicSchedulingSettings(),
  ]);
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Convênios"
        title="Convênios confirmados pela INNEURO."
        description="Consulte as condições do seu plano antes do exame."
      />
      <section className="bg-surface pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-24">
        <Container>
          <p className="text-muted mb-8 max-w-3xl text-lg leading-relaxed">
            Consulte nossa equipe para confirmar cobertura, autorização e
            disponibilidade para o exame desejado.
          </p>
          <p className="bg-mint text-brand-dark mb-8 max-w-3xl rounded-2xl p-4 text-sm font-semibold">
            A INNEURO também recebe solicitações pelo SUS em um fluxo próprio de
            atendimento. {scheduling.publicText}
          </p>
          <ul className="grid grid-cols-1 gap-4 min-[380px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {convenios
              .filter((item) => item.active)
              .map((item) => (
                <PartnerLogoCard
                  key={item.id}
                  partner={item}
                  variant="detailed"
                />
              ))}
          </ul>
          <div className="border-warning/25 mt-8 rounded-3xl border bg-white p-6 text-sm leading-relaxed">
            A cobertura pode variar conforme o plano, produto contratado e exame
            solicitado.
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={createWhatsAppUrl(
                institutional.config.whatsapp.primary.number,
                coverageMessage,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white focus-visible:ring-2 focus-visible:outline-none"
            >
              <MessageCircle aria-hidden="true" size={18} />
              Confirmar cobertura pelo WhatsApp
              <ExternalLink aria-hidden="true" size={14} />
            </a>
            <Link
              href="/contato#pre-agendamento"
              className="border-brand/25 text-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full border bg-white px-6 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              <CalendarPlus aria-hidden="true" size={18} />
              Solicitar pré-agendamento
            </Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
