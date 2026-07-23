import { Suspense } from "react";
import { ExamCatalog } from "@/components/exams/exam-catalog";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Exames de imagem em Macapá | INNEURO",
  description:
    "Consulte modalidades de exames e informações disponíveis na INNEURO em Macapá, Amapá.",
  path: "/exames",
});

export default function ExamsPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Exames"
        title="Encontre a modalidade que você procura."
        description="Pesquise e filtre as modalidades de exames confirmadas da INNEURO."
      />
      <section className="bg-surface py-14 sm:py-18 lg:py-24">
        <Container>
          <Suspense
            fallback={
              <div
                className="min-h-48 rounded-3xl bg-white"
                aria-label="Carregando exames"
              />
            }
          >
            <ExamCatalog />
          </Suspense>
        </Container>
      </section>
    </main>
  );
}
