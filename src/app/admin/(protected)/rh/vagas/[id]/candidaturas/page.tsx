import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  formatApplicationDate,
  type ApplicationStatus,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";

type ApplicationListRow = {
  id: string;
  status: ApplicationStatus;
  process_label: string | null;
  submitted_at: string;
  candidate: { id: string; full_name: string } | null;
};

const statusClasses: Record<ApplicationStatus, string> = {
  submitted: "bg-sky-100 text-sky-800",
  screening: "bg-amber-100 text-amber-800",
  in_process: "bg-violet-100 text-violet-800",
  finalized: "bg-slate-100 text-slate-700",
  withdrawn: "bg-rose-100 text-rose-800",
};

export default async function CareerJobApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, applicationsResult] = await Promise.all([
    supabase.from("career_jobs").select("id, title").eq("id", id).maybeSingle(),
    supabase
      .from("career_job_applications")
      .select(
        "id, status, process_label, submitted_at, candidate:candidate_accounts(id, full_name)",
      )
      .eq("job_id", id)
      .order("submitted_at", { ascending: false }),
  ]);
  if (jobResult.error || !jobResult.data) notFound();
  const applications =
    (applicationsResult.data as unknown as ApplicationListRow[] | null) ?? [];
  const query = await searchParams;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas / Candidaturas"
        title={jobResult.data.title}
        description="Consulte os inscritos e abra o snapshot profissional enviado em cada candidatura."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={`/admin/rh/vagas/${id}`}
        >
          Voltar para a vaga
        </Link>
      </div>

      {query.error || applicationsResult.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar as candidaturas.
        </p>
      ) : applications.length ? (
        <ul className="grid gap-4">
          {applications.map((application) => (
            <li key={application.id}>
              <Link
                href={`/admin/rh/vagas/${id}/candidaturas/${application.id}`}
                className="border-border-light hover:border-brand group block rounded-3xl border bg-white p-5 transition-colors sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-brand-dark text-xl font-semibold">
                      {application.candidate?.full_name ??
                        "Candidato indisponível"}
                    </h2>
                    <p className="text-muted mt-2 text-sm">
                      Enviada em{" "}
                      {formatApplicationDate(application.submitted_at)}
                    </p>
                    {application.process_label ? (
                      <p className="text-muted mt-1 text-sm">
                        Processo: {application.process_label}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[application.status]}`}
                  >
                    {applicationStatusLabels[application.status]}
                  </span>
                </div>
                <p className="text-brand mt-5 text-sm font-bold group-hover:underline">
                  Abrir candidatura
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Nenhuma candidatura
          </h2>
          <p className="text-muted mt-2 text-sm">
            Os inscritos nesta vaga aparecerão aqui.
          </p>
        </section>
      )}
    </>
  );
}
