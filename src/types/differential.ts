export type DifferentialIcon =
  "technology" | "humanized-care" | "patient-portal" | "preparations";

export type Differential = {
  id: string;
  title: string;
  description: string;
  icon: DifferentialIcon;
};
