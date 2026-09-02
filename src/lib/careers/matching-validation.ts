import { z } from "zod";
import {
  matchCriterionKinds,
  matchCriterionKeys,
  matchCriterionLabels,
  matchCriterionPriorities,
} from "@/lib/careers/matching";

export const matchMatrixFormSchema = z
  .object({
    jobId: z.string().uuid(),
    weights: z.partialRecord(
      z.enum(matchCriterionKeys),
      z.coerce.number().int().min(0).max(100),
    ),
    active: z.partialRecord(z.enum(matchCriterionKeys), z.boolean()).optional(),
    kinds: z
      .partialRecord(z.enum(matchCriterionKeys), z.enum(matchCriterionKinds))
      .optional(),
    priorities: z
      .partialRecord(
        z.enum(matchCriterionKeys),
        z.enum(matchCriterionPriorities),
      )
      .optional(),
  })
  .superRefine((data, context) => {
    const total = matchCriterionKeys.reduce(
      (sum, key) =>
        (data.active?.[key] ?? true) &&
        (data.kinds?.[key] ?? "scoring") === "scoring"
          ? sum + (data.weights[key] ?? 0)
          : sum,
      0,
    );
    if (total !== 100) {
      context.addIssue({
        code: "custom",
        path: ["weights"],
        message: "A soma dos pesos deve ser exatamente 100%.",
      });
    }
    matchCriterionKeys.forEach((key) => {
      if (
        (!(data.active?.[key] ?? true) ||
          (data.kinds?.[key] ?? "scoring") === "minimum") &&
        (data.weights[key] ?? 0) !== 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["weights", key],
          message: "Critério inativo ou mínimo deve ter peso zero.",
        });
      }
    });
  })
  .transform((data) => ({
    jobId: data.jobId,
    criteria: matchCriterionKeys.map((key) => ({
      key,
      label: matchCriterionLabels[key],
      weight: data.weights[key] ?? 0,
      active: data.active?.[key] ?? true,
      kind: data.kinds?.[key] ?? "scoring",
      priority: data.priorities?.[key] ?? "important",
    })),
  }));

export const recalculateMatchSchema = z.object({
  jobId: z.string().uuid(),
  applicationId: z.string().uuid(),
});
