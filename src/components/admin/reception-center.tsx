"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Download,
  Eye,
  FileDown,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import {
  buildAppointmentWhatsAppUrl,
  formatReceptionDate,
  formatWaitingTime,
  hasValidSchedulingEmail,
  isActiveRequest,
  isAttendedRequest,
  isConfirmationPending,
  isLongWaiting,
  notSchedulableGuidance,
  notSchedulableReasonLabels,
  notSchedulableReasons,
  pendingSuggestions,
  quickPendingReasons,
  workflowLabels,
  type ConfirmationStatus,
  type WorkflowStatus,
  type NotSchedulableReason,
} from "@/lib/scheduling/operations";

type ExamRow = {
  id: string;
  exam_name: string;
  exam_id: string | null;
  modality: string | null;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  preparation_text: string | null;
  documents_to_bring: string[];
  automatic_preparation: string;
  automatic_documents: string[];
  not_schedulable_reason: NotSchedulableReason | null;
  not_schedulable_detail: string | null;
  not_schedulable_guidance: string | null;
  not_schedulable_at: string | null;
};
type DocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  checked_at: string | null;
  source: string;
  created_at: string;
};
type HistoryRow = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};
type CommunicationRow = {
  id: string;
  communication_type: string;
  subject: string;
  text_body: string;
  status: string;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
};
type ProfileRelation =
  { full_name: string | null } | Array<{ full_name: string | null }> | null;

export type ReceptionRequest = {
  id: string;
  protocol: string;
  patient_name: string;
  cpf: string | null;
  phone: string;
  email: string | null;
  service_type: string;
  insurance_name: string | null;
  insurance_card_number: string | null;
  workflow_status: WorkflowStatus;
  confirmation_status: ConfirmationStatus;
  confirmation_communication_id: string | null;
  assigned_to: string | null;
  claimed_at: string | null;
  assigned: ProfileRelation;
  completed_by: string | null;
  completed_at: string | null;
  completed: ProfileRelation;
  insurer_reference: string | null;
  authorization_number: string | null;
  authorization_valid_until: string | null;
  pending_reason: string | null;
  pending_correction: string | null;
  pending_guidance: string | null;
  not_schedulable_reason: NotSchedulableReason | null;
  not_schedulable_detail: string | null;
  not_schedulable_guidance: string | null;
  not_schedulable_communication_status: ConfirmationStatus;
  not_schedulable_communication_id: string | null;
  documents_received_at: string | null;
  unit_name: string;
  created_at: string;
  updated_at: string;
  appointment_request_exams: ExamRow[];
  appointment_request_documents: DocumentRow[];
  appointment_request_history: HistoryRow[];
  appointment_request_communications: CommunicationRow[];
};

type Modal =
  | "wait"
  | "pending"
  | "rejected"
  | "authorize"
  | "not_schedulable"
  | "take_over"
  | "delete_request"
  | "complete"
  | "message"
  | "view-message"
  | null;
type ScheduleDraft = {
  examId: string;
  name: string;
  date: string;
  time: string;
  preparation: string;
  documents: string;
};

const serviceLabels: Record<string, string> = {
  PARTICULAR: "Particular",
  INSURANCE: "Convênio",
  SUS: "SUS",
};
const documentLabels: Record<string, string> = {
  photo_id: "Documento com foto",
  medical_request: "Pedido médico",
  sus_authorization: "Autorização",
  sus_card: "Cartão SUS",
  insurance_card_front: "Carteirinha",
  insurance_card_back: "Verso da carteirinha",
  insurance_authorization: "Autorização",
  other: "Documento complementar",
};

function relationName(relation: ProfileRelation, fallback: string) {
  return (
    (Array.isArray(relation) ? relation[0]?.full_name : relation?.full_name) ||
    fallback
  );
}

function effectiveStatus(request: ReceptionRequest) {
  if (
    request.workflow_status === "NAO_AGENDAVEL" &&
    request.not_schedulable_communication_status !== "SENT"
  )
    return "Comunicação pendente";
  if (
    isConfirmationPending(request.workflow_status, request.confirmation_status)
  )
    return "Confirmação pendente";
  return workflowLabels[request.workflow_status];
}

function statusColor(request: ReceptionRequest) {
  if (
    isConfirmationPending(request.workflow_status, request.confirmation_status)
  )
    return "bg-rose-100 text-rose-800";
  if (request.workflow_status === "AUTORIZADO")
    return "bg-emerald-100 text-emerald-800";
  if (["PENDENCIA", "RECUSADO"].includes(request.workflow_status))
    return "bg-amber-100 text-amber-900";
  if (request.workflow_status === "NOVO") return "bg-sky-100 text-sky-800";
  if (request.workflow_status === "NAO_AGENDAVEL")
    return "bg-rose-100 text-rose-900";
  return "bg-slate-100 text-slate-700";
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full bg-slate-100"
            aria-label="Fechar"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ReceptionCenter({
  requests,
  currentUser,
}: {
  requests: ReceptionRequest[];
  currentUser: {
    id: string;
    name: string;
    canManageScheduling: boolean;
    canOverrideAssignment: boolean;
  };
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"active" | "attended">("active");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [hiddenActiveIds, setHiddenActiveIds] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showContactCorrection, setShowContactCorrection] = useState(false);
  const [reason, setReason] = useState<string>(quickPendingReasons[0]);
  const [correction, setCorrection] = useState(
    pendingSuggestions[quickPendingReasons[0]].correction,
  );
  const [guidance, setGuidance] = useState(
    pendingSuggestions[quickPendingReasons[0]].guidance,
  );
  const [reference, setReference] = useState("");
  const [authorizationNumber, setAuthorizationNumber] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [sharedDate, setSharedDate] = useState("");
  const [schedules, setSchedules] = useState<ScheduleDraft[]>([]);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageType, setMessageType] = useState("GUIDANCE");
  const [viewMessage, setViewMessage] = useState<CommunicationRow | null>(null);
  const [notSchedulableReason, setNotSchedulableReason] =
    useState<NotSchedulableReason>("clinic_does_not_offer");
  const [notSchedulableDetail, setNotSchedulableDetail] = useState("");
  const [deletionJustification, setDeletionJustification] = useState("");
  const [notSchedulableOrientation, setNotSchedulableOrientation] = useState(
    notSchedulableGuidance.clinic_does_not_offer,
  );
  const [closureScope, setClosureScope] = useState<"all" | "selected">("all");
  const [selectedClosureExams, setSelectedClosureExams] = useState<string[]>(
    [],
  );
  const [postActionWhatsappUrl, setPostActionWhatsappUrl] = useState("");

  const activeRequests = useMemo(
    () =>
      requests
        .filter(
          (item) =>
            !hiddenActiveIds.includes(item.id) &&
            isActiveRequest(item.workflow_status, item.confirmation_status),
        )
        .sort((a, b) => {
          const priority = (item: ReceptionRequest) =>
            item.documents_received_at
              ? 0
              : isConfirmationPending(
                    item.workflow_status,
                    item.confirmation_status,
                  )
                ? 1
                : item.workflow_status === "NOVO"
                  ? 2
                  : 3;
          return (
            priority(a) - priority(b) ||
            Date.parse(a.created_at) - Date.parse(b.created_at)
          );
        }),
    [requests, hiddenActiveIds],
  );
  const attendedRequests = useMemo(
    () =>
      requests
        .filter((item) =>
          isAttendedRequest(item.workflow_status, item.confirmation_status),
        )
        .sort(
          (a, b) =>
            Date.parse(b.completed_at ?? b.updated_at) -
            Date.parse(a.completed_at ?? a.updated_at),
        ),
    [requests],
  );
  const source = view === "active" ? activeRequests : attendedRequests;
  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR").replace(/\s/g, "");
    return source.filter((item) => {
      if (view === "active") {
        if (filter === "mine" && item.assigned_to !== currentUser.id)
          return false;
        if (filter === "new" && item.workflow_status !== "NOVO") return false;
        if (
          filter === "pending" &&
          !["PENDENCIA", "RECUSADO"].includes(item.workflow_status)
        )
          return false;
        if (filter === "authorized" && item.workflow_status !== "AUTORIZADO")
          return false;
        if (
          filter === "confirmation" &&
          !isConfirmationPending(item.workflow_status, item.confirmation_status)
        )
          return false;
      }
      if (!normalized) return true;
      return `${item.patient_name}${item.cpf ?? ""}${item.phone}${item.protocol}`
        .toLocaleLowerCase("pt-BR")
        .replace(/\s/g, "")
        .includes(normalized);
    });
  }, [source, query, filter, view, currentUser.id]);
  const selected =
    filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const pendingCount = activeRequests.filter((item) =>
    ["PENDENCIA", "RECUSADO"].includes(item.workflow_status),
  ).length;
  const authorizedCount = activeRequests.filter(
    (item) => item.workflow_status === "AUTORIZADO",
  ).length;
  const confirmationCount = activeRequests.filter((item) =>
    isConfirmationPending(item.workflow_status, item.confirmation_status),
  ).length;
  const whatsAppUrl = selected
    ? buildAppointmentWhatsAppUrl({
        phone: selected.phone,
        patientName: selected.patient_name,
        protocol: selected.protocol,
      })
    : null;
  const emailIsValid = hasValidSchedulingEmail(selected?.email);
  const ownedByAnother = Boolean(
    selected?.assigned_to && selected.assigned_to !== currentUser.id,
  );
  const lockedByAnother = ownedByAnother && !currentUser.canOverrideAssignment;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const editing = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (event.target as HTMLElement).tagName,
      );
      if (event.key === "/" && !editing) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key.toLowerCase() === "n" && !modal && !editing) nextRequest();
      if (event.key.toLowerCase() === "w" && !modal && !editing && whatsAppUrl)
        window.open(whatsAppUrl, "_blank", "noopener,noreferrer");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function nextRequest() {
    if (!filtered.length) return;
    const index = filtered.findIndex((item) => item.id === selected?.id);
    setSelectedId(filtered[(index + 1) % filtered.length].id);
  }

  function chooseReason(value: string) {
    setReason(value);
    const suggested = pendingSuggestions[value];
    if (suggested) {
      setCorrection(suggested.correction);
      setGuidance(suggested.guidance);
    }
  }

  function openPending(kind: "pending" | "rejected") {
    chooseReason(quickPendingReasons[0]);
    setModal(kind);
  }

  function openComplete() {
    if (!selected) return;
    setSharedDate("");
    setSchedules(
      selected.appointment_request_exams
        .filter((exam) => exam.status !== "NOT_SCHEDULABLE")
        .map((exam) => ({
          examId: exam.id,
          name: exam.exam_name,
          date: exam.scheduled_date ?? "",
          time: exam.scheduled_time?.slice(0, 5) ?? "",
          preparation:
            exam.preparation_text ||
            exam.automatic_preparation ||
            "Sem preparo específico cadastrado.",
          documents: (exam.documents_to_bring?.length
            ? exam.documents_to_bring
            : exam.automatic_documents
          ).join("\n"),
        })),
    );
    setModal("complete");
  }

  function openNotSchedulable() {
    if (!selected) return;
    const available = selected.appointment_request_exams
      .filter((exam) => exam.status !== "NOT_SCHEDULABLE")
      .map((exam) => exam.id);
    setNotSchedulableReason("clinic_does_not_offer");
    setNotSchedulableDetail("");
    setNotSchedulableOrientation(notSchedulableGuidance.clinic_does_not_offer);
    setClosureScope("all");
    setSelectedClosureExams(available);
    setModal("not_schedulable");
  }

  function openDeletion() {
    setDeletionJustification("");
    setModal("delete_request");
  }

  function openMessage() {
    if (!selected || !emailIsValid) {
      setShowContactCorrection(true);
      setError("Corrija o e-mail do paciente antes de enviar.");
      return;
    }
    setMessageType("GUIDANCE");
    setMessageSubject("Orientação sobre seu pré-agendamento — INNEURO");
    setMessageBody(
      `Olá, ${selected.patient_name}.\n\nPROTOCOLO\n${selected.protocol}\n\n`,
    );
    setModal("message");
  }

  async function copyContact(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copiado.`);
      setError("");
    } catch {
      setError(
        `Não foi possível copiar o ${label.toLocaleLowerCase("pt-BR")}.`,
      );
    }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected || saving) return false;
    const actedId = selected.id;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/solicitacoes/acoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: actedId,
          operationId: crypto.randomUUID(),
          action,
          ...extra,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível concluir.");
      setNotice(result.message || "Ação concluída.");
      setPostActionWhatsappUrl(result.whatsappUrl || "");
      if (result.removeFromActive)
        setHiddenActiveIds((ids) => [...ids, actedId]);
      setModal(null);
      router.refresh();
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Não foi possível concluir.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateContact(form: FormData) {
    const updated = await act("update_contact", {
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    if (updated) setShowContactCorrection(false);
  }

  function renderNextAction() {
    if (!selected) return null;
    if (view === "attended")
      return (
        <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
          <p className="font-bold">
            {selected.workflow_status === "NAO_AGENDAVEL"
              ? "Solicitação não agendável"
              : "Atendimento finalizado"}
          </p>
          <p className="mt-1 text-sm">
            {selected.workflow_status === "NAO_AGENDAVEL" ? (
              selected.not_schedulable_detail ||
              (selected.not_schedulable_reason
                ? notSchedulableReasonLabels[selected.not_schedulable_reason]
                : "Motivo registrado no histórico.")
            ) : (
              <>
                Por{" "}
                {relationName(selected.completed, "Atendente não identificado")}{" "}
                em {formatReceptionDate(selected.completed_at)}.
              </>
            )}
          </p>
        </div>
      );
    if (selected.workflow_status === "NAO_AGENDAVEL") {
      const communication = selected.appointment_request_communications.find(
        (item) => item.id === selected.not_schedulable_communication_id,
      );
      return (
        <div className="rounded-2xl bg-rose-50 p-4 text-rose-950">
          <p className="font-bold">Comunicação pendente</p>
          <p className="mt-1 text-sm">
            O motivo foi preservado. Reenvie o e-mail para encerrar a fila.
          </p>
          {communication ? (
            <button
              type="button"
              disabled={saving || lockedByAnother || !emailIsValid}
              onClick={() =>
                act("retry", { communicationId: communication.id })
              }
              className="mt-3 min-h-11 rounded-full bg-rose-800 px-4 font-bold text-white disabled:opacity-50"
            >
              <RefreshCw className="mr-1 inline" size={15} /> Reenviar
              comunicação
            </button>
          ) : null}
        </div>
      );
    }
    if (
      isConfirmationPending(
        selected.workflow_status,
        selected.confirmation_status,
      )
    )
      return (
        <button
          type="button"
          disabled={saving || lockedByAnother || !emailIsValid}
          onClick={() => act("retry_confirmation")}
          className="min-h-12 w-full rounded-full bg-rose-700 px-5 font-bold text-white disabled:opacity-50"
        >
          <RefreshCw className="mr-2 inline" size={17} />
          {saving ? "Reenviando..." : "Reenviar confirmação"}
        </button>
      );
    if (selected.workflow_status === "NOVO" && ownedByAnother)
      return (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Assuma o agendamento acima para continuar o atendimento.
        </p>
      );
    if (selected.workflow_status === "NOVO")
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => act("claim")}
            className="bg-brand min-h-12 rounded-full px-5 font-bold text-white disabled:opacity-50"
          >
            <UserCheck className="mr-2 inline" size={17} />
            {saving ? "Assumindo..." : "Assumir atendimento"}
          </button>
          {currentUser.canManageScheduling ? (
            <button
              type="button"
              disabled={saving || !emailIsValid}
              onClick={openNotSchedulable}
              className="min-h-12 rounded-full border border-rose-300 px-5 font-bold text-rose-800 disabled:opacity-50"
            >
              <Ban className="mr-1 inline" size={16} /> Não é possível agendar
            </button>
          ) : null}
        </div>
      );
    if (selected.workflow_status === "AUTORIZADO")
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={saving || lockedByAnother || !emailIsValid}
            onClick={openComplete}
            className="min-h-12 rounded-full bg-emerald-700 px-5 font-bold text-white disabled:opacity-50"
          >
            Confirmar data e horário
          </button>
          <button
            type="button"
            disabled={saving || !emailIsValid}
            onClick={openNotSchedulable}
            className="min-h-12 rounded-full border border-rose-300 px-5 font-bold text-rose-800 disabled:opacity-50"
          >
            <Ban className="mr-1 inline" size={16} /> Não é possível agendar
          </button>
        </div>
      );
    if (lockedByAnother)
      return (
        <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
          Atendimento em andamento com{" "}
          {relationName(selected.assigned, "outro atendente")}.
        </p>
      );
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {selected.workflow_status === "EM_ANALISE" ? (
          <button
            type="button"
            onClick={() => setModal("wait")}
            className="min-h-11 rounded-full bg-slate-800 px-4 font-bold text-white"
          >
            Enviar ao convênio
          </button>
        ) : null}
        {selected.workflow_status === "AGUARDANDO_CONVENIO" ? (
          <button
            type="button"
            onClick={() => openPending("rejected")}
            className="min-h-11 rounded-full bg-amber-600 px-4 font-bold text-white"
          >
            Convênio recusou
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => openPending("pending")}
          className="min-h-11 rounded-full bg-amber-100 px-4 font-bold text-amber-950"
        >
          Registrar pendência
        </button>
        <button
          type="button"
          onClick={() => setModal("authorize")}
          className="min-h-11 rounded-full bg-emerald-700 px-4 font-bold text-white"
        >
          Autorizar agendamento
        </button>
        {currentUser.canManageScheduling ? (
          <button
            type="button"
            disabled={saving || !emailIsValid}
            onClick={openNotSchedulable}
            className="min-h-11 rounded-full border border-rose-300 px-4 font-bold text-rose-800 disabled:opacity-50"
          >
            <Ban className="mr-1 inline" size={15} /> Não é possível agendar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      {notice ? (
        <div
          role="status"
          className="bg-mint text-brand mb-4 rounded-xl p-3 font-bold"
        >
          <p className="flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" size={18} /> {notice}
          </p>
          {postActionWhatsappUrl ? (
            <a
              href={postActionWhatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-10 items-center rounded-full bg-emerald-700 px-4 text-sm text-white"
            >
              <MessageCircle className="mr-1" size={15} /> Avisar pelo WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-4 flex items-center gap-2 rounded-xl p-3 font-bold"
        >
          <AlertTriangle aria-hidden="true" size={18} /> {error}
        </p>
      ) : null}

      <section className="border-border-light mb-4 rounded-2xl border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex rounded-xl bg-slate-100 p-1"
            aria-label="Visualização da central"
          >
            <button
              type="button"
              onClick={() => {
                setView("active");
                setFilter("all");
                setShowContactCorrection(false);
              }}
              className={`min-h-10 rounded-lg px-4 text-sm font-extrabold ${view === "active" ? "bg-brand text-white shadow-sm" : "text-slate-600"}`}
            >
              FILA ATIVA · {activeRequests.length}
            </button>
            <button
              type="button"
              onClick={() => {
                setView("attended");
                setFilter("all");
                setShowContactCorrection(false);
              }}
              className={`min-h-10 rounded-lg px-4 text-sm font-extrabold ${view === "attended" ? "bg-brand text-white shadow-sm" : "text-slate-600"}`}
            >
              ENCERRADOS · {attendedRequests.length}
            </button>
          </div>
          {view === "active" ? (
            <div className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
              <span>{activeRequests.length} aguardando atendimento</span>
              <span>{pendingCount} pendências</span>
              <span>{authorizedCount} autorizados</span>
              <span>{confirmationCount} confirmações pendentes</span>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[16rem] flex-1">
            <Search
              className="text-muted absolute top-3.5 left-3"
              size={18}
              aria-hidden="true"
            />
            <span className="sr-only">Buscar paciente</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, CPF, telefone ou protocolo  /"
              className="border-border-light min-h-12 w-full rounded-xl border pr-3 pl-10"
            />
          </label>
          {view === "active" ? (
            <div
              className="flex flex-wrap gap-1.5"
              aria-label="Filtros rápidos"
            >
              {[
                ["all", "Todos"],
                ["mine", "Meus"],
                ["new", "Novos"],
                ["pending", "Pendências"],
                ["authorized", "Autorizados"],
                ["confirmation", "Confirmação"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`min-h-9 rounded-full px-3 text-xs font-bold ${filter === key ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(20rem,.75fr)_minmax(36rem,1.25fr)]">
        <section
          aria-label={view === "active" ? "Fila ativa" : "Atendidos"}
          className="min-w-0"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-muted text-xs font-bold tracking-wide uppercase">
              {filtered.length} registro(s)
            </p>
            <button
              type="button"
              onClick={nextRequest}
              className="text-brand min-h-9 px-2 text-xs font-bold"
            >
              PRÓXIMO <ChevronRight className="inline" size={15} />
            </button>
          </div>
          <div className="space-y-2 xl:max-h-[72vh] xl:overflow-y-auto xl:pr-1">
            {filtered.map((item) => {
              const exams = item.appointment_request_exams;
              const received = Boolean(item.documents_received_at);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setShowContactCorrection(false);
                  }}
                  className={`border-border-light w-full rounded-2xl border p-3 text-left transition ${selected?.id === item.id ? "ring-brand bg-sky-50 ring-2" : "bg-white hover:bg-slate-50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">
                        {item.patient_name}
                      </p>
                      <p className="text-muted mt-0.5 truncate text-xs">
                        {exams[0]?.exam_name || "Exame não informado"}
                        {exams.length > 1
                          ? ` + ${exams.length - 1}`
                          : ""} ·{" "}
                        {item.insurance_name ||
                          serviceLabels[item.service_type] ||
                          item.service_type}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[.65rem] font-extrabold ${statusColor(item)}`}
                    >
                      {effectiveStatus(item)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[.7rem]">
                    <span
                      className={
                        isLongWaiting(item.created_at) && view === "active"
                          ? "font-bold text-amber-800"
                          : "text-muted"
                      }
                    >
                      <Clock3 className="mr-1 inline" size={13} />
                      {view === "active"
                        ? formatWaitingTime(item.created_at)
                        : formatReceptionDate(item.completed_at)}
                    </span>
                    {received ? (
                      <span className="font-bold text-emerald-800">
                        DOCUMENTO RECEBIDO
                      </span>
                    ) : null}
                    {item.assigned_to ? (
                      <span className="text-muted">
                        Responsável: {relationName(item.assigned, "Atendente")}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
            {!filtered.length ? (
              <div className="border-border-light rounded-2xl border bg-white p-8 text-center text-sm text-slate-600">
                Nenhum registro nesta visualização.
              </div>
            ) : null}
          </div>
        </section>

        <section
          aria-label="Detalhes do atendimento"
          className="border-border-light min-w-0 rounded-2xl border bg-white"
        >
          {selected ? (
            <>
              <header className="border-border-light border-b p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-muted text-xs font-bold">
                      {selected.protocol}
                    </p>
                    <h2 className="font-heading text-brand mt-1 text-2xl font-semibold">
                      {selected.patient_name}
                    </h2>
                    <p className="text-muted mt-1 text-sm">
                      Responsável:{" "}
                      {relationName(selected.assigned, "Não atribuído")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <a
                      href={`/api/admin/solicitacoes/${selected.id}/formulario`}
                      className="bg-brand inline-flex min-h-10 items-center justify-center rounded-full px-4 text-xs font-bold text-white"
                    >
                      <FileDown
                        className="mr-1.5"
                        size={16}
                        aria-hidden="true"
                      />
                      Formulário completo
                    </a>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor(selected)}`}
                    >
                      {effectiveStatus(selected)}
                    </span>
                  </div>
                </div>
                {lockedByAnother && view === "active" ? (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    Esta solicitação está sendo atendida por outra pessoa. As
                    ações operacionais ficam protegidas.
                  </p>
                ) : null}
                {ownedByAnother &&
                currentUser.canOverrideAssignment &&
                view === "active" ? (
                  <div className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
                    <p>
                      Este atendimento está atribuído a{" "}
                      {relationName(selected.assigned, "outro atendente")}. Você
                      possui permissão administrativa para realizar alterações.
                    </p>
                    <p className="mt-1 font-bold">
                      Administrador intervindo: {currentUser.name}
                    </p>
                  </div>
                ) : null}
                {view === "active" &&
                ownedByAnother &&
                currentUser.canManageScheduling ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setModal("take_over")}
                      className="bg-brand min-h-11 rounded-full px-4 font-bold text-white disabled:opacity-50"
                    >
                      <UserCheck className="mr-1 inline" size={16} /> Assumir
                      agendamento
                    </button>
                    <button
                      type="button"
                      disabled={saving || !emailIsValid}
                      onClick={openNotSchedulable}
                      className="min-h-11 rounded-full border border-rose-300 px-4 font-bold text-rose-800 disabled:opacity-50"
                    >
                      <Ban className="mr-1 inline" size={16} /> Não é possível
                      agendar
                    </button>
                  </div>
                ) : null}
                {view === "active" && currentUser.canOverrideAssignment ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={openDeletion}
                    className="mt-3 inline-flex min-h-10 items-center rounded-full border border-rose-300 px-4 text-sm font-bold text-rose-800 disabled:opacity-50"
                  >
                    <Trash2 className="mr-1" size={15} /> Excluir agendamento
                  </button>
                ) : null}
              </header>

              <div className="border-border-light border-b p-4 sm:p-5">
                <p className="text-muted mb-2 text-[.68rem] font-extrabold tracking-wide uppercase">
                  Contato do paciente
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-bold">
                      {selected.phone || "Telefone não informado"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {whatsAppUrl ? (
                        <a
                          href={whatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-9 rounded-full bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                        >
                          <MessageCircle className="mr-1 inline" size={15} />
                          WhatsApp <span className="opacity-70">W</span>
                        </a>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-3 py-2 text-xs text-slate-600">
                          WhatsApp indisponível
                        </span>
                      )}
                      {selected.phone ? (
                        <button
                          type="button"
                          onClick={() =>
                            copyContact(selected.phone, "Telefone")
                          }
                          className="min-h-9 rounded-full bg-white px-3 text-xs font-bold ring-1 ring-slate-200"
                        >
                          <Clipboard className="mr-1 inline" size={14} /> Copiar
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="truncate text-sm font-bold">
                      {emailIsValid ? selected.email : "E-mail não informado"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {emailIsValid ? (
                        <>
                          <button
                            type="button"
                            onClick={openMessage}
                            className="min-h-9 rounded-full bg-sky-800 px-3 text-xs font-bold text-white"
                          >
                            <Mail className="mr-1 inline" size={14} /> Enviar
                            e-mail
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              copyContact(selected.email!, "E-mail")
                            }
                            className="min-h-9 rounded-full bg-white px-3 text-xs font-bold ring-1 ring-slate-200"
                          >
                            <Clipboard className="mr-1 inline" size={14} />{" "}
                            Copiar
                          </button>
                        </>
                      ) : currentUser.canOverrideAssignment ? (
                        <button
                          type="button"
                          onClick={() =>
                            setShowContactCorrection((value) => !value)
                          }
                          className="min-h-9 rounded-full bg-white px-3 text-xs font-bold ring-1 ring-slate-200"
                        >
                          Corrigir contato
                        </button>
                      ) : null}
                      {emailIsValid && currentUser.canOverrideAssignment ? (
                        <button
                          type="button"
                          onClick={() =>
                            setShowContactCorrection((value) => !value)
                          }
                          className="min-h-9 rounded-full bg-white px-3 text-xs font-bold ring-1 ring-slate-200"
                        >
                          Corrigir contato
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {showContactCorrection ? (
                  <form
                    action={updateContact}
                    className="mt-3 grid gap-2 rounded-xl bg-amber-50 p-3 sm:grid-cols-2"
                  >
                    <label className="text-xs font-bold">
                      WhatsApp correto
                      <input
                        name="phone"
                        type="tel"
                        required
                        defaultValue={selected.phone ?? ""}
                        className="mt-1 min-h-11 w-full rounded-lg border border-amber-200 bg-white px-3 font-normal"
                      />
                    </label>
                    <label className="flex-1 text-xs font-bold">
                      E-mail correto
                      <input
                        name="email"
                        type="email"
                        required
                        defaultValue={selected.email ?? ""}
                        className="mt-1 min-h-11 w-full rounded-lg border border-amber-200 bg-white px-3 font-normal"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-brand min-h-11 rounded-full px-5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2"
                    >
                      Salvar contato
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="border-border-light border-b p-4 sm:p-5">
                <p className="text-muted mb-3 text-[.68rem] font-extrabold tracking-wide uppercase">
                  Próxima ação
                </p>
                {!emailIsValid &&
                ["AUTORIZADO", "CONCLUIDO"].includes(
                  selected.workflow_status,
                ) ? (
                  <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    Corrija o e-mail antes de concluir ou reenviar a
                    confirmação.
                  </p>
                ) : null}
                {renderNextAction()}
              </div>

              <div className="divide-border-light divide-y p-2 sm:p-3">
                <details open className="group p-2">
                  <summary className="cursor-pointer list-none py-2 font-bold">
                    Exames ({selected.appointment_request_exams.length})
                  </summary>
                  <div className="space-y-2 pb-2">
                    {selected.appointment_request_exams.map((exam) => (
                      <div
                        key={exam.id}
                        className="rounded-xl bg-slate-50 p-3 text-sm"
                      >
                        <p className="font-bold">{exam.exam_name}</p>
                        {exam.status === "NOT_SCHEDULABLE" ? (
                          <div className="mt-2 rounded-lg bg-rose-100 p-2 text-rose-900">
                            <p className="font-bold">Não agendável</p>
                            <p className="mt-1 text-xs">
                              {exam.not_schedulable_detail ||
                                (exam.not_schedulable_reason
                                  ? notSchedulableReasonLabels[
                                      exam.not_schedulable_reason
                                    ]
                                  : "Motivo registrado.")}
                            </p>
                          </div>
                        ) : null}
                        {exam.scheduled_date ? (
                          <p className="mt-1 text-emerald-800">
                            {formatReceptionDate(exam.scheduled_date)} ·{" "}
                            {exam.scheduled_time?.slice(0, 5) ||
                              "horário pendente"}
                          </p>
                        ) : null}
                        <p className="text-muted mt-1">
                          {exam.modality || "Modalidade não informada"}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
                <details className="p-2">
                  <summary className="cursor-pointer list-none py-2 font-bold">
                    Convênio e atendimento
                  </summary>
                  <dl className="grid gap-2 pb-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">Tipo</dt>
                      <dd className="font-bold">
                        {serviceLabels[selected.service_type] ||
                          selected.service_type}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Convênio</dt>
                      <dd className="font-bold">
                        {selected.insurance_name || "Não se aplica"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Unidade</dt>
                      <dd className="font-bold">{selected.unit_name}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Referência</dt>
                      <dd className="font-bold">
                        {selected.insurer_reference || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Autorização</dt>
                      <dd className="font-bold">
                        {selected.authorization_number || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Validade</dt>
                      <dd className="font-bold">
                        {formatReceptionDate(
                          selected.authorization_valid_until,
                        )}
                      </dd>
                    </div>
                  </dl>
                </details>
                <details open className="p-2">
                  <summary className="cursor-pointer list-none py-2 font-bold">
                    Documentos · {selected.appointment_request_documents.length}{" "}
                    {selected.appointment_request_documents.length === 1
                      ? "arquivo"
                      : "arquivos"}
                  </summary>
                  <div className="space-y-2 pb-2">
                    {selected.appointment_request_documents.map((document) => (
                      <div
                        key={document.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold">
                            {documentLabels[document.document_type] ||
                              "Documento"}
                          </p>
                          <p className="text-muted truncate text-xs">
                            {document.file_name}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            href={`/api/admin/solicitacoes/${selected.id}/documentos/${document.id}/visualizar`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center rounded-full bg-white px-3 text-xs font-bold ring-1 ring-slate-200"
                            aria-label={`Visualizar ${document.file_name}`}
                          >
                            <Eye
                              className="mr-1"
                              size={14}
                              aria-hidden="true"
                            />
                            Visualizar
                          </a>
                          <a
                            href={`/api/admin/solicitacoes/${selected.id}/documentos/${document.id}/download`}
                            className="inline-flex size-9 items-center justify-center rounded-full bg-white ring-1 ring-slate-200"
                            aria-label={`Baixar documento ${document.file_name}`}
                            title="Baixar documento"
                          >
                            <Download size={15} aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    ))}
                    {!selected.appointment_request_documents.length ? (
                      <p className="text-muted text-sm">
                        Nenhum documento enviado.
                      </p>
                    ) : null}
                  </div>
                </details>
                <details className="p-2">
                  <summary className="cursor-pointer list-none py-2 font-bold">
                    Comunicações (
                    {selected.appointment_request_communications.length})
                  </summary>
                  <div className="space-y-2 pb-2">
                    {[...selected.appointment_request_communications]
                      .sort(
                        (a, b) =>
                          Date.parse(b.created_at) - Date.parse(a.created_at),
                      )
                      .map((message) => (
                        <div
                          key={message.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setViewMessage(message);
                              setModal("view-message");
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="block truncate font-bold">
                              {message.subject}
                            </span>
                            <span className="text-muted text-xs">
                              {message.status === "SENT"
                                ? "Enviado"
                                : message.status === "FAILED"
                                  ? "Falhou"
                                  : "Pendente"}{" "}
                              · {formatReceptionDate(message.created_at)}
                            </span>
                          </button>
                          {message.status === "FAILED" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                act("retry", { communicationId: message.id })
                              }
                              className="rounded-full bg-white px-3 py-2 text-xs font-bold ring-1 ring-slate-200"
                            >
                              <RefreshCw className="mr-1 inline" size={13} />{" "}
                              Reenviar
                            </button>
                          ) : null}
                        </div>
                      ))}
                    {!selected.appointment_request_communications.length ? (
                      <p className="text-muted text-sm">
                        Nenhuma comunicação enviada.
                      </p>
                    ) : null}
                  </div>
                </details>
                <details className="p-2">
                  <summary className="cursor-pointer list-none py-2 font-bold">
                    Histórico ({selected.appointment_request_history.length})
                  </summary>
                  <ol className="space-y-2 pb-2">
                    {[...selected.appointment_request_history]
                      .sort(
                        (a, b) =>
                          Date.parse(b.created_at) - Date.parse(a.created_at),
                      )
                      .map((entry) => (
                        <li
                          key={entry.id}
                          className="border-l-2 border-slate-200 pl-3 text-sm"
                        >
                          <p className="font-bold">{entry.action}</p>
                          <p className="text-muted text-xs">
                            {formatReceptionDate(entry.created_at)}
                            {typeof entry.details?.actor_name === "string" ? (
                              <> · {entry.details.actor_name}</>
                            ) : null}
                          </p>
                          {typeof entry.details?.message === "string" ? (
                            <p className="mt-1 text-xs">
                              {entry.details.message}
                            </p>
                          ) : null}
                          {entry.action === "NÃO FOI POSSÍVEL AGENDAR" ? (
                            <dl className="mt-2 space-y-1 rounded-lg bg-rose-50 p-2 text-xs text-rose-950">
                              <div>
                                <dt className="inline font-bold">Motivo: </dt>
                                <dd className="inline">
                                  {typeof entry.details.reason === "string" &&
                                  entry.details.reason in
                                    notSchedulableReasonLabels
                                    ? notSchedulableReasonLabels[
                                        entry.details
                                          .reason as NotSchedulableReason
                                      ]
                                    : "Motivo registrado"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline font-bold">
                                  Justificativa:{" "}
                                </dt>
                                <dd className="inline">
                                  {typeof entry.details.justification ===
                                  "string"
                                    ? entry.details.justification
                                    : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline font-bold">
                                  Registrado por:{" "}
                                </dt>
                                <dd className="inline">
                                  {typeof entry.details.actor_name === "string"
                                    ? entry.details.actor_name
                                    : "Atendente"}
                                </dd>
                              </div>
                            </dl>
                          ) : null}
                        </li>
                      ))}
                  </ol>
                </details>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-slate-600">
              Selecione um atendimento na fila.
            </div>
          )}
        </section>
      </div>

      {modal === "take_over" && selected ? (
        <ModalShell title="Assumir agendamento" onClose={() => setModal(null)}>
          <p className="mt-5 text-sm text-slate-700">
            Este agendamento está com{" "}
            <strong>
              {relationName(selected.assigned, "outro atendente")}
            </strong>
            . Confirma que deseja assumir o atendimento?
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => act("take_over")}
            className="bg-brand mt-6 min-h-12 w-full rounded-full px-5 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Assumindo..." : "Confirmar e assumir"}
          </button>
        </ModalShell>
      ) : null}

      {modal === "delete_request" && selected ? (
        <ModalShell
          title="Excluir agendamento da fila"
          onClose={() => setModal(null)}
        >
          <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
            A exclusão é lógica: o registro, o histórico e os documentos serão
            preservados, mas o agendamento sairá da central operacional.
          </p>
          <label className="mt-5 block text-sm font-bold">
            Justificativa interna
            <textarea
              value={deletionJustification}
              onChange={(event) => setDeletionJustification(event.target.value)}
              minLength={20}
              maxLength={500}
              rows={4}
              className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
            />
            <span className="text-muted mt-1 block text-xs font-normal">
              {deletionJustification.trim().length}/500 caracteres (mínimo 20)
            </span>
          </label>
          <button
            type="button"
            disabled={saving || deletionJustification.trim().length < 20}
            onClick={() =>
              act("delete_request", {
                justification: deletionJustification,
              })
            }
            className="mt-6 min-h-12 w-full rounded-full bg-rose-800 px-5 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Excluindo..." : "Confirmar exclusão lógica"}
          </button>
        </ModalShell>
      ) : null}

      {modal === "not_schedulable" && selected ? (
        <ModalShell
          title="Não é possível agendar"
          onClose={() => setModal(null)}
        >
          <div className="mt-5 space-y-5">
            <fieldset>
              <legend className="text-sm font-bold">Aplicar a</legend>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="closure-scope"
                  checked={closureScope === "all"}
                  onChange={() => {
                    setClosureScope("all");
                    setSelectedClosureExams(
                      selected.appointment_request_exams
                        .filter((exam) => exam.status !== "NOT_SCHEDULABLE")
                        .map((exam) => exam.id),
                    );
                  }}
                />
                Toda a solicitação
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="closure-scope"
                  checked={closureScope === "selected"}
                  onChange={() => {
                    setClosureScope("selected");
                    setSelectedClosureExams([]);
                  }}
                />
                Somente exames selecionados
              </label>
              {closureScope === "selected" ? (
                <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3">
                  {selected.appointment_request_exams
                    .filter((exam) => exam.status !== "NOT_SCHEDULABLE")
                    .map((exam) => (
                      <label
                        key={exam.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClosureExams.includes(exam.id)}
                          onChange={(event) =>
                            setSelectedClosureExams((current) =>
                              event.target.checked
                                ? [...current, exam.id]
                                : current.filter((id) => id !== exam.id),
                            )
                          }
                        />
                        {exam.exam_name}
                      </label>
                    ))}
                </div>
              ) : null}
            </fieldset>
            <label className="block text-sm font-bold">
              Motivo
              <select
                value={notSchedulableReason}
                onChange={(event) => {
                  const value = event.target.value as NotSchedulableReason;
                  setNotSchedulableReason(value);
                  setNotSchedulableOrientation(notSchedulableGuidance[value]);
                }}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              >
                {notSchedulableReasons.map((item) => (
                  <option key={item} value={item}>
                    {notSchedulableReasonLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              Justificativa interna
              <textarea
                value={notSchedulableDetail}
                onChange={(event) =>
                  setNotSchedulableDetail(event.target.value)
                }
                rows={3}
                minLength={20}
                maxLength={800}
                className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
              />
              <span className="text-muted mt-1 block text-xs font-normal">
                Explique a decisão em pelo menos 20 caracteres. Esta informação
                fica no histórico interno e é separada da orientação enviada ao
                paciente.
              </span>
            </label>
            <label className="block text-sm font-bold">
              Orientação ao paciente
              <textarea
                value={notSchedulableOrientation}
                onChange={(event) =>
                  setNotSchedulableOrientation(event.target.value)
                }
                rows={4}
                maxLength={1600}
                className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <button
              type="button"
              disabled={
                saving ||
                !emailIsValid ||
                selectedClosureExams.length === 0 ||
                !notSchedulableOrientation.trim() ||
                notSchedulableDetail.trim().length < 20
              }
              onClick={() =>
                act("not_schedulable", {
                  reason: notSchedulableReason,
                  detail: notSchedulableDetail,
                  guidance: notSchedulableOrientation,
                  examIds: selectedClosureExams,
                })
              }
              className="min-h-12 w-full rounded-full bg-rose-800 px-5 font-bold text-white disabled:opacity-50"
            >
              {saving ? "Registrando..." : "Registrar e avisar paciente"}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {modal === "wait" && selected ? (
        <ModalShell title="Enviar ao convênio" onClose={() => setModal(null)}>
          <label className="mt-5 block text-sm font-bold">
            Referência ou protocolo do convênio (opcional)
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <button
            disabled={saving}
            onClick={() => act("wait_insurance", { reference })}
            className="bg-brand mt-6 min-h-12 w-full rounded-full font-bold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar envio ao convênio"}
          </button>
        </ModalShell>
      ) : null}
      {(modal === "pending" || modal === "rejected") && selected ? (
        <ModalShell
          title={
            modal === "rejected"
              ? "Recusado pelo convênio"
              : "Registrar pendência"
          }
          onClose={() => setModal(null)}
        >
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-bold">
              Motivo
              <select
                value={reason}
                onChange={(event) => chooseReason(event.target.value)}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              >
                {quickPendingReasons.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              O que precisa ser corrigido
              <textarea
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
                rows={3}
                className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold">
              Orientação ao paciente
              <textarea
                value={guidance}
                onChange={(event) => setGuidance(event.target.value)}
                rows={4}
                className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <button
              disabled={saving || !emailIsValid}
              onClick={() =>
                act(modal === "rejected" ? "rejected" : "pending", {
                  reason,
                  correction,
                  guidance,
                })
              }
              className="bg-brand min-h-12 w-full rounded-full font-bold text-white disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Registrar e avisar paciente"}
            </button>
          </div>
        </ModalShell>
      ) : null}
      {modal === "authorize" && selected ? (
        <ModalShell
          title="Confirmar autorização"
          onClose={() => setModal(null)}
        >
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Número da autorização
              <input
                value={
                  authorizationNumber || selected.authorization_number || ""
                }
                onChange={(event) => setAuthorizationNumber(event.target.value)}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Validade
              <input
                type="date"
                value={validUntil || selected.authorization_valid_until || ""}
                onChange={(event) => setValidUntil(event.target.value)}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
          </div>
          <button
            disabled={saving}
            onClick={() =>
              act("authorize", {
                authorizationNumber:
                  authorizationNumber || selected.authorization_number || "",
                validUntil:
                  validUntil || selected.authorization_valid_until || "",
              })
            }
            className="mt-6 min-h-12 w-full rounded-full bg-emerald-700 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar autorização"}
          </button>
        </ModalShell>
      ) : null}
      {modal === "complete" && selected ? (
        <ModalShell
          title="Confirmar agendamento"
          onClose={() => setModal(null)}
        >
          <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
            <strong>{selected.patient_name}</strong>
            <br />
            {selected.email} · {selected.unit_name}
          </div>
          {schedules.length > 1 ? (
            <label className="mt-5 block text-sm font-bold">
              Usar a mesma data em todos os exames
              <input
                type="date"
                value={sharedDate}
                onChange={(event) => {
                  setSharedDate(event.target.value);
                  setSchedules((rows) =>
                    rows.map((row) => ({ ...row, date: event.target.value })),
                  );
                }}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
          ) : null}
          <div className="mt-5 space-y-4">
            {schedules.map((schedule, index) => (
              <fieldset
                key={schedule.examId}
                className="border-border-light rounded-2xl border p-4"
              >
                <legend className="px-2 font-bold">
                  {schedules.length > 1 ? `Exame ${index + 1} — ` : ""}
                  {schedule.name}
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    Data
                    <input
                      type="date"
                      value={schedule.date}
                      onChange={(event) =>
                        setSchedules((rows) =>
                          rows.map((row) =>
                            row.examId === schedule.examId
                              ? { ...row, date: event.target.value }
                              : row,
                          ),
                        )
                      }
                      className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                    />
                  </label>
                  <label className="text-sm font-bold">
                    Horário
                    <input
                      type="time"
                      value={schedule.time}
                      onChange={(event) =>
                        setSchedules((rows) =>
                          rows.map((row) =>
                            row.examId === schedule.examId
                              ? { ...row, time: event.target.value }
                              : row,
                          ),
                        )
                      }
                      className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-bold">
                  Preparo automático — revise se necessário
                  <textarea
                    value={schedule.preparation}
                    onChange={(event) =>
                      setSchedules((rows) =>
                        rows.map((row) =>
                          row.examId === schedule.examId
                            ? { ...row, preparation: event.target.value }
                            : row,
                        ),
                      )
                    }
                    rows={3}
                    className="border-border-light mt-1 w-full rounded-xl border p-3 font-normal"
                  />
                </label>
                <label className="mt-3 block text-sm font-bold">
                  Documentos automáticos — um por linha
                  <textarea
                    value={schedule.documents}
                    onChange={(event) =>
                      setSchedules((rows) =>
                        rows.map((row) =>
                          row.examId === schedule.examId
                            ? { ...row, documents: event.target.value }
                            : row,
                        ),
                      )
                    }
                    rows={3}
                    className="border-border-light mt-1 w-full rounded-xl border p-3 font-normal"
                  />
                </label>
              </fieldset>
            ))}
          </div>
          <div className="bg-surface mt-5 rounded-2xl p-4 text-sm">
            <p className="font-bold">Prévia da confirmação</p>
            <p className="mt-1">
              Para: {selected.email} · Unidade: {selected.unit_name}
            </p>
            {schedules.map((item) => (
              <div key={item.examId} className="mt-3">
                <strong>{item.name}</strong> ·{" "}
                {item.date ? formatReceptionDate(item.date) : "data pendente"} ·{" "}
                {item.time || "horário pendente"}
                <p className="text-muted mt-1 whitespace-pre-line">
                  Preparo:{" "}
                  {item.preparation || "Sem preparo específico cadastrado."}
                  <br />
                  Documentos: {item.documents || "Nenhum documento adicional."}
                </p>
              </div>
            ))}
          </div>
          <button
            disabled={
              saving || schedules.some((item) => !item.date || !item.time)
            }
            onClick={() =>
              act("complete", {
                schedules: schedules.map((item) => ({
                  examId: item.examId,
                  date: item.date,
                  time: item.time,
                  preparation: item.preparation,
                  documents: item.documents
                    .split("\n")
                    .map((value) => value.trim())
                    .filter(Boolean),
                })),
              })
            }
            className="bg-brand mt-6 min-h-12 w-full rounded-full font-bold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar agendamento e avisar paciente"}
          </button>
        </ModalShell>
      ) : null}
      {modal === "message" && selected ? (
        <ModalShell title="Enviar e-mail" onClose={() => setModal(null)}>
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
            <strong>PARA</strong>
            <br />
            {selected.email}
          </p>
          <label className="mt-4 block text-sm font-bold">
            Modelo
            <select
              value={messageType}
              onChange={(event) => {
                const value = event.target.value;
                setMessageType(value);
                const titles: Record<string, string> = {
                  GUIDANCE: "Orientação sobre seu pré-agendamento — INNEURO",
                  PENDING: "Pendência no pré-agendamento — INNEURO",
                  INSURANCE_REJECTED: "Retorno do convênio — INNEURO",
                  AUTHORIZED: "Autorização do pré-agendamento — INNEURO",
                  DOCUMENT_RECEIVED: "Documentação recebida — INNEURO",
                  SCHEDULE_CONFIRMED: "Agendamento — INNEURO",
                  CUSTOM: "Mensagem da INNEURO",
                };
                setMessageSubject(titles[value]);
                setMessageBody(
                  `Olá, ${selected.patient_name}.\n\nPROTOCOLO\n${selected.protocol}\n\n`,
                );
              }}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
            >
              <option value="GUIDANCE">Orientação</option>
              <option value="PENDING">Pendência</option>
              <option value="INSURANCE_REJECTED">Convênio</option>
              <option value="DOCUMENT_RECEIVED">Documentação</option>
              <option value="SCHEDULE_CONFIRMED">Agendamento</option>
              <option value="CUSTOM">Mensagem personalizada</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-bold">
            Assunto
            <input
              value={messageSubject}
              onChange={(event) => setMessageSubject(event.target.value)}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="mt-4 block text-sm font-bold">
            Mensagem
            <textarea
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              rows={8}
              className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
            />
          </label>
          <button
            disabled={saving || !messageSubject.trim() || !messageBody.trim()}
            onClick={() =>
              act("manual", {
                subject: messageSubject,
                message: messageBody,
                type: messageType,
              })
            }
            className="bg-brand mt-5 min-h-12 w-full rounded-full font-bold text-white disabled:opacity-50"
          >
            <Send className="mr-2 inline" size={17} />
            {saving ? "Enviando..." : "Enviar e-mail"}
          </button>
        </ModalShell>
      ) : null}
      {modal === "view-message" && viewMessage ? (
        <ModalShell title={viewMessage.subject} onClose={() => setModal(null)}>
          <pre className="bg-surface mt-5 rounded-2xl p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
            {viewMessage.text_body}
          </pre>
        </ModalShell>
      ) : null}
    </div>
  );
}
