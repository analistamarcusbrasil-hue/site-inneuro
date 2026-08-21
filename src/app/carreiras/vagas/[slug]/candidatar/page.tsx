import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { submitCareerJobApplicationAction } from "@/app/carreiras/application-actions";
import { Container } from "@/components/layout/container";
import { getCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import {
  currentMacapaDate,
  isJobPubliclyAvailable,
  type CareerJob,
} from "@/lib/careers/jobs";
import {
  applicationSourceLabels,
  applicationSources,
  commuteFeasibilityLabels,
  commuteFeasibilities,
  commuteTimeLabels,
  commuteTimes,
  formatCompanyUnitLocation,
  transitBenefitLabels,
  transitBenefitOptions,
  transportModeLabels,
  transportModes,
} from "@/lib/careers/logistics";
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

  const today = currentMacapaDate();
  const [
    jobResult,
    profileResult,
    experiencesResult,
    educationResult,
    resumeResult,
  ] = await Promise.all([
    session.supabase
      .from("career_jobs")
      .select(
        "*, area:career_job_areas(id, name, slug, is_active), unit:company_units(id, name, address, neighborhood, city, state, postal_code, active)",
      )
      .eq("slug", slug)
      .in("status", ["published", "closed"])
      .lte("opens_on", today)
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
  const isAvailable = isJobPubliclyAvailable(job);
  const profile =
    (profileResult.data as CandidateProfessionalProfile | null) ?? null;
  const experiences =
    (experiencesResult.data as CandidateExperience[] | null) ?? [];
  const education = (educationResult.data as CandidateEducation[] | null) ?? [];
  const resume = (resumeResult.data as CandidateResume | null) ?? null;
  const { data: existingApplication } = await session.supabase
    .from("career_job_applications")
    .select("id")
    .eq("job_id", job.id)
    .eq("candidate_id", session.user.id)
    .maybeSingle();
  const query = await searchParams;
  const requiresCommute = Boolean(
    job.unit && (job.work_mode === "onsite" || job.work_mode === "hybrid"),
  );

  if (!resume) {
    const onboardingUrl = `/carreiras/perfil?${new URLSearchParams({
      onboarding: "resume",
      next: destination,
    }).toString()}`;
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="bg-surface min-h-screen py-10 sm:py-14"
      >
        <Container className="max-w-3xl">
          <Link
            className="text-brand text-sm font-bold hover:underline"
            href={`/carreiras/vagas/${slug}`}
          >
            Voltar para a vaga
          </Link>
          <section className="border-brand/20 mt-6 rounded-[2rem] border bg-white p-6 shadow-[0_14px_40px_rgba(3,37,27,0.05)] sm:p-8">
            <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
              Currículo necessário
            </p>
            <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold">
              Antes de confirmar sua candidatura, envie seu currículo.
            </h1>
            <p className="text-muted mt-4 leading-relaxed">
              Depois do envio, você poderá revisar as informações identificadas
              e retornar à candidatura para {job.title}.
            </p>
            <Link
              className="bg-brand hover:bg-brand-dark mt-6 inline-flex min-h-12 items-center rounded-full px-6 font-bold text-white"
              href={onboardingUrl}
            >
              Enviar meu currículo
            </Link>
          </section>
        </Container>
      </main>
    );
  }

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
            {job.vacancy_number} · Candidatura para {job.title}
          </p>
          <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold sm:text-4xl">
            Revise seu perfil antes de se candidatar.
          </h1>
          <p className="text-muted mt-3 max-w-3xl leading-relaxed">
            Esta é a versão que será enviada ao RH. Você pode atualizar seu
            perfil antes de confirmar.
          </p>
          {!isAvailable ? (
            <p className="bg-error/10 text-error mt-5 rounded-2xl p-4 font-bold">
              Esta vaga não está mais recebendo candidaturas.
            </p>
          ) : null}
        </header>

        {query.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-6 rounded-2xl p-4 text-sm font-bold"
          >
            {query.error === "duplicate"
              ? "Você já possui uma candidatura para esta vaga."
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
                  {[profile?.neighborhood, profile?.city, profile?.state]
                    .filter(Boolean)
                    .join(" · ") || "Não informada"}
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
                <p className="font-bold">{resume.original_name}</p>
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
            {existingApplication ? (
              <div className="bg-mint text-brand-dark w-full rounded-2xl p-4">
                <p className="font-bold">
                  Você já possui uma candidatura para esta vaga.
                </p>
                <Link
                  className="mt-3 inline-flex min-h-11 items-center rounded-full bg-white px-5 text-sm font-bold"
                  href="/carreiras/candidaturas"
                >
                  Ver minha candidatura
                </Link>
              </div>
            ) : null}
          </div>

          {!existingApplication && isAvailable ? (
            <form
              action={submitCareerJobApplicationAction}
              className="mt-7 grid gap-6"
            >
              <input type="hidden" name="job_id" value={job.id} />
              <input type="hidden" name="slug" value={job.slug} />
              {requiresCommute ? (
                <fieldset className="border-border-light grid gap-5 rounded-2xl border p-4 sm:p-5">
                  <legend className="font-heading text-brand-dark px-2 text-lg font-semibold">
                    Logística para esta vaga
                  </legend>
                  {job.unit ? (
                    <div className="bg-surface rounded-2xl p-4 text-sm">
                      <p className="font-bold">{job.unit.name}</p>
                      <p className="text-muted mt-1">{job.unit.address}</p>
                      <p className="text-muted">
                        {formatCompanyUnitLocation(job.unit)}
                      </p>
                    </div>
                  ) : null}
                  <label className="grid gap-2 text-sm font-bold">
                    Você consegue se deslocar até esta unidade?
                    <select
                      name="commute_feasibility"
                      required
                      className="border-border-light min-h-12 rounded-xl border bg-white px-3 font-normal"
                    >
                      <option value="">Selecione</option>
                      {commuteFeasibilities.map((value) => (
                        <option key={value} value={value}>
                          {commuteFeasibilityLabels[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold">
                    Tempo estimado de deslocamento
                    <select
                      name="commute_time"
                      required
                      className="border-border-light min-h-12 rounded-xl border bg-white px-3 font-normal"
                    >
                      <option value="">Selecione</option>
                      {commuteTimes.map((value) => (
                        <option key={value} value={value}>
                          {commuteTimeLabels[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend className="text-sm font-bold">
                      Como pretende realizar o deslocamento? (opcional)
                    </legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {transportModes.map((value) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            name="transport_modes"
                            value={value}
                          />
                          {transportModeLabels[value]}
                        </label>
                      ))}
                    </div>
                    <p className="text-muted mt-3 text-xs">
                      O meio de transporte não gera vantagem ou desvantagem na
                      triagem.
                    </p>
                  </fieldset>
                  <label className="grid gap-2 text-sm font-bold">
                    Pretende utilizar vale-transporte?
                    <select
                      name="transit_benefit"
                      required
                      className="border-border-light min-h-12 rounded-xl border bg-white px-3 font-normal"
                    >
                      <option value="">Selecione</option>
                      {transitBenefitOptions.map((value) => (
                        <option key={value} value={value}>
                          {transitBenefitLabels[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              ) : null}

              <label className="grid gap-2 text-sm font-bold sm:max-w-md">
                Como soube desta vaga?
                <select
                  name="source"
                  defaultValue="site_inneuro"
                  className="border-border-light min-h-12 rounded-xl border bg-white px-3 font-normal"
                >
                  {applicationSources.map((value) => (
                    <option key={value} value={value}>
                      {applicationSourceLabels[value]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-3 text-sm leading-relaxed">
                <label className="flex items-start gap-3">
                  <input
                    className="mt-1"
                    type="checkbox"
                    name="recruitment_consent"
                    required
                  />
                  <span>
                    Autorizo o tratamento dos meus dados profissionais para
                    participar deste processo seletivo.
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <input
                    className="mt-1"
                    type="checkbox"
                    name="automated_support_consent"
                    required
                  />
                  <span>
                    Estou ciente de que ferramentas automatizadas podem apoiar a
                    organização e a triagem. Elas não decidem contratação nem
                    fazem rejeição automática.
                  </span>
                </label>
              </div>

              <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 justify-self-start rounded-full px-6 font-bold text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
                Enviar candidatura
              </button>
            </form>
          ) : null}
        </section>
      </Container>
    </main>
  );
}
