import type { Metadata } from "next";
import { CalendarPlus, ExternalLink, MessageCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { ServiceDetails } from "@/components/preparations/service-details";
import {
  getPublicExamBySlug,
  getPublicInstitutionalContent,
  getPublicPreparationBySlug,
} from "@/lib/cms/public-content";
import { createPageMetadata } from "@/lib/metadata";
import { createWhatsAppUrl } from "@/lib/whatsapp";
import { modalities as staticModalities } from "@/data/modalidades";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return staticModalities
    .filter((item) => item.active)
    .map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;
  const [service, { modality }] = await Promise.all([
    getPublicPreparationBySlug(slug),
    getPublicExamBySlug(slug),
  ]);
  if (!modality) return {};
  return createPageMetadata({
    title: `Preparo para ${modality.name} | INNEURO Macapá`,
    description: service
      ? `Consulte horários e orientações de preparo validadas para ${modality.name} na INNEURO.`
      : `Saiba como confirmar com a equipe da INNEURO as orientações específicas para ${modality.name}.`,
    path: `/preparos/${modality.slug}`,
  });
}
export default async function PreparationPage({ params }: Props) {
  const slug = (await params).slug;
  const [service, { modality }, institutional] = await Promise.all([
    getPublicPreparationBySlug(slug),
    getPublicExamBySlug(slug),
    getPublicInstitutionalContent(),
  ]);
  if (!modality) notFound();
  const whatsappUrl = createWhatsAppUrl(
    institutional.config.whatsapp.primary.number,
    `Olá! Gostaria de confirmar as orientações para ${modality.name} na INNEURO.`,
  );
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Preparo validado"
        title={modality.name}
        description={
          service
            ? "Consulte os horários específicos, a forma de atendimento e as orientações fornecidas pela INNEURO."
            : "Confirme as orientações específicas desta modalidade diretamente com a equipe da INNEURO."
        }
      />
      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <Container>
          {service ? (
            <ServiceDetails
              service={service}
              whatsappNumber={institutional.config.whatsapp.primary.number}
            />
          ) : (
            <div className="border-border-light rounded-3xl border bg-white p-7 sm:p-9">
              <h2 className="font-heading text-ink text-2xl font-semibold">
                Orientação individual
              </h2>
              <p className="text-muted mt-4 max-w-3xl leading-relaxed">
                As orientações específicas deste exame são informadas pela nossa
                equipe durante a confirmação do agendamento. Siga sempre a
                orientação específica fornecida para o seu procedimento.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/contato?exame=${encodeURIComponent(modality.name)}#pre-agendamento`}
                  className="bg-brand inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold text-white"
                >
                  <CalendarPlus aria-hidden="true" size={18} /> Agendar exame
                </Link>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-brand/25 text-brand-dark inline-flex min-h-12 items-center justify-center gap-2 rounded-full border px-6 text-sm font-bold"
                >
                  <MessageCircle aria-hidden="true" size={18} /> Falar com a
                  equipe <ExternalLink aria-hidden="true" size={14} />
                </a>
              </div>
            </div>
          )}
        </Container>
      </section>
    </main>
  );
}
