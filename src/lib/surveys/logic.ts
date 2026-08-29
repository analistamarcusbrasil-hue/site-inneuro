import type {
  SurveyAnswerValue,
  SurveyDashboardMetrics,
  SurveyPeriodPreset,
  SurveyQuestion,
  SurveyRule,
} from "@/lib/surveys/types";

export const surveyCategoryLabels: Record<string, string> = {
  EXPERIENCIA_GERAL: "Experiência geral",
  AGENDAMENTO: "Agendamento",
  RECEPCAO: "Recepção",
  TEMPO_ESPERA: "Tempo de espera",
  PROFISSIONAIS: "Profissionais",
  EXECUCAO_EXAME: "Execução do exame",
  SEGURANCA_CONFORTO: "Segurança e conforto",
  COMUNICACAO: "Informações e orientações",
  INFRAESTRUTURA: "Infraestrutura",
  RESOLUCAO: "Resolução",
  NPS: "NPS",
  DIAGNOSTICO: "Oportunidades de melhoria",
  DESTAQUE: "Destaques positivos",
};

export function calculateNps(scores: number[]) {
  const valid = scores.filter(
    (score) => Number.isInteger(score) && score >= 0 && score <= 10,
  );
  if (!valid.length)
    return { nps: null, promoters: 0, passives: 0, detractors: 0 };
  const promoters = valid.filter((score) => score >= 9).length;
  const passives = valid.filter((score) => score >= 7 && score <= 8).length;
  const detractors = valid.filter((score) => score <= 6).length;
  return {
    nps: Math.round(((promoters - detractors) / valid.length) * 100),
    promoters,
    passives,
    detractors,
  };
}

function numericAnswers(
  questions: SurveyQuestion[],
  answers: Record<string, SurveyAnswerValue>,
) {
  return questions
    .filter(
      (question) =>
        question.version.question_type === "STAR_5" &&
        !["DIAGNOSTICO", "DESTAQUE"].includes(question.version.category),
    )
    .map((question) => answers[question.id]?.numericValue)
    .filter((value): value is number => typeof value === "number");
}

export function ruleMatches(
  rule: SurveyRule,
  questions: SurveyQuestion[],
  answers: Record<string, SurveyAnswerValue>,
) {
  const expected = Number(rule.comparison_value);
  if (rule.operator === "ANY_DIMENSION_LTE")
    return numericAnswers(questions, answers).some((value) => value <= expected);
  if (rule.operator === "AVERAGE_GTE") {
    const values = numericAnswers(questions, answers);
    return (
      values.length > 0 &&
      values.reduce((total, value) => total + value, 0) / values.length >=
        expected
    );
  }
  if (!rule.source_question_id) return false;
  const answer = answers[rule.source_question_id];
  const current =
    answer?.numericValue ?? answer?.optionValue ?? answer?.textValue ?? null;
  if (rule.operator === "LTE") return Number(current) <= expected;
  if (rule.operator === "GTE") return Number(current) >= expected;
  if (rule.operator === "EQ") return current === rule.comparison_value;
  if (rule.operator === "NEQ") return current !== rule.comparison_value;
  if (rule.operator === "CONTAINS")
    return Array.isArray(current)
      ? current.includes(String(rule.comparison_value))
      : String(current ?? "").includes(String(rule.comparison_value));
  return false;
}

export function visibleSurveyQuestions(
  questions: SurveyQuestion[],
  rules: SurveyRule[],
  answers: Record<string, SurveyAnswerValue>,
) {
  const byTarget = new Map<string, SurveyRule[]>();
  for (const rule of rules) {
    const entries = byTarget.get(rule.target_question_id) ?? [];
    entries.push(rule);
    byTarget.set(rule.target_question_id, entries);
  }
  return questions.filter((question) => {
    const conditional = question.version.configuration.conditional === true;
    const questionRules = byTarget.get(question.id) ?? [];
    if (!questionRules.length) return !conditional;
    const showRules = questionRules.filter((rule) => rule.action === "SHOW");
    const hideRules = questionRules.filter((rule) => rule.action === "HIDE");
    const shown = showRules.length
      ? showRules.some((rule) => ruleMatches(rule, questions, answers))
      : !conditional;
    return (
      shown && !hideRules.some((rule) => ruleMatches(rule, questions, answers))
    );
  });
}

function startOfLocalDay(date: Date) {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
}

export function surveyDateRange(
  preset: SurveyPeriodPreset,
  customStart?: string,
  customEnd?: string,
  now = new Date(),
) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = startOfLocalDay(now);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  if (preset === "previous-month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end.setTime(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime());
  }
  if (preset === "year") start = new Date(now.getFullYear(), 0, 1);
  if (preset === "custom" && customStart && customEnd) {
    start = new Date(`${customStart}T00:00:00-03:00`);
    end.setTime(new Date(`${customEnd}T23:59:59.999-03:00`).getTime());
  }
  const exclusiveEnd = new Date(end.getTime() + 1);
  return { start, end, exclusiveEnd };
}

export function previousSurveyRange(start: Date, exclusiveEnd: Date) {
  const duration = exclusiveEnd.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    exclusiveEnd: new Date(start),
  };
}

export type SurveyPriority = {
  category: string;
  score: number;
  trend: "PIORANDO" | "ESTÁVEL" | "MELHORANDO";
  npsImpact: "ALTO" | "MÉDIO" | "BAIXO";
  current: number;
  previous: number | null;
  negativeCount: number;
  negativeRate: number;
};

export function buildSurveyPriorities(
  current: SurveyDashboardMetrics,
  previous: SurveyDashboardMetrics,
): SurveyPriority[] {
  return current.dimensions
    .filter((dimension) => dimension.average !== null)
    .map((dimension) => {
      const previousDimension = previous.dimensions.find(
        (item) => item.category === dimension.category,
      );
      const average = Number(dimension.average);
      const previousAverage = previousDimension?.average ?? null;
      const change = previousAverage === null ? 0 : average - previousAverage;
      const negativeRate = dimension.response_count
        ? (dimension.negative_count / dimension.response_count) * 100
        : 0;
      const worsening = Math.max(0, -change) * 18;
      const score = Math.round(
        Math.min(
          100,
          (5 - average) * 16 +
            negativeRate * 0.45 +
            Math.min(18, Math.log2(dimension.negative_count + 1) * 4) +
            worsening +
            (current.nps !== null && current.nps < 30 ? 8 : 0),
        ),
      );
      return {
        category: dimension.category,
        score,
        trend:
          change <= -0.15
            ? "PIORANDO"
            : change >= 0.15
              ? "MELHORANDO"
              : "ESTÁVEL",
        npsImpact: score >= 70 ? "ALTO" : score >= 45 ? "MÉDIO" : "BAIXO",
        current: average,
        previous: previousAverage,
        negativeCount: dimension.negative_count,
        negativeRate: Math.round(negativeRate * 10) / 10,
      } satisfies SurveyPriority;
    })
    .sort((a, b) => b.score - a.score);
}

export function isCriticalSurveyResponse(input: {
  overall: number | null;
  nps: number | null;
  dimensions: number[];
}) {
  return (
    (input.overall !== null && input.overall <= 2) ||
    (input.nps !== null && input.nps <= 6) ||
    input.dimensions.filter((value) => value <= 2).length >= 2
  );
}
