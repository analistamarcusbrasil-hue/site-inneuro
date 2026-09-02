"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useActionState,
  useMemo,
  useState,
} from "react";
import {
  bulkCareerApplicationsAction,
  type BulkCareerApplicationsState,
} from "@/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions";
import { notifyCandidatePipelineMovement } from "@/components/admin/careers/candidate-pipeline-nav";
import {
  applicationStatusLabels,
  candidateStageLabels,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import {
  matchAdherenceBandLabels,
  matchStatusLabels,
  type ExplainableMatchResult,
  type MatchAdherenceBand,
} from "@/lib/careers/matching";

export type AtsCandidateRow = {
  applicationId: string;
  name: string;
  objective: string;
  education: string;
  relevantExperience: string;
  experienceMonths: number;
  availability: string;
  availabilityShifts: string[];
  status: ApplicationStatus;
  stage: CareerJobApplication["candidate_stage"];
  submittedAt: string;
  resumeId: string | null;
  match: ExplainableMatchResult | null;
  matchScore: number | null;
  informationCoverage: number;
  band: MatchAdherenceBand;
  referredBy: string | null;
  isReferred: boolean;
  isFavorite: boolean;
  tags: string[];
  skills: string[];
  hiringChecklist: Record<string, unknown>;
};

const initialState: BulkCareerApplicationsState = {
  status: "idle",
  message: "",
};

const bandClasses: Record<MatchAdherenceBand, string> = {
  excellent: "bg-emerald-100 text-emerald-900",
  high: "bg-teal-100 text-teal-900",
  good: "bg-sky-100 text-sky-900",
  partial: "bg-amber-100 text-amber-900",
  review: "bg-slate-100 text-slate-700",
};

const shiftLabels: Record<string, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noite",
  flexible: "Flexível",
};

function formatExperience(months: number) {
  if (!months) return "Não identificado";
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return [
    years ? `${years} ano(s)` : "",
    remainder ? `${remainder} mês(es)` : "",
  ]
    .filter(Boolean)
    .join(" e ");
}

function ScoreBadge({ row }: { row: AtsCandidateRow }) {
  return (
    <span
      title={`${matchAdherenceBandLabels[row.band]} · cobertura ${row.informationCoverage}%`}
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${bandClasses[row.band]}`}
    >
      {row.matchScore === null ? "Analisar" : `${row.matchScore}%`}
    </span>
  );
}

function canQuickDecide(stage: AtsCandidateRow["stage"]) {
  return !["hired", "not_approved"].includes(stage);
}

const nextStageLabels: Partial<
  Record<AtsCandidateRow["stage"], string>
> = {
  resume: "Entrevista",
  interview: "Teste prático",
  practical_test: "Contratação",
  hiring: "Contratado",
};

const nextQueueStages: Partial<
  Record<
    AtsCandidateRow["stage"],
    AtsCandidateRow["stage"]
  >
> = {
  resume: "interview",
  interview: "practical_test",
  practical_test: "hiring",
  hiring: "hired",
};

const emptyQueueMessages: Record<AtsCandidateRow["stage"], string> = {
  resume: "Nenhum currículo aguardando análise.",
  interview: "Nenhum candidato aguardando decisão de entrevista.",
  practical_test: "Nenhum candidato aguardando decisão do teste prático.",
  hiring: "Nenhum candidato aguardando decisão de contratação.",
  hired: "Nenhum candidato contratado nesta vaga.",
  not_approved: "Nenhum candidato não aprovado nesta vaga.",
};

export function CandidateOperationsCenter({
  jobId,
  rows,
  total,
  activeStage,
}: {
  jobId: string;
  rows: AtsCandidateRow[];
  total: number;
  activeStage: CareerJobApplication["candidate_stage"] | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [displayRows, setDisplayRows] = useState(rows);
  const [displayTotal, setDisplayTotal] = useState(total);
  const [processing, setProcessing] = useState<{
    applicationIds: string[];
    operation: string;
  } | null>(null);
  const [activeRow, setActiveRow] = useState<AtsCandidateRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<"summary" | "match" | "hiring">(
    "summary",
  );
  const [state, formAction, pending] = useActionState(
    async (previousState: BulkCareerApplicationsState, formData: FormData) => {
      let applicationIds: string[] = [];
      try {
        applicationIds = JSON.parse(
          String(formData.get("application_ids") ?? "[]"),
        ) as string[];
      } catch {
        applicationIds = [];
      }
      const operation = String(formData.get("operation") ?? "");
      setProcessing({ applicationIds, operation });
      let nextState: BulkCareerApplicationsState;
      try {
        nextState = await bulkCareerApplicationsAction(previousState, formData);
      } finally {
        setProcessing(null);
      }
      if (
        nextState.status === "success" &&
        nextState.fromStage &&
        nextState.nextStage &&
        nextState.movedCount
      ) {
        notifyCandidatePipelineMovement({
          jobId,
          fromStage: nextState.fromStage,
          toStage: nextState.nextStage,
          movedCount: nextState.movedCount,
        });
        setDisplayRows((current) =>
          activeStage
            ? current.filter(
                (row) => !applicationIds.includes(row.applicationId),
              )
            : current.map((row) =>
                applicationIds.includes(row.applicationId)
                  ? {
                      ...row,
                      stage: nextState.nextStage!,
                      status:
                        nextState.nextStage === "hired" ||
                        nextState.nextStage === "not_approved"
                          ? "finalized"
                          : "in_process",
                    }
                  : row,
              ),
        );
        if (activeStage) {
          setDisplayTotal((current) =>
            Math.max(0, current - nextState.movedCount!),
          );
        }
        setSelected([]);
        router.refresh();
      } else if (nextState.refreshRequired) {
        router.refresh();
      }
      return nextState;
    },
    initialState,
  );

  const selectedRows = useMemo(
    () =>
      displayRows.filter((row) => selected.includes(row.applicationId)),
    [displayRows, selected],
  );
  const selectedStage =
    selectedRows.length &&
    selectedRows.every((row) => row.stage === selectedRows[0].stage)
      ? selectedRows[0].stage
      : "";
  const canMove = Boolean(
    selectedStage && !["hired", "not_approved"].includes(selectedStage),
  );

  function toggle(applicationId: string) {
    setSelected((current) =>
      current.includes(applicationId)
        ? current.filter((id) => id !== applicationId)
        : [...current, applicationId],
    );
  }

  function confirmQuickDecision(
    event: FormEvent<HTMLFormElement>,
    row: AtsCandidateRow,
  ) {
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    if (!submitter?.value) return;
    const isRejection = submitter.value === "not_approve";
    const message = isRejection
      ? `Reprovar candidato?\n\n${row.name} será movido(a) para Não aprovados.`
      : `Aprovar candidato?\n\n${row.name} avançará para ${nextStageLabels[row.stage] ?? "a próxima etapa"}.`;
    if (!window.confirm(message)) event.preventDefault();
  }

  function exportSelection() {
    const exported = selectedRows.length ? selectedRows : displayRows;
    const csv = [
      ["Nome", "Etapa", "Status", "Aderência", "Experiência", "Indicação"],
      ...exported.map((row) => [
        row.name,
        candidateStageLabels[row.stage],
        applicationStatusLabels[row.status],
        row.matchScore ?? "Não calculada",
        formatExperience(row.experienceMonths),
        row.referredBy ?? "Não",
      ]),
    ]
      .map((line) =>
        line
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(";"),
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "candidaturas-inneuro.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const stages = Object.keys(
    candidateStageLabels,
  ) as AtsCandidateRow["stage"][];
  const nextQueueStage = activeStage ? nextQueueStages[activeStage] : undefined;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">
          {displayTotal} resultado(s) · {selected.length} selecionado(s) nesta
          página
        </p>
        <div className="border-border-light flex rounded-full border bg-white p-1 text-sm font-bold">
          <button
            type="button"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            className={`min-h-9 rounded-full px-4 ${view === "list" ? "bg-brand text-white" : "text-brand-dark"}`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            aria-pressed={view === "kanban"}
            className={`min-h-9 rounded-full px-4 ${view === "kanban" ? "bg-brand text-white" : "text-brand-dark"}`}
          >
            Kanban
          </button>
        </div>
      </div>

      {state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`mb-4 rounded-2xl p-4 text-sm font-bold ${state.status === "error" ? "bg-error/10 text-error" : "bg-mint text-brand-dark"}`}
        >
          {state.message}
        </p>
      ) : null}

      {!displayRows.length ? (
        <section className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            {activeStage
              ? "✓ Todos os candidatos desta etapa foram avaliados."
              : "Nenhuma candidatura encontrada."}
          </h2>
          <p className="text-muted mt-2 text-sm">
            {activeStage
              ? emptyQueueMessages[activeStage]
              : "Ajuste os filtros ou aguarde novas candidaturas."}
          </p>
          {nextQueueStage ? (
            <Link
              href={`/admin/rh/vagas/${jobId}/candidaturas?etapa=${nextQueueStage}`}
              className="bg-brand hover:bg-brand-dark mt-5 inline-flex min-h-10 items-center rounded-full px-5 text-sm font-bold text-white"
            >
              Ver {candidateStageLabels[nextQueueStage]}
            </Link>
          ) : null}
        </section>
      ) : view === "kanban" ? (
        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          {stages.map((stage) => {
            const stageRows = displayRows.filter((row) => row.stage === stage);
            return (
              <section
                key={stage}
                aria-labelledby={`kanban-${stage}`}
                className="border-border-light min-w-0 rounded-2xl border bg-white p-3"
              >
                <h2
                  id={`kanban-${stage}`}
                  className="text-brand-dark flex items-center justify-between text-xs font-bold uppercase"
                >
                  <span>{candidateStageLabels[stage]}</span>
                  <span className="bg-surface rounded-full px-2 py-1">
                    {stageRows.length}
                  </span>
                </h2>
                <div className="mt-3 grid gap-3">
                  {stageRows.map((row) => (
                    <button
                      type="button"
                      key={row.applicationId}
                      onClick={() => setActiveRow(row)}
                      className="border-border-light hover:border-brand/40 rounded-xl border p-3 text-left"
                    >
                      <span className="text-ink block truncate text-sm font-bold">
                        {row.isFavorite ? "★ " : ""}
                        {row.name}
                      </span>
                      <span className="mt-2 block">
                        <ScoreBadge row={row} />
                      </span>
                    </button>
                  ))}
                  {!stageRows.length ? (
                    <p className="text-muted py-5 text-center text-xs">
                      Nenhum nesta página
                    </p>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <div className="border-border-light hidden overflow-hidden rounded-3xl border bg-white md:block">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-11" />
                <col className="w-[25%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[9%]" />
                <col className="w-[290px]" />
              </colgroup>
              <thead className="bg-surface text-brand-dark text-xs uppercase">
                <tr>
                  <th className="px-3 py-4">
                    <input
                      aria-label="Selecionar todos os resultados desta página"
                      type="checkbox"
                      checked={
                        displayRows.length > 0 &&
                        selected.length === displayRows.length
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? displayRows.map((row) => row.applicationId)
                            : [],
                        )
                      }
                      className="accent-brand size-4"
                    />
                  </th>
                  <th className="px-3 py-4">Candidato</th>
                  <th className="px-3 py-4">Perfil</th>
                  <th className="px-3 py-4">Etapa</th>
                  <th className="px-3 py-4">Aderência</th>
                  <th className="px-2 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-border-light divide-y">
                {displayRows.map((row) => (
                  <tr
                    key={row.applicationId}
                    className={`h-20 align-middle transition-opacity ${processing?.applicationIds.includes(row.applicationId) ? "opacity-50" : ""}`}
                  >
                    <td className="px-3 py-3 align-middle">
                      <input
                        aria-label={`Selecionar ${row.name}`}
                        type="checkbox"
                        checked={selected.includes(row.applicationId)}
                        onChange={() => toggle(row.applicationId)}
                        className="accent-brand size-4"
                      />
                    </td>
                    <td className="min-w-0 px-3 py-3 align-middle">
                      <button
                        type="button"
                        className="text-brand block max-w-full truncate text-left font-bold hover:underline"
                        onClick={() => setActiveRow(row)}
                      >
                        {row.isFavorite ? "★ " : ""}
                        {row.name}
                      </button>
                      <span className="text-muted mt-1 block truncate text-xs">
                        {row.objective}
                      </span>
                      {row.isReferred || row.tags.length ? (
                        <div className="mt-1.5 flex max-h-5 items-center gap-1 overflow-hidden">
                          {row.isReferred ? (
                            <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                              Indicação
                            </span>
                          ) : null}
                          {row.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="bg-surface text-muted max-w-24 truncate rounded-full px-2 py-0.5 text-[10px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="min-w-0 px-3 py-3 align-middle">
                      <span className="text-ink line-clamp-2 leading-snug">
                        {row.education}
                      </span>
                      <span className="text-muted mt-1 block text-xs">
                        {formatExperience(row.experienceMonths)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="text-ink font-bold">
                        {candidateStageLabels[row.stage]}
                      </span>
                      <span className="text-muted mt-1 block text-xs">
                        {applicationStatusLabels[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex flex-col items-start">
                        <ScoreBadge row={row} />
                        <span className="text-muted mt-1 block whitespace-nowrap text-xs">
                          Cobertura {row.informationCoverage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {row.resumeId ? (
                          <Link
                            href={`/api/admin/rh/curriculos/${row.resumeId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Ver currículo — ${row.name}`}
                            className="border-brand/30 text-brand-dark inline-flex min-h-9 flex-none items-center justify-center rounded-lg border bg-white px-3 text-xs font-bold hover:bg-emerald-50"
                          >
                            Ver currículo
                          </Link>
                        ) : (
                          <span className="border-border-light text-muted inline-flex min-h-9 items-center rounded-lg border px-2 text-[10px]">
                            Sem currículo
                          </span>
                        )}
                        {canQuickDecide(row.stage) ? (
                          <form
                            action={formAction}
                            onSubmit={(event) =>
                              confirmQuickDecision(event, row)
                            }
                            className="flex flex-none items-center gap-1"
                          >
                            <input type="hidden" name="job_id" value={jobId} />
                            <input
                              type="hidden"
                              name="application_ids"
                              value={JSON.stringify([row.applicationId])}
                            />
                            <input
                              type="hidden"
                              name="expected_stage"
                              value={row.stage}
                            />
                            <button
                              name="operation"
                              value="approve"
                              disabled={pending}
                              title={`Aprovar e avançar para ${nextStageLabels[row.stage]} — ${row.name}`}
                              className="min-h-9 flex-none rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {processing?.applicationIds.includes(
                                row.applicationId,
                              ) && processing.operation === "approve"
                                ? "Processando…"
                                : "✓ Aprovar"}
                            </button>
                            <button
                              name="operation"
                              value="not_approve"
                              disabled={pending}
                              title={`Reprovar — ${row.name}`}
                              className="bg-error hover:bg-error/85 min-h-9 flex-none rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {processing?.applicationIds.includes(
                                row.applicationId,
                              ) && processing.operation === "not_approve"
                                ? "Processando…"
                                : "✕ Reprovar"}
                            </button>
                          </form>
                        ) : (
                          <span
                            className={`inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold ${row.stage === "hired" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
                          >
                            {row.stage === "hired"
                              ? "✓ Contratado"
                              : "✕ Não aprovado"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {displayRows.map((row) => (
              <article
                key={row.applicationId}
                className={`border-border-light rounded-2xl border bg-white p-4 transition-opacity ${processing?.applicationIds.includes(row.applicationId) ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    aria-label={`Selecionar ${row.name}`}
                    type="checkbox"
                    checked={selected.includes(row.applicationId)}
                    onChange={() => toggle(row.applicationId)}
                    className="accent-brand mt-1 size-4"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveRow(row)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="text-brand block truncate font-bold">
                      {row.isFavorite ? "★ " : ""}
                      {row.name}
                    </span>
                    <span className="text-muted mt-1 block text-xs">
                      {candidateStageLabels[row.stage]} · {row.education}
                    </span>
                  </button>
                  <ScoreBadge row={row} />
                </div>
                {row.isReferred || row.tags.length ? (
                  <div className="mt-2 flex flex-wrap gap-1 pl-7">
                    {row.isReferred ? (
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                        Indicação
                      </span>
                    ) : null}
                    {row.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="bg-surface text-muted rounded-full px-2 py-0.5 text-[10px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 grid gap-2">
                  {row.resumeId ? (
                    <Link
                      href={`/api/admin/rh/curriculos/${row.resumeId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-brand/30 text-brand-dark inline-flex min-h-9 items-center justify-center rounded-lg border bg-white px-3 text-xs font-bold"
                    >
                      Ver currículo
                    </Link>
                  ) : (
                    <span className="border-border-light text-muted inline-flex min-h-9 items-center justify-center rounded-lg border text-xs">
                      Currículo indisponível
                    </span>
                  )}
                  {canQuickDecide(row.stage) ? (
                    <form
                      action={formAction}
                      onSubmit={(event) => confirmQuickDecision(event, row)}
                      className="grid grid-cols-2 gap-2"
                    >
                      <input type="hidden" name="job_id" value={jobId} />
                      <input
                        type="hidden"
                        name="application_ids"
                        value={JSON.stringify([row.applicationId])}
                      />
                      <input
                        type="hidden"
                        name="expected_stage"
                        value={row.stage}
                      />
                      <button
                        name="operation"
                        value="approve"
                        disabled={pending}
                        className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {processing?.applicationIds.includes(
                          row.applicationId,
                        ) && processing.operation === "approve"
                          ? "Processando…"
                          : "✓ Aprovar"}
                      </button>
                      <button
                        name="operation"
                        value="not_approve"
                        disabled={pending}
                        className="bg-error min-h-9 rounded-lg px-3 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {processing?.applicationIds.includes(
                          row.applicationId,
                        ) && processing.operation === "not_approve"
                          ? "Processando…"
                          : "✕ Reprovar"}
                      </button>
                    </form>
                  ) : (
                    <span
                      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-bold ${row.stage === "hired" ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
                    >
                      {row.stage === "hired"
                        ? "✓ Contratado"
                        : "✕ Não aprovado"}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {selected.length ? (
        <form
          action={formAction}
          onSubmit={(event) => {
            const operation = (event.nativeEvent as SubmitEvent)
              .submitter as HTMLButtonElement | null;
            if (
              operation?.value &&
              !window.confirm(
                `Confirmar “${operation.textContent?.trim()}” para ${selected.length} candidatura(s)?`,
              )
            ) {
              event.preventDefault();
            }
          }}
          className="border-brand/20 fixed right-4 bottom-4 left-4 z-30 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-2xl lg:left-[calc(var(--admin-sidebar-width,0px)+1rem)]"
        >
          <input type="hidden" name="job_id" value={jobId} />
          <input
            type="hidden"
            name="application_ids"
            value={JSON.stringify(selected)}
          />
          <input type="hidden" name="expected_stage" value={selectedStage} />
          <strong className="text-brand-dark mr-2 text-sm">
            {selected.length} selecionado(s)
          </strong>
          <button
            name="operation"
            value="approve"
            disabled={!canMove || pending}
            className="bg-brand disabled:bg-muted min-h-9 rounded-full px-4 text-xs font-bold text-white"
          >
            Avançar etapa
          </button>
          <button
            name="operation"
            value="not_approve"
            disabled={!canMove || pending}
            className="border-error/30 text-error min-h-9 rounded-full border px-4 text-xs font-bold disabled:opacity-40"
          >
            Não aprovar
          </button>
          <input
            name="internal_note"
            aria-label="Observação interna para não aprovação"
            placeholder="Observação interna"
            maxLength={4000}
            className="border-border-light min-h-9 w-40 rounded-full border px-3 text-xs"
          />
          <button
            name="operation"
            value="send_communication"
            disabled={pending}
            className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold"
          >
            Enviar comunicação
          </button>
          <input
            name="value"
            aria-label="Marcador"
            placeholder="Marcador"
            maxLength={40}
            className="border-border-light min-h-9 w-32 rounded-full border px-3 text-xs"
          />
          <button
            name="operation"
            value="add_tag"
            disabled={pending}
            className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold"
          >
            Adicionar tag
          </button>
          <button
            name="operation"
            value="remove_tag"
            disabled={pending}
            className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold"
          >
            Remover tag
          </button>
          <button
            name="operation"
            value="favorite"
            disabled={pending}
            className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold"
          >
            Favoritar
          </button>
          <button
            name="operation"
            value="unfavorite"
            disabled={pending}
            className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold"
          >
            Desfavoritar
          </button>
          <button
            type="button"
            onClick={exportSelection}
            className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold"
          >
            Exportar
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-muted ml-auto min-h-9 px-2 text-xs font-bold"
          >
            Limpar
          </button>
        </form>
      ) : null}

      {activeRow ? (
        <div className="fixed inset-0 z-40 bg-black/30" role="presentation">
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Perfil rápido de ${activeRow.name}`}
            className="absolute top-0 right-0 h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-muted text-xs font-bold uppercase">
                  Perfil rápido
                </p>
                <h2 className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
                  {activeRow.name}
                </h2>
                <p className="text-muted mt-1 text-sm">
                  {candidateStageLabels[activeRow.stage]} · candidatura em{" "}
                  {new Date(activeRow.submittedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar perfil rápido"
                onClick={() => setActiveRow(null)}
                className="border-border-light size-10 rounded-full border text-xl"
              >
                ×
              </button>
            </div>
            <div className="border-border-light mt-6 flex gap-1 border-b">
              {(
                [
                  ["summary", "Resumo"],
                  ["match", "Aderência"],
                  ["hiring", "Contratação"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setDrawerTab(value)}
                  className={`border-b-2 px-3 py-3 text-sm font-bold ${drawerTab === value ? "border-brand text-brand" : "text-muted border-transparent"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {drawerTab === "summary" ? (
              <dl className="mt-6 grid gap-5 text-sm">
                {[
                  ["Objetivo", activeRow.objective],
                  ["Formação", activeRow.education],
                  ["Experiência relevante", activeRow.relevantExperience],
                  [
                    "Tempo de experiência",
                    formatExperience(activeRow.experienceMonths),
                  ],
                  ["Disponibilidade", activeRow.availability],
                  [
                    "Turnos",
                    activeRow.availabilityShifts.length
                      ? activeRow.availabilityShifts
                          .map((item) => shiftLabels[item] ?? item)
                          .join(", ")
                      : "Não identificado",
                  ],
                  ["Indicação", activeRow.referredBy ?? "Não informada"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-muted text-xs font-bold uppercase">
                      {label}
                    </dt>
                    <dd className="text-ink mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : drawerTab === "match" ? (
              <div className="mt-6">
                <ScoreBadge row={activeRow} />
                <p className="text-muted mt-2 text-sm">
                  Cobertura das informações: {activeRow.informationCoverage}%.
                  Este indicador apoia a análise e não decide a candidatura.
                </p>
                <ul className="mt-5 grid gap-3">
                  {activeRow.match?.items.map((item) => (
                    <li
                      key={item.key}
                      className="border-border-light rounded-xl border p-3"
                    >
                      <div className="flex justify-between gap-3 text-sm font-bold">
                        <span>{item.label}</span>
                        <span>{matchStatusLabels[item.status]}</span>
                      </div>
                      {item.evidence[0] ? (
                        <p className="text-muted mt-2 text-xs">
                          {item.evidence[0].text}
                        </p>
                      ) : null}
                    </li>
                  )) ?? (
                    <li className="text-muted text-sm">
                      Aderência ainda não calculada.
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <div className="mt-6">
                <h3 className="text-brand-dark font-bold">
                  Checklist de contratação
                </h3>
                <p className="text-muted mt-2 text-sm">
                  Documentos, aprovações, observações e status podem ser
                  acompanhados sem misturar esses dados à pontuação de
                  aderência.
                </p>
                <pre className="bg-surface text-ink mt-4 overflow-auto rounded-xl p-4 text-xs">
                  {Object.keys(activeRow.hiringChecklist).length
                    ? JSON.stringify(activeRow.hiringChecklist, null, 2)
                    : "Nenhuma informação registrada."}
                </pre>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/admin/rh/vagas/${jobId}/candidaturas/${activeRow.applicationId}`}
                className="bg-brand inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-white"
              >
                Abrir perfil completo
              </Link>
              {activeRow.resumeId ? (
                <a
                  href={`/api/admin/rh/curriculos/${activeRow.resumeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
                >
                  Currículo original
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
