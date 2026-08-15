import { z } from "zod";
import { jobStatuses, workModes } from "./jobs";

const prohibitedCriteria = [
  /\bidade\b/i,
  /\bsexo\b/i,
  /\bg[eê]nero\b/i,
  /\bestado civil\b/i,
  /\breligi[aã]o\b/i,
  /\bra[cç]a\b/i,
  /\betnia\b/i,
  /\borienta[cç][aã]o sexual\b/i,
  /\bgravidez\b/i,
  /\bcondi[cç][aã]o m[eé]dica\b/i,
  /\bdefici[eê]ncia\b/i,
] as const;

export function containsProhibitedJobCriteria(value: string) {
  return prohibitedCriteria.some((pattern) => pattern.test(value));
}

const requiredText = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `Informe ${label}.`)
    .max(max, `${label} ultrapassou o limite permitido.`)
    .refine(
      (value) => !containsProhibitedJobCriteria(value),
      "Remova critérios relacionados a características pessoais protegidas.",
    );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "O texto ultrapassou o limite permitido.")
    .refine(
      (value) => !containsProhibitedJobCriteria(value),
      "Remova critérios relacionados a características pessoais protegidas.",
    )
    .transform((value) => value || null);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const careerJobFormSchema = z
  .object({
    title: requiredText("o título da vaga", 3, 120),
    areaId: z.string().uuid("Selecione uma área válida."),
    unitId: z
      .union([z.string().uuid(), z.literal("")])
      .transform((value) => value || null),
    positions: z.coerce.number().int().min(1).max(100),
    location: requiredText("o local", 2, 160),
    workMode: z.enum(workModes),
    workSchedule: optionalText(500),
    description: requiredText("a descrição", 20, 800),
    activities: requiredText("as principais atividades", 20, 5000),
    schooling: requiredText("a escolaridade", 2, 1000),
    desirableExperience: optionalText(1500),
    requiredRequirements: requiredText("os requisitos obrigatórios", 2, 3000),
    desirableRequirements: optionalText(3000),
    skills: requiredText("as habilidades", 2, 2000),
    certifications: optionalText(1500),
    opensOn: dateSchema,
    closesOn: z
      .union([dateSchema, z.literal("")])
      .transform((value) => value || null),
  })
  .refine((value) => !value.closesOn || value.closesOn >= value.opensOn, {
    path: ["closesOn"],
    message: "O encerramento deve ser posterior à abertura.",
  })
  .refine(
    (value) =>
      !["onsite", "hybrid"].includes(value.workMode) || Boolean(value.unitId),
    {
      path: ["unitId"],
      message: "Selecione a unidade de trabalho.",
    },
  );

export const careerJobIdSchema = z.object({ id: z.string().uuid() });

export const careerJobTransitionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(jobStatuses),
});

export const careerJobAreaSchema = z.object({
  id: z.string().uuid().optional(),
  name: requiredText("o nome da área", 2, 80),
});
