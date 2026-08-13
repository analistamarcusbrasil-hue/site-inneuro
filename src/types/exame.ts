export type Exame = {
  slug: string;
  name: string;
  modality: string;
  modalitySlug: string;
  shortDescription: string;
  preparationSlug?: string;
  purpose?: string;
  howPerformed?: string;
  generalGuidance?: string;
  documents?: string;
  badge?: "Exclusivo";
  active: boolean;
};
