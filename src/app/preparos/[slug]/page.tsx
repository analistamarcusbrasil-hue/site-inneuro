import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { ServiceDetails } from "@/components/preparations/service-details";
import { clinicalServices, getClinicalService } from "@/data/clinical-services";
import { createPageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return clinicalServices.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = getClinicalService((await params).slug);
  if (!service) return {};
  return createPageMetadata({
    title: `Preparo para ${service.name} | INNEURO Macapá`,
    description: `Consulte horários e orientações de preparo validadas para ${service.name} na INNEURO.`,
    path: `/preparos/${service.slug}`,
  });
}
export default async function PreparationPage({ params }: Props) {
  const service = getClinicalService((await params).slug);
  if (!service) notFound();
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Preparo validado"
        title={service.name}
        description="Consulte os horários específicos, a forma de atendimento e as orientações fornecidas pela INNEURO."
      />
      <section className="bg-surface py-14 sm:py-20 lg:py-24">
        <Container>
          <ServiceDetails service={service} />
        </Container>
      </section>
    </main>
  );
}
