import type { Metadata } from "next";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { PreparationCatalog } from "@/components/preparations/preparation-catalog";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Preparos de Exames | INNEURO",
  description: "Consulte a central de preparos de exames da INNEURO.",
  alternates: siteConfig.url
    ? { canonical: `${siteConfig.url}/preparos` }
    : undefined,
  robots: { index: true, follow: true },
};

export default function PreparationsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Central de preparos"
        title="Orientações reunidas com responsabilidade."
        description="Consulte conteúdos validados e confirme dúvidas específicas com a equipe da INNEURO."
      />
      <section className="bg-surface py-14 sm:py-18 lg:py-24">
        <Container>
          <PreparationCatalog />
        </Container>
      </section>
    </main>
  );
}
