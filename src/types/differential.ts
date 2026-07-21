export type DifferentialIcon =
  | "technology"
  | "humanized-care"
  | "journey"
  | "modalities"
  | "cloud-results"
  | "patient-portal"
  | "preparations"
  | "communication";

export type Differential = {
  id: string;
  title: string;
  description: string;
  icon: DifferentialIcon;
};
