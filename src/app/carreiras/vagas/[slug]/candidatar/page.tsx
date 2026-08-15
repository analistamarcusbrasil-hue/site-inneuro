import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { submitCareerJobApplicationAction } from "@/app/carreiras/application-actions";
import { Container } from "@/components/layout/container";
import { getCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import type { CareerJob } from "@/lib/careers/jobs";
import {
  formatCandidateMonth,
  formatFileSize,
  type CandidateEducation,
  type CandidateExperience,
  type CandidateProfessionalProfile,
  type CandidateResume,
} from "@/lib/careers/profile";

export const metadata: Metadata = {
  title: "Revisar candidatura | Carreiras INNEURO",
};

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-6">
      <h2 className="font-heading text-brand-dark text-xl font-semibold">
        {title}
      </h2>
      <div className="text-ink mt-4 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default async function ReviewCareerApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  requireCareersPortalEnabled();
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) notFound();
  const destination = `/carreiras/vagas/${slug}/candidatar`;
  const session = await getCandidateSession();
  if (!session.user || !session.account || !session.supabase) {
    redirect(`/carreiras/entrar?next=${encodeURIComponent(destination)}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const [
    jobResult,
    profileResult,
    experiencesResult,
    educationResult,
    resumeResult,
  ] = await Promise.all([
    session.supabase
      .from("career_jobs")
      .select("*, area:career_job_areas(id, name, slug, is_active)")
      .eq("slug", slug)
      .eq("status", "published")
      .lte("opens_on", today)
      .or(`closes_on.is.null,closes_on.gte.${today}`)
      .maybeSingle(),
    session.supabase
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", session.user.id)
      .maybeSingle(),
    session.supabase
      .from("candidate_experiences")
      .select("*")
      .eq("candidate_id", session.user.id)
      .order("sort_order", { ascending: true }),
    session.supabase
      .from("candidate_education")
      .select("*")
      .eq("candidate_id", session.user.id)
      .order("sort_order", { ascending: true }),
    session.supabase
      .from("candidate_resumes")
      .select("*")
      .eq("candidate_id", session.user.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (jobResult.error || !jobResult.data) notFound();

  const job = jobResult.data as CareerJob;
  const profile =
    (profileResult.data as CandidateProfessionalProfile | null) ?? null;
  const experiences =
    (experiencesResult.data as CandidateExperience[] | null) ?? [];
  const education = (educationResult.data as CandidateEducation[] | null) ?? [];
  const resume = (resumeResult.data as CandidateResume | null) ?? null;
  const { data: activeApplication } = await session.supabase
    .from("career_job_applications")
    .select("id")
    .eq("job_id", job.id)
    .eq("candidate_id", session.user.id)
    .not("status", "in", "(finalized,withdrawn)")
    .maybeSingle();
  const query = await searchParams;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-screen py-10 sm:py-14"
    >
      <Container className="max-w-5xl">
        <Link
          className="text-brand text-sm font-bold hover:underline"
          href={`/carreiras/vagas/${slug}`}
        >
          Voltar para a vaga
        </Link>
        <header className="mt-5">
          <p className="text-brand text-xs font-bold tracking-widest uppercase">
            Candidatura para {job.title}
          </p>
          <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold sm:text-4xl">
            Revise seu perfil antes de se candidatar.
          </h1>
          <p className="text-muted mt-3 max-w-3xl leading-relaxed">
            Esta é a versão que será enviada ao RH. Você pode atualizar seu
            perfil antes de confirmar.
          </p>
        </header>

        {query.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-6 rounded-2xl p-4 text-sm font-bold"
          >
            {query.error === "duplicate"
              ? "Você já possui uma candidatura ativa para esta vaga."
              : query.error === "unavailable"
                ? "Esta vaga não está mais disponível para candidatura."
                : "Não foi possível enviar a candidatura. Tente novamente."}
          </p>
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <ReviewSection title="Contato">
            <dl className="grid gap-3">
              <div>
                <dt className="text-muted">Nome</dt>
                <dd className="font-bold">{session.account.full_name}</dd>
              </div>
              <div>
                <dt className="text-muted">E-mail</dt>
                <dd className="font-bold break-all">
                  {session.user.email ?? "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">WhatsApp</dt>
                <dd className="font-bold">
                  {profile?.whatsapp ?? "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Localização</dt>
                <dd className="font-bold">
                  {[profile?.city, profile?.state].filter(Boolean).join("/") ||
                    "Não informada"}
                </dd>
              </div>
            </dl>
          </ReviewSection>

          <ReviewSection title="Disponibilidade">
            <p className="whitespace-pre-line">
              {profile?.availability ?? "Não informada"}
            </p>
          </ReviewSection>

          <ReviewSection title="Experiência">
            {experiences.length ? (
              <ul className="grid gap-4">
                {experiences.map((item) => (
                  <li key={item.id}>
                    <p className="font-bold">
                      {item.job_title} · {item.company}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {formatCandidateMonth(item.start_date)} até{" "}
                      {item.is_current
                        ? "o momento"
                        : formatCandidateMonth(item.end_date)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nenhuma experiência informada.</p>
            )}
          </ReviewSection>

          <ReviewSection title="Formação">
            {education.length ? (
              <ul className="grid gap-4">
                {education.map((item) => (
                  <li key={item.id}>
                    <p className="font-bold">{item.course}</p>
                    <p className="text-muted mt-1">
                      {item.education_level} · {item.institution}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nenhuma formação informada.</p>
            )}
          </ReviewSection>

          <ReviewSection title="Currículo">
            {resume ? (
              <>
                <p className="font-bold">
                  Versão {resume.version} · {resume.original_name}
                </p>
                <p className="text-muted mt-1 text-xs">
                  {formatFileSize(resume.size_bytes)}
                </p>
              </>
            ) : (
              <p className="text-muted">Nenhum currículo enviado.</p>
            )}
          </ReviewSection>
        </div>

        <section className="border-brand/15 mt-6 rounded-3xl border bg-white p-5 sm:p-6">
          <p className="text-muted text-sm leading-relaxed">
            Ao enviar, será guardada uma cópia destas informações para preservar
            exatamente o conteúdo desta candidatura.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="border-brand/30 text-brand-dark inline-flex min-h-12 items-center rounded-full border px-6 font-bold"
              href="/carreiras/perfil"
            >
              Atualizar perfil
            </Link>
            {activeApplication ? (
              <Link
                className="bg-brand inline-flex min-h-12 items-center rounded-full px-6 font-bold text-white"
                href="/carreiras/candidaturas"
              >
                Ver minha candidatura
              </Link>
            ) : (
              <form action={submitCareerJobApplicationAction}>
                <input type="hidden" name="job_id" value={job.id} />
                <input type="hidden" name="slug" value={job.slug} />
                <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 rounded-full px-6 font-bold text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                  Enviar candidatura
                </button>
              </form>
            )}
          </div>
        </section>
      </Container>
    </main>
  );
}
