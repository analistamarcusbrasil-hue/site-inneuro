export const careerCommunicationTemplates = [
  "APPLICATION_RECEIVED",
  "UNDER_REVIEW",
  "NEXT_STAGE",
  "STAGE_1_APPROVED",
  "STAGE_2_APPROVED",
  "STAGE_3_APPROVED",
  "FINAL_APPROVED",
  "INTERVIEW_INVITE",
  "PRACTICAL_TEST_INVITE",
  "INTERVIEW_REMINDER",
  "APPROVED",
  "TALENT_POOL",
  "REJECTED",
  "PROCESS_CLOSED",
  "CUSTOM_MESSAGE",
  "INTERNAL_NEW_APPLICATION",
  "PASSWORD_RECOVERY",
] as const;

export type CareerCommunicationTemplate =
  (typeof careerCommunicationTemplates)[number];

export const adminCareerCommunicationTemplates = [
  "UNDER_REVIEW",
  "NEXT_STAGE",
  "STAGE_1_APPROVED",
  "STAGE_2_APPROVED",
  "STAGE_3_APPROVED",
  "FINAL_APPROVED",
  "INTERVIEW_INVITE",
  "PRACTICAL_TEST_INVITE",
  "INTERVIEW_REMINDER",
  "APPROVED",
  "TALENT_POOL",
  "REJECTED",
  "PROCESS_CLOSED",
  "CUSTOM_MESSAGE",
] as const;

export type AdminCareerCommunicationTemplate =
  (typeof adminCareerCommunicationTemplates)[number];

export type CareerCommunicationStatus =
  "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";

export type CareerCommunicationVariables = Record<string, unknown>;

export type RenderedCareerCommunication = {
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type CareerCommunicationRecord = {
  id: string;
  candidate_id: string | null;
  application_id: string | null;
  job_id: string | null;
  type: CareerCommunicationTemplate;
  template_key: CareerCommunicationTemplate;
  recipient_kind: "candidate" | "internal";
  recipient_email: string;
  subject: string;
  status: CareerCommunicationStatus;
  payload: CareerCommunicationVariables;
  attempt_count: number;
  idempotency_key: string | null;
  last_attempt_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  last_error_code: string | null;
  triggered_by: "candidate" | "admin" | "system";
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type QueueCareerCommunicationInput = {
  candidateId?: string | null;
  applicationId?: string | null;
  jobId?: string | null;
  template: CareerCommunicationTemplate;
  recipientKind: "candidate" | "internal";
  recipient: string;
  variables: CareerCommunicationVariables;
  triggeredBy: "candidate" | "admin" | "system";
  createdBy?: string | null;
  idempotencyKey?: string | null;
};

export const careerCommunicationTemplateLabels: Record<
  CareerCommunicationTemplate,
  string
> = {
  APPLICATION_RECEIVED: "Candidatura recebida",
  UNDER_REVIEW: "Candidatura em análise",
  NEXT_STAGE: "Próxima etapa",
  STAGE_1_APPROVED: "Aprovado para entrevista",
  STAGE_2_APPROVED: "Aprovado para teste prático",
  STAGE_3_APPROVED: "Aprovado para contratação",
  FINAL_APPROVED: "Contratação aprovada",
  INTERVIEW_INVITE: "Convite para entrevista",
  PRACTICAL_TEST_INVITE: "Convite para teste prático",
  INTERVIEW_REMINDER: "Lembrete de entrevista",
  APPROVED: "Aprovado no processo",
  TALENT_POOL: "Banco de talentos",
  REJECTED: "Processo encerrado para o candidato",
  PROCESS_CLOSED: "Processo seletivo encerrado",
  CUSTOM_MESSAGE: "Mensagem personalizada",
  INTERNAL_NEW_APPLICATION: "Alerta interno de nova candidatura",
  PASSWORD_RECOVERY: "Recuperação de senha",
};
