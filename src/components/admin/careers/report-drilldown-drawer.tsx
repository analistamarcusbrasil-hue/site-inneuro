import Link from "next/link";
import { Download, Search, X } from "lucide-react";
import {
  applicationStatusLabels,
  candidateStageLabels,
} from "@/lib/careers/applications";
import {
  applicationSourceLabels,
  commuteFeasibilityLabels,
  commuteTimeLabels,
  transitBenefitLabels,
} from "@/lib/careers/logistics";
import {
  reportNotInformedValue,
  type CareerReportDimension,
  type CareerReportRow,
  type CareerReportSort,
} from "@/lib/careers/reports";
import { AdminDrawer } from "@/components/admin/ui";

export const reportDimensionTitles: Record<CareerReportDimension, string> = {
  status: "Status das candidaturas",
  stage: "Etapa atual",
  source: "Origem",
  commute: "Deslocamento",
  commute_time: "Tempo de deslocamento",
  transit_benefit: "Vale-transporte",
};

const notInformedLabel = "Não informado";

function labelFor(
  labels: Record<string, string>,
  value: string | null | undefined,
) {
  return value ? (labels[value] ?? notInformedLabel) : notInformedLabel;
}

function classificationReason(
  row: CareerReportRow,
  dimension: CareerReportDimension,
) {
  if (dimension === "status")
    return `Status atual da candidatura: ${applicationStatusLabels[row.status]}.`;
  if (dimension === "stage")
    return `Esta candidatura encontra-se atualmente na etapa ${candidateStageLabels[row.currentStage]}.`;
  if (dimension === "source")
    return `Origem registrada: ${labelFor(applicationSourceLabels, row.source)}.`;
  if (dimension === "commute")
    return `Possibilidade de deslocamento informada: ${labelFor(
      commuteFeasibilityLabels,
      row.logistics?.commute_feasibility,
    )}.`;
  if (dimension === "commute_time")
    return `Tempo de deslocamento informado: ${labelFor(
      commuteTimeLabels,
      row.logistics?.commute_time,
    )}.`;
  return `Resposta sobre vale-transporte: ${labelFor(
    transitBenefitLabels,
    row.logistics?.transit_benefit,
  )}.`;
}

function drilldownDescription(
  dimension: CareerReportDimension,
  valueLabel: string,
) {
  if (dimension === "status")
    return `Candidaturas cujo status atual é ${valueLabel}.`;
  if (dimension === "stage")
    return `Candidaturas que estão atualmente na etapa ${valueLabel}.`;
  if (dimension === "source")
    return `Candidaturas cuja origem registrada é ${valueLabel}.`;
  if (dimension === "commute")
    return `Candidaturas cuja possibilidade de deslocamento informada é ${valueLabel}.`;
  if (dimension === "commute_time")
    return `Candidaturas cujo tempo de deslocamento informado é ${valueLabel}.`;
  return `Candidaturas cuja resposta sobre vale-transporte é ${valueLabel}.`;
}

function ReportDrilldownCandidateRow({
  row,
  dimension,
}: {
  row: CareerReportRow;
  dimension: CareerReportDimension;
}) {
  const showLogistics = ["commute", "commute_time", "transit_benefit"].includes(
    dimension,
  );

  return (
    <article className="border-border-light rounded-2xl border p-4 sm:p-5">
      <h3 className="font-heading text-brand-dark text-lg font-semibold">
        {row.candidateName}
      </h3>
      <dl className="mt-4 grid gap-x-5 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Vaga</dt>
          <dd className="font-semibold">{row.job.title}</dd>
        </div>
        <div>
          <dt className="text-muted">Etapa atual</dt>
          <dd className="font-semibold">
            {candidateStageLabels[row.currentStage]}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="font-semibold">
            {applicationStatusLabels[row.status]}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Candidatura</dt>
          <dd className="font-semibold">
            {new Date(row.submitted_at).toLocaleDateString("pt-BR")}
          </dd>
        </div>
        {dimension === "status" || dimension === "source" ? (
          <div>
            <dt className="text-muted">Origem</dt>
            <dd className="font-semibold">
              {labelFor(applicationSourceLabels, row.source)}
            </dd>
          </div>
        ) : null}
        {showLogistics ? (
          <>
            <div>
              <dt className="text-muted">Deslocamento</dt>
              <dd className="font-semibold">
                {labelFor(
                  commuteFeasibilityLabels,
                  row.logistics?.commute_feasibility,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Tempo de deslocamento</dt>
              <dd className="font-semibold">
                {labelFor(commuteTimeLabels, row.logistics?.commute_time)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Vale-transporte</dt>
              <dd className="font-semibold">
                {labelFor(transitBenefitLabels, row.logistics?.transit_benefit)}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
      <div className="bg-surface mt-4 rounded-xl p-3 text-sm">
        <p className="text-brand-dark text-xs font-bold tracking-wide uppercase">
          Motivo da classificação
        </p>
        <p className="text-muted mt-1">
          {classificationReason(row, dimension)}
        </p>
      </div>
      <Link
        href={`/admin/rh/vagas/${row.job_id}/candidaturas/${row.id}`}
        className="border-brand/30 text-brand-dark hover:bg-mint mt-4 inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold"
      >
        Ver candidatura
      </Link>
    </article>
  );
}

function pageHref(query: Record<string, string>, page: number) {
  const params = new URLSearchParams(query);
  if (page > 1) params.set("pagina_drill", String(page));
  else params.delete("pagina_drill");
  return `/admin/rh/relatorios?${params.toString()}`;
}

export function ReportDrilldownDrawer({
  dimension,
  valueLabel,
  groupTotal,
  filteredTotal,
  rows,
  search,
  sort,
  page,
  pageSize,
  query,
  closeHref,
  exportHref,
}: {
  dimension: CareerReportDimension;
  valueLabel: string;
  groupTotal: number;
  filteredTotal: number;
  rows: CareerReportRow[];
  search: string;
  sort: CareerReportSort;
  page: number;
  pageSize: number;
  query: Record<string, string>;
  closeHref: string;
  exportHref: string;
}) {
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const first = filteredTotal ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, filteredTotal);

  return (
    <AdminDrawer
      closeHref={closeHref}
      labelledBy="report-drilldown-title"
      describedBy="report-drilldown-description"
    >
      <div className="relative min-h-full">
        <header className="border-border-light sticky top-0 z-10 border-b bg-white/95 p-5 backdrop-blur sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-brand text-xs font-bold tracking-widest uppercase">
                {reportDimensionTitles[dimension]}
              </p>
              <h2
                id="report-drilldown-title"
                className="font-heading text-brand-dark mt-2 text-2xl font-semibold"
              >
                {valueLabel}
              </h2>
              <p className="text-muted mt-1 text-sm">
                {groupTotal.toLocaleString("pt-BR")}{" "}
                {groupTotal === 1 ? "candidato" : "candidatos"}
              </p>
            </div>
            <Link
              href={closeHref}
              className="border-border-light hover:bg-surface grid size-11 shrink-0 place-items-center rounded-full border"
              aria-label="Fechar"
            >
              <X size={19} aria-hidden="true" />
            </Link>
          </div>
          <p
            id="report-drilldown-description"
            className="text-muted mt-3 text-sm"
          >
            {drilldownDescription(dimension, valueLabel)}
          </p>

          <form className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            {Object.entries(query)
              .filter(
                ([key]) => !["busca", "ordem", "pagina_drill"].includes(key),
              )
              .map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            <label className="relative">
              <span className="sr-only">Buscar por candidato ou vaga</span>
              <Search
                size={17}
                className="text-muted pointer-events-none absolute top-3.5 left-3"
                aria-hidden="true"
              />
              <input
                name="busca"
                defaultValue={search}
                placeholder="Buscar candidato ou vaga..."
                className="border-border-light min-h-11 w-full rounded-xl border pr-3 pl-10 text-sm"
              />
            </label>
            <label>
              <span className="sr-only">Ordenação</span>
              <select
                name="ordem"
                defaultValue={sort}
                className="border-border-light min-h-11 w-full rounded-xl border px-3 text-sm"
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigos</option>
                <option value="name">Nome A-Z</option>
              </select>
            </label>
            <button className="bg-brand min-h-11 rounded-xl px-4 text-sm font-bold text-white">
              Aplicar
            </button>
          </form>
          <a
            href={exportHref}
            className="text-brand-dark mt-4 inline-flex items-center gap-2 text-sm font-bold hover:underline"
          >
            <Download size={16} aria-hidden="true" />
            Exportar este agrupamento
          </a>
        </header>

        <div className="p-5 sm:p-7">
          {search ? (
            <p className="text-muted mb-4 text-sm">
              {filteredTotal.toLocaleString("pt-BR")} encontrado(s) de{" "}
              {groupTotal.toLocaleString("pt-BR")}.
            </p>
          ) : null}
          {rows.length ? (
            <div className="grid gap-4">
              {rows.map((row) => (
                <ReportDrilldownCandidateRow
                  key={row.id}
                  row={row}
                  dimension={dimension}
                />
              ))}
            </div>
          ) : (
            <div className="border-border-light rounded-2xl border p-6 text-center">
              <p className="font-heading text-brand-dark font-semibold">
                Nenhum candidato encontrado com os filtros atuais.
              </p>
            </div>
          )}

          {filteredTotal ? (
            <nav
              className="border-border-light mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5"
              aria-label="Paginação do detalhamento"
            >
              <p className="text-muted text-sm">
                {first.toLocaleString("pt-BR")}–{last.toLocaleString("pt-BR")}{" "}
                de {filteredTotal.toLocaleString("pt-BR")}
              </p>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Link
                    href={pageHref(query, page - 1)}
                    className="border-border-light inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold"
                  >
                    Anterior
                  </Link>
                ) : (
                  <span className="border-border-light text-muted inline-flex min-h-10 items-center rounded-full border px-4 text-sm opacity-50">
                    Anterior
                  </span>
                )}
                {page < totalPages ? (
                  <Link
                    href={pageHref(query, page + 1)}
                    className="border-border-light inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-bold"
                  >
                    Próxima
                  </Link>
                ) : (
                  <span className="border-border-light text-muted inline-flex min-h-10 items-center rounded-full border px-4 text-sm opacity-50">
                    Próxima
                  </span>
                )}
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </AdminDrawer>
  );
}

export const reportNotInformedLabel = {
  [reportNotInformedValue]: notInformedLabel,
};
