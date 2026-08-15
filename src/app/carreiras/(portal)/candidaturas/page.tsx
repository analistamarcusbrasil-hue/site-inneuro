import type { Metadata } from "next";
import Link from "next/link";
import { withdrawCareerJobApplicationAction } from "@/app/carreiras/application-actions";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { Container } from "@/components/layout/container";
import {
  applicationStatusLabels,
  canWithdrawApplication,
  formatApplicationDate,
  type ApplicationStatus,
} from "@/lib/careers/applications";
import { requireCandidateSession } from "@/lib/careers/auth";

export const metadata: Metadata = {
  title: "Minhas candidaturas | Carreiras INNEURO",
};

type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  process_label: string | null;
  submitted_at: string;
  job: {
    id: string;
    slug: string;
    title: string;
    location: string;
    area: { name: string } | null;
  } | null;
};

const statusClasses: Record<ApplicationStatus, string> = {
  submitted: "bg-sky-100 text-sky-800",
  screening: "bg-amber-100 text-amber-800",
  in_process: "bg-violet-100 text-violet-800",
  finalized: "bg-slate-100 text-slate-700",
  withdrawn: "bg-rose-100 text-rose-800",
};

export default async function CandidateApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { supabase, user } = await requireCandidateSession();
  const query = await searchParams;
  const { data, error } = await supabase
    .from("career_job_applications")
    .select(
      "id, status, process_label, submitted_at, job:career_jobs(id, slug, title, location, area:career_job_areas(name))",
    )
    .eq("candidate_id", user.id)
    .order("submitted_at", { ascending: false });
  const applications = (data as unknown as ApplicationRow[] | null) ?? [];

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-screen py-10 sm:py-14"
    >
      <Container className="max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-brand text-xs font-bold tracking-widest uppercase">
              Área do candidato
            </p>
            <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold sm:text-4xl">
              Minhas candidaturas
            </h1>
            <p className="text-muted mt-3">
              Acompanhe as vagas para as quais você enviou seu perfil.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
              href="/carreiras/perfil"
            >
              Meu perfil
            </Link>
            <Link
              className="bg-brand inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-white"
              href="/carreiras/vagas"
            >
              Ver vagas
            </Link>
          </div>
        </header>

        {query.status === "submitted" ? (
          <p
            role="status"
            className="bg-mint text-brand-dark mt-6 rounded-2xl p-4 text-sm font-bold"
          >
            Candidatura enviada com sucesso.
          </p>
        ) : query.status === "withdrawn" ? (
          <p
            role="status"
            className="bg-mint text-brand-dark mt-6 rounded-2xl p-4 text-sm font-bold"
          >
            Candidatura retirada.
          </p>
        ) : null}
        {query.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-6 rounded-2xl p-4 text-sm font-bold"
          >
            Não foi possível atualizar a candidatura.
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-8 rounded-2xl p-5 font-bold"
          >
            Não foi possível carregar suas candidaturas.
          </p>
        ) : applications.length ? (
          <ul className="mt-8 grid gap-5">
            {applications.map((application) => (
              <li
                key={application.id}
                className="border-border-light rounded-3xl border bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-brand text-xs font-bold tracking-wide uppercase">
                      {application.job?.area?.name ?? "Carreiras INNEURO"}
                    </p>
                    <h2 className="font-heading text-brand-dark mt-2 text-xl font-semibold">
                      {application.job?.title ?? "Vaga indisponível"}
                    </h2>
                    <p className="text-muted mt-2 text-sm">
                      {application.job?.location} · Enviada em{" "}
                      {formatApplicationDate(application.submitted_at)}
                    </p>
                    {application.process_label ? (
                      <p className="text-ink mt-3 text-sm">
                        <span className="text-muted">Processo:</span>{" "}
                        <strong>{application.process_label}</strong>
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[application.status]}`}
                  >
                    {applicationStatusLabels[application.status]}
                  </span>
                </div>
                <div className="border-border-light mt-5 flex flex-wrap gap-4 border-t pt-5">
                  {application.job ? (
                    <Link
                      className="text-brand text-sm font-bold hover:underline"
                      href={`/carreiras/vagas/${application.job.slug}`}
                    >
                      Ver vaga
                    </Link>
                  ) : null}
                  {canWithdrawApplication(application.status) ? (
                    <ConfirmCommandForm
                      action={withdrawCareerJobApplicationAction}
                      message="Deseja retirar sua candidatura desta vaga?"
                    >
                      <input
                        type="hidden"
                        name="application_id"
                        value={application.id}
                      />
                      <button className="text-error text-sm font-bold hover:underline">
                        Retirar candidatura
                      </button>
                    </ConfirmCommandForm>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <section className="border-border-light mt-8 rounded-3xl border bg-white p-8 text-center">
            <h2 className="font-heading text-brand-dark text-xl font-semibold">
              Nenhuma candidatura enviada
            </h2>
            <p className="text-muted mt-2 text-sm">
              Quando você se candidatar a uma vaga, o acompanhamento aparecerá
              aqui.
            </p>
          </section>
        )}
      </Container>
    </main>
  );
}
