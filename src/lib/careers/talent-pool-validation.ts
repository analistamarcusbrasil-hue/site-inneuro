import { z } from "zod";

export const talentPoolAreaSelectionSchema = z
  .array(z.string().uuid())
  .min(1, "Escolha pelo menos uma área de interesse.")
  .max(20, "Escolha no máximo 20 áreas.")
  .transform((areas) => [...new Set(areas)]);

const optionalFilter = z.string().trim().max(120).catch("");

export const talentPoolFiltersSchema = z.object({
  query: z.string().trim().max(200).catch(""),
  areaId: z.union([z.literal(""), z.string().uuid()]).catch(""),
  city: optionalFilter,
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || /^[A-Z]{2}$/.test(value))
    .catch(""),
  education: optionalFilter,
  experience: optionalFilter,
  skill: optionalFilter,
  certification: optionalFilter,
  availability: optionalFilter,
  updatedWithin: z.enum(["", "7", "30", "90", "365"]).catch(""),
});

export const talentPoolCandidateIdSchema = z.string().uuid();
