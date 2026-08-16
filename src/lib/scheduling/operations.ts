export const workflowStatuses = [
  "NOVO",
  "EM_ANALISE",
  "AGUARDANDO_CONVENIO",
  "PENDENCIA",
  "RECUSADO",
  "AUTORIZADO",
  "CONCLUIDO",
  "CANCELADO",
] as const;

export type WorkflowStatus = (typeof workflowStatuses)[number];

export const workflowLabels: Record<WorkflowStatus, string> = {
  NOVO: "Novo",
  EM_ANALISE: "Em atendimento",
  AGUARDANDO_CONVENIO: "Aguardando convênio",
  PENDENCIA: "Pendência",
  RECUSADO: "Recusado pelo convênio",
  AUTORIZADO: "Autorizado",
  CONCLUIDO: "Atendido",
  CANCELADO: "Cancelado",
};

export type ConfirmationStatus = "NOT_REQUIRED" | "PENDING" | "SENT" | "FAILED";

export function isConfirmationPending(
  workflowStatus: WorkflowStatus,
  confirmationStatus: ConfirmationStatus,
) {
  return (
    workflowStatus === "CONCLUIDO" &&
    ["PENDING", "FAILED"].includes(confirmationStatus)
  );
}

export function isAttendedRequest(
  workflowStatus: WorkflowStatus,
  confirmationStatus: ConfirmationStatus,
) {
  return (
    workflowStatus === "CONCLUIDO" &&
    !isConfirmationPending(workflowStatus, confirmationStatus)
  );
}

export function isActiveRequest(
  workflowStatus: WorkflowStatus,
  confirmationStatus: ConfirmationStatus,
) {
  return (
    isConfirmationPending(workflowStatus, confirmationStatus) ||
    !["CONCLUIDO", "CANCELADO"].includes(workflowStatus)
  );
}

export function normalizeWhatsAppPhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (!/^[1-9]\d(?:[2-9]\d{7}|9\d{8})$/.test(national)) return null;
  return `55${national}`;
}

export function buildAppointmentWhatsAppUrl(input: {
  phone: string | null | undefined;
  patientName: string;
  protocol?: string | null;
}) {
  const phone = normalizeWhatsAppPhone(input.phone);
  if (!phone) return null;
  const firstName = input.patientName.trim().split(/\s+/)[0] || "Olá";
  const protocol = input.protocol?.trim()
    ? ` Protocolo: ${input.protocol.trim()}.`
    : "";
  const message = `Olá, ${firstName}. Aqui é da recepção da INNEURO. Estamos entrando em contato sobre sua solicitação de pré-agendamento.${protocol}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function hasValidSchedulingEmail(value: string | null | undefined) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export const quickPendingReasons = [
  "Pedido médico incompleto",
  "Pedido sem assinatura",
  "Pedido sem carimbo",
  "Carteirinha ilegível",
  "Carteirinha vencida",
  "Documento ilegível",
  "Falta relatório médico",
  "Dados divergentes",
  "Autorização pendente",
  "Outro",
] as const;

export const pendingSuggestions: Record<
  string,
  { correction: string; guidance: string }
> = {
  "Pedido médico incompleto": {
    correction: "Enviar um pedido médico completo e legível.",
    guidance:
      "Confira se o pedido contém todas as informações do exame e envie uma nova imagem ou PDF.",
  },
  "Pedido sem assinatura": {
    correction:
      "Enviar o pedido médico assinado pelo profissional solicitante.",
    guidance: "Solicite a assinatura no pedido e envie o documento atualizado.",
  },
  "Pedido sem carimbo": {
    correction:
      "Enviar o pedido médico com identificação do profissional solicitante.",
    guidance:
      "Solicite o carimbo ou identificação válida do profissional e envie o documento atualizado.",
  },
  "Carteirinha ilegível": {
    correction: "Enviar uma imagem legível da carteirinha do convênio.",
    guidance:
      "Fotografe a carteirinha com boa iluminação, sem cortes ou reflexos.",
  },
  "Carteirinha vencida": {
    correction: "Enviar a carteirinha atualizada do convênio.",
    guidance:
      "Confirme a validade junto ao convênio e envie o documento vigente.",
  },
  "Documento ilegível": {
    correction: "Enviar novamente o documento em boa qualidade.",
    guidance:
      "Fotografe o documento inteiro, com boa iluminação e sem reflexos.",
  },
  "Falta relatório médico": {
    correction: "Enviar o relatório médico solicitado.",
    guidance:
      "Solicite o relatório ao profissional responsável e envie uma imagem ou PDF legível.",
  },
  "Dados divergentes": {
    correction: "Confirmar e corrigir os dados divergentes nos documentos.",
    guidance:
      "Revise os dados e envie os documentos atualizados para nova análise.",
  },
  "Autorização pendente": {
    correction:
      "Enviar a autorização do convênio assim que estiver disponível.",
    guidance:
      "Acompanhe a solicitação junto ao convênio e envie a autorização quando liberada.",
  },
  Outro: {
    correction: "Enviar a documentação corrigida.",
    guidance: "Revise a orientação informada e envie o documento solicitado.",
  },
};

export function defaultDocumentsToBring(serviceType: string) {
  const common = [
    "Documento oficial com foto",
    "Pedido médico",
    "Exames anteriores, quando aplicável",
  ];
  return serviceType === "INSURANCE"
    ? [
        common[0],
        common[1],
        "Carteirinha do convênio",
        "Autorização",
        common[2],
      ]
    : serviceType === "SUS"
      ? [
          common[0],
          common[1],
          "Cartão SUS",
          "Autorização da regulação",
          common[2],
        ]
      : common;
}

export function formatWaitingTime(createdAt: string, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.floor((now - Date.parse(createdAt)) / 60_000),
  );
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

export function formatReceptionDate(value: string | null) {
  if (!value) return "—";
  if (value.includes("T")) {
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export function isLongWaiting(createdAt: string, now = Date.now()) {
  return now - Date.parse(createdAt) >= 60 * 60 * 1000;
}
