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
  "registered",
  "screening",
  "interview",
  "evaluation",
  "finalists",
  "selected",
  "talent_pool",
  "not_selected",
] as const;

export type SelectionStage = (typeof selectionStages)[number];

export const selectionStageLabels: Record<SelectionStage, string> = {
  registered: "Inscritos",
  screening: "Triagem",
  interview: "Entrevista",
  evaluation: "Avaliação",
  finalists: "Finalistas",
  selected: "Selecionado",
  talent_pool: "Banco de Talentos",
  not_selected: "Não selecionado",
};

export const mainSelectionStages = selectionStages.slice(0, 6);
export const auxiliarySelectionStages = selectionStages.slice(6);

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
