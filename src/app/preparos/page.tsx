import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { PreparationCatalog } from "@/components/preparations/preparation-catalog";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Preparos para exames | INNEURO Macapá",
  description:
    "Consulte orientações de preparo validadas pela INNEURO para exames realizados em Macapá.",
  path: "/preparos",
});

export default function PreparationsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Central de preparos"
        title="Orientações reunidas com responsabilidade."
        description="Consulte conteúdos validados e confirme dúvidas específicas com a equipe da INNEURO."
      />
      <section className="bg-surface pt-10 pb-14 sm:pt-12 sm:pb-18 lg:pt-14 lg:pb-24">
        <Container>
          <PreparationCatalog />
        </Container>
      </section>
    </main>
  );
}
