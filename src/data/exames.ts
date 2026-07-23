import { modalities } from "@/data/modalidades";
import type { Exame } from "@/types/exame";

export const exames: Exame[] = modalities.map((modality) => ({
  slug: modality.slug,
  name: modality.name,
  modality: modality.name,
  modalitySlug: modality.slug,
  shortDescription: modality.shortDescription,
  active: modality.active,
  preparationSlug: [
    "tomografia-computadorizada",
    "raios-x",
    "mapeamento-cerebral",
    "ressonancia-magnetica",
  ].includes(modality.slug)
    ? modality.slug
    : undefined,
}));

export function hasIndexableExamContent(exam: Exame) {
  return Boolean(
    exam.purpose ||
    exam.howPerformed ||
    exam.generalGuidance ||
    exam.documents ||
    exam.preparationSlug,
  );
}
