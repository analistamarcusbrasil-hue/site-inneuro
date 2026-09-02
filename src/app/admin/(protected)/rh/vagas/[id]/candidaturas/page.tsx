import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  CandidateOperationsCenter,
  type AtsCandidateRow,
} from "@/components/admin/careers/candidate-operations-center";
import { CandidatePipelineNav } from "@/components/admin/careers/candidate-pipeline-nav";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatuses,
  applicationStatusLabels,
  candidateStageLabels,
  careerApplicationSnapshotSchema,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import { buildJobCandidateReportRows } from "@/lib/careers/job-candidate-report";

type SearchRow = {
  application_id: string;
  candidate_id: string;
  status: ApplicationStatus;
  candidate_stage: CareerJobApplication["candidate_stage"];
  profile_snapshot: unknown;
  submitted_at: string;
  is_referred: boolean;
  referred_by: string | null;
  is_favorite: boolean;
  tags: string[];
  availability_shifts: string[];
  hiring_checklist: Record<string, unknown>;
  experience_months: number;
  match_score: number | null;
  match_result: unknown;
  resume_id: string | null;
  total_count: number;
};

type PipelineRow = {
  candidate_stage: CareerJobApplication["candidate_stage"];
  candidate_count: number;
};

type Query = Record<string, string | string[] | undefined>;

function queryValue(query: Query, key: string) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(
  value: string | undefined,
  values: readonly T[],
) {
  return value && values.includes(value as T) ? (value as T) : undefined;
}

function queryHref(query: Query, changes: Record<string, string | null>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, rawValue]) => {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value) params.set(key, value);
  });
  Object.entries(changes).forEach(([key, value]) => {
    if (value) params.set(key, value);
    else params.delete(key);
  });
  return `?${params.toString()}`;
}

const selectClass =
  "border-border-light min-h-11 w-full rounded-xl border bg-white px-3 text-sm";

export default async function CareerJobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Query>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, matrixResult] = await Promise.all([
    supabase
      .from("career_jobs")
      .select("id, title, vacancy_number")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("career_job_match_matrices")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id),
  ]);
  if (jobResult.error || !jobResult.data) notFound();

  const stage = oneOf(
    queryValue(query, "etapa"),
    Object.keys(
      candidateStageLabels,
    ) as CareerJobApplication["candidate_stage"][],
  );
  const status = oneOf(queryValue(query, "status"), applicationStatuses);
  const education = oneOf(queryValue(query, "escolaridade"), [
    "informed",
    "not_identified",
  ] as const);
  const customerService = oneOf(queryValue(query, "atendimento"), [
    "yes",
    "not_identified",
  ] as const);
  const similarRole = oneOf(queryValue(query, "funcao"), [
    "yes",
    "not_identified",
  ] as const);
  const healthExperience = oneOf(queryValue(query, "saude"), [
    "yes",
    "not_identified",
  ] as const);
  const shift = oneOf(queryValue(query, "turno"), [
    "morning",
    "afternoon",
    "night",
    "flexible",
  ] as const);
  const referral = oneOf(queryValue(query, "indicacao"), [
    "referred",
    "not_referred",
  ] as const);
  const sort =
    oneOf(queryValue(query, "ordem"), [
      "best_match",
      "newest",
      "oldest",
      "name",
    ] as const) ?? (matrixResult.count ? "best_match" : "newest");
  const pageSize = Number(
    oneOf(queryValue(query, "por_pagina"), ["25", "50", "100"] as const) ??
      "25",
  );
  const page = Math.max(
    1,
    Number.parseInt(queryValue(query, "pagina") ?? "1", 10) || 1,
  );
  const scoreMin = Number.parseInt(
    queryValue(query, "aderencia_min") ?? "",
    10,
  );
  const scoreMax = Number.parseInt(
    queryValue(query, "aderencia_max") ?? "",
    10,
  );
  const experienceYears = Number.parseInt(
    queryValue(query, "experiencia") ?? "",
    10,
  );

  const [searchResult, pipelineResult, allApplicationsResult] = await Promise.all([
    supabase.rpc("search_career_job_applications", {
      p_job_id: id,
      p_search: queryValue(query, "busca") || null,
      p_stage: stage ?? null,
      p_status: status ?? null,
      p_education: education ?? null,
      p_customer_service: customerService ?? null,
      p_similar_role: similarRole ?? null,
      p_health_experience: healthExperience ?? null,
      p_shift: shift ?? null,
      p_referral: referral ?? null,
      p_tag: queryValue(query, "tag") || null,
      p_score_min: Number.isFinite(scoreMin) ? scoreMin : null,
      p_score_max: Number.isFinite(scoreMax) ? scoreMax : null,
      p_experience_min_months: Number.isFinite(experienceYears)
        ? experienceYears * 12
        : null,
      p_submitted_from: queryValue(query, "de") || null,
      p_submitted_to: queryValue(query, "ate") || null,
      p_sort: sort,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    supabase.rpc("career_job_pipeline_summary", { p_job_id: id }),
    supabase
      .from("career_job_applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id),
  ]);

  const databaseRows = (searchResult.data as SearchRow[] | null) ?? [];
  const reportRows = buildJobCandidateReportRows({
    applications: databaseRows.map((row) => ({
      id: row.application_id,
      candidate_id: row.candidate_id,
      status: row.status,
      candidate_stage: row.candidate_stage,
      profile_snapshot: row.profile_snapshot,
      submitted_at: row.submitted_at,
    })),
    matchRuns: databaseRows.flatMap((row) =>
      row.match_score === null
        ? []
        : [
            {
              application_id: row.application_id,
              overall_score: row.match_score,
              result: row.match_result,
              calculated_at: row.submitted_at,
            },
          ],
    ),
    resumes: databaseRows.flatMap((row) =>
      row.resume_id
        ? [{ id: row.resume_id, candidate_id: row.candidate_id, version: 1 }]
        : [],
    ),
    jobTitle: jobResult.data.title,
  });
  const databaseById = new Map(
    databaseRows.map((row) => [row.application_id, row]),
  );
  const rows: AtsCandidateRow[] = reportRows.map((row) => {
    const databaseRow = databaseById.get(row.applicationId)!;
    const snapshot = careerApplicationSnapshotSchema.safeParse(
      databaseRow.profile_snapshot,
    );
    return {
      ...row,
      objective: snapshot.success
        ? snapshot.data.profile?.professional_objective?.trim() ||
          "Objetivo não informado"
        : "Objetivo não informado",
      experienceMonths: databaseRow.experience_months,
      availabilityShifts: databaseRow.availability_shifts ?? [],
      isReferred: databaseRow.is_referred,
      referredBy: databaseRow.referred_by,
      isFavorite: databaseRow.is_favorite,
      tags: databaseRow.tags ?? [],
      hiringChecklist: databaseRow.hiring_checklist ?? {},
    };
  });
  const total = Number(databaseRows[0]?.total_count ?? 0);
  const pipeline = new Map(
    ((pipelineResult.data as PipelineRow[] | null) ?? []).map((item) => [
      item.candidate_stage,
      Number(item.candidate_count),
    ]),
  );
  const pipelineCounts = Object.fromEntries(
    (
      Object.keys(
        candidateStageLabels,
      ) as CareerJobApplication["candidate_stage"][]
    ).map((candidateStage) => [candidateStage, pipeline.get(candidateStage) ?? 0]),
  ) as Record<CareerJobApplication["candidate_stage"], number>;
  const stageHrefs = Object.fromEntries(
    (
      Object.keys(
        candidateStageLabels,
      ) as CareerJobApplication["candidate_stage"][]
    ).map((candidateStage) => [
      candidateStage,
      queryHref(query, { etapa: candidateStage, pagina: null }),
    ]),
  ) as Record<CareerJobApplication["candidate_stage"], string>;
  const hasError =
    searchResult.error || pipelineResult.error || allApplicationsResult.error;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const activeFilters = [
    [
      "busca",
      queryValue(query, "busca"),
      `Busca: ${queryValue(query, "busca")}`,
    ],
    ["escolaridade", education, "Escolaridade"],
    ["atendimento", customerService, "Atendimento"],
    ["funcao", similarRole, "Função semelhante"],
    ["saude", healthExperience, "Experiência em saúde"],
    ["turno", shift, "Turno"],
    ["indicacao", referral, "Indicação"],
    ["tag", queryValue(query, "tag"), `Tag: ${queryValue(query, "tag")}`],
  ].filter((item) => item[1]);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas / Candidaturas"
        title={`Processo seletivo — ${jobResult.data.title}`}
        description={`${jobResult.data.vacancy_number} · Central operacional para busca, triagem e movimentações humanas auditáveis.`}
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      <div className="mb-5 flex flex-wrap gap-3">
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={`/admin/rh/vagas/${id}`}
        >
          Voltar para a vaga
        </Link>
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={`/admin/rh/vagas/${id}/aderencia`}
        >
          Matriz de aderência 2.0
        </Link>
      </div>

      <CandidatePipelineNav
        key={Object.entries(pipelineCounts)
          .map(([candidateStage, count]) => `${candidateStage}:${count}`)
          .join("|")}
        jobId={id}
        activeStage={stage ?? null}
        initialCounts={pipelineCounts}
        allCount={allApplicationsResult.count ?? 0}
        allHref={queryHref(query, { etapa: null, pagina: null })}
        stageHrefs={stageHrefs}
      />

      <aside className="border-brand/20 bg-mint/60 text-brand-dark mb-5 rounded-2xl border p-4 text-sm">
        A aderência é um apoio explicável à triagem. “Não identificado” não
        significa “não atende”; o sistema não aprova, rejeita ou movimenta
        candidatos automaticamente. Em “Melhores currículos”, a lista prioriza
        aderência com boa cobertura de informações e usa experiência como
        desempate, sempre do maior para o menor.
      </aside>

      <form className="border-border-light mb-4 rounded-2xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="text-ink grid gap-1 text-xs font-bold">
            Buscar candidatos
            <input
              name="busca"
              defaultValue={queryValue(query, "busca") ?? ""}
              placeholder="Nome, profissão, curso, habilidade ou experiência"
              className={selectClass}
            />
          </label>
          <label className="text-ink grid gap-1 text-xs font-bold">
            Ordenar por
            <select name="ordem" defaultValue={sort} className={selectClass}>
              <option value="best_match">Melhores currículos</option>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
              <option value="name">Nome</option>
            </select>
          </label>
          <button className="bg-brand hover:bg-brand-dark min-h-11 self-end rounded-full px-6 text-sm font-bold text-white">
            Buscar
          </button>
        </div>
        <details className="mt-3">
          <summary className="text-brand cursor-pointer text-sm font-bold">
            + Filtros profissionais
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-ink grid gap-1 text-xs font-bold">
              Escolaridade
              <select
                name="escolaridade"
                defaultValue={education ?? ""}
                className={selectClass}
              >
                <option value="">Todas</option>
                <option value="informed">Informada</option>
                <option value="not_identified">Não identificada</option>
              </select>
            </label>
            {[
              ["atendimento", "Atendimento", customerService],
              ["funcao", "Função semelhante", similarRole],
              ["saude", "Experiência em saúde", healthExperience],
            ].map(([name, label, value]) => (
              <label
                key={String(name)}
                className="text-ink grid gap-1 text-xs font-bold"
              >
                {label}
                <select
                  name={String(name)}
                  defaultValue={value ?? ""}
                  className={selectClass}
                >
                  <option value="">Todas</option>
                  <option value="yes">Identificada</option>
                  <option value="not_identified">Não identificada</option>
                </select>
              </label>
            ))}
            <label className="text-ink grid gap-1 text-xs font-bold">
              Turno disponível
              <select
                name="turno"
                defaultValue={shift ?? ""}
                className={selectClass}
              >
                <option value="">Todos</option>
                <option value="morning">Manhã</option>
                <option value="afternoon">Tarde</option>
                <option value="night">Noite</option>
                <option value="flexible">Flexível</option>
              </select>
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Indicação
              <select
                name="indicacao"
                defaultValue={referral ?? ""}
                className={selectClass}
              >
                <option value="">Todas</option>
                <option value="referred">Com indicação</option>
                <option value="not_referred">Sem indicação</option>
              </select>
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Status
              <select
                name="status"
                defaultValue={status ?? ""}
                className={selectClass}
              >
                <option value="">Todos</option>
                {applicationStatuses.map((value) => (
                  <option key={value} value={value}>
                    {applicationStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Experiência mínima
              <select
                name="experiencia"
                defaultValue={queryValue(query, "experiencia") ?? ""}
                className={selectClass}
              >
                <option value="">Qualquer</option>
                <option value="1">1 ano</option>
                <option value="2">2 anos</option>
                <option value="3">3 anos</option>
                <option value="5">5 anos</option>
              </select>
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Tag
              <input
                name="tag"
                defaultValue={queryValue(query, "tag") ?? ""}
                className={selectClass}
              />
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Aderência mínima
              <input
                type="number"
                min={0}
                max={100}
                name="aderencia_min"
                defaultValue={queryValue(query, "aderencia_min") ?? ""}
                className={selectClass}
              />
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Aderência máxima
              <input
                type="number"
                min={0}
                max={100}
                name="aderencia_max"
                defaultValue={queryValue(query, "aderencia_max") ?? ""}
                className={selectClass}
              />
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Candidatura desde
              <input
                type="date"
                name="de"
                defaultValue={queryValue(query, "de") ?? ""}
                className={selectClass}
              />
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Candidatura até
              <input
                type="date"
                name="ate"
                defaultValue={queryValue(query, "ate") ?? ""}
                className={selectClass}
              />
            </label>
            <label className="text-ink grid gap-1 text-xs font-bold">
              Resultados por página
              <select
                name="por_pagina"
                defaultValue={String(pageSize)}
                className={selectClass}
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
          </div>
        </details>
      </form>

      {activeFilters.length ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {activeFilters.map(([key, , label]) => (
            <Link
              key={String(key)}
              href={queryHref(query, { [String(key)]: null, pagina: null })}
              className="bg-surface text-brand-dark rounded-full px-3 py-2 text-xs font-bold"
            >
              {label} ×
            </Link>
          ))}
          <Link href="?" className="text-brand px-2 text-xs font-bold">
            Limpar filtros
          </Link>
        </div>
      ) : null}

      {hasError ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar a central de candidaturas. A migração do ATS
          precisa estar disponível neste ambiente.
        </p>
      ) : rows.length ? (
        <CandidateOperationsCenter
          key={`${stage ?? "all"}:${total}:${rows.map((row) => `${row.applicationId}:${row.stage}`).join("|")}`}
          jobId={id}
          rows={rows}
          total={total}
          activeStage={stage ?? null}
        />
      ) : (
        <section className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Nenhum perfil encontrado
          </h2>
          <p className="text-muted mt-2 text-sm">
            Ajuste os filtros ou aguarde novas candidaturas.
          </p>
        </section>
      )}

      {!hasError && totalPages > 1 ? (
        <nav
          aria-label="Paginação"
          className="mt-6 flex items-center justify-between gap-4"
        >
          <Link
            aria-disabled={page <= 1}
            href={
              page <= 1 ? "#" : queryHref(query, { pagina: String(page - 1) })
            }
            className={`border-brand/30 text-brand-dark rounded-full border px-5 py-3 text-sm font-bold ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
          >
            Anterior
          </Link>
          <span className="text-muted text-sm">
            Página {page} de {totalPages}
          </span>
          <Link
            aria-disabled={page >= totalPages}
            href={
              page >= totalPages
                ? "#"
                : queryHref(query, { pagina: String(page + 1) })
            }
            className={`border-brand/30 text-brand-dark rounded-full border px-5 py-3 text-sm font-bold ${page >= totalPages ? "pointer-events-none opacity-40" : ""}`}
          >
            Próxima
          </Link>
        </nav>
      ) : null}
    </>
  );
}
