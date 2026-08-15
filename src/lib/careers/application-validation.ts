import { z } from "zod";
import { applicationStatuses } from "@/lib/careers/applications";

export const careerApplicationIdSchema = z.string().uuid();
export const careerApplicationJobIdSchema = z.string().uuid();

export const careerApplicationSubmissionSchema = z.object({
  jobId: careerApplicationJobIdSchema,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const careerApplicationStatusUpdateSchema = z.object({
  applicationId: careerApplicationIdSchema,
  jobId: careerApplicationJobIdSchema,
  status: z.enum(applicationStatuses),
  processLabel: z
    .string()
    .trim()
    .max(160, "O nome do processo deve ter no máximo 160 caracteres.")
    .transform((value) => value || null),
});
