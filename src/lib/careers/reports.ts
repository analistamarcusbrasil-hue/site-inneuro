import {
  applicationStatuses,
  candidateStageLabels,
  careerApplicationSnapshotSchema,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import {
  applicationSources,
  commuteFeasibilities,
  commuteTimes,
  transitBenefitOptions,
  type ApplicationSource,
  type CommuteFeasibility,
  type CommuteTime,
  type TransitBenefit,
} from "@/lib/careers/logistics";

export const reportNotInformedValue = "not_informed";

export type CareerReportDimension =
  | "status"
  | "stage"
  | "source"
  | "commute"
  | "commute_time"
  | "transit_benefit";

export type CareerReportSort = "recent" | "oldest" | "name";

export type CareerReportJob = {
  id: string;
  title: string;
  area_id: string;
  unit_id: string | null;
};

export type CareerReportApplication = {
  id: string;
  job_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  source: ApplicationSource | string | null;
  profile_snapshot: unknown;
  candidate_stage: CareerJobApplication["candidate_stage"];
  submitted_at: string;
};

export type CareerReportProcessCandidate = {
  application_id: string;
  process_id: string;
  stage: string;
};

export type CareerReportLogistics = {
  application_id: string;
  commute_feasibility: CommuteFeasibility | null;
  commute_time: CommuteTime | null;
  transit_benefit: TransitBenefit | null;
};

export type CareerReportFilters = {
  inicio?: string;
  fim?: string;
  unidade?: string;
  area?: string;
  vaga?: string;
  processo?: string;
  status?: string;
  etapa?: string;
  grupo?: string;
  valor?: string;
  busca?: string;
  ordem?: string;
  pagina_drill?: string;
};

export type CareerReportRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  candidateName: string;
  currentStage: CareerJobApplication["candidate_stage"];
  status: ApplicationStatus;
  source: ApplicationSource | string | null;
  submitted_at: string;
  job: CareerReportJob;
  process: CareerReportProcessCandidate | null;
  logistics: CareerReportLogistics | null;
};

const allowedDimensionValues: Record<CareerReportDimension, Set<string>> = {
  status: new Set(applicationStatuses),
  stage: new Set(Object.keys(candidateStageLabels)),
  source: new Set(applicationSources),
  commute: new Set(commuteFeasibilities),
  commute_time: new Set(commuteTimes),
  transit_benefit: new Set(transitBenefitOptions),
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function normalizeDimensionValue(
  dimension: CareerReportDimension,
  value: string | null | undefined,
) {
  return value && allowedDimensionValues[dimension].has(value)
    ? value
    : reportNotInformedValue;
}

export function getCareerReportDimensionValue(
  row: CareerReportRow,
  dimension: CareerReportDimension,
) {
  const value =
    dimension === "status"
      ? row.status
      : dimension === "stage"
        ? row.currentStage
        : dimension === "source"
          ? row.source
          : dimension === "commute"
            ? row.logistics?.commute_feasibility
            : dimension === "commute_time"
              ? row.logistics?.commute_time
              : row.logistics?.transit_benefit;
  return normalizeDimensionValue(dimension, value);
}

export function buildCareerReportRows({
  applications,
  jobs,
  processCandidates,
  logistics,
  filters,
}: {
  applications: CareerReportApplication[];
  jobs: CareerReportJob[];
  processCandidates: CareerReportProcessCandidate[];
  logistics: CareerReportLogistics[];
  filters: CareerReportFilters;
}) {
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const processByApplication = new Map(
    processCandidates.map((item) => [item.application_id, item]),
  );
  const logisticsByApplication = new Map(
    logistics.map((item) => [item.application_id, item]),
  );
  const start = filters.inicio ? `${filters.inicio}T00:00:00.000Z` : null;
  const end = filters.fim ? `${filters.fim}T23:59:59.999Z` : null;

  return applications.flatMap((application): CareerReportRow[] => {
    const job = jobById.get(application.job_id);
    if (!job) return [];
    const process = processByApplication.get(application.id) ?? null;
    if (start && application.submitted_at < start) return [];
    if (end && application.submitted_at > end) return [];
    if (filters.unidade && job.unit_id !== filters.unidade) return [];
    if (filters.area && job.area_id !== filters.area) return [];
    if (filters.vaga && job.id !== filters.vaga) return [];
    if (filters.processo && process?.process_id !== filters.processo) return [];
    if (filters.status && application.status !== filters.status) return [];
    if (filters.etapa && application.candidate_stage !== filters.etapa)
      return [];
    const snapshot = careerApplicationSnapshotSchema.safeParse(
      application.profile_snapshot,
    );
    return [
      {
        id: application.id,
        job_id: application.job_id,
        candidate_id: application.candidate_id,
        candidateName:
          snapshot.success && snapshot.data.candidate.full_name.trim()
            ? snapshot.data.candidate.full_name.trim()
            : "Nome não identificado",
        currentStage: application.candidate_stage,
        status: application.status,
        source: application.source,
        submitted_at: application.submitted_at,
        job,
        process,
        logistics: logisticsByApplication.get(application.id) ?? null,
      },
    ];
  });
}

export function countCareerReportDimension(
  rows: CareerReportRow[],
  dimension: CareerReportDimension,
) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const key = getCareerReportDimensionValue(row, dimension);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

export function filterAndSortCareerReportDrilldown(
  rows: CareerReportRow[],
  options: {
    dimension: CareerReportDimension;
    value: string;
    search?: string;
    sort?: CareerReportSort;
  },
) {
  const search = normalizeSearch(options.search ?? "");
  return rows
    .filter(
      (row) =>
        getCareerReportDimensionValue(row, options.dimension) ===
          options.value &&
        (!search ||
          normalizeSearch(`${row.candidateName} ${row.job.title}`).includes(
            search,
          )),
    )
    .sort((a, b) => {
      if (options.sort === "name")
        return a.candidateName.localeCompare(b.candidateName, "pt-BR");
      if (options.sort === "oldest")
        return a.submitted_at.localeCompare(b.submitted_at);
      return b.submitted_at.localeCompare(a.submitted_at);
    });
}
