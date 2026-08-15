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

type MatchRunRow = {
  application_id: string;
  overall_score: number;
  hard_skills_score: number;
  matrix_version: number;
  calculated_at: string;
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
  searchParams: Promise<{ error?: string; ordem?: string }>;
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
  const matchRunsResult = applications.length
    ? await supabase
        .from("career_application_match_runs")
        .select(
          "application_id, overall_score, hard_skills_score, matrix_version, calculated_at",
        )
        .in(
          "application_id",
          applications.map((application) => application.id),
        )
        .order("calculated_at", { ascending: false })
    : { data: [] as MatchRunRow[], error: null };
  const latestMatchByApplication = new Map<string, MatchRunRow>();
  for (const run of (matchRunsResult.data as MatchRunRow[] | null) ?? []) {
    if (!latestMatchByApplication.has(run.application_id)) {
      latestMatchByApplication.set(run.application_id, run);
    }
  }
  const orderedApplications = [...applications].sort((a, b) => {
    if (query.ordem !== "aderencia") return 0;
    return (
      (latestMatchByApplication.get(b.id)?.overall_score ?? -1) -
      (latestMatchByApplication.get(a.id)?.overall_score ?? -1)
    );
  });

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
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={`/admin/rh/vagas/${id}/aderencia`}
        >
          Configurar matriz
        </Link>
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={
            query.ordem === "aderencia"
              ? `/admin/rh/vagas/${id}/candidaturas`
              : `/admin/rh/vagas/${id}/candidaturas?ordem=aderencia`
          }
        >
          {query.ordem === "aderencia"
            ? "Ordenar por data"
            : "Ordenar por aderência"}
        </Link>
      </div>

      <aside className="border-brand/20 bg-mint/60 text-brand-dark mb-6 rounded-2xl border p-4 text-sm">
        Indicador de apoio à triagem. A decisão final é responsabilidade do RH.
      </aside>

      {query.error || applicationsResult.error || matchRunsResult.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar as candidaturas.
        </p>
      ) : applications.length ? (
        <ul className="grid gap-4">
          {orderedApplications.map((application) => {
            const match = latestMatchByApplication.get(application.id);
            return (
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
                  {match ? (
                    <div className="border-border-light mt-5 flex flex-wrap gap-3 border-t pt-4 text-xs">
                      <span className="bg-mint text-brand-dark rounded-full px-3 py-1 font-bold">
                        Aderência à vaga: {match.overall_score}%
                      </span>
                      <span className="bg-surface text-muted rounded-full px-3 py-1 font-bold">
                        Hard skills: {match.hard_skills_score}%
                      </span>
                      <span className="text-muted self-center">
                        Matriz v{match.matrix_version}
                      </span>
                    </div>
                  ) : (
                    <p className="text-muted mt-5 text-xs">
                      Aderência ainda não calculada.
                    </p>
                  )}
                  <p className="text-brand mt-5 text-sm font-bold group-hover:underline">
                    Abrir candidatura
                  </p>
                </Link>
              </li>
            );
          })}
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
