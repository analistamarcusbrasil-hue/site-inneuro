import { z } from "zod";

export const contactCategories = [
  { value: "QUESTION", label: "Dúvida" },
  { value: "SUGGESTION", label: "Sugestão" },
  { value: "PRAISE", label: "Elogio" },
  { value: "COMPLAINT", label: "Reclamação" },
  { value: "SERVICE", label: "Atendimento" },
  { value: "INSURANCE", label: "Convênios" },
  { value: "FINANCIAL", label: "Financeiro" },
  { value: "OTHER", label: "Outros" },
] as const;

export type ContactCategory = (typeof contactCategories)[number]["value"];

export const contactCategoryValues = contactCategories.map(
  (category) => category.value,
) as [ContactCategory, ...ContactCategory[]];

export function getContactCategoryLabel(value: ContactCategory) {
  return (
    contactCategories.find((category) => category.value === value)?.label ??
    "Outros"
  );
}

function singleLine(value: string) {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeMessage(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

export const contactMessageSchema = z.object({
  submissionId: z.string().uuid("Atualize a página e tente novamente."),
  name: z
    .string()
    .transform(singleLine)
    .pipe(
      z
        .string()
        .min(3, "Informe seu nome completo.")
        .max(120, "O nome pode ter no máximo 120 caracteres."),
    ),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(
      z
        .string()
        .email("Informe um e-mail válido.")
        .max(254, "O e-mail informado é muito longo."),
    ),
  phone: z
    .string()
    .transform((value) => value.trim())
    .refine(
      (value) => !value || /^\(\d{2}\) \d{4,5}-\d{4}$/.test(value),
      "Informe um telefone brasileiro válido.",
    ),
  category: z.enum(contactCategoryValues, {
    error: "Selecione uma categoria.",
  }),
  subject: z
    .string()
    .transform(singleLine)
    .pipe(
      z
        .string()
        .min(3, "Informe o assunto da mensagem.")
        .max(160, "O assunto pode ter no máximo 160 caracteres."),
    ),
  message: z
    .string()
    .transform(normalizeMessage)
    .pipe(
      z
        .string()
        .min(10, "Escreva uma mensagem com pelo menos 10 caracteres.")
        .max(3000, "A mensagem pode ter no máximo 3000 caracteres."),
    ),
  consent: z.literal(true, {
    error: "Confirme a leitura da Política de Privacidade.",
  }),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

export function formatBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
