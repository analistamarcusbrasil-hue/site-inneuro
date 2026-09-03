import {
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  Database,
  Inbox,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { AdminButton, AdminMetricCard } from "@/components/admin/ui";
import {
  candidateStageLabels,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CompanyUnit } from "@/lib/careers/logistics";

const roleLabels = {
  administrator: "Administrador",
  hr_manager: "Gestor de RH",
  reviewer: "Avaliador",
  viewer: "Visualizador",
} as const;

type JobRow = { id: string; status: string; unit_id: string | null };
type ApplicationRow = {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_stage: CareerJobApplication["candidate_stage"];
  submitted_at: string;
};
type ProcessRow = {
  id: string;
  job_id: string;
  status: string;
  closed_at: string | null;
};
type InterviewRow = {
  application_id: string;
  scheduled_at: string;
  status: string;
};

export default async function HrDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string }>;
}) {
  const { supabase, hrRole } = await requireHrAccess();
  const canSeeOverview = hrRole !== "reviewer";
  const query = await searchParams;
  const selectedUnit = query.unidade ?? "";
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();
  const nowIso = new Date().toISOString();

  const [
    unitsResult,
    jobsResult,
    applicationsResult,
    candidatesResult,
    processesResult,
    interviewsResult,
    talentResult,
  ] = canSeeOverview
    ? await Promise.all([
        supabase.from("company_units").select("*").order("name"),
        supabase.from("career_jobs").select("id, status, unit_id"),
        supabase
          .from("career_job_applications")
          .select("id, job_id, candidate_id, candidate_stage, submitted_at"),
        supabase.from("candidate_accounts").select("id, created_at"),
        supabase
          .from("career_selection_processes")
          .select("id, job_id, status, closed_at"),
        supabase
          .from("career_candidate_interviews")
          .select("application_id, scheduled_at, status"),
        supabase
          .from("career_talent_pool_memberships")
          .select("candidate_id, status"),
      ])
    : Array.from({ length: 7 }, () => ({ data: [], error: null }));

  const units = (unitsResult.data as CompanyUnit[] | null) ?? [];
  const allJobs = (jobsResult.data as JobRow[] | null) ?? [];
  const jobs = selectedUnit
    ? allJobs.filter((job) => job.unit_id === selectedUnit)
    : allJobs;
  const jobIds = new Set(jobs.map((job) => job.id));
  const allApplications =
    (applicationsResult.data as ApplicationRow[] | null) ?? [];
  const applications = selectedUnit
    ? allApplications.filter((application) => jobIds.has(application.job_id))
    : allApplications;
  const applicationIds = new Set(applications.map((item) => item.id));
  const candidateIds = new Set(applications.map((item) => item.candidate_id));
  const allProcesses = (processesResult.data as ProcessRow[] | null) ?? [];
  const processes = selectedUnit
    ? allProcesses.filter((process) => jobIds.has(process.job_id))
    : allProcesses;
  const interviews = (
    (interviewsResult.data as InterviewRow[] | null) ?? []
  ).filter(
    (item) =>
      (!selectedUnit || applicationIds.has(item.application_id)) &&
      item.status === "scheduled" &&
      item.scheduled_at >= nowIso,
  );
  const candidates =
    (candidatesResult.data as { id: string; created_at: string }[] | null) ??
    [];
  const newCandidates = selectedUnit
    ? new Set(
        applications
          .filter((item) => item.submitted_at >= sinceIso)
          .map((item) => item.candidate_id),
      ).size
    : candidates.filter((candidate) => candidate.created_at >= sinceIso).length;
  const talentMemberships =
    (talentResult.data as { candidate_id: string; status: string }[] | null) ??
    [];
  const talentCount = talentMemberships.filter(
    (item) =>
      item.status === "active" &&
      (!selectedUnit || candidateIds.has(item.candidate_id)),
  ).length;
  const stageCounts = Object.fromEntries(
    Object.keys(candidateStageLabels).map((stage) => [
      stage,
      applications.filter((item) => item.candidate_stage === stage).length,
    ]),
  );
  const hasError = [
    unitsResult,
    jobsResult,
    applicationsResult,
    candidatesResult,
    processesResult,
    interviewsResult,
    talentResult,
  ].some((result) => result.error);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Gestão de carreiras"
        description="Indicadores reais de vagas, candidaturas e processos seletivos, sem dados simulados."
      />
      <HrNavigation
        current="dashboard"
        canManageJobs={canSeeOverview}
        canManageCandidates={canSeeOverview}
        canViewReports={canSeeOverview}
        canManageSettings={hrRole === "administrator"}
      />

      <section aria-labelledby="rh-overview-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="rh-overview-title"
              className="font-heading text-ink text-2xl font-semibold"
            >
              Visão geral
            </h2>
            <p className="text-muted mt-2 text-sm">
              Período recente: últimos 30 dias. A seleção por unidade também
              filtra os processos vinculados às vagas.
            </p>
          </div>
          <span className="bg-mint text-brand-dark rounded-full px-4 py-2 text-xs font-bold">
            Acesso: {roleLabels[hrRole]}
          </span>
        </div>

        {canSeeOverview ? (
          <form className="border-border-light mt-5 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
            <label className="text-ink min-w-64 flex-1 text-sm font-bold">
              Unidade
              <select
                name="unidade"
                defaultValue={selectedUnit}
                className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
              >
                <option value="">Todas as unidades</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </label>
            <AdminButton type="submit">Aplicar filtro</AdminButton>
            {selectedUnit ? (
              <Link
                href="/admin/rh"
                className="text-brand px-3 py-3 text-sm font-bold"
              >
                Limpar
              </Link>
            ) : null}
          </form>
        ) : null}

        {hasError ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-5 rounded-2xl p-4 text-sm font-bold"
          >
            Parte dos indicadores está temporariamente indisponível.
          </p>
        ) : null}

        {canSeeOverview ? (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Vagas publicadas",
                value: jobs.filter((job) => job.status === "published").length,
                Icon: BriefcaseBusiness,
                description: "No recorte selecionado",
              },
              {
                label: "Candidaturas",
                value: applications.length,
                Icon: Inbox,
                description: "Total no recorte selecionado",
              },
              {
                label: "Novos candidatos",
                value: newCandidates,
                Icon: UserPlus,
                description: "Registrados ou inscritos nos últimos 30 dias",
              },
              {
                label: "Processos ativos",
                value: processes.filter((process) =>
                  ["open", "in_progress"].includes(process.status),
                ).length,
                Icon: ClipboardList,
                description: "Abertos ou em andamento",
              },
              {
                label: "Processos encerrados",
                value: processes.filter(
                  (process) =>
                    process.status === "closed" &&
                    Boolean(process.closed_at && process.closed_at >= sinceIso),
                ).length,
                Icon: ClipboardList,
                description: "Encerrados nos últimos 30 dias",
              },
              {
                label: "Entrevistas agendadas",
                value: interviews.length,
                Icon: CalendarClock,
                description: "Agenda futura registrada",
              },
              {
                label: "Selecionados",
                value: stageCounts.hired ?? 0,
                Icon: Users,
                description: "Contratações registradas no ATS",
              },
              {
                label: "Banco de talentos",
                value: talentCount,
                Icon: Database,
                description: "Participações ativas",
              },
            ].map(({ label, value, Icon, description }) => (
              <li key={label}>
                <AdminMetricCard
                  label={label}
                  value={value.toLocaleString("pt-BR")}
                  description={description}
                  icon={<Icon aria-hidden="true" size={20} />}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-border-light mt-5 rounded-3xl border bg-white p-6 text-sm font-bold">
            O avaliador visualiza somente candidaturas e processos aos quais foi
            autorizado.
          </p>
        )}
      </section>

      {canSeeOverview ? (
        <section
          className="border-border-light mt-8 rounded-3xl border bg-white p-5 sm:p-7"
          aria-labelledby="funnel-title"
        >
          <h2
            id="funnel-title"
            className="font-heading text-brand-dark text-2xl font-semibold"
          >
            Funil atual
          </h2>
          <p className="text-muted mt-2 text-sm">
            Contagem real pela etapa atual, sem somar movimentações históricas.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(candidateStageLabels).map(([stage, label]) => (
              <li key={stage} className="bg-surface rounded-2xl p-4">
                <p className="text-muted text-xs">{label}</p>
                <p className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
                  {(stageCounts[stage] ?? 0).toLocaleString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <aside className="border-brand/15 bg-mint/60 text-brand-dark mt-8 rounded-3xl border p-5 text-sm leading-relaxed">
        O portal público de candidatos continua desabilitado durante a validação
        final. Este ambiente permanece exclusivo para usuários administrativos
        autorizados.
      </aside>
    </>
  );
}
