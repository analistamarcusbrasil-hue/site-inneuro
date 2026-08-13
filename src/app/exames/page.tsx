import Link from "next/link";
import { Suspense } from "react";
import { ExamCatalog } from "@/components/exams/exam-catalog";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { Modalities } from "@/components/sections/modalities";
import { createPageMetadata } from "@/lib/metadata";
import {
  getPublicExams,
  getPublicSchedulingSettings,
} from "@/lib/cms/public-content";

export const metadata = createPageMetadata({
  title: "Exames e Serviços | INNEURO",
  description:
    "Conheça os exames e serviços realizados pela INNEURO em Macapá, incluindo ressonância magnética, tomografia, Raio-X, mamografia e exames de neurofisiologia.",
  path: "/exames",
});

export default async function ExamsPage() {
  const [content, scheduling] = await Promise.all([
    getPublicExams(),
    getPublicSchedulingSettings(),
  ]);
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Exames"
        title="Exames e serviços da INNEURO."
        description="Consulte os exames e serviços atualmente realizados pela clínica."
      />
      <Modalities compactTop items={content.modalities} />
      <section className="bg-surface py-14 sm:py-18 lg:py-24">
        <Container>
          <p className="bg-mint text-brand-dark mb-8 rounded-2xl p-4 text-sm font-semibold">
            {scheduling.publicText} {scheduling.note}
          </p>
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow mb-2">Catálogo completo</p>
              <h2 className="font-heading text-ink text-3xl font-semibold sm:text-4xl">
                Todos os exames e serviços
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
            <ExamCatalog
              exams={content.exams}
              modalities={content.modalities}
            />
          </Suspense>
        </Container>
      </section>
    </main>
  );
}
