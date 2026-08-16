import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  candidateStageLabels,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  buildJobCandidateReportRows,
  filterAndSortJobCandidateReport,
  type JobCandidateReportFilters,
} from "@/lib/careers/job-candidate-report";

const statusClasses: Record<ApplicationStatus, string> = {
  submitted: "bg-sky-100 text-sky-800",
  screening: "bg-amber-100 text-amber-800",
  in_process: "bg-violet-100 text-violet-800",
  finalized: "bg-slate-100 text-slate-700",
  withdrawn: "bg-rose-100 text-rose-800",
};

const bandClasses = {
  high: "bg-emerald-100 text-emerald-800",
  intermediate: "bg-amber-100 text-amber-800",
  review: "bg-slate-100 text-slate-700",
};

const selectClass =
  "border-border-light min-h-11 rounded-xl border bg-white px-3 text-sm";

export default async function CareerJobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    erro?: string;
    ordem?: string;
    escolaridade?: string;
    atendimento?: string;
    funcao?: string;
    etapa?: string;
  }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, applicationsResult] = await Promise.all([
    supabase
      .from("career_jobs")
      .select("id, title, vacancy_number")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("career_job_applications")
      .select(
        "id, candidate_id, status, candidate_stage, profile_snapshot, submitted_at",
      )
      .eq("job_id", id)
      .order("submitted_at", { ascending: false }),
  ]);
  if (jobResult.error || !jobResult.data) notFound();
  const applications =
    (applicationsResult.data as CareerJobApplication[] | null) ?? [];
  const candidateIds = [
    ...new Set(applications.map((item) => item.candidate_id)),
  ];
  const applicationIds = applications.map((item) => item.id);
  const [matchRunsResult, resumesResult] = await Promise.all([
    applicationIds.length
      ? supabase
          .from("career_application_match_runs")
          .select("application_id, overall_score, result, calculated_at")
          .in("application_id", applicationIds)
          .order("calculated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    candidateIds.length
      ? supabase
          .from("candidate_resumes")
          .select("id, candidate_id, version")
          .in("candidate_id", candidateIds)
          .order("version", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  const reportRows = buildJobCandidateReportRows({
    applications,
    matchRuns: matchRunsResult.data ?? [],
    resumes: resumesResult.data ?? [],
    jobTitle: jobResult.data.title,
  });
  const activeApplications = applications.filter(
    (item) => !["finalized", "withdrawn"].includes(item.status),
  );
  const funnelSummary = {
    total: applications.filter((item) => item.status !== "withdrawn").length,
    resume: activeApplications.filter(
      (item) => item.candidate_stage === "resume",
    ).length,
    interview: activeApplications.filter(
      (item) => item.candidate_stage === "interview",
    ).length,
    practical_test: activeApplications.filter(
      (item) => item.candidate_stage === "practical_test",
    ).length,
    hiring: activeApplications.filter(
      (item) => item.candidate_stage === "hiring",
    ).length,
    not_approved: applications.filter(
      (item) => item.candidate_stage === "not_approved",
    ).length,
    hired: applications.filter((item) => item.candidate_stage === "hired")
      .length,
  };
  const filters: JobCandidateReportFilters = {
    sort: ["match", "date", "name"].includes(query.ordem ?? "")
      ? (query.ordem as JobCandidateReportFilters["sort"])
      : "date",
    education: ["informed", "not_identified"].includes(query.escolaridade ?? "")
      ? (query.escolaridade as JobCandidateReportFilters["education"])
      : undefined,
    customerService: ["yes", "not_identified"].includes(query.atendimento ?? "")
      ? (query.atendimento as JobCandidateReportFilters["customerService"])
      : undefined,
    similarRole: ["yes", "not_identified"].includes(query.funcao ?? "")
      ? (query.funcao as JobCandidateReportFilters["similarRole"])
      : undefined,
    stage: Object.hasOwn(candidateStageLabels, query.etapa ?? "")
      ? (query.etapa as JobCandidateReportFilters["stage"])
      : undefined,
  };
  const rows = filterAndSortJobCandidateReport(reportRows, filters);
  const hasError =
    applicationsResult.error || matchRunsResult.error || resumesResult.error;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas / Candidaturas"
        title={`Processo seletivo — ${jobResult.data.title}`}
        description={`${jobResult.data.vacancy_number} · Acompanhe as quatro etapas, filtre candidatos e registre decisões exclusivamente humanas.`}
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap gap-3">
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
          Configurar critérios da vaga
        </Link>
      </div>

      <section
        aria-label="Resumo das candidaturas"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      >
        {[
          ["Total", funnelSummary.total, ""],
          ["1. Currículo", funnelSummary.resume, "resume"],
          ["2. Entrevista", funnelSummary.interview, "interview"],
          ["3. Teste Prático", funnelSummary.practical_test, "practical_test"],
          ["4. Contratação", funnelSummary.hiring, "hiring"],
          ["Não aprovados", funnelSummary.not_approved, "not_approved"],
          ["Contratados", funnelSummary.hired, "hired"],
        ].map(([label, count, stage]) => (
          <Link
            key={String(label)}
            href={stage ? `?etapa=${stage}` : `?`}
            className={`hover:border-brand/50 rounded-2xl border bg-white p-5 transition ${filters.stage === stage || (!filters.stage && !stage) ? "border-brand ring-brand/10 ring-2" : "border-border-light"}`}
          >
            <p className="text-muted text-xs font-bold tracking-wide uppercase">
              {label}
            </p>
            <p className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
              {count}
            </p>
          </Link>
        ))}
      </section>

      <aside className="border-brand/20 bg-mint/60 text-brand-dark mb-6 rounded-2xl border p-4 text-sm">
        <strong>Indicador de apoio à triagem:</strong> usa somente requisitos
        profissionais da vaga e informações confirmadas pelo candidato. “Não
        identificado” não significa “não atende” e não gera decisão automática.
      </aside>

      <form className="border-border-light mb-6 grid gap-4 rounded-2xl border bg-white p-5 md:grid-cols-3 xl:grid-cols-6">
        <label className="text-ink grid gap-2 text-xs font-bold">
          Ordenar por
          <select
            className={selectClass}
            name="ordem"
            defaultValue={filters.sort}
          >
            <option value="date">Data da candidatura</option>
            <option value="match">Aderência</option>
            <option value="name">Nome</option>
          </select>
        </label>
        <label className="text-ink grid gap-2 text-xs font-bold">
          Escolaridade
          <select
            className={selectClass}
            name="escolaridade"
            defaultValue={filters.education ?? ""}
          >
            <option value="">Todas</option>
            <option value="informed">Informada</option>
            <option value="not_identified">Não identificada</option>
          </select>
        </label>
        <label className="text-ink grid gap-2 text-xs font-bold">
          Atendimento
          <select
            className={selectClass}
            name="atendimento"
            defaultValue={filters.customerService ?? ""}
          >
            <option value="">Todos</option>
            <option value="yes">Experiência identificada</option>
            <option value="not_identified">Não identificada</option>
          </select>
        </label>
        <label className="text-ink grid gap-2 text-xs font-bold">
          Função semelhante
          <select
            className={selectClass}
            name="funcao"
            defaultValue={filters.similarRole ?? ""}
          >
            <option value="">Todas</option>
            <option value="yes">Experiência identificada</option>
            <option value="not_identified">Não identificada</option>
          </select>
        </label>
        <label className="text-ink grid gap-2 text-xs font-bold">
          Etapa da seleção
          <select
            className={selectClass}
            name="etapa"
            defaultValue={filters.stage ?? ""}
          >
            <option value="">Todas</option>
            {Object.entries(candidateStageLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="bg-brand hover:bg-brand-dark min-h-11 self-end rounded-full px-5 text-sm font-bold text-white">
          Aplicar filtros
        </button>
      </form>

      {hasError ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar todos os dados das candidaturas.
        </p>
      ) : rows.length ? (
        <div className="border-border-light overflow-x-auto rounded-3xl border bg-white">
          <table className="w-full min-w-[1380px] text-left text-sm">
            <thead className="bg-surface text-brand-dark text-xs uppercase">
              <tr>
                {[
                  "Nome",
                  "Escolaridade",
                  "Experiência relevante",
                  "Experiência em atendimento",
                  "Experiência em função semelhante",
                  "Disponibilidade",
                  "Principais competências",
                  "Status",
                  "Currículo PDF",
                  "Aderência aos requisitos da vaga",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-4 font-bold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border-light divide-y">
              {rows.map((row) => (
                <tr key={row.applicationId} className="align-top">
                  <td className="px-4 py-4">
                    <Link
                      className="text-brand font-bold hover:underline"
                      href={`/admin/rh/vagas/${id}/candidaturas/${row.applicationId}`}
                    >
                      {row.name}
                    </Link>
                    <span className="text-muted mt-1 block text-xs">
                      {candidateStageLabels[row.stage]}
                    </span>
                  </td>
                  <td className="px-4 py-4">{row.education}</td>
                  <td className="max-w-64 px-4 py-4">
                    {row.relevantExperience}
                  </td>
                  <td className="px-4 py-4">
                    {row.hasCustomerServiceExperience
                      ? "Identificada"
                      : "Não identificado"}
                  </td>
                  <td className="px-4 py-4">
                    {row.hasSimilarRoleExperience
                      ? "Identificada"
                      : "Não identificado"}
                  </td>
                  <td className="max-w-56 px-4 py-4">{row.availability}</td>
                  <td className="max-w-56 px-4 py-4">
                    {row.skills.length
                      ? row.skills.join(", ")
                      : "Não identificado"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[row.status]}`}
                    >
                      {applicationStatusLabels[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {row.resumeId ? (
                      <a
                        className="text-brand font-bold hover:underline"
                        href={`/api/admin/rh/curriculos/${row.resumeId}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Visualizar original
                      </a>
                    ) : (
                      "Não enviado"
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${bandClasses[row.band]}`}
                    >
                      {row.matchScore === null
                        ? "Não calculada"
                        : `${row.matchScore}%`}
                    </span>
                    {row.match ? (
                      <span className="text-muted mt-2 block text-xs">
                        Cobertura das informações: {row.informationCoverage}% ·{" "}
                        {
                          row.match.items.filter(
                            (item) => item.status === "not_informed",
                          ).length
                        }{" "}
                        requisito(s) não identificado(s)
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </>
  );
}
