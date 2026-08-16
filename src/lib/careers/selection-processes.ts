export const selectionProcessStatuses = [
  "draft",
  "open",
  "in_progress",
  "closed",
  "cancelled",
] as const;

export type SelectionProcessStatus = (typeof selectionProcessStatuses)[number];

export const selectionProcessStatusLabels: Record<
  SelectionProcessStatus,
  string
> = {
  draft: "Rascunho",
  open: "Aberto",
  in_progress: "Em andamento",
  closed: "Encerrado",
  cancelled: "Cancelado",
};

export const selectionStages = [
  "resume",
  "interview",
  "practical_test",
  "hiring",
  "hired",
  "not_approved",
] as const;

export type SelectionStage = (typeof selectionStages)[number];

export const selectionStageLabels: Record<SelectionStage, string> = {
  resume: "Currículo",
  interview: "Entrevista",
  practical_test: "Teste Prático",
  hiring: "Contratação",
  hired: "Contratado",
  not_approved: "Não aprovado",
};

export const mainSelectionStages = selectionStages.slice(0, 4);
export const auxiliarySelectionStages = selectionStages.slice(4);

export const selectionStageNumbers: Partial<Record<SelectionStage, number>> = {
  resume: 1,
  interview: 2,
  practical_test: 3,
  hiring: 4,
};

export const selectionStageCandidateMessages: Partial<
  Record<SelectionStage, string>
> = {
  resume: "Seu currículo está sendo analisado.",
  interview: "Você avançou para a etapa de entrevista.",
  practical_test: "Você avançou para a etapa de teste prático.",
  hiring: "Você chegou à etapa final do processo seletivo.",
  hired: "Sua contratação foi aprovada pela equipe responsável.",
  not_approved: "Sua participação neste processo foi encerrada.",
};

export const selectionStageNext: Partial<
  Record<SelectionStage, SelectionStage>
> = {
  resume: "interview",
  interview: "practical_test",
  practical_test: "hiring",
  hiring: "hired",
};

export const selectionStageApprovalLabels: Partial<
  Record<SelectionStage, string>
> = {
  resume: "APROVAR PARA ENTREVISTA",
  interview: "APROVAR PARA TESTE PRÁTICO",
  practical_test: "APROVAR PARA CONTRATAÇÃO",
  hiring: "APROVAR CONTRATAÇÃO",
};

export type CareerSelectionProcess = {
  id: string;
  job_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: SelectionProcessStatus;
  opened_at: string | null;
  started_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  job?: { id: string; title: string; status: string } | null;
};

export type CareerSelectionCandidate = {
  id: string;
  process_id: string;
  application_id: string;
  candidate_id: string;
  stage: SelectionStage;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
};

const processTransitions: Record<
  SelectionProcessStatus,
  readonly SelectionProcessStatus[]
> = {
  draft: ["open", "cancelled"],
  open: ["in_progress", "closed", "cancelled"],
  in_progress: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function canTransitionSelectionProcess(
  from: SelectionProcessStatus,
  to: SelectionProcessStatus,
) {
  return processTransitions[from].includes(to);
}

export function canManageSelectionCandidates(status: SelectionProcessStatus) {
  return status === "open" || status === "in_progress";
}

export function formatSelectionPeriodDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}
