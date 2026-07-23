import { ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import type { Convenio } from "@/types/convenio";
import { siteConfig } from "@/config/site";
import { PartnerLogoCard } from "@/components/partners/partner-logo-card";

const whatsappNumber = siteConfig.whatsapp.primary.number;

export function Insurance({ partners }: { partners: Convenio[] }) {
  const activeConvenios = partners.filter((convenio) => convenio.active);

  return (
    <section
      id="convenios"
      aria-labelledby="insurance-title"
      className="bg-white py-16 sm:py-20 lg:py-28"
    >
      <Container>
        <div className="border-border-light bg-surface grid overflow-hidden rounded-[2rem] border lg:grid-cols-[.72fr_1.28fr]">
          <div className="bg-brand-dark relative overflow-hidden p-8 text-white sm:p-10 lg:p-12">
            <div className="insurance-rings" aria-hidden="true" />
            <ShieldCheck
              className="text-tech relative"
              aria-hidden="true"
              size={34}
              strokeWidth={1.5}
            />
            <p className="text-mint relative mt-8 text-xs font-bold tracking-[0.14em] uppercase">
              Atendimento
            </p>
            <h2
              id="insurance-title"
              className="font-heading relative mt-3 text-3xl leading-tight font-semibold tracking-[-0.04em] sm:text-4xl"
            >
              Convênios e atendimento particular
            </h2>
          </div>
          <div className="p-8 sm:p-10 lg:p-12">
            <p className="text-muted max-w-2xl text-lg leading-relaxed">
              Consulte nossa equipe para confirmar cobertura, autorização e
              disponibilidade para o exame desejado.
            </p>

            {activeConvenios.length > 0 && (
              <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {activeConvenios.map((convenio) => (
                  <PartnerLogoCard key={convenio.id} partner={convenio} />
                ))}
              </ul>
            )}

            <div className="mt-9">
              <p className="text-muted mb-6 text-sm">
                A cobertura pode variar conforme o plano, produto contratado e
                exame solicitado.
              </p>
              {whatsappNumber ? (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Consultar atendimento pelo WhatsApp — abre em nova aba"
                  className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <MessageCircle aria-hidden="true" size={18} /> Consultar
                  atendimento
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  title="WhatsApp indisponível no momento"
                  className="bg-border-light text-muted inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-full px-6 text-sm font-bold opacity-75"
                >
                  <MessageCircle aria-hidden="true" size={18} /> Consultar
                  atendimento
                </button>
              )}
              <Link
                href="/convenios"
                className="text-brand ml-4 inline-flex min-h-12 items-center text-sm font-bold"
              >
                Ver todos os convênios
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
