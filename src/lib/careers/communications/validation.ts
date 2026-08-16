import { z } from "zod";
import {
  adminCareerCommunicationTemplates,
  careerCommunicationTemplates,
} from "./types";

export const safeEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .refine((value) => !/[\r\n]/.test(value));

const safeLine = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\r\n]/.test(value));

const safeText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

const candidateJobVariables = z.object({
  candidateName: safeLine(160),
  jobTitle: safeLine(160),
  portalUrl: z.string().url().max(500),
});

export const careerCommunicationVariablesSchema = z.discriminatedUnion(
  "template",
  [
    candidateJobVariables.extend({
      template: z.enum([
        "APPLICATION_RECEIVED",
        "UNDER_REVIEW",
        "APPROVED",
        "TALENT_POOL",
        "REJECTED",
        "PROCESS_CLOSED",
      ]),
    }),
    candidateJobVariables.extend({
      template: z.literal("NEXT_STAGE"),
      nextStage: safeLine(160),
      instructions: optionalText(2000),
      eventDate: optionalText(80),
    }),
    candidateJobVariables.extend({
      template: z.enum(["INTERVIEW_INVITE", "INTERVIEW_REMINDER"]),
      interviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      interviewTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      location: safeLine(240),
      instructions: optionalText(2000),
    }),
    candidateJobVariables.extend({
      template: z.literal("CUSTOM_MESSAGE"),
      subject: safeLine(160),
      message: safeText(4000),
    }),
    z.object({
      template: z.literal("INTERNAL_NEW_APPLICATION"),
      candidateName: safeLine(160),
      candidateEmail: safeEmailSchema,
      candidatePhone: optionalText(30),
      jobTitle: safeLine(160),
      submittedAt: z.string().datetime(),
      applicationId: z.string().uuid(),
      adminUrl: z.string().url().max(500),
    }),
    z.object({
      template: z.literal("PASSWORD_RECOVERY"),
      candidateName: safeLine(160),
      recoveryUrl: z.string().url().max(2000),
    }),
  ],
);

export const queueCareerCommunicationSchema = z.object({
  candidateId: z.string().uuid().nullable().optional(),
  applicationId: z.string().uuid().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
  template: z.enum(careerCommunicationTemplates),
  recipientKind: z.enum(["candidate", "internal"]),
  recipient: safeEmailSchema,
  variables: z.record(z.string(), z.unknown()),
  triggeredBy: z.enum(["candidate", "admin", "system"]),
  createdBy: z.string().uuid().nullable().optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(200)
    .regex(/^[a-zA-Z0-9:._-]+$/)
    .nullable()
    .optional(),
});

export const adminSendCommunicationSchema = z.object({
  applicationId: z.string().uuid(),
  template: z.enum(adminCareerCommunicationTemplates),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(200)
    .regex(/^[a-zA-Z0-9:._-]+$/),
  nextStage: optionalText(160),
  instructions: optionalText(2000),
  eventDate: optionalText(80),
  interviewDate: optionalText(10),
  interviewTime: optionalText(5),
  location: optionalText(240),
  subject: optionalText(160),
  message: optionalText(4000),
});

export const communicationHistoryQuerySchema = z.object({
  applicationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const retryCareerCommunicationSchema = z.object({
  communicationId: z.string().uuid(),
});

export function validateTemplateVariables(
  template: (typeof careerCommunicationTemplates)[number],
  variables: Record<string, unknown>,
) {
  return careerCommunicationVariablesSchema.parse({ template, ...variables });
}
