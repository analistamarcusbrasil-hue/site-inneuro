import type { ApplicationStatus } from "@/lib/careers/applications";
import type {
  ApplicationSource,
  CommuteFeasibility,
  CommuteTime,
  TransitBenefit,
} from "@/lib/careers/logistics";

export type CareerReportJob = {
  id: string;
  title: string;
  area_id: string;
  unit_id: string | null;
};

export type CareerReportApplication = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  source: ApplicationSource;
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
};

export type CareerReportRow = CareerReportApplication & {
  job: CareerReportJob;
  process: CareerReportProcessCandidate | null;
  logistics: CareerReportLogistics | null;
};

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
  const end = filters.fim ? `${filters.fim}T23:59:59.999Z` : null;

  return applications.flatMap((application): CareerReportRow[] => {
    const job = jobById.get(application.job_id);
    if (!job) return [];
    const process = processByApplication.get(application.id) ?? null;
    if (filters.inicio && application.submitted_at < filters.inicio) return [];
    if (end && application.submitted_at > end) return [];
    if (filters.unidade && job.unit_id !== filters.unidade) return [];
    if (filters.area && job.area_id !== filters.area) return [];
    if (filters.vaga && job.id !== filters.vaga) return [];
    if (filters.processo && process?.process_id !== filters.processo) return [];
    if (filters.status && application.status !== filters.status) return [];
    if (filters.etapa && process?.stage !== filters.etapa) return [];
    return [
      {
        ...application,
        job,
        process,
        logistics: logisticsByApplication.get(application.id) ?? null,
      },
    ];
  });
}

export function countBy<T extends string>(values: Array<T | null | undefined>) {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = value ?? "not_informed";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
