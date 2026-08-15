import { z } from "zod";
import {
  matchCriterionKeys,
  matchCriterionLabels,
} from "@/lib/careers/matching";

export const matchMatrixFormSchema = z
  .object({
    jobId: z.string().uuid(),
    weights: z.record(
      z.enum(matchCriterionKeys),
      z.coerce.number().int().min(0).max(100),
    ),
  })
  .superRefine((data, context) => {
    const total = matchCriterionKeys.reduce(
      (sum, key) => sum + (data.weights[key] ?? 0),
      0,
    );
    if (total !== 100) {
      context.addIssue({
        code: "custom",
        path: ["weights"],
        message: "A soma dos pesos deve ser exatamente 100%.",
      });
    }
  })
  .transform((data) => ({
    jobId: data.jobId,
    criteria: matchCriterionKeys.map((key) => ({
      key,
      label: matchCriterionLabels[key],
      weight: data.weights[key],
    })),
  }));

export const recalculateMatchSchema = z.object({
  jobId: z.string().uuid(),
  applicationId: z.string().uuid(),
});
