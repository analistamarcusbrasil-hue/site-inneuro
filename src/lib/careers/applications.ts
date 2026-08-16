import { z } from "zod";

export const applicationStatuses = [
  "submitted",
  "screening",
  "in_process",
  "finalized",
  "withdrawn",
] as const;

export type ApplicationStatus = (typeof applicationStatuses)[number];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  submitted: "Enviada",
  screening: "Em triagem",
  in_process: "Em processo",
  finalized: "Finalizada",
  withdrawn: "Retirada",
};

export const candidateStageLabels: Record<
  CareerJobApplication["candidate_stage"],
  string
> = {
  registered: "Candidatura recebida",
  screening: "Em análise",
  interview: "Entrevista",
  evaluation: "Próxima etapa",
  finalists: "Finalista",
  selected: "Aprovado",
  talent_pool: "Banco de talentos",
  not_selected: "Não selecionado",
};

const optionalText = z.string().nullable();

export const careerApplicationSnapshotSchema = z.object({
  captured_at: z.string(),
  candidate: z.object({
    full_name: z.string(),
    email: optionalText,
  }),
  profile: z
    .object({
      whatsapp: optionalText,
      city: optionalText,
      state: optionalText,
      professional_objective: optionalText,
      about: optionalText,
      availability: optionalText,
    })
    .nullable(),
  experiences: z.array(
    z.object({
      company: z.string(),
      job_title: z.string(),
      start_date: z.string(),
      end_date: optionalText,
      is_current: z.boolean(),
      activities: z.string(),
    }),
  ),
  education: z.array(
    z.object({
      education_level: z.string(),
      course: z.string(),
      institution: z.string(),
      start_date: z.string(),
      end_date: optionalText,
      in_progress: z.boolean(),
    }),
  ),
  certifications: z.array(
    z.object({
      name: z.string(),
      institution: z.string(),
      completion_year: z.number(),
      expires_at: optionalText,
    }),
  ),
  skills: z.array(z.string()),
  resume: z
    .object({
      original_name: z.string(),
      size_bytes: z.number(),
      mime_type: z.literal("application/pdf"),
      version: z.number(),
      created_at: z.string(),
    })
    .nullable(),
});

export type CareerApplicationSnapshot = z.infer<
  typeof careerApplicationSnapshotSchema
>;

export type CareerJobApplication = {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  source?: string;
  profile_snapshot: unknown;
  process_label: string | null;
  candidate_stage:
    | "registered"
    | "screening"
    | "interview"
    | "evaluation"
    | "finalists"
    | "selected"
    | "talent_pool"
    | "not_selected";
  stage_updated_at: string;
  submitted_at: string;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};

export const adminApplicationTransitions: Record<
  ApplicationStatus,
  readonly ApplicationStatus[]
> = {
  submitted: ["screening", "in_process", "finalized"],
  screening: ["in_process", "finalized"],
  in_process: ["finalized"],
  finalized: [],
  withdrawn: [],
};

export function canTransitionApplication(
  from: ApplicationStatus,
  to: ApplicationStatus,
) {
  return adminApplicationTransitions[from].includes(to);
}

export function canWithdrawApplication(status: ApplicationStatus) {
  return ["submitted", "screening", "in_process"].includes(status);
}

export function formatApplicationDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
