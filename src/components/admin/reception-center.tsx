"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileDown,
  Mail,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  X,
} from "lucide-react";
import {
  formatWaitingTime,
  isLongWaiting,
  pendingSuggestions,
  quickPendingReasons,
  workflowLabels,
  type WorkflowStatus,
} from "@/lib/scheduling/operations";

type ExamRow = {
  id: string;
  exam_name: string;
  exam_id: string | null;
  modality: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  preparation_text: string | null;
  documents_to_bring: string[];
  automatic_preparation: string;
  automatic_documents: string[];
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
  subject: string;
  text_body: string;
  status: string;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
};

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
  assigned_to: string | null;
  claimed_at: string | null;
  assigned:
    { full_name: string | null } | Array<{ full_name: string | null }> | null;
  insurer_reference: string | null;
  authorization_number: string | null;
  authorization_valid_until: string | null;
  pending_reason: string | null;
  pending_correction: string | null;
  pending_guidance: string | null;
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
  photo_id: "Ver documento",
  medical_request: "Ver pedido médico",
  sus_authorization: "Ver autorização",
  sus_card: "Ver cartão SUS",
  insurance_card_front: "Ver carteirinha",
  insurance_card_back: "Ver verso da carteirinha",
  insurance_authorization: "Ver autorização",
  other: "Ver documento complementar",
};

function assignedName(request: ReceptionRequest) {
  return (
    (Array.isArray(request.assigned)
      ? request.assigned[0]?.full_name
      : request.assigned?.full_name) || "Não atribuído"
  );
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
  currentUser: { id: string; name: string };
}) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(requests[0]?.id ?? "");
  const [modal, setModal] = useState<Modal>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
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

  const selected =
    requests.find((item) => item.id === selectedId) ?? requests[0] ?? null;
  const filtered = useMemo(() => {
    const normalized = query.toLocaleLowerCase("pt-BR").replace(/\s/g, "");
    return requests.filter((item) => {
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
      if (!normalized) return true;
      return `${item.patient_name}${item.cpf ?? ""}${item.phone}${item.protocol}`
        .toLocaleLowerCase("pt-BR")
        .replace(/\s/g, "")
        .includes(normalized);
    });
  }, [requests, query, filter, currentUser.id]);

  const counts = {
    NOVOS: requests.filter((r) => r.workflow_status === "NOVO").length,
    "EM ANÁLISE": requests.filter((r) => r.workflow_status === "EM_ANALISE")
      .length,
    CONVÊNIO: requests.filter(
      (r) => r.workflow_status === "AGUARDANDO_CONVENIO",
    ).length,
    PENDÊNCIAS: requests.filter((r) =>
      ["PENDENCIA", "RECUSADO"].includes(r.workflow_status),
    ).length,
    AUTORIZADOS: requests.filter((r) => r.workflow_status === "AUTORIZADO")
      .length,
    CONCLUÍDOS: requests.filter((r) => r.workflow_status === "CONCLUIDO")
      .length,
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (
        event.key.toLowerCase() === "n" &&
        !modal &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (event.target as HTMLElement).tagName,
        )
      )
        nextRequest();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function nextRequest() {
    if (!filtered.length) return;
    const index = filtered.findIndex((item) => item.id === selected?.id);
    setSelectedId(filtered[(index + 1) % filtered.length].id);
  }

  function openPending(kind: "pending" | "rejected") {
    const suggested = pendingSuggestions[quickPendingReasons[0]];
    setReason(quickPendingReasons[0]);
    setCorrection(suggested.correction);
    setGuidance(suggested.guidance);
    setModal(kind);
  }

  function openComplete() {
    if (!selected) return;
    setSharedDate("");
    setSchedules(
      selected.appointment_request_exams.map((exam) => ({
        examId: exam.id,
        name: exam.exam_name,
        date: exam.scheduled_date ?? "",
        time: exam.scheduled_time?.slice(0, 5) ?? "",
        preparation: exam.preparation_text ?? exam.automatic_preparation,
        documents: (exam.documents_to_bring?.length
          ? exam.documents_to_bring
          : exam.automatic_documents
        ).join("\n"),
      })),
    );
    setModal("complete");
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!selected || saving) return false;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/solicitacoes/acoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selected.id,
          operationId: crypto.randomUUID(),
          action,
          ...extra,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Não foi possível concluir.");
      setNotice(result.message || "Ação concluída.");
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

  async function updateEmail(form: FormData) {
    await act("update_contact", { email: String(form.get("email") ?? "") });
  }

  function chooseReason(value: string) {
    setReason(value);
    const suggested = pendingSuggestions[value];
    if (suggested) {
      setCorrection(suggested.correction);
      setGuidance(suggested.guidance);
    }
  }

  const statusColor = (status: string) =>
    status === "AUTORIZADO"
      ? "bg-emerald-100 text-emerald-800"
      : status === "PENDENCIA" || status === "RECUSADO"
        ? "bg-amber-100 text-amber-900"
        : status === "NOVO"
          ? "bg-sky-100 text-sky-800"
          : "bg-slate-100 text-slate-700";

  return (
    <div>
      {notice ? (
        <p
          role="status"
          className="bg-mint text-brand mb-5 flex items-center gap-2 rounded-xl p-4 font-bold"
        >
          <CheckCircle2 aria-hidden="true" size={18} />
          {notice}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-5 flex items-center gap-2 rounded-xl p-4 font-bold"
        >
          <AlertTriangle aria-hidden="true" size={18} />
          {error}
        </p>
      ) : null}
      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Object.entries(counts).map(([label, count]) => (
          <article
            key={label}
            className="border-border-light rounded-2xl border bg-white p-4"
          >
            <p className="text-muted text-[.68rem] font-bold tracking-wide">
              {label}
            </p>
            <p className="font-heading text-brand mt-1 text-3xl font-semibold">
              {count}
            </p>
          </article>
        ))}
      </section>
      <section className="border-border-light mb-5 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-3">
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, CPF, telefone ou protocolo  /"
            className="border-border-light min-h-12 w-full rounded-xl border pr-3 pl-10"
          />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filtros rápidos">
          {[
            ["all", "Todos"],
            ["mine", "Meus atendimentos"],
            ["new", "Novos"],
            ["pending", "Pendências"],
            ["authorized", "Autorizados"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-10 rounded-full px-4 text-sm font-bold ${filter === key ? "bg-brand text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(21rem,.8fr)_minmax(34rem,1.2fr)]">
        <section aria-label="Fila de pré-agendamentos" className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-muted text-sm">
              {filtered.length} atendimento(s) · mais antigos primeiro
            </p>
            <button
              type="button"
              onClick={nextRequest}
              className="text-brand text-sm font-bold"
            >
              Próximo atendimento <ChevronRight className="inline" size={16} />
            </button>
          </div>
          <ol className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
            {filtered.map((item) => {
              const long = isLongWaiting(item.created_at),
                received = Boolean(item.documents_received_at);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`border-border-light w-full rounded-2xl border bg-white p-4 text-left transition ${selected?.id === item.id ? "ring-brand ring-2" : "hover:border-brand/40"} ${received ? "border-emerald-400 bg-emerald-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <strong className="text-ink line-clamp-1">
                        {item.patient_name}
                      </strong>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[.65rem] font-bold ${statusColor(item.workflow_status)}`}
                      >
                        {received
                          ? "DOCUMENTO RECEBIDO"
                          : workflowLabels[item.workflow_status]}
                      </span>
                    </div>
                    <p className="text-brand mt-2 line-clamp-1 text-sm font-semibold">
                      {item.appointment_request_exams
                        .map((exam) => exam.exam_name)
                        .join(" · ")}
                    </p>
                    <p className="text-muted mt-1 line-clamp-1 text-xs">
                      {item.insurance_name || serviceLabels[item.service_type]}{" "}
                      · {assignedName(item)}
                    </p>
                    <p
                      className={`mt-2 flex items-center gap-1 text-xs font-bold ${long ? "text-warning" : "text-muted"}`}
                    >
                      <Clock3 size={14} aria-hidden="true" />
                      {formatWaitingTime(item.created_at)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="xl:sticky xl:top-24">
          {selected ? (
            <article className="border-border-light max-h-[78vh] overflow-y-auto rounded-3xl border bg-white">
              <header className="border-border-light sticky top-0 z-10 border-b bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-brand text-xs font-bold uppercase">
                      {selected.protocol}
                    </p>
                    <h2 className="font-heading mt-1 text-2xl font-semibold">
                      {selected.patient_name}
                    </h2>
                    <p className="text-muted mt-1 text-sm">
                      {selected.phone} ·{" "}
                      {selected.email || "E-mail não informado"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor(selected.workflow_status)}`}
                  >
                    {workflowLabels[selected.workflow_status]}
                  </span>
                </div>
                <p className="text-muted mt-3 text-sm">
                  <UserCheck
                    className="mr-1 inline"
                    size={16}
                    aria-hidden="true"
                  />
                  Atendente:{" "}
                  <strong className="text-ink">{assignedName(selected)}</strong>
                </p>
              </header>
              <div className="space-y-6 p-5 sm:p-6">
                {!selected.email ? (
                  <form
                    action={updateEmail}
                    className="rounded-2xl bg-amber-50 p-4"
                  >
                    <p className="text-sm font-bold">
                      Informe o e-mail para enviar orientações
                    </p>
                    <div className="mt-2 flex gap-2">
                      <input
                        name="email"
                        type="email"
                        required
                        placeholder="paciente@exemplo.com"
                        className="border-border-light min-h-11 min-w-0 flex-1 rounded-xl border bg-white px-3"
                      />
                      <button
                        disabled={saving}
                        className="bg-brand rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
                      >
                        Salvar
                      </button>
                    </div>
                  </form>
                ) : null}
                <section>
                  <h3 className="text-brand text-xs font-bold uppercase">
                    Exames
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {selected.appointment_request_exams.map((exam) => (
                      <li
                        key={exam.id}
                        className="bg-surface rounded-xl p-3 text-sm"
                      >
                        <strong>{exam.exam_name}</strong>
                        {exam.scheduled_date ? (
                          <p className="text-muted mt-1">
                            {new Date(
                              `${exam.scheduled_date}T12:00:00`,
                            ).toLocaleDateString("pt-BR")}{" "}
                            · {exam.scheduled_time?.slice(0, 5)}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
                <section className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h3 className="text-brand text-xs font-bold uppercase">
                      Convênio
                    </h3>
                    <p className="mt-2 text-sm">
                      {selected.insurance_name ||
                        serviceLabels[selected.service_type]}
                    </p>
                    {selected.insurance_card_number ? (
                      <p className="text-muted mt-1 text-xs">
                        Carteirinha: ••••
                        {selected.insurance_card_number.slice(-4)}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <h3 className="text-brand text-xs font-bold uppercase">
                      Documentos
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.appointment_request_documents.map((doc) => (
                        <a
                          key={doc.id}
                          href={`/api/admin/solicitacoes/documentos/${doc.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`border-brand text-brand inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-bold ${doc.source === "PATIENT_CORRECTION" ? "bg-emerald-50" : ""}`}
                        >
                          <FileDown size={15} aria-hidden="true" />
                          {documentLabels[doc.document_type] || "Ver documento"}
                        </a>
                      ))}
                    </div>
                  </div>
                </section>
                <section className="border-border-light sticky bottom-0 z-10 rounded-2xl border bg-white p-3 shadow-lg">
                  <div className="flex flex-wrap gap-2">
                    {selected.workflow_status === "NOVO" ? (
                      <button
                        disabled={saving}
                        onClick={() => act("claim")}
                        className="bg-brand min-h-12 flex-1 rounded-full px-5 font-bold text-white disabled:opacity-50"
                      >
                        {saving ? "Salvando..." : "Assumir atendimento"}
                      </button>
                    ) : null}
                    {selected.workflow_status === "EM_ANALISE" ? (
                      <>
                        <button
                          onClick={() => setModal("wait")}
                          className="bg-brand min-h-11 rounded-full px-4 text-sm font-bold text-white"
                        >
                          Aguardar convênio
                        </button>
                        <button
                          onClick={() => openPending("pending")}
                          className="min-h-11 rounded-full bg-amber-500 px-4 text-sm font-bold text-white"
                        >
                          Pendência
                        </button>
                        <button
                          onClick={() => setModal("authorize")}
                          className="min-h-11 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white"
                        >
                          Autorizado
                        </button>
                      </>
                    ) : null}
                    {selected.workflow_status === "AGUARDANDO_CONVENIO" ? (
                      <>
                        <button
                          onClick={() => openPending("pending")}
                          className="min-h-11 rounded-full bg-amber-500 px-4 text-sm font-bold text-white"
                        >
                          Pendência
                        </button>
                        <button
                          onClick={() => openPending("rejected")}
                          className="bg-error min-h-11 rounded-full px-4 text-sm font-bold text-white"
                        >
                          Recusado
                        </button>
                        <button
                          onClick={() => setModal("authorize")}
                          className="min-h-11 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white"
                        >
                          Autorizado
                        </button>
                      </>
                    ) : null}
                    {["PENDENCIA", "RECUSADO"].includes(
                      selected.workflow_status,
                    ) ? (
                      <>
                        <button
                          onClick={() => openPending("pending")}
                          className="min-h-11 rounded-full bg-amber-500 px-4 text-sm font-bold text-white"
                        >
                          Atualizar pendência
                        </button>
                        <button
                          onClick={() => setModal("authorize")}
                          className="min-h-11 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white"
                        >
                          Autorizado
                        </button>
                      </>
                    ) : null}
                    {selected.workflow_status === "AUTORIZADO" ? (
                      <button
                        onClick={openComplete}
                        className="bg-brand min-h-12 flex-1 rounded-full px-5 font-bold text-white"
                      >
                        Concluir agendamento
                      </button>
                    ) : null}
                    <button
                      onClick={() => {
                        setMessageSubject(
                          "Orientação sobre seu pré-agendamento — INNEURO",
                        );
                        setMessageType("GUIDANCE");
                        setMessageBody(
                          `Olá, ${selected.patient_name}.\n\nPROTOCOLO\n${selected.protocol}\n\n`,
                        );
                        setModal("message");
                      }}
                      className="border-brand text-brand min-h-11 rounded-full border px-4 text-sm font-bold"
                    >
                      <Mail className="mr-1 inline" size={16} />
                      Enviar mensagem
                    </button>
                    {selected.workflow_status === "CONCLUIDO" ? (
                      <button
                        onClick={nextRequest}
                        className="bg-brand min-h-11 rounded-full px-5 text-sm font-bold text-white"
                      >
                        Próximo atendimento
                      </button>
                    ) : null}
                  </div>
                </section>
                <section>
                  <h3 className="font-heading text-lg font-semibold">
                    Comunicações
                  </h3>
                  <ul className="mt-3 space-y-2">
                    {[...selected.appointment_request_communications]
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .map((message) => (
                        <li
                          key={message.id}
                          className="bg-surface flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <strong className="block truncate">
                              {message.subject}
                            </strong>
                            <span className="text-muted text-xs">
                              {new Date(message.created_at).toLocaleString(
                                "pt-BR",
                              )}{" "}
                              ·{" "}
                              {message.status === "SENT"
                                ? "Enviado"
                                : message.status === "FAILED"
                                  ? "Falhou"
                                  : "Processando"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setViewMessage(message);
                              setModal("view-message");
                            }}
                            className="text-brand text-xs font-bold"
                          >
                            Ver mensagem
                          </button>
                          {message.status === "FAILED" ? (
                            <button
                              disabled={saving}
                              onClick={() =>
                                act("retry", { communicationId: message.id })
                              }
                              className="text-error text-xs font-bold"
                            >
                              <RefreshCw className="mr-1 inline" size={14} />
                              Reenviar
                            </button>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </section>
                <section>
                  <h3 className="font-heading text-lg font-semibold">
                    Histórico
                  </h3>
                  <ol className="border-brand/20 mt-3 space-y-4 border-l pl-4">
                    {[...selected.appointment_request_history]
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .map((item) => (
                        <li
                          key={item.id}
                          className="before:bg-brand relative text-sm before:absolute before:top-1.5 before:-left-[1.3rem] before:size-2 before:rounded-full"
                        >
                          <strong>{item.action}</strong>
                          <time className="text-muted mt-1 block text-xs">
                            {new Date(item.created_at).toLocaleString("pt-BR")}
                          </time>
                        </li>
                      ))}
                  </ol>
                </section>
              </div>
            </article>
          ) : (
            <div className="border-border-light text-muted rounded-3xl border bg-white p-8 text-center">
              Nenhuma solicitação na fila.
            </div>
          )}
        </section>
      </div>

      {modal === "wait" && selected ? (
        <ModalShell title="Enviado ao convênio" onClose={() => setModal(null)}>
          <label className="mt-5 block text-sm font-bold">
            Número da solicitação ou autorização (opcional)
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
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
                onChange={(e) => chooseReason(e.target.value)}
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
                onChange={(e) => setCorrection(e.target.value)}
                rows={3}
                className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <label className="block text-sm font-bold">
              Orientação ao paciente
              <textarea
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                rows={4}
                className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
              />
            </label>
            <p className="bg-surface rounded-xl p-3 text-xs">
              O sistema salvará a pendência, registrará o histórico e enviará o
              link seguro de correção em uma única ação.
            </p>
            <button
              disabled={saving}
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
                onChange={(e) => setAuthorizationNumber(e.target.value)}
                className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Validade
              <input
                type="date"
                value={validUntil || selected.authorization_valid_until || ""}
                onChange={(e) => setValidUntil(e.target.value)}
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
            className="mt-6 min-h-12 w-full rounded-full bg-emerald-600 font-bold text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar autorização"}
          </button>
        </ModalShell>
      ) : null}
      {modal === "complete" && selected ? (
        <ModalShell title="Concluir agendamento" onClose={() => setModal(null)}>
          <p className="text-muted mt-2 text-sm">
            {selected.patient_name} ·{" "}
            {selected.insurance_name || serviceLabels[selected.service_type]} ·{" "}
            {selected.unit_name}
          </p>
          <label className="mt-5 block text-sm font-bold">
            Usar a mesma data em todos os exames
            <input
              type="date"
              value={sharedDate}
              onChange={(e) => {
                setSharedDate(e.target.value);
                setSchedules((rows) =>
                  rows.map((row) => ({ ...row, date: e.target.value })),
                );
              }}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <div className="mt-5 space-y-5">
            {schedules.map((schedule, index) => (
              <fieldset
                key={schedule.examId}
                className="border-border-light rounded-2xl border p-4"
              >
                <legend className="px-2 font-bold">
                  Exame {index + 1} — {schedule.name}
                </legend>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-bold">
                    Data
                    <input
                      type="date"
                      value={schedule.date}
                      onChange={(e) =>
                        setSchedules((rows) =>
                          rows.map((row) =>
                            row.examId === schedule.examId
                              ? { ...row, date: e.target.value }
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
                      onChange={(e) =>
                        setSchedules((rows) =>
                          rows.map((row) =>
                            row.examId === schedule.examId
                              ? { ...row, time: e.target.value }
                              : row,
                          ),
                        )
                      }
                      className="border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
                    />
                  </label>
                </div>
                <label className="mt-3 block text-sm font-bold">
                  Preparo oficial — revise se necessário
                  <textarea
                    value={schedule.preparation}
                    onChange={(e) =>
                      setSchedules((rows) =>
                        rows.map((row) =>
                          row.examId === schedule.examId
                            ? { ...row, preparation: e.target.value }
                            : row,
                        ),
                      )
                    }
                    rows={4}
                    className="border-border-light mt-1 w-full rounded-xl border p-3 font-normal"
                  />
                </label>
                <label className="mt-3 block text-sm font-bold">
                  Documentos a levar — um por linha
                  <textarea
                    value={schedule.documents}
                    onChange={(e) =>
                      setSchedules((rows) =>
                        rows.map((row) =>
                          row.examId === schedule.examId
                            ? { ...row, documents: e.target.value }
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
            <strong>O paciente receberá:</strong>
            {schedules.map((item) => (
              <p key={item.examId} className="mt-2">
                {item.name} ·{" "}
                {item.date
                  ? new Date(`${item.date}T12:00:00`).toLocaleDateString(
                      "pt-BR",
                    )
                  : "data pendente"}{" "}
                · {item.time || "horário pendente"} · preparo e documentos
                acima.
              </p>
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
            {saving ? "Salvando..." : "Confirmar agendamento e enviar"}
          </button>
        </ModalShell>
      ) : null}
      {modal === "message" && selected ? (
        <ModalShell title="Enviar mensagem" onClose={() => setModal(null)}>
          <label className="mt-5 block text-sm font-bold">
            Modelo
            <select
              value={messageType}
              onChange={(e) => {
                const value = e.target.value;
                setMessageType(value);
                const title =
                  value === "DOCUMENT_RECEIVED"
                    ? "Documentação recebida — INNEURO"
                    : value === "AUTHORIZED"
                      ? "Autorização do pré-agendamento — INNEURO"
                      : value === "SCHEDULE_CONFIRMED"
                        ? "Agendamento — INNEURO"
                        : "Orientação sobre seu pré-agendamento — INNEURO";
                setMessageSubject(title);
                setMessageBody(
                  `Olá, ${selected.patient_name}.\n\nPROTOCOLO\n${selected.protocol}\n\n`,
                );
              }}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
            >
              <option value="GUIDANCE">Orientação</option>
              <option value="DOCUMENT_RECEIVED">Documentação recebida</option>
              <option value="AUTHORIZED">Autorização</option>
              <option value="SCHEDULE_CONFIRMED">Agendamento</option>
              <option value="CUSTOM">Mensagem personalizada</option>
            </select>
          </label>
          <label className="mt-4 block text-sm font-bold">
            Assunto
            <input
              value={messageSubject}
              onChange={(e) => setMessageSubject(e.target.value)}
              className="border-border-light mt-2 min-h-12 w-full rounded-xl border px-3 font-normal"
            />
          </label>
          <label className="mt-4 block text-sm font-bold">
            Mensagem
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              rows={9}
              className="border-border-light mt-2 w-full rounded-xl border p-3 font-normal"
            />
          </label>
          <button
            disabled={saving}
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
            {saving ? "Enviando..." : "Enviar"}
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
