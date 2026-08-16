import { z } from "zod";
import {
  selectionProcessStatuses,
  selectionStages,
} from "@/lib/careers/selection-processes";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const selectionProcessIdSchema = z.string().uuid();

export const selectionProcessFormSchema = z
  .object({
    name: z.string().trim().min(3).max(160),
    jobId: z.string().uuid(),
    startsOn: dateSchema,
    endsOn: dateSchema,
  })
  .refine((data) => data.endsOn >= data.startsOn, {
    path: ["endsOn"],
    message: "O encerramento não pode ser anterior ao início.",
  });

export const selectionProcessTransitionSchema = z.object({
  processId: selectionProcessIdSchema,
  status: z.enum(selectionProcessStatuses),
});

export const selectionCandidateAddSchema = z.object({
  processId: selectionProcessIdSchema,
  applicationId: z.string().uuid(),
});

export const selectionCandidateMoveSchema = z.object({
  processId: selectionProcessIdSchema,
  processCandidateId: z.string().uuid(),
  stage: z.enum(selectionStages),
  view: z.enum(["kanban", "list"]).catch("kanban"),
  sendCommunication: z.boolean().default(false),
  interviewDate: z.string().trim().max(10).optional(),
  interviewTime: z.string().trim().max(5).optional(),
  location: z.string().trim().max(240).optional(),
  instructions: z.string().trim().max(2000).optional(),
});

export const selectionCandidateNoteSchema = z.object({
  processId: selectionProcessIdSchema,
  processCandidateId: z.string().uuid(),
  internalNote: z
    .string()
    .trim()
    .max(4000, "A observação deve ter no máximo 4.000 caracteres.")
    .transform((value) => value || null),
  view: z.enum(["kanban", "list"]).catch("kanban"),
});

export const careerStageDecisionSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  expectedStage: z.enum(selectionStages),
  decision: z.enum(["approve", "not_approve"]),
});

export const careerStageEventSchema = z.object({
  applicationId: z.string().uuid(),
  jobId: z.string().uuid(),
  stage: z.enum(["interview", "practical_test"]),
  scheduledDate: dateSchema,
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  location: z.string().trim().min(2).max(240),
  instructions: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => value || null),
  internalNotes: z
    .string()
    .trim()
    .max(4000)
    .transform((value) => value || null),
});
