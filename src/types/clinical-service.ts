export type ServicePeriod = { start: string; end: string };

export type ServiceSchedule = {
  label: string;
  days: string;
  periods: ServicePeriod[];
};

export type PreparationGroup = {
  title: string;
  appliesTo: string[];
  instructions: string[];
  warning?: string;
};

export type ClinicalService = {
  slug: string;
  name: string;
  searchTerms: string[];
  attendanceMode: "walk-in" | "appointment" | "mixed";
  attendanceLabel: string;
  schedules: ServiceSchedule[];
  scheduleNote?: string;
  preparationGroups: PreparationGroup[];
  documents?: string[];
  safetyQuestions?: string[];
  previousExamsRecommended?: boolean;
  validatedByClinic: boolean;
  lastReviewedAt: string;
};
