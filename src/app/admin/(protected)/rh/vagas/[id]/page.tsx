import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  formatJobDate,
  isJobPubliclyAvailable,
  jobStatusLabels,
  workModeLabels,
  type CareerJob,
} from "@/lib/careers/jobs";
import {
  duplicateCareerJobAction,
  transitionCareerJobAction,
} from "../actions";

const statusClasses = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  closed: "bg-rose-100 text-rose-800",
} as const;

const statusMessages: Record<string, string> = {
  created: "Vaga criada como rascunho.",
  updated: "Alterações salvas.",
  published: "Vaga publicada.",
  paused: "Publicação pausada.",
  closed: "Vaga encerrada.",
};

const errorMessages: Record<string, string> = {
  transition: "Esta mudança de status não é permitida.",
  "publish-validation": "Revise todos os campos antes de publicar.",
  area: "A área da vaga precisa estar ativa para publicar.",
  duplicate: "Não foi possível duplicar a vaga.",
};

function JobDetail({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-6">
      <h2 className="font-heading text-brand-dark text-xl font-semibold">
        {title}
      </h2>
      <p className="text-ink mt-4 text-sm leading-relaxed whitespace-pre-line">
        {value}
      </p>
    </section>
  );
}

export default async function CareerJobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const { data, error } = await supabase
    .from("career_jobs")
    .select("*, area:career_job_areas(id, name, slug, is_active)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) notFound();
  const job = data as CareerJob;
  const publicAvailable = isJobPubliclyAvailable(job);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas"
        title={job.title}
        description="Visualize o conteúdo completo e controle o ciclo de publicação da vaga."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      {query.status && statusMessages[query.status] ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {statusMessages[query.status]}
        </p>
      ) : null}
      {query.error && errorMessages[query.error] ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {errorMessages[query.error]}
        </p>
      ) : null}

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClasses[job.status]}`}
            >
              {jobStatusLabels[job.status]}
            </span>
            <p className="text-muted mt-4 text-sm">
              {job.area?.name ?? "Área indisponível"} · {job.location} ·{" "}
              {workModeLabels[job.work_mode]}
            </p>
            <p className="text-muted mt-2 text-xs">
              {job.positions} posição(ões) · Abertura em{" "}
              {formatJobDate(job.opens_on)}
              {job.closes_on
                ? ` · Encerramento em ${formatJobDate(job.closes_on)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              className="border-brand/30 text-brand-dark hover:bg-mint inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
              href={`/admin/rh/vagas/${job.id}/editar`}
            >
              Editar
            </a>
            {publicAvailable ? (
              <a
                className="border-brand/30 text-brand-dark hover:bg-mint inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
                href={`/carreiras/vagas/${job.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver página pública
              </a>
            ) : null}
          </div>
        </div>

        <div className="border-border-light mt-6 flex flex-wrap gap-3 border-t pt-6">
          {job.status === "draft" || job.status === "paused" ? (
            <ConfirmCommandForm
              action={transitionCareerJobAction}
              message="Confirma a publicação desta vaga no portal de carreiras?"
            >
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="published" />
              <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white">
                Publicar
              </button>
            </ConfirmCommandForm>
          ) : null}
          {job.status === "published" ? (
            <ConfirmCommandForm
              action={transitionCareerJobAction}
              message="Pausar a exibição pública desta vaga?"
            >
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="paused" />
              <button className="border-warning text-warning min-h-11 rounded-full border px-5 text-sm font-bold">
                Pausar
              </button>
            </ConfirmCommandForm>
          ) : null}
          {job.status !== "closed" ? (
            <ConfirmCommandForm
              action={transitionCareerJobAction}
              message="Encerrar definitivamente esta vaga? Ela será preservada no histórico."
            >
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="status" value="closed" />
              <button className="border-error text-error min-h-11 rounded-full border px-5 text-sm font-bold">
                Encerrar
              </button>
            </ConfirmCommandForm>
          ) : null}
          <ConfirmCommandForm
            action={duplicateCareerJobAction}
            message="Criar uma cópia desta vaga como rascunho?"
          >
            <input type="hidden" name="id" value={job.id} />
            <button className="border-brand/30 text-brand-dark min-h-11 rounded-full border px-5 text-sm font-bold">
              Duplicar
            </button>
          </ConfirmCommandForm>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <JobDetail title="Descrição" value={job.description} />
        <JobDetail title="Principais atividades" value={job.activities} />
        <JobDetail title="Escolaridade" value={job.schooling} />
        <JobDetail
          title="Experiência desejável"
          value={job.desirable_experience}
        />
        <JobDetail
          title="Requisitos obrigatórios"
          value={job.required_requirements}
        />
        <JobDetail
          title="Requisitos desejáveis"
          value={job.desirable_requirements}
        />
        <JobDetail title="Habilidades" value={job.skills} />
        <JobDetail title="Certificações" value={job.certifications} />
        <JobDetail title="Jornada ou horário" value={job.work_schedule} />
      </div>
    </>
  );
}
