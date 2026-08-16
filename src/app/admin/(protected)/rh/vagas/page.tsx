import { BriefcaseBusiness, Building2, FolderCog, Plus } from "lucide-react";
import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  formatJobDate,
  jobStatuses,
  jobStatusLabels,
  workModeLabels,
  type CareerJob,
} from "@/lib/careers/jobs";

const statusClasses = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  closed: "bg-rose-100 text-rose-800",
} as const;

export default async function HrJobsPage() {
  const { supabase } = await requireHrAccess("jobs:manage");
  const { data, error } = await supabase
    .from("career_jobs")
    .select(
      "*, area:career_job_areas(id, name, slug, is_active), unit:company_units(id, name, address, neighborhood, city, state, postal_code, active)",
    )
    .order("updated_at", { ascending: false });
  const jobs = error ? [] : ((data as CareerJob[] | null) ?? []);
  const counts = Object.fromEntries(
    jobStatuses.map((status) => [
      status,
      jobs.filter((job) => job.status === status).length,
    ]),
  ) as Record<(typeof jobStatuses)[number], number>;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Vagas"
        description="Crie, revise e controle a publicação das oportunidades profissionais da INNEURO."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/rh/vagas/nova"
          className="bg-brand hover:bg-brand-dark inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
        >
          <Plus size={18} aria-hidden="true" />
          Criar vaga
        </Link>
        <Link
          href="/admin/rh/vagas/areas"
          className="border-brand/30 text-brand-dark hover:bg-mint inline-flex min-h-11 items-center gap-2 rounded-full border px-6 text-sm font-bold"
        >
          <FolderCog size={18} aria-hidden="true" />
          Administrar áreas
        </Link>
        <Link
          href="/admin/rh/unidades"
          className="border-brand/30 text-brand-dark hover:bg-mint inline-flex min-h-11 items-center gap-2 rounded-full border px-6 text-sm font-bold"
        >
          <Building2 size={18} aria-hidden="true" />
          Administrar unidades
        </Link>
      </div>

      <section
        aria-label="Resumo das vagas"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {jobStatuses.map((status) => (
          <article
            key={status}
            className="border-border-light rounded-2xl border bg-white p-5"
          >
            <p className="text-muted text-sm">{jobStatusLabels[status]}</p>
            <p className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
              {counts[status].toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-7" aria-labelledby="jobs-list-title">
        <h2
          id="jobs-list-title"
          className="font-heading text-ink text-2xl font-semibold"
        >
          Todas as vagas
        </h2>
        {error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-5 rounded-2xl p-4 text-sm font-bold"
          >
            Não foi possível carregar as vagas.
          </p>
        ) : null}
        {jobs.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {jobs.map((job) => (
              <article
                key={job.id}
                className="border-border-light rounded-3xl border bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClasses[job.status]}`}
                    >
                      {jobStatusLabels[job.status]}
                    </span>
                    <p className="text-brand mt-3 text-xs font-bold tracking-[0.14em] uppercase">
                      {job.vacancy_number}
                    </p>
                    <h3 className="font-heading text-brand-dark mt-3 text-xl font-semibold">
                      {job.title}
                    </h3>
                    <p className="text-muted mt-2 text-sm">
                      {job.area?.name ?? "Área indisponível"} · {job.location}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {workModeLabels[job.work_mode]}
                      {job.positions ? ` · ${job.positions} posição(ões)` : ""}
                    </p>
                    {job.unit ? (
                      <p className="text-muted mt-1 text-xs">
                        Unidade: {job.unit.name}
                      </p>
                    ) : null}
                  </div>
                  <span className="bg-surface text-muted grid size-11 place-items-center rounded-2xl">
                    <BriefcaseBusiness size={20} aria-hidden="true" />
                  </span>
                </div>
                <p className="text-ink mt-4 line-clamp-3 text-sm leading-relaxed">
                  {job.description}
                </p>
                <p className="text-muted mt-4 text-xs">
                  Abertura: {formatJobDate(job.opens_on)}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    className="text-brand text-sm font-bold hover:underline"
                    href={`/admin/rh/vagas/${job.id}`}
                  >
                    Visualizar
                  </Link>
                  <Link
                    className="text-brand text-sm font-bold hover:underline"
                    href={`/admin/rh/vagas/${job.id}/editar`}
                  >
                    Editar
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-border-light mt-5 rounded-3xl border bg-white p-8 text-center">
            <BriefcaseBusiness
              className="text-brand mx-auto"
              aria-hidden="true"
            />
            <p className="text-ink mt-4 font-bold">Nenhuma vaga criada.</p>
            <p className="text-muted mt-2 text-sm">
              Comece criando uma oportunidade como rascunho.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
