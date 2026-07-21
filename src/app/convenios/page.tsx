import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { PartnersShowcase } from "@/components/partners/partners-showcase";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Convênios e parcerias | INNEURO",
  description: "Convênios e parcerias informados pela INNEURO.",
  alternates: siteConfig.url
    ? { canonical: `${siteConfig.url}/convenios` }
    : undefined,
};
export default function InsurancePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Atendimento"
        title="Convênios e parcerias"
        description="Consulte nossa equipe para confirmar cobertura, autorização e disponibilidade para o exame desejado."
      />
      <section className="bg-surface py-16 sm:py-20 lg:py-24">
        <Container>
          <PartnersShowcase />
          <div className="border-warning/25 mt-10 rounded-3xl border bg-white p-6 text-sm leading-relaxed">
            A cobertura pode variar conforme o plano, produto contratado e exame
            solicitado. O AmorSaúde está apresentado como parceria, não como
            plano de saúde.
          </div>
        </Container>
      </section>
    </main>
  );
}
