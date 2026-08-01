import Link from "next/link";
import { Suspense } from "react";
import { ExamCatalog } from "@/components/exams/exam-catalog";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { Modalities } from "@/components/sections/modalities";
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
      <Modalities compactTop />
      <section className="bg-surface py-14 sm:py-18 lg:py-24">
        <Container>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow mb-2">Catálogo completo</p>
              <h2 className="font-heading text-ink text-3xl font-semibold sm:text-4xl">
                Todos os exames
              </h2>
            </div>
            <Link
              href="/preparos"
              className="border-brand/20 text-brand-dark hover:border-brand/40 hover:bg-brand/5 focus-visible:ring-tech inline-flex min-h-11 items-center justify-center rounded-full border bg-white px-5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none"
            >
              Consultar preparos
            </Link>
          </div>
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
