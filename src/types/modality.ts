export type ModalityIcon =
  | "magnetic-resonance"
  | "computed-tomography"
  | "x-ray"
  | "nuclear-medicine"
  | "scintigraphy"
  | "brain-mapping"
  | "functional-exam"
  | "monitoring"
  | "medical-care";

export type Modality = {
  slug: string;
  name: string;
  shortDescription: string;
  icon: ModalityIcon;
  active: boolean;
  featured?: boolean;
};
