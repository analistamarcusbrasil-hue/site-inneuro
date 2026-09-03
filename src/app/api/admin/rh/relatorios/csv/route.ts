import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/cms/auth";
import {
  hasHrPermission,
  resolveHrAccessRole,
} from "@/lib/careers/hr-permissions";
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
  buildCareerReportRows,
  filterAndSortCareerReportDrilldown,
  type CareerReportApplication,
  type CareerReportDimension,
  type CareerReportFilters,
  type CareerReportJob,
  type CareerReportLogistics,
  type CareerReportProcessCandidate,
} from "@/lib/careers/reports";

const reportDimensions: CareerReportDimension[] = [
  "status",
  "stage",
  "source",
  "commute",
  "commute_time",
  "transit_benefit",
];

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session.user || !session.profile || !session.supabase) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const role = resolveHrAccessRole(session.profile);
  if (!hasHrPermission(role, "reports:view")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters: CareerReportFilters = Object.fromEntries(
    ["inicio", "fim", "unidade", "area", "vaga", "processo", "status", "etapa"]
      .map((key) => [key, url.searchParams.get(key) ?? ""])
      .filter(([, value]) => value),
  );
  const [jobs, applications, processCandidates, logistics] = await Promise.all([
    session.supabase.from("career_jobs").select("id, title, area_id, unit_id"),
    session.supabase
      .from("career_job_applications")
      .select(
        "id, job_id, candidate_id, status, source, profile_snapshot, candidate_stage, submitted_at",
      ),
    session.supabase
      .from("career_selection_process_candidates")
      .select("application_id, process_id, stage"),
    session.supabase
      .from("career_application_logistics")
      .select(
        "application_id, commute_feasibility, commute_time, transit_benefit",
      ),
  ]);
  if (
    [jobs, applications, processCandidates, logistics].some(
      (result) => result.error,
    )
  ) {
    return NextResponse.json(
      { error: "Relatório indisponível" },
      { status: 503 },
    );
  }
  const rows = buildCareerReportRows({
    applications: (applications.data as CareerReportApplication[] | null) ?? [],
    jobs: (jobs.data as CareerReportJob[] | null) ?? [],
    processCandidates:
      (processCandidates.data as CareerReportProcessCandidate[] | null) ?? [],
    logistics: (logistics.data as CareerReportLogistics[] | null) ?? [],
    filters,
  });
  const requestedDimension = url.searchParams.get("grupo");
  const requestedValue = url.searchParams.get("valor");
  const dimension = reportDimensions.includes(
    requestedDimension as CareerReportDimension,
  )
    ? (requestedDimension as CareerReportDimension)
    : null;
  const exportedRows =
    dimension && requestedValue
      ? filterAndSortCareerReportDrilldown(rows, {
          dimension,
          value: requestedValue,
        })
      : rows;
  const labelFor = (
    labels: Record<string, string>,
    value: string | null | undefined,
  ) => (value ? (labels[value] ?? "Não informado") : "Não informado");
  const header = [
    "candidatura_id",
    "candidato",
    "vaga",
    "data_envio",
    "status",
    "etapa",
    "origem",
    "deslocamento",
    "tempo_deslocamento",
    "vale_transporte",
  ];
  const body = exportedRows.map((row) =>
    [
      row.id,
      row.candidateName,
      row.job.title,
      row.submitted_at,
      applicationStatusLabels[row.status],
      candidateStageLabels[row.currentStage],
      labelFor(applicationSourceLabels, row.source),
      labelFor(commuteFeasibilityLabels, row.logistics?.commute_feasibility),
      labelFor(commuteTimeLabels, row.logistics?.commute_time),
      labelFor(transitBenefitLabels, row.logistics?.transit_benefit),
    ]
      .map(csvCell)
      .join(";"),
  );
  await session.supabase.from("audit_logs").insert({
    actor_id: session.user.id,
    action: "career_report_exported",
    entity_type: "career_report",
    after_data: {
      filters,
      drilldown: dimension ? { dimension, value: requestedValue } : null,
      row_count: exportedRows.length,
      fields: header,
    },
  });
  const content = `\uFEFF${header.map(csvCell).join(";")}\r\n${body.join("\r\n")}`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-carreiras-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
