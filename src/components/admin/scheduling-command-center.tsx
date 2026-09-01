"use client";

import { FormEvent, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  ListFilter,
  LoaderCircle,
  PhoneCall,
  Search,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  ReceptionCenter,
  type ReceptionRequest,
} from "@/components/admin/reception-center";
import {
  contactResultLabels,
  contactResults,
  contactTypeLabels,
  contactTypes,
  formatReceptionDate,
  formatWaitingTime,
  getOperationalStatus,
  isActiveRequest,
  isPendingFollowUp,
  operationalOutcomeReasonLabels,
  operationalOutcomeReasons,
  operationalStatusLabels,
  waitingTimeTone,
  type ContactResult,
  type ContactType,
  type OperationalOutcomeReason,
  type OperationalStatus,
} from "@/lib/scheduling/operations";
import {
  calculateSchedulingConversionRate,
  formatOperationalDuration,
} from "@/lib/scheduling/analytics";

export type SchedulingMetrics = {
  total: number;
  waiting: number;
  inService: number;
  pendingFollowUps: number;
  scheduledToday: number;
  scheduled: number;
  unscheduled: number;
  averageFirstContactMinutes: number | null;
  averageCompletionMinutes: number | null;
  reasons: Array<{ reason: string; total: number }>;
  responsibles: Array<{
    id: string | null;
    name: string;
    total: number;
    scheduled: number;
    unscheduled: number;
  }>;
};

export type SchedulingQueryState = {
  query: string;
  status: string;
  scope: string;
  sort: string;
  from: string;
  to: string;
  insurance: string;
  modality: string;
  responsible: string;
  unit: string;
  reason: string;
};

export type SchedulingFilterOptions = {
  insurances: string[];
  modalities: string[];
  units: string[];
  responsibles: Array<{ id: string; name: string }>;
};

type ScheduleRow = {
  examId: string;
  name: string;
  date: string;
  time: string;
  preparation: string;
  documents: string[];
};

type CurrentUser = {
  id: string;
  name: string;
  canManageScheduling: boolean;
  canOverrideAssignment: boolean;
};

function relationName(request: ReceptionRequest) {
  const relation = request.assigned;
  return (
    (Array.isArray(relation) ? relation[0]?.full_name : relation?.full_name) ||
    "Não atribuído"
  );
}

function operationalBadge(status: OperationalStatus) {
  return {
    AGUARDANDO: "bg-amber-100 text-amber-900 ring-amber-200",
    EM_ATENDIMENTO: "bg-sky-100 text-sky-800 ring-sky-200",
    AGENDADO: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    NAO_AGENDADO: "bg-rose-100 text-rose-800 ring-rose-200",
  }[status];
}

function waitingToneClass(request: ReceptionRequest) {
  if (!isActiveRequest(request.workflow_status, request.confirmation_status))
    return "text-slate-500";
  return {
    normal: "text-slate-600",
    attention: "bg-amber-50 text-amber-800",
    warning: "bg-orange-50 text-orange-800",
    critical: "bg-rose-50 text-rose-800",
  }[waitingTimeTone(request.created_at)];
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scheduling-modal-title"
    >
      <section className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="border-border-light flex items-start justify-between gap-4 border-b p-5">
          <div>
            <h2
              id="scheduling-modal-title"
              className="font-heading text-xl font-semibold text-slate-950"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-muted mt-1 text-sm">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

export function SchedulingCommandCenter({
  requests,
  currentUser,
  initialSelectedId,
  initialSelectionMissing = false,
  metrics,
  queryState,
  filterOptions,
  pagination,
}: {
  requests: ReceptionRequest[];
  currentUser: CurrentUser;
  initialSelectedId?: string;
  initialSelectionMissing?: boolean;
  metrics: SchedulingMetrics;
  queryState: SchedulingQueryState;
  filterOptions: SchedulingFilterOptions;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(queryState.query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? "");
  const [savingId, setSavingId] = useState("");
  const [notice, setNotice] = useState(
    initialSelectionMissing
      ? "Solicitação não encontrada ou indisponível nesta fila."
      : "",
  );
  const [error, setError] = useState("");
  const [unscheduledRequest, setUnscheduledRequest] =
    useState<ReceptionRequest | null>(null);
  const [unscheduledReason, setUnscheduledReason] =
    useState<OperationalOutcomeReason>("no_contact");
  const [unscheduledObservation, setUnscheduledObservation] = useState("");
  const [contactRequest, setContactRequest] = useState<ReceptionRequest | null>(
    null,
  );
  const [contactType, setContactType] = useState<ContactType>("phone");
  const [contactResult, setContactResult] =
    useState<ContactResult>("no_answer");
  const [contactNote, setContactNote] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [scheduleRequest, setScheduleRequest] =
    useState<ReceptionRequest | null>(null);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [scheduleObservation, setScheduleObservation] = useState("");

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  );
  const conversionRate = calculateSchedulingConversionRate({
    scheduled: metrics.scheduled,
    unscheduled: metrics.unscheduled,
  });

  function updateQuery(
    changes: Record<string, string | number | null | undefined>,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value == null || value === "" || value === "all") params.delete(key);
      else params.set(key, String(value));
    }
    if (!("page" in changes)) params.delete("page");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, {
      scroll: false,
    });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateQuery({ q: searchValue.trim(), page: null });
  }

  function openSchedule(request: ReceptionRequest) {
    setError("");
    setScheduleObservation(request.scheduling_note ?? "");
    setSchedules(
      request.appointment_request_exams
        .filter((exam) => exam.status !== "NOT_SCHEDULABLE")
        .map((exam) => ({
          examId: exam.id,
          name: exam.exam_name,
          date: exam.scheduled_date ?? "",
          time: exam.scheduled_time?.slice(0, 5) ?? "",
          preparation:
            exam.preparation_text || exam.automatic_preparation || "",
          documents: exam.documents_to_bring.length
            ? exam.documents_to_bring
            : exam.automatic_documents,
        })),
    );
    setScheduleRequest(request);
  }

  async function act(
    request: ReceptionRequest,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    setSavingId(request.id);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/admin/solicitacoes/acoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          operationId: crypto.randomUUID(),
          action,
          ...extra,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        removeFromActive?: boolean;
      };
      if (!response.ok || !result.ok)
        throw new Error(result.error || "Não foi possível concluir a ação.");
      setNotice(result.message || "Ação concluída.");
      if (result.removeFromActive && selectedId === request.id)
        setSelectedId("");
      setUnscheduledRequest(null);
      setContactRequest(null);
      setScheduleRequest(null);
      router.refresh();
      return true;
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Não foi possível concluir a ação.",
      );
      return false;
    } finally {
      setSavingId("");
    }
  }

  async function submitContactAttempt(event: FormEvent) {
    event.preventDefault();
    if (!contactRequest) return;
    let followUpAt: string | null = null;
    if (contactResult === "follow_up_requested") {
      if (!followUpDate || !followUpTime) {
        setError("Informe a data e o horário do retorno.");
        return;
      }
      followUpAt = new Date(`${followUpDate}T${followUpTime}`).toISOString();
    }
    await act(contactRequest, "register_contact", {
      contactType,
      result: contactResult,
      note: contactNote,
      followUpAt,
    });
  }

  async function submitSchedule(event: FormEvent) {
    event.preventDefault();
    if (!scheduleRequest) return;
    if (
      !schedules.length ||
      schedules.some((item) => !item.date || !item.time)
    ) {
      setError("Preencha data e horário de todos os exames.");
      return;
    }
    await act(scheduleRequest, "complete", {
      schedules: schedules.map((item) => ({
        examId: item.examId,
        date: item.date,
        time: item.time,
        preparation: item.preparation,
        documents: item.documents,
      })),
      observation: scheduleObservation,
    });
  }

  const metricCards = [
    {
      label: "Aguardando",
      value: metrics.waiting,
      icon: Clock3,
      tone: "text-amber-700 bg-amber-50",
    },
    {
      label: "Em atendimento",
      value: metrics.inService,
      icon: Users,
      tone: "text-sky-700 bg-sky-50",
    },
    {
      label: "Retornos pendentes",
      value: metrics.pendingFollowUps,
      icon: Bell,
      tone: "text-violet-700 bg-violet-50",
    },
    {
      label: "Agendados hoje",
      value: metrics.scheduledToday,
      icon: CalendarCheck2,
      tone: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Não agendados",
      value: metrics.unscheduled,
      icon: XCircle,
      tone: "text-rose-700 bg-rose-50",
    },
  ];

  const tabs = [
    { key: "all", label: "Todos", count: metrics.total },
    { key: "waiting", label: "Aguardando", count: metrics.waiting },
    { key: "in_service", label: "Em atendimento", count: metrics.inService },
    { key: "scheduled", label: "Agendados", count: metrics.scheduled },
    { key: "unscheduled", label: "Não agendados", count: metrics.unscheduled },
  ];

  function rowActions(request: ReceptionRequest) {
    const status = getOperationalStatus(request.workflow_status);
    const busy = savingId === request.id;
    const ownedByAnother = Boolean(
      request.assigned_to && request.assigned_to !== currentUser.id,
    );
    const canOperate =
      currentUser.canManageScheduling &&
      (!ownedByAnother || currentUser.canOverrideAssignment);

    if (status === "AGUARDANDO") {
      return (
        <button
          type="button"
          disabled={busy || !currentUser.canManageScheduling}
          onClick={() => act(request, "claim")}
          className="bg-brand inline-flex min-h-8 items-center rounded-lg px-2.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {busy ? (
            <LoaderCircle className="mr-1 animate-spin" size={14} />
          ) : (
            <UserCheck className="mr-1" size={14} />
          )}
          Assumir atendimento
        </button>
      );
    }
    if (status === "EM_ATENDIMENTO") {
      return (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            disabled={
              busy || !canOperate || request.workflow_status !== "AUTORIZADO"
            }
            onClick={() => openSchedule(request)}
            title={
              request.workflow_status !== "AUTORIZADO"
                ? "Conclua a análise e autorização antes de agendar."
                : "Agendar"
            }
            className="inline-flex min-h-8 items-center rounded-lg bg-emerald-700 px-2.5 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-500"
          >
            <Check className="mr-1" size={14} /> Agendar
          </button>
          <button
            type="button"
            disabled={busy || !canOperate}
            onClick={() => {
              setUnscheduledReason("no_contact");
              setUnscheduledObservation("");
              setUnscheduledRequest(request);
            }}
            className="inline-flex min-h-8 items-center rounded-lg bg-rose-700 px-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <X className="mr-1" size={14} /> Não foi possível
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setSelectedId(request.id)}
        className="text-brand min-h-8 rounded-lg px-2.5 text-xs font-bold hover:bg-sky-50"
      >
        Ver detalhes
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
        >
          <CheckCircle2 size={17} aria-hidden="true" /> {notice}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900"
        >
          <AlertTriangle size={17} aria-hidden="true" /> {error}
        </div>
      ) : null}

      <section
        aria-label="Resumo da central"
        className="grid grid-cols-2 gap-2 lg:grid-cols-5"
      >
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="border-border-light flex min-h-20 items-center gap-3 rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,.03)]"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg ${card.tone}`}
              >
                <Icon size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-muted truncate text-xs font-bold">
                  {card.label}
                </p>
                <p className="mt-0.5 text-2xl leading-none font-semibold text-slate-950">
                  {card.value.toLocaleString("pt-BR")}
                </p>
              </div>
            </article>
          );
        })}
      </section>

      <section className="border-border-light rounded-2xl border bg-white shadow-[0_2px_8px_rgba(15,23,42,.03)]">
        <div className="border-border-light space-y-3 border-b p-3 sm:p-4">
          <div className="flex flex-col gap-2 lg:flex-row">
            <form
              onSubmit={submitSearch}
              className="relative flex min-w-0 flex-1"
            >
              <Search
                className="text-muted pointer-events-none absolute top-2.5 left-3"
                size={17}
                aria-hidden="true"
              />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por paciente, CPF, telefone ou exame..."
                className="border-border-light min-h-10 w-full rounded-lg border pr-20 pl-9 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <button
                type="submit"
                className="text-brand absolute top-1 right-1 min-h-8 rounded-md px-3 text-xs font-bold hover:bg-sky-50"
              >
                Buscar
              </button>
            </form>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                className={`border-border-light inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-bold ${filtersOpen ? "bg-brand text-white" : "bg-white text-slate-700"}`}
                aria-expanded={filtersOpen}
              >
                <Filter className="mr-1.5" size={16} /> Filtros
              </button>
              <button
                type="button"
                onClick={() => setIndicatorsOpen((value) => !value)}
                className={`border-border-light inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-bold ${indicatorsOpen ? "bg-brand text-white" : "bg-white text-slate-700"}`}
                aria-expanded={indicatorsOpen}
              >
                <BarChart3 className="mr-1.5" size={16} /> Indicadores
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-2 xl:flex-row xl:items-center">
            <div
              className="flex gap-1 overflow-x-auto pb-1"
              aria-label="Status da fila"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => updateQuery({ status: tab.key, page: null })}
                  className={`min-h-8 shrink-0 rounded-lg px-3 text-xs font-bold ${queryState.status === tab.key || (tab.key === "all" && !queryState.status) ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {tab.label} ({tab.count.toLocaleString("pt-BR")})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex rounded-lg bg-slate-100 p-1"
                aria-label="Escopo da fila"
              >
                <button
                  type="button"
                  onClick={() => updateQuery({ scope: "general", page: null })}
                  className={`min-h-7 rounded-md px-2.5 text-xs font-bold ${queryState.scope !== "mine" ? "text-brand bg-white shadow-sm" : "text-slate-600"}`}
                >
                  Fila geral
                </button>
                <button
                  type="button"
                  onClick={() => updateQuery({ scope: "mine", page: null })}
                  className={`min-h-7 rounded-md px-2.5 text-xs font-bold ${queryState.scope === "mine" ? "text-brand bg-white shadow-sm" : "text-slate-600"}`}
                >
                  Minha fila
                </button>
              </div>
              <label className="text-muted flex items-center gap-1.5 text-xs font-bold">
                Ordenar
                <select
                  value={queryState.sort || "priority"}
                  onChange={(event) =>
                    updateQuery({ sort: event.target.value, page: null })
                  }
                  className="border-border-light min-h-8 rounded-lg border bg-white px-2 text-xs text-slate-700"
                >
                  <option value="priority">Prioridade</option>
                  <option value="oldest">Mais antigos</option>
                  <option value="newest">Mais recentes</option>
                  <option value="name">Nome</option>
                  <option value="status">Status</option>
                  <option value="responsible">Responsável</option>
                </select>
              </label>
            </div>
          </div>

          {filtersOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                updateQuery({
                  from: String(data.get("from") || ""),
                  to: String(data.get("to") || ""),
                  insurance: String(data.get("insurance") || ""),
                  modality: String(data.get("modality") || ""),
                  responsible: String(data.get("responsible") || ""),
                  unit: String(data.get("unit") || ""),
                  reason: String(data.get("reason") || ""),
                  page: null,
                });
                setFiltersOpen(false);
              }}
              className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4"
            >
              <label className="text-xs font-bold text-slate-700">
                Solicitação de
                <input
                  name="from"
                  type="date"
                  defaultValue={queryState.from}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                />
              </label>
              <label className="text-xs font-bold text-slate-700">
                Solicitação até
                <input
                  name="to"
                  type="date"
                  defaultValue={queryState.to}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                />
              </label>
              <label className="text-xs font-bold text-slate-700">
                Convênio
                <select
                  name="insurance"
                  defaultValue={queryState.insurance}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                >
                  <option value="">Todos</option>
                  {filterOptions.insurances.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700">
                Modalidade
                <select
                  name="modality"
                  defaultValue={queryState.modality}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                >
                  <option value="">Todas</option>
                  {filterOptions.modalities.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700">
                Responsável
                <select
                  name="responsible"
                  defaultValue={queryState.responsible}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                >
                  <option value="">Todos</option>
                  <option value="unassigned">Não atribuído</option>
                  {filterOptions.responsibles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700">
                Unidade
                <select
                  name="unit"
                  defaultValue={queryState.unit}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                >
                  <option value="">Todas</option>
                  {filterOptions.units.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-700 sm:col-span-2">
                Motivo de não agendamento
                <select
                  name="reason"
                  defaultValue={queryState.reason}
                  className="border-border-light mt-1 min-h-9 w-full rounded-lg border bg-white px-2 font-normal"
                >
                  <option value="">Todos</option>
                  {operationalOutcomeReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {operationalOutcomeReasonLabels[reason]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    updateQuery({
                      from: null,
                      to: null,
                      insurance: null,
                      modality: null,
                      responsible: null,
                      unit: null,
                      reason: null,
                      page: null,
                    })
                  }
                  className="min-h-9 rounded-lg px-3 text-xs font-bold text-slate-600"
                >
                  Limpar
                </button>
                <button
                  type="submit"
                  className="bg-brand min-h-9 rounded-lg px-4 text-xs font-bold text-white"
                >
                  Aplicar filtros
                </button>
              </div>
            </form>
          ) : null}
        </div>

        {indicatorsOpen ? (
          <section
            className="border-border-light border-b bg-slate-50/70 p-4"
            aria-label="Indicadores operacionais"
          >
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Total de solicitações",
                  metrics.total.toLocaleString("pt-BR"),
                ],
                [
                  "Taxa de conversão",
                  `${conversionRate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
                ],
                [
                  "Tempo até 1º atendimento",
                  formatOperationalDuration(metrics.averageFirstContactMinutes),
                ],
                [
                  "Tempo até conclusão",
                  formatOperationalDuration(metrics.averageCompletionMinutes),
                ],
              ].map(([label, value]) => (
                <article
                  key={label}
                  className="border-border-light rounded-xl border bg-white p-3"
                >
                  <p className="text-muted text-xs font-bold">{label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {value}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <article className="border-border-light rounded-xl border bg-white p-4">
                <h3 className="text-sm font-bold text-slate-950">
                  Principais motivos de não agendamento
                </h3>
                <ol className="mt-3 space-y-2">
                  {metrics.reasons.slice(0, 6).map((item) => (
                    <li
                      key={item.reason}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>
                        {operationalOutcomeReasonLabels[
                          item.reason as OperationalOutcomeReason
                        ] || item.reason}
                      </span>
                      <strong>{item.total}</strong>
                    </li>
                  ))}
                  {!metrics.reasons.length ? (
                    <li className="text-muted text-sm">
                      Ainda não há motivos registrados.
                    </li>
                  ) : null}
                </ol>
              </article>
              <article className="border-border-light rounded-xl border bg-white p-4">
                <h3 className="text-sm font-bold text-slate-950">
                  Solicitações por responsável
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-muted">
                      <tr>
                        <th className="pb-2">Responsável</th>
                        <th className="pb-2 text-right">Concluídas</th>
                        <th className="pb-2 text-right">Conversão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-light divide-y">
                      {metrics.responsibles.slice(0, 8).map((item) => (
                        <tr key={item.id ?? item.name}>
                          <td className="py-2 font-bold">{item.name}</td>
                          <td className="py-2 text-right">{item.total}</td>
                          <td className="py-2 text-right">
                            {calculateSchedulingConversionRate({
                              scheduled: item.scheduled,
                              unscheduled: item.unscheduled,
                            }).toLocaleString("pt-BR", {
                              maximumFractionDigits: 1,
                            })}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!metrics.responsibles.length ? (
                    <p className="text-muted py-3 text-sm">
                      Ainda não há conclusões no período.
                    </p>
                  ) : null}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead className="border-border-light border-b bg-slate-50 text-[.68rem] font-extrabold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-3 py-3">Exame</th>
                <th className="px-3 py-3">Convênio</th>
                <th className="px-3 py-3">Solicitação</th>
                <th className="px-3 py-3">Responsável</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-border-light divide-y">
              {requests.map((request) => {
                const status = getOperationalStatus(request.workflow_status);
                const returnPending = isPendingFollowUp(
                  request.follow_up_at,
                  request.workflow_status,
                );
                return (
                  <tr key={request.id} className="group hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedId(request.id)}
                        className="max-w-[15rem] text-left"
                      >
                        <span className="block truncate text-sm font-bold text-slate-950 group-hover:text-sky-800">
                          {request.patient_name}
                        </span>
                        <span className="text-muted mt-0.5 block text-xs">
                          {request.phone || "Telefone não informado"}
                        </span>
                      </button>
                    </td>
                    <td className="max-w-[14rem] px-3 py-3 text-sm text-slate-700">
                      <span className="block truncate">
                        {request.appointment_request_exams[0]?.exam_name ||
                          "Exame não informado"}
                      </span>
                      {request.appointment_request_exams.length > 1 ? (
                        <span className="text-muted text-xs">
                          + {request.appointment_request_exams.length - 1}{" "}
                          exame(s)
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[11rem] px-3 py-3 text-sm text-slate-700">
                      <span className="block truncate">
                        {request.insurance_name ||
                          (request.service_type === "PARTICULAR"
                            ? "Particular"
                            : request.service_type)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${waitingToneClass(request)}`}
                      >
                        <Clock3 className="mr-1" size={13} />
                        {formatWaitingTime(request.created_at)}
                      </span>
                      {returnPending ? (
                        <span className="mt-1 block text-xs font-bold text-violet-700">
                          <Bell className="mr-1 inline" size={13} />
                          Retorno {formatReceptionDate(request.follow_up_at)}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[10rem] px-3 py-3 text-sm text-slate-700">
                      <span className="block truncate">
                        {relationName(request)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[.68rem] font-extrabold ring-1 ring-inset ${operationalBadge(status)}`}
                      >
                        {operationalStatusLabels[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rowActions(request)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-border-light divide-y md:hidden">
          {requests.map((request) => {
            const status = getOperationalStatus(request.workflow_status);
            const returnPending = isPendingFollowUp(
              request.follow_up_at,
              request.workflow_status,
            );
            return (
              <article key={request.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(request.id)}
                    className="min-w-0 text-left"
                  >
                    <h3 className="truncate font-bold text-slate-950">
                      {request.patient_name}
                    </h3>
                    <p className="text-muted mt-0.5 text-xs">{request.phone}</p>
                  </button>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[.65rem] font-extrabold ring-1 ring-inset ${operationalBadge(status)}`}
                  >
                    {operationalStatusLabels[status]}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Exame</dt>
                    <dd className="mt-0.5 font-bold">
                      {request.appointment_request_exams[0]?.exam_name ||
                        "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Convênio</dt>
                    <dd className="mt-0.5 font-bold">
                      {request.insurance_name || "Particular"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Tempo</dt>
                    <dd
                      className={`mt-0.5 inline-flex rounded px-1.5 py-0.5 font-bold ${waitingToneClass(request)}`}
                    >
                      {formatWaitingTime(request.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Responsável</dt>
                    <dd className="mt-0.5 font-bold">
                      {relationName(request)}
                    </dd>
                  </div>
                </dl>
                {returnPending ? (
                  <p className="mt-3 rounded-lg bg-violet-50 p-2 text-xs font-bold text-violet-800">
                    <Bell className="mr-1 inline" size={13} />
                    Retorno pendente ·{" "}
                    {formatReceptionDate(request.follow_up_at)}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  {rowActions(request)}
                </div>
              </article>
            );
          })}
        </div>

        {!requests.length ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
              <ListFilter size={20} />
            </span>
            <h3 className="mt-3 font-bold text-slate-900">
              Nenhum agendamento encontrado
            </h3>
            <p className="text-muted mt-1 text-sm">
              Não há solicitações para estes filtros.
            </p>
          </div>
        ) : null}

        <footer className="border-border-light flex flex-col gap-2 border-t px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted">
            {pagination.total.toLocaleString("pt-BR")} registro(s) · página{" "}
            {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => updateQuery({ page: pagination.page - 1 })}
              className="border-border-light inline-flex min-h-8 items-center rounded-lg border px-2.5 font-bold text-slate-700 disabled:opacity-40"
            >
              <ChevronLeft size={14} className="mr-1" />
              Anterior
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateQuery({ page: pagination.page + 1 })}
              className="border-border-light inline-flex min-h-8 items-center rounded-lg border px-2.5 font-bold text-slate-700 disabled:opacity-40"
            >
              Próxima
              <ChevronRight size={14} className="ml-1" />
            </button>
          </div>
        </footer>
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-[60]"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes da solicitação"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setSelectedId("")}
            aria-label="Fechar detalhes"
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-3xl overflow-y-auto bg-white shadow-2xl">
            <header className="border-border-light sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white/95 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <p className="text-muted text-xs font-bold">
                  {selected.protocol}
                </p>
                <h2 className="truncate font-bold text-slate-950">
                  {selected.patient_name}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isActiveRequest(
                  selected.workflow_status,
                  selected.confirmation_status,
                ) &&
                (selected.assigned_to === currentUser.id ||
                  currentUser.canOverrideAssignment) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setContactType("phone");
                      setContactResult("no_answer");
                      setContactNote("");
                      setFollowUpDate("");
                      setFollowUpTime("");
                      setContactRequest(selected);
                    }}
                    className="border-border-light inline-flex min-h-8 items-center rounded-lg border px-2.5 text-xs font-bold text-slate-700"
                  >
                    <PhoneCall className="mr-1" size={14} />
                    Registrar tentativa
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedId("")}
                  className="grid size-9 place-items-center rounded-lg bg-slate-100"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
            </header>
            <ReceptionCenter
              requests={[selected]}
              currentUser={currentUser}
              initialSelectedId={selected.id}
              embedded
            />
          </aside>
        </div>
      ) : null}

      {unscheduledRequest ? (
        <ModalShell
          title="Não foi possível realizar o agendamento"
          description={`${unscheduledRequest.patient_name} · ${unscheduledRequest.appointment_request_exams[0]?.exam_name || "Exame"}`}
          onClose={() => setUnscheduledRequest(null)}
        >
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await act(unscheduledRequest, "mark_not_scheduled", {
                reason: unscheduledReason,
                observation: unscheduledObservation,
              });
            }}
            className="space-y-4"
          >
            <label className="block text-sm font-bold text-slate-800">
              Motivo <span className="text-rose-700">*</span>
              <select
                required
                value={unscheduledReason}
                onChange={(event) =>
                  setUnscheduledReason(
                    event.target.value as OperationalOutcomeReason,
                  )
                }
                className="border-border-light mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"
              >
                {operationalOutcomeReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {operationalOutcomeReasonLabels[reason]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-800">
              Observação complementar{" "}
              {unscheduledReason === "other" ? (
                <span className="text-rose-700">*</span>
              ) : (
                <span className="text-muted font-normal">(opcional)</span>
              )}
              <textarea
                required={unscheduledReason === "other"}
                value={unscheduledObservation}
                onChange={(event) =>
                  setUnscheduledObservation(event.target.value)
                }
                maxLength={1000}
                rows={4}
                className="border-border-light mt-1.5 w-full rounded-lg border p-3 font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnscheduledRequest(null)}
                className="min-h-9 rounded-lg px-3 text-sm font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={Boolean(savingId)}
                className="inline-flex min-h-9 items-center rounded-lg bg-rose-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingId ? (
                  <LoaderCircle className="mr-1.5 animate-spin" size={15} />
                ) : (
                  <XCircle className="mr-1.5" size={15} />
                )}
                Registrar como não agendado
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {contactRequest ? (
        <ModalShell
          title="Registrar tentativa"
          description={contactRequest.patient_name}
          onClose={() => setContactRequest(null)}
        >
          <form onSubmit={submitContactAttempt} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-800">
                Canal
                <select
                  value={contactType}
                  onChange={(event) =>
                    setContactType(event.target.value as ContactType)
                  }
                  className="border-border-light mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"
                >
                  {contactTypes.map((type) => (
                    <option key={type} value={type}>
                      {contactTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-800">
                Resultado
                <select
                  value={contactResult}
                  onChange={(event) =>
                    setContactResult(event.target.value as ContactResult)
                  }
                  className="border-border-light mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 font-normal"
                >
                  {contactResults.map((result) => (
                    <option key={result} value={result}>
                      {contactResultLabels[result]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {contactResult === "follow_up_requested" ? (
              <div className="grid gap-3 rounded-xl bg-violet-50 p-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-violet-950">
                  Data do retorno
                  <input
                    required
                    type="date"
                    value={followUpDate}
                    onChange={(event) => setFollowUpDate(event.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-lg border border-violet-200 bg-white px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-bold text-violet-950">
                  Horário do retorno
                  <input
                    required
                    type="time"
                    value={followUpTime}
                    onChange={(event) => setFollowUpTime(event.target.value)}
                    className="mt-1.5 min-h-11 w-full rounded-lg border border-violet-200 bg-white px-3 font-normal"
                  />
                </label>
              </div>
            ) : null}
            <label className="block text-sm font-bold text-slate-800">
              Observação{" "}
              <span className="text-muted font-normal">(opcional)</span>
              <textarea
                value={contactNote}
                onChange={(event) => setContactNote(event.target.value)}
                maxLength={1000}
                rows={3}
                className="border-border-light mt-1.5 w-full rounded-lg border p-3 font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContactRequest(null)}
                className="min-h-9 rounded-lg px-3 text-sm font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={Boolean(savingId)}
                className="bg-brand inline-flex min-h-9 items-center rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingId ? (
                  <LoaderCircle className="mr-1.5 animate-spin" size={15} />
                ) : (
                  <Check className="mr-1.5" size={15} />
                )}
                Salvar tentativa
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {scheduleRequest ? (
        <ModalShell
          title="Confirmar agendamento"
          description={`${scheduleRequest.patient_name} · ${scheduleRequest.insurance_name || "Particular"}`}
          onClose={() => setScheduleRequest(null)}
        >
          <form onSubmit={submitSchedule} className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <span className="text-muted">Unidade</span>
              <strong className="ml-2">{scheduleRequest.unit_name}</strong>
            </div>
            <div className="space-y-3">
              {schedules.map((schedule, index) => (
                <fieldset
                  key={schedule.examId}
                  className="border-border-light rounded-xl border p-3"
                >
                  <legend className="px-1 text-sm font-bold">
                    {schedule.name}
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-bold">
                      Data
                      <input
                        required
                        type="date"
                        value={schedule.date}
                        onChange={(event) =>
                          setSchedules((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, date: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="border-border-light mt-1.5 min-h-11 w-full rounded-lg border px-3 font-normal"
                      />
                    </label>
                    <label className="text-sm font-bold">
                      Horário
                      <input
                        required
                        type="time"
                        value={schedule.time}
                        onChange={(event) =>
                          setSchedules((items) =>
                            items.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, time: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="border-border-light mt-1.5 min-h-11 w-full rounded-lg border px-3 font-normal"
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </div>
            <label className="block text-sm font-bold">
              Observação{" "}
              <span className="text-muted font-normal">(opcional)</span>
              <textarea
                value={scheduleObservation}
                onChange={(event) => setScheduleObservation(event.target.value)}
                maxLength={1000}
                rows={3}
                className="border-border-light mt-1.5 w-full rounded-lg border p-3 font-normal"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduleRequest(null)}
                className="min-h-9 rounded-lg px-3 text-sm font-bold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={Boolean(savingId)}
                className="inline-flex min-h-9 items-center rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingId ? (
                  <LoaderCircle className="mr-1.5 animate-spin" size={15} />
                ) : (
                  <Check className="mr-1.5" size={15} />
                )}
                Confirmar agendamento
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
