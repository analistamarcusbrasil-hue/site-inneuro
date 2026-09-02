"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import {
  bulkCareerApplicationsAction,
  type BulkCareerApplicationsState,
} from "@/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions";
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

export function CandidateOperationsCenter({
  jobId,
  rows,
  total,
}: {
  jobId: string;
  rows: AtsCandidateRow[];
  total: number;
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeRow, setActiveRow] = useState<AtsCandidateRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<"summary" | "match" | "hiring">(
    "summary",
  );
  const [state, formAction, pending] = useActionState(
    async (previousState: BulkCareerApplicationsState, formData: FormData) => {
      const nextState = await bulkCareerApplicationsAction(
        previousState,
        formData,
      );
      if (nextState.status === "success") {
        setSelected([]);
        router.refresh();
      }
      return nextState;
    },
    initialState,
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.includes(row.applicationId)),
    [rows, selected],
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

  function exportSelection() {
    const exported = selectedRows.length ? selectedRows : rows;
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

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted text-sm">
          {total} resultado(s) · {selected.length} selecionado(s) nesta página
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

      {view === "kanban" ? (
        <div className="grid gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          {stages.map((stage) => {
            const stageRows = rows.filter((row) => row.stage === stage);
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
              <thead className="bg-surface text-brand-dark text-xs uppercase">
                <tr>
                  <th className="w-12 px-4 py-4">
                    <input
                      aria-label="Selecionar todos os resultados desta página"
                      type="checkbox"
                      checked={
                        rows.length > 0 && selected.length === rows.length
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? rows.map((row) => row.applicationId)
                            : [],
                        )
                      }
                      className="accent-brand size-4"
                    />
                  </th>
                  <th className="w-[27%] px-3 py-4">Candidato</th>
                  <th className="w-[22%] px-3 py-4">Perfil</th>
                  <th className="w-[16%] px-3 py-4">Etapa</th>
                  <th className="w-[13%] px-3 py-4">Aderência</th>
                  <th className="px-3 py-4">Marcadores</th>
                </tr>
              </thead>
              <tbody className="divide-border-light divide-y">
                {rows.map((row) => (
                  <tr key={row.applicationId} className="align-top">
                    <td className="px-4 py-4">
                      <input
                        aria-label={`Selecionar ${row.name}`}
                        type="checkbox"
                        checked={selected.includes(row.applicationId)}
                        onChange={() => toggle(row.applicationId)}
                        className="accent-brand size-4"
                      />
                    </td>
                    <td className="px-3 py-4">
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
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-ink line-clamp-2">
                        {row.education}
                      </span>
                      <span className="text-muted mt-1 block text-xs">
                        {formatExperience(row.experienceMonths)}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className="text-ink font-bold">
                        {candidateStageLabels[row.stage]}
                      </span>
                      <span className="text-muted mt-1 block text-xs">
                        {applicationStatusLabels[row.status]}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <ScoreBadge row={row} />
                      <span className="text-muted mt-1 block text-xs">
                        Cobertura {row.informationCoverage}%
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-1">
                        {row.isReferred ? (
                          <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-900">
                            Indicação
                          </span>
                        ) : null}
                        {row.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="bg-surface text-muted rounded-full px-2 py-1 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <article
                key={row.applicationId}
                className="border-border-light rounded-2xl border bg-white p-4"
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
