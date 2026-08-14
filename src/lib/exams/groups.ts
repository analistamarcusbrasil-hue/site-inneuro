import type { Exame } from "@/types/exame";
import type { Modality } from "@/types/modality";

export type ExamGroup = Modality & {
  exams: Exame[];
};

export function hasExamDetails(exam: Exame) {
  return Boolean(
    exam.shortDescription ||
    exam.purpose ||
    exam.howPerformed ||
    exam.generalGuidance ||
    exam.documents ||
    exam.preparationSlug,
  );
}

export function createExamGroups(
  exams: Exame[],
  modalities: Modality[],
): ExamGroup[] {
  return modalities
    .filter((modality) => modality.active && modality.featured === true)
    .map((modality) => ({
      ...modality,
      exams: exams.filter(
        (exam) => exam.active && exam.modalitySlug === modality.slug,
      ),
    }));
}

export function findExamGroup(
  groups: ExamGroup[],
  slug: string,
): ExamGroup | undefined {
  return groups.find((group) => group.slug === slug);
}
