import { z } from "zod";
import {
  applicationSources,
  commuteFeasibilities,
  commuteTimes,
  transitBenefitOptions,
  transportModes,
} from "@/lib/careers/logistics";
import { brazilianStates } from "@/lib/careers/profile-validation";

const requiredText = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const companyUnitSchema = z.object({
  id: z.string().uuid().optional(),
  name: requiredText(2, 120),
  address: requiredText(2, 200),
  neighborhood: requiredText(2, 120),
  city: requiredText(2, 100),
  state: z.enum(brazilianStates),
  postalCode: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{5}-?\d{3}$/.test(value))
    .transform((value) => value || null),
});

export const careerApplicationLogisticsSchema = z
  .object({
    jobId: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    requiresCommute: z.boolean(),
    commuteFeasibility: z
      .union([z.enum(commuteFeasibilities), z.literal("")])
      .transform((value) => value || null),
    commuteTime: z
      .union([z.enum(commuteTimes), z.literal("")])
      .transform((value) => value || null),
    transportModes: z.array(z.enum(transportModes)).max(8),
    transitBenefit: z
      .union([z.enum(transitBenefitOptions), z.literal("")])
      .transform((value) => value || null),
    source: z.enum(applicationSources),
    recruitmentConsent: z.literal(true),
    automatedSupportConsent: z.literal(true),
  })
  .superRefine((data, context) => {
    if (
      data.requiresCommute &&
      (!data.commuteFeasibility || !data.commuteTime || !data.transitBenefit)
    ) {
      context.addIssue({
        code: "custom",
        path: ["commuteFeasibility"],
        message: "Complete as informações operacionais da vaga.",
      });
    }
  });
