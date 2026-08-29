export type SurveyQuestionType =
  | "STAR_5"
  | "NPS_10"
  | "NUMBER_SCALE"
  | "YES_NO"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "AUDIO";

export type SurveyOption = {
  id: string;
  label: string;
  value: string;
  sort_order: number;
};

export type SurveyQuestion = {
  id: string;
  stable_key: string;
  sort_order: number;
  active: boolean;
  version: {
    id: string;
    version_number: number;
    category: string;
    question_type: SurveyQuestionType;
    title: string;
    description: string | null;
    required: boolean;
    allow_na: boolean;
    configuration: Record<string, unknown>;
    options: SurveyOption[];
  };
};

export type SurveyRule = {
  id: string;
  source_question_id: string | null;
  operator:
    | "EQ"
    | "NEQ"
    | "LTE"
    | "GTE"
    | "CONTAINS"
    | "ANY_DIMENSION_LTE"
    | "AVERAGE_GTE";
  comparison_value: unknown;
  target_question_id: string;
  action: "SHOW" | "HIDE";
};

export type SurveyAnswerValue = {
  numericValue?: number;
  textValue?: string;
  optionValue?: string | string[];
  notApplicable?: boolean;
};

export type SurveyPublicDefinition = {
  organization: { id: string; name: string };
  unit: { id: string; name: string } | null;
  campaign: {
    id: string;
    title: string;
    description: string;
    settings: Record<string, unknown>;
  };
  qrCode: { id: string; token: string; label: string };
  questions: SurveyQuestion[];
  rules: SurveyRule[];
};

export type SurveyDimensionMetric = {
  category: string;
  average: number;
  response_count: number;
  negative_count: number;
  positive_count: number;
  distribution: Record<string, number>;
};

export type SurveyDashboardMetrics = {
  responseCount: number;
  overallScore: number | null;
  criticalCount: number;
  positiveRate: number | null;
  nps: number | null;
  npsBreakdown: {
    total: number;
    promoters: number;
    passives: number;
    detractors: number;
  };
  completion: {
    openings: number;
    starts: number;
    completions: number;
    rate: number | null;
  };
  dimensions: SurveyDimensionMetric[];
  problems: Array<{ label: string; total: number }>;
  praise: Array<{ label: string; total: number }>;
};

export type SurveyPeriodPreset =
  | "today"
  | "7d"
  | "30d"
  | "month"
  | "previous-month"
  | "year"
  | "custom";
