import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { getPublicPartners } from "@/lib/cms/public-content";
import { PartnerLogoCard } from "@/components/partners/partner-logo-card";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Convênios e parcerias da INNEURO | Macapá",
  description:
    "Consulte convênios e parcerias apresentados pela INNEURO e confirme cobertura para seu exame.",
  path: "/convenios",
});

export default async function InsurancePage() {
  const convenios = await getPublicPartners();
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Convênios"
        title="Convênios confirmados pela INNEURO."
        description="Consulte as condições do seu plano antes do exame."
      />
      <section className="bg-surface py-16 sm:py-20 lg:py-24">
        <Container>
          <p className="text-muted mb-8 max-w-3xl text-lg leading-relaxed">
            Consulte nossa equipe para confirmar cobertura, autorização e
            disponibilidade para o exame desejado.
          </p>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {convenios
              .filter((item) => item.active)
              .map((item) => (
                <PartnerLogoCard key={item.id} partner={item} />
              ))}
          </ul>
          <div className="border-warning/25 mt-8 rounded-3xl border bg-white p-6 text-sm leading-relaxed">
            A cobertura pode variar conforme o plano, produto contratado e exame
            solicitado.
          </div>
        </Container>
      </section>
    </main>
  );
}
