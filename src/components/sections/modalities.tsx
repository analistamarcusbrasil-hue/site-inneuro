import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/sections/section-header";
import { ModalityCard } from "@/components/ui/modality-card";
import { modalities } from "@/data/modalidades";

export function Modalities({ compactTop = false }: { compactTop?: boolean }) {
  const featuredSlugs = new Set([
    "ressonancia-magnetica",
    "tomografia-computadorizada",
    "raios-x",
    "mapeamento-cerebral",
  ]);
  const activeModalities = modalities.filter(
    (modality) => modality.active && featuredSlugs.has(modality.slug),
  );

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
          eyebrow="Modalidades"
          title="Principais exames"
          description="Acesse informações objetivas sobre modalidades disponíveis na INNEURO."
        />
        <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
          {activeModalities.map((modality) => (
            <ModalityCard key={modality.slug} modality={modality} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
