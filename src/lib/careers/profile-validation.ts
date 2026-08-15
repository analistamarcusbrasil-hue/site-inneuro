import { z } from "zod";

export const brazilianStates = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export const educationLevels = [
  "Ensino fundamental",
  "Ensino médio",
  "Curso técnico",
  "Graduação",
  "Pós-graduação",
  "Mestrado",
  "Doutorado",
] as const;

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `Informe ${label}.`)
    .max(max, `${label} ultrapassou o limite permitido.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "O texto ultrapassou o limite permitido.")
    .transform((value) => value || null);

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const optionalMonthSchema = z
  .union([monthSchema, z.literal("")])
  .transform((value) => value || null);

export const candidatePersonalProfileSchema = z.object({
  fullName: requiredText("seu nome completo", 120),
  email: z.string().trim().email("Informe um e-mail válido.").max(254),
  whatsapp: z
    .string()
    .trim()
    .max(24)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 13;
    }, "Informe um WhatsApp válido."),
  city: requiredText("sua cidade", 100),
  state: z.enum(brazilianStates),
  neighborhood: optionalText(120),
  professionalObjective: optionalText(500),
  about: optionalText(3000),
  availability: optionalText(800),
});

export const candidateExperienceSchema = z
  .object({
    id: z.string().uuid().optional(),
    company: requiredText("a empresa", 160),
    jobTitle: requiredText("o cargo", 160),
    startMonth: monthSchema,
    endMonth: optionalMonthSchema,
    isCurrent: z.boolean(),
    activities: requiredText("as principais atividades", 3000),
  })
  .refine((value) => value.isCurrent || Boolean(value.endMonth), {
    path: ["endMonth"],
    message: "Informe a data final ou marque trabalho atual.",
  })
  .refine((value) => !value.endMonth || value.endMonth >= value.startMonth, {
    path: ["endMonth"],
    message: "A data final deve ser posterior à data inicial.",
  });

export const candidateEducationSchema = z
  .object({
    id: z.string().uuid().optional(),
    educationLevel: z.enum(educationLevels),
    course: requiredText("o curso", 180),
    institution: requiredText("a instituição", 180),
    startMonth: monthSchema,
    endMonth: optionalMonthSchema,
    inProgress: z.boolean(),
  })
  .refine((value) => value.inProgress || Boolean(value.endMonth), {
    path: ["endMonth"],
    message: "Informe a conclusão ou marque formação em andamento.",
  })
  .refine((value) => !value.endMonth || value.endMonth >= value.startMonth, {
    path: ["endMonth"],
    message: "A conclusão deve ser posterior ao início.",
  });

export const candidateCertificationSchema = z.object({
  id: z.string().uuid().optional(),
  name: requiredText("o nome do curso ou certificação", 180),
  institution: requiredText("a instituição", 180),
  completionYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  expiresAt: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .transform((value) => value || null),
});

export const candidateSkillSchema = z.object({
  name: requiredText("a habilidade", 80),
});

export const candidateOwnedRecordSchema = z.object({
  id: z.string().uuid(),
});

export const candidateMoveRecordSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
  recordType: z.enum(["experience", "education"]),
});
