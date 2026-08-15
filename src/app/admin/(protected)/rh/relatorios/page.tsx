import { Download } from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  applicationStatuses,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  applicationSourceLabels,
  commuteFeasibilityLabels,
  commuteTimeLabels,
  transitBenefitLabels,
  type ApplicationSource,
  type CommuteFeasibility,
  type CommuteTime,
  type TransitBenefit,
} from "@/lib/careers/logistics";
import {
  buildCareerReportRows,
  countBy,
  type CareerReportApplication,
  type CareerReportFilters,
  type CareerReportJob,
  type CareerReportLogistics,
  type CareerReportProcessCandidate,
} from "@/lib/careers/reports";

const stageLabels: Record<string, string> = {
  registered: "Inscritos",
  screening: "Triagem",
  interview: "Entrevista",
  evaluation: "Avaliação",
  finalists: "Finalistas",
  selected: "Selecionados",
  talent_pool: "Banco de Talentos",
  not_selected: "Não selecionados",
};

function Breakdown({
  title,
  counts,
  labels,
}: {
  title: string;
  counts: Record<string, number>;
  labels: Record<string, string>;
}) {
  return (
    <section className="border-border-light rounded-3xl border bg-white p-5">
      <h2 className="font-heading text-brand-dark text-lg font-semibold">
        {title}
      </h2>
      {Object.keys(counts).length ? (
        <ul className="mt-4 grid gap-2 text-sm">
          {Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => (
              <li key={key} className="flex justify-between gap-4">
                <span className="text-muted">
                  {labels[key] ?? "Não informado"}
                </span>
                <strong>{value.toLocaleString("pt-BR")}</strong>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-muted mt-4 text-sm">Sem dados no período.</p>
      )}
    </section>
  );
}

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
      .select("id, job_id, status, source, submitted_at"),
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
  const exportQuery = new URLSearchParams(
    Object.entries(filters).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();

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
            {Object.entries(stageLabels).map(([value, label]) => (
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
            rows.filter((row) => row.process?.stage === "selected").length,
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

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Breakdown
          title="Status das candidaturas"
          counts={countBy(rows.map((row) => row.status))}
          labels={applicationStatusLabels}
        />
        <Breakdown
          title="Etapa atual"
          counts={countBy(rows.map((row) => row.process?.stage))}
          labels={stageLabels}
        />
        <Breakdown
          title="Origem"
          counts={countBy(rows.map((row) => row.source))}
          labels={applicationSourceLabels as Record<ApplicationSource, string>}
        />
        <Breakdown
          title="Deslocamento"
          counts={countBy(
            rows.map((row) => row.logistics?.commute_feasibility),
          )}
          labels={
            commuteFeasibilityLabels as Record<CommuteFeasibility, string>
          }
        />
        <Breakdown
          title="Tempo de deslocamento"
          counts={countBy(rows.map((row) => row.logistics?.commute_time))}
          labels={commuteTimeLabels as Record<CommuteTime, string>}
        />
        <Breakdown
          title="Vale-transporte"
          counts={countBy(rows.map((row) => row.logistics?.transit_benefit))}
          labels={transitBenefitLabels as Record<TransitBenefit, string>}
        />
      </div>

      <p className="border-brand/15 bg-mint/60 text-brand-dark mt-6 rounded-2xl border p-4 text-sm">
        Indicadores logísticos são operacionais e não representam valor
        profissional. Meio de transporte não é usado para ranquear candidatos.
      </p>
    </>
  );
}
