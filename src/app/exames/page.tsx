import type { Metadata } from "next";
import { Suspense } from "react";
import { ExamCatalog } from "@/components/exams/exam-catalog";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Exames | INNEURO",
  description: "Consulte as modalidades de exames confirmadas da INNEURO.",
  alternates: siteConfig.url
    ? { canonical: `${siteConfig.url}/exames` }
    : undefined,
};

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
