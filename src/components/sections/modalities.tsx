import { Container } from "@/components/layout/container";
import { Section } from "@/components/layout/section";
import { SectionHeader } from "@/components/sections/section-header";
import { ModalityCard } from "@/components/ui/modality-card";
import { modalities } from "@/data/modalidades";

export function Modalities() {
  const activeModalities = modalities.filter((modality) => modality.active);

  return (
    <Section aria-label="Modalidades de exames" className="bg-surface">
      <Container>
        <SectionHeader
          eyebrow="Modalidades"
          title="Exames organizados para facilitar sua jornada."
          description="Conheça as modalidades confirmadas da INNEURO e encontre o caminho para as informações de cada exame."
        />
        <div className="mt-12 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {activeModalities.map((modality) => (
            <ModalityCard key={modality.slug} modality={modality} />
          ))}
        </div>
      </Container>
    </Section>
  );
}
