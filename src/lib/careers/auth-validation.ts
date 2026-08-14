import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Informe um e-mail válido.")
  .max(254, "O e-mail informado é muito longo.");

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.");

export const candidateLoginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const candidateRegistrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Informe seu nome completo.")
      .max(120, "O nome deve ter no máximo 120 caracteres."),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
    acceptedTerms: z.literal(true, {
      error: "É necessário aceitar os termos e a política de privacidade.",
    }),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas informadas não são iguais.",
  });

export const candidateRecoverySchema = z.object({ email: emailSchema });

export const candidatePasswordUpdateSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: passwordSchema,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "As senhas informadas não são iguais.",
  });

const allowedCareersDestinations = new Set([
  "/carreiras/perfil",
  "/carreiras/recuperar-senha?mode=update",
]);

export function safeCareersDestination(value: string | null) {
  return value && allowedCareersDestinations.has(value)
    ? value
    : "/carreiras/perfil";
}

export function normalizeCandidateName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name.length >= 2 ? name.slice(0, 120) : "Candidato";
}
