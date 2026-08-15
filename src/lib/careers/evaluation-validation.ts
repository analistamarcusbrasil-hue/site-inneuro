import { z } from "zod";
import {
  containsProhibitedEvaluationCriterion,
  interviewStatuses,
  interviewTypes,
} from "@/lib/careers/evaluations";

export const evaluationTemplateFormSchema = z.object({
  jobId: z.string().uuid(),
  customCriteria: z
    .array(
      z
        .string()
        .trim()
        .max(120)
        .refine(
          (value) => !value || value.length >= 3,
          "O critério precisa ter pelo menos 3 caracteres.",
        )
        .refine(
          (value) => !containsProhibitedEvaluationCriterion(value),
          "Use somente critérios profissionais relacionados à vaga.",
        ),
    )
    .max(6)
    .transform((items) => [...new Set(items.filter(Boolean))]),
});

export const candidateEvaluationFormSchema = z.object({
  applicationId: z.string().uuid(),
  templateId: z.string().uuid(),
  comment: z
    .string()
    .trim()
    .max(3000)
    .transform((value) => value || null),
});

export const evaluatorAssignmentSchema = z.object({
  applicationId: z.string().uuid(),
  evaluatorId: z.string().uuid(),
});

export const interviewFormSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Data inválida."),
  interviewType: z.enum(interviewTypes),
  responsibleId: z.string().uuid(),
  status: z.enum(interviewStatuses),
  internalNotes: z
    .string()
    .trim()
    .max(4000)
    .transform((value) => value || null),
});
