import { z } from "zod";

export const defaultEvaluationCriteria = [
  { id: "professional_communication", label: "Comunicação profissional" },
  { id: "technical_knowledge", label: "Conhecimento técnico" },
  { id: "related_experience", label: "Experiência relacionada" },
  { id: "organization", label: "Organização" },
  { id: "problem_solving", label: "Resolução de problemas" },
  { id: "requirements_mastery", label: "Domínio dos requisitos" },
] as const;

export type EvaluationCriterion = { id: string; label: string };

export const evaluationCriteriaSchema = z
  .array(
    z.object({
      id: z.string().trim().min(2).max(80),
      label: z.string().trim().min(3).max(120),
    }),
  )
  .min(6)
  .max(12)
  .superRefine((criteria, context) => {
    if (
      new Set(criteria.map((criterion) => criterion.id)).size !==
      criteria.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Os critérios devem ser únicos.",
      });
    }
    for (const criterion of criteria) {
      if (containsProhibitedEvaluationCriterion(criterion.label)) {
        context.addIssue({
          code: "custom",
          path: [criteria.indexOf(criterion), "label"],
          message: "Use somente critérios profissionais relacionados à vaga.",
        });
      }
    }
  });

const prohibitedEvaluationCriteria = [
  /\bapar[eê]ncia\b/i,
  /\bsexo\b/i,
  /\bidade\b/i,
  /\bperfil bonito\b/i,
  /\bra[çc]a\b/i,
  /\bcor da pele\b/i,
  /\breligi[aã]o\b/i,
  /\borienta[çc][aã]o sexual\b/i,
  /\bestado civil\b/i,
  /\bgravidez\b/i,
  /\bfotografia\b/i,
];

export function containsProhibitedEvaluationCriterion(value: string) {
  return prohibitedEvaluationCriteria.some((pattern) => pattern.test(value));
}

export type EvaluationTemplate = {
  id: string;
  job_id: string;
  version: number;
  criteria: unknown;
  created_by: string;
  created_at: string;
};

export type CandidateEvaluation = {
  id: string;
  application_id: string;
  template_id: string;
  template_version: number;
  evaluator_id: string;
  evaluation_version: number;
  scores: unknown;
  comment: string | null;
  created_at: string;
};

export const evaluationScoresSchema = z.record(
  z.string().min(2).max(80),
  z.number().int().min(1).max(5),
);

export function calculateEvaluationAverage(scores: Record<string, number>) {
  const values = Object.values(scores);
  if (!values.length) return null;
  return Number(
    (values.reduce((total, score) => total + score, 0) / values.length).toFixed(
      2,
    ),
  );
}

export function latestEvaluationByEvaluator(
  evaluations: CandidateEvaluation[],
) {
  const latest = new Map<string, CandidateEvaluation>();
  for (const evaluation of [...evaluations].sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
  )) {
    if (!latest.has(evaluation.evaluator_id)) {
      latest.set(evaluation.evaluator_id, evaluation);
    }
  }
  return [...latest.values()];
}

export function calculateHumanEvaluationAverage(
  evaluations: CandidateEvaluation[],
) {
  const individualAverages = latestEvaluationByEvaluator(evaluations).flatMap(
    (evaluation) => {
      const scores = evaluationScoresSchema.safeParse(evaluation.scores);
      if (!scores.success) return [];
      const average = calculateEvaluationAverage(scores.data);
      return average === null ? [] : [average];
    },
  );
  if (!individualAverages.length) return null;
  return Number(
    (
      individualAverages.reduce((total, average) => total + average, 0) /
      individualAverages.length
    ).toFixed(2),
  );
}

export const interviewTypes = [
  "in_person",
  "video",
  "phone",
  "technical",
  "other",
] as const;
export type InterviewType = (typeof interviewTypes)[number];
export const interviewTypeLabels: Record<InterviewType, string> = {
  in_person: "Presencial",
  video: "Videochamada",
  phone: "Telefone",
  technical: "Técnica",
  other: "Outro",
};

export const interviewStatuses = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type InterviewStatus = (typeof interviewStatuses)[number];
export const interviewStatusLabels: Record<InterviewStatus, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Não compareceu",
};
