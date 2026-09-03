import { Download } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ReportBreakdown } from "@/components/admin/careers/report-breakdown";
import {
  ReportDrilldownDrawer,
  reportDimensionTitles,
  reportNotInformedLabel,
} from "@/components/admin/careers/report-drilldown-drawer";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  applicationStatuses,
  candidateStageLabels,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  applicationSourceLabels,
  commuteFeasibilityLabels,
  commuteTimeLabels,
  transitBenefitLabels,
} from "@/lib/careers/logistics";
import {
  buildCareerReportRows,
  countCareerReportDimension,
  filterAndSortCareerReportDrilldown,
  reportNotInformedValue,
  type CareerReportApplication,
  type CareerReportDimension,
  type CareerReportFilters,
  type CareerReportJob,
  type CareerReportLogistics,
  type CareerReportProcessCandidate,
  type CareerReportSort,
} from "@/lib/careers/reports";

const reportDimensions: CareerReportDimension[] = [
  "status",
  "stage",
  "source",
  "commute",
  "commute_time",
  "transit_benefit",
];

const mainFilterKeys = [
  "inicio",
  "fim",
  "unidade",
  "area",
  "vaga",
  "processo",
  "status",
  "etapa",
] as const;

function isReportDimension(
  value: string | undefined,
): value is CareerReportDimension {
  return reportDimensions.includes(value as CareerReportDimension);
}

function isReportSort(value: string | undefined): value is CareerReportSort {
  return ["recent", "oldest", "name"].includes(value ?? "");
}

function queryFromFilters(filters: CareerReportFilters) {
  const query: Record<string, string> = {};
  for (const key of mainFilterKeys) {
    const value = filters[key];
    if (value) query[key] = value;
  }
  return query;
}

const labelsByDimension: Record<
  CareerReportDimension,
  Record<string, string>
> = {
  status: { ...applicationStatusLabels, ...reportNotInformedLabel },
  stage: { ...candidateStageLabels, ...reportNotInformedLabel },
  source: { ...applicationSourceLabels, ...reportNotInformedLabel },
  commute: { ...commuteFeasibilityLabels, ...reportNotInformedLabel },
  commute_time: { ...commuteTimeLabels, ...reportNotInformedLabel },
  transit_benefit: { ...transitBenefitLabels, ...reportNotInformedLabel },
};

export default async function CareersReportsPage({
  searchParams,
}: {
  searchParams: Promise<CareerReportFilters>;
}) {
  const { supabase, hrRole } = await requireHrAccess("reports:view");
  const filters = await searchParams;
  const [
    units,
    areas,
    jobsResult,
    processes,
    applications,
    processCandidates,
    logistics,
  ] = await Promise.all([
    supabase.from("company_units").select("id, name").order("name"),
    supabase.from("career_job_areas").select("id, name").order("name"),
    supabase
      .from("career_jobs")
      .select("id, title, area_id, unit_id")
      .order("title"),
    supabase
      .from("career_selection_processes")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase
      .from("career_job_applications")
      .select(
        "id, job_id, candidate_id, status, source, profile_snapshot, candidate_stage, submitted_at",
      ),
    supabase
      .from("career_selection_process_candidates")
      .select("application_id, process_id, stage"),
    supabase
      .from("career_application_logistics")
      .select(
        "application_id, commute_feasibility, commute_time, transit_benefit",
      ),
  ]);
  const rows = buildCareerReportRows({
    applications: (applications.data as CareerReportApplication[] | null) ?? [],
    jobs: (jobsResult.data as CareerReportJob[] | null) ?? [],
    processCandidates:
      (processCandidates.data as CareerReportProcessCandidate[] | null) ?? [],
    logistics: (logistics.data as CareerReportLogistics[] | null) ?? [],
    filters,
  });
  const baseFilters = queryFromFilters(filters);
  const exportQuery = new URLSearchParams(baseFilters).toString();
  const countsByDimension = Object.fromEntries(
    reportDimensions.map((dimension) => [
      dimension,
      countCareerReportDimension(rows, dimension),
    ]),
  ) as Record<CareerReportDimension, Record<string, number>>;
  const selectedDimension = isReportDimension(filters.grupo)
    ? filters.grupo
    : null;
  const selectedValue =
    selectedDimension && filters.valor ? filters.valor : null;
  const selectedSort = isReportSort(filters.ordem) ? filters.ordem : "recent";
  const pageSize = 25;
  const drilldownRows =
    selectedDimension && selectedValue
      ? filterAndSortCareerReportDrilldown(rows, {
          dimension: selectedDimension,
          value: selectedValue,
          search: filters.busca,
          sort: selectedSort,
        })
      : [];
  const requestedPage = Math.max(1, Number(filters.pagina_drill) || 1);
  const drilldownPages = Math.max(
    1,
    Math.ceil(drilldownRows.length / pageSize),
  );
  const drilldownPage = Math.min(requestedPage, drilldownPages);
  const visibleDrilldownRows = drilldownRows.slice(
    (drilldownPage - 1) * pageSize,
    drilldownPage * pageSize,
  );
  const drilldownQuery =
    selectedDimension && selectedValue
      ? {
          ...baseFilters,
          grupo: selectedDimension,
          valor: selectedValue,
          ...(filters.busca ? { busca: filters.busca } : {}),
          ...(selectedSort !== "recent" ? { ordem: selectedSort } : {}),
        }
      : baseFilters;
  const dataError = [
    jobsResult,
    applications,
    processCandidates,
    logistics,
  ].some((result) => result.error);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Relatórios"
        description="Acompanhe indicadores reais e exporte dados mínimos, sem currículo, telefone ou e-mail."
      />
      <HrNavigation
        current="reports"
        canManageJobs
        canManageCandidates
        canViewReports
        canManageSettings={hrRole === "administrator"}
      />

      <form className="border-border-light grid gap-4 rounded-3xl border bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-bold">
          Início
          <input
            type="date"
            name="inicio"
            defaultValue={filters.inicio ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold">
          Fim
          <input
            type="date"
            name="fim"
            defaultValue={filters.fim ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <label className="text-sm font-bold">
          Unidade
          <select
            name="unidade"
            defaultValue={filters.unidade ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todas</option>
            {units.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Área
          <select
            name="area"
            defaultValue={filters.area ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todas</option>
            {areas.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Vaga
          <select
            name="vaga"
            defaultValue={filters.vaga ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todas</option>
            {jobsResult.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Processo
          <select
            name="processo"
            defaultValue={filters.processo ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todos</option>
            {processes.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Status
          <select
            name="status"
            defaultValue={filters.status ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todos</option>
            {applicationStatuses.map((status) => (
              <option key={status} value={status}>
                {applicationStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold">
          Etapa
          <select
            name="etapa"
            defaultValue={filters.etapa ?? ""}
            className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
          >
            <option value="">Todas</option>
            {Object.entries(candidateStageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-4">
          <button className="bg-brand min-h-11 rounded-full px-6 text-sm font-bold text-white">
            Aplicar filtros
          </button>
          <a
            href={`/api/admin/rh/relatorios/csv${exportQuery ? `?${exportQuery}` : ""}`}
            className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center gap-2 rounded-full border px-6 text-sm font-bold"
          >
            <Download size={17} aria-hidden="true" />
            Exportar CSV
          </a>
        </div>
      </form>

      <section
        className="mt-6 grid gap-4 sm:grid-cols-3"
        aria-label="Resumo filtrado"
      >
        {[
          ["Candidaturas", rows.length],
          ["Em processos", rows.filter((row) => row.process).length],
          [
            "Selecionados",
            rows.filter((row) => row.currentStage === "hired").length,
          ],
        ].map(([label, value]) => (
          <article
            key={label}
            className="border-border-light rounded-3xl border bg-white p-5"
          >
            <p className="text-muted text-sm">{label}</p>
            <p className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
              {Number(value).toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
      </section>

      {dataError ? (
        <p className="border-danger/20 bg-danger/5 text-danger mt-6 rounded-2xl border p-4 text-sm">
          {selectedDimension
            ? "Não foi possível carregar os candidatos deste agrupamento."
            : "Não foi possível carregar os candidatos deste relatório."}
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportDimensions.map((dimension) => (
            <ReportBreakdown
              key={dimension}
              title={reportDimensionTitles[dimension]}
              dimension={dimension}
              counts={countsByDimension[dimension]}
              labels={labelsByDimension[dimension]}
              filters={baseFilters}
            />
          ))}
        </div>
      )}

      <p className="border-brand/15 bg-mint/60 text-brand-dark mt-6 rounded-2xl border p-4 text-sm">
        Indicadores logísticos são operacionais e não representam valor
        profissional. Meio de transporte não é usado para ranquear candidatos.
      </p>

      {!dataError && selectedDimension && selectedValue ? (
        <ReportDrilldownDrawer
          dimension={selectedDimension}
          valueLabel={
            labelsByDimension[selectedDimension][selectedValue] ??
            labelsByDimension[selectedDimension][reportNotInformedValue]
          }
          groupTotal={countsByDimension[selectedDimension][selectedValue] ?? 0}
          filteredTotal={drilldownRows.length}
          rows={visibleDrilldownRows}
          search={filters.busca ?? ""}
          sort={selectedSort}
          page={drilldownPage}
          pageSize={pageSize}
          query={drilldownQuery}
          closeHref={`/admin/rh/relatorios${exportQuery ? `?${exportQuery}` : ""}`}
          exportHref={`/api/admin/rh/relatorios/csv?${new URLSearchParams({
            ...baseFilters,
            grupo: selectedDimension,
            valor: selectedValue,
          }).toString()}`}
        />
      ) : null}
    </>
  );
}
