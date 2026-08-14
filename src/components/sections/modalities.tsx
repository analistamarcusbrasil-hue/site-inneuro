import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/sections/section-header";
import { ModalityCard } from "@/components/ui/modality-card";
import Link from "next/link";
import type { ExamGroup } from "@/lib/exams/groups";

export function Modalities({
  compactTop = false,
  showAllLink = false,
  groups,
}: {
  compactTop?: boolean;
  showAllLink?: boolean;
  groups: ExamGroup[];
}) {
  return (
    <Section
      aria-label="Modalidades de exames"
      className={
        compactTop
          ? "bg-surface pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-28"
          : "bg-surface"
      }
    >
      <Container>
        <SectionHeader
          eyebrow="Exames e serviços"
          title="Estrutura ampla de diagnóstico"
          description="Consulte as categorias de exames e serviços realizados pela INNEURO."
        />
        <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => (
            <ModalityCard key={group.slug} group={group} />
          ))}
        </div>
        {showAllLink ? (
          <div className="mt-8 text-center">
            <Link
              href="/exames"
              className="border-brand/25 text-brand-dark hover:bg-mint focus-visible:ring-tech inline-flex min-h-12 items-center justify-center rounded-full border bg-white px-6 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              Ver todos os exames
            </Link>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
