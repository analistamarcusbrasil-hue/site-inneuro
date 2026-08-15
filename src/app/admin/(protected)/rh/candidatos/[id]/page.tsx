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
import {
  calculateCandidateProfileCompletion,
  formatCandidateMonth,
  formatFileSize,
  type CandidateCertification,
  type CandidateEducation,
  type CandidateExperience,
  type CandidateProfessionalProfile,
  type CandidateResume,
  type CandidateSkill,
} from "@/lib/careers/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CandidateAccountRow = {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

type CandidateApplicationRow = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  process_label: string | null;
  submitted_at: string;
  job: { title: string } | null;
};

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border-light rounded-3xl border bg-white p-6">
      <h2 className="font-heading text-brand-dark text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OriginBadge({ source }: { source?: "manual" | "resume" | null }) {
  return (
    <span className="bg-surface text-muted mt-2 inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-wide uppercase">
      {source === "resume"
        ? "Origem: extraído do currículo"
        : "Origem: informado manualmente"}
    </span>
  );
}

export default async function HrCandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("candidates:manage");
  const [
    accountResult,
    profileResult,
    experiencesResult,
    educationResult,
    certificationsResult,
    skillsResult,
    resumesResult,
    applicationsResult,
  ] = await Promise.all([
    supabase.from("candidate_accounts").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", id)
      .maybeSingle(),
    supabase
      .from("candidate_experiences")
      .select("*")
      .eq("candidate_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("candidate_education")
      .select("*")
      .eq("candidate_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("candidate_certifications")
      .select("*")
      .eq("candidate_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("candidate_skills")
      .select("*")
      .eq("candidate_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("candidate_resumes")
      .select("*")
      .eq("candidate_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("career_job_applications")
      .select(
        "id, job_id, status, process_label, submitted_at, job:career_jobs(title)",
      )
      .eq("candidate_id", id)
      .order("submitted_at", { ascending: false }),
  ]);
  if (accountResult.error || !accountResult.data) notFound();

  const account = accountResult.data as CandidateAccountRow;
  const profile =
    (profileResult.data as CandidateProfessionalProfile | null) ?? null;
  const experiences =
    (experiencesResult.data as CandidateExperience[] | null) ?? [];
  const education = (educationResult.data as CandidateEducation[] | null) ?? [];
  const certifications =
    (certificationsResult.data as CandidateCertification[] | null) ?? [];
  const skills = (skillsResult.data as CandidateSkill[] | null) ?? [];
  const resumes = (resumesResult.data as CandidateResume[] | null) ?? [];
  const applications =
    (applicationsResult.data as unknown as CandidateApplicationRow[] | null) ??
    [];

  const admin = createSupabaseAdminClient();
  const authResult = admin ? await admin.auth.admin.getUserById(id) : null;
  const email = authResult?.data.user?.email ?? null;
  const completion = calculateCandidateProfileCompletion({
    fullName: account.full_name,
    email,
    profile,
    experienceCount: experiences.length,
    educationCount: education.length,
    skillCount: skills.length,
    resumeCount: resumes.length,
  });

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Candidatos"
        title={account.full_name}
        description="Perfil profissional autodeclarado pelo candidato. A completude indica somente preenchimento e não representa score."
      />
      <HrNavigation current="candidates" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5">
        <div>
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            Preenchimento do perfil
          </p>
          <p className="font-heading text-brand-dark mt-1 text-3xl font-semibold">
            {completion}%
          </p>
        </div>
        <p className="text-muted max-w-xl text-sm">
          Não é avaliação profissional, ranking, aderência ou pontuação de
          seleção.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title="Dados pessoais e objetivo">
          <p className="text-muted mb-5 text-xs">
            Dados confirmados pelo candidato antes de serem incorporados ao
            perfil.
          </p>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">E-mail</dt>
              <dd className="text-ink mt-1 font-bold break-all">
                {email ?? "Não disponível"}
              </dd>
              <OriginBadge source={profile?.field_sources?.email} />
            </div>
            <div>
              <dt className="text-muted">WhatsApp</dt>
              <dd className="text-ink mt-1 font-bold">
                {profile?.whatsapp ?? "Não informado"}
              </dd>
              <OriginBadge source={profile?.field_sources?.whatsapp} />
            </div>
            <div>
              <dt className="text-muted">Cidade</dt>
              <dd className="text-ink mt-1 font-bold">
                {profile?.city ?? "Não informada"}
              </dd>
              <OriginBadge source={profile?.field_sources?.city} />
            </div>
            <div>
              <dt className="text-muted">UF</dt>
              <dd className="text-ink mt-1 font-bold">
                {profile?.state ?? "Não informada"}
              </dd>
              <OriginBadge source={profile?.field_sources?.state} />
            </div>
          </dl>
          <div className="border-border-light mt-5 border-t pt-5">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Objetivo profissional
            </h3>
            <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-line">
              {profile?.professional_objective ?? "Não informado"}
            </p>
            <OriginBadge
              source={profile?.field_sources?.professional_objective}
            />
          </div>
          <div className="border-border-light mt-5 border-t pt-5">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Sobre o candidato
            </h3>
            <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-line">
              {profile?.about ?? "Não informado"}
            </p>
            <OriginBadge source={profile?.field_sources?.about} />
          </div>
          <div className="border-border-light mt-5 border-t pt-5">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Disponibilidade
            </h3>
            <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-line">
              {profile?.availability ?? "Não informada"}
            </p>
          </div>
        </DetailSection>

        <DetailSection title="Habilidades autodeclaradas">
          {skills.length ? (
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  className="bg-mint text-brand-dark rounded-full px-4 py-2 text-sm font-bold"
                >
                  {skill.name}
                  <span className="text-brand/70 text-[0.65rem] font-semibold">
                    {skill.data_source === "resume" ? "currículo" : "manual"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm">Nenhuma habilidade informada.</p>
          )}
          <p className="text-muted mt-5 text-xs leading-relaxed">
            Estas habilidades foram declaradas pelo candidato e ainda não foram
            verificadas pela INNEURO.
          </p>
        </DetailSection>

        <DetailSection title="Experiências profissionais">
          {experiences.length ? (
            <ol className="grid gap-4">
              {experiences.map((item) => (
                <li
                  key={item.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <h3 className="text-ink font-bold">{item.job_title}</h3>
                  <p className="text-muted mt-1 text-sm">{item.company}</p>
                  <p className="text-muted mt-1 text-xs">
                    {formatCandidateMonth(item.start_date)} até{" "}
                    {item.is_current
                      ? "o momento"
                      : formatCandidateMonth(item.end_date)}
                  </p>
                  <p className="text-ink mt-3 text-sm leading-relaxed whitespace-pre-line">
                    {item.activities}
                  </p>
                  <OriginBadge source={item.data_source} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">Nenhuma experiência informada.</p>
          )}
        </DetailSection>

        <DetailSection title="Escolaridade">
          {education.length ? (
            <ol className="grid gap-4">
              {education.map((item) => (
                <li
                  key={item.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <h3 className="text-ink font-bold">{item.course}</h3>
                  <p className="text-muted mt-1 text-sm">
                    {item.education_level} · {item.institution}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    {formatCandidateMonth(item.start_date)} até{" "}
                    {item.in_progress
                      ? "em andamento"
                      : formatCandidateMonth(item.end_date)}
                  </p>
                  <OriginBadge source={item.data_source} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">Nenhuma formação informada.</p>
          )}
        </DetailSection>

        <DetailSection title="Cursos e certificações">
          {certifications.length ? (
            <ol className="grid gap-4">
              {certifications.map((item) => (
                <li
                  key={item.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <h3 className="text-ink font-bold">{item.name}</h3>
                  <p className="text-muted mt-1 text-sm">
                    {item.institution} · {item.completion_year}
                  </p>
                  {item.expires_at ? (
                    <p className="text-muted mt-1 text-xs">
                      Validade:{" "}
                      {new Date(
                        `${item.expires_at}T12:00:00`,
                      ).toLocaleDateString("pt-BR")}
                    </p>
                  ) : null}
                  <OriginBadge source={item.data_source} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">
              Nenhum curso ou certificação informado.
            </p>
          )}
        </DetailSection>

        <DetailSection title="Currículo privado">
          {resumes.length ? (
            <ol className="grid gap-3">
              {resumes.map((resume) => (
                <li
                  key={resume.id}
                  className="border-border-light flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
                >
                  <div>
                    <p className="text-ink font-bold">
                      Versão {resume.version}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {resume.original_name} ·{" "}
                      {formatFileSize(resume.size_bytes)}
                    </p>
                  </div>
                  <a
                    className="text-brand text-sm font-bold hover:underline"
                    href={`/api/admin/rh/curriculos/${resume.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir PDF com acesso auditado
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">Nenhum currículo enviado.</p>
          )}
          <p className="text-muted mt-4 text-xs">
            Cada acesso é autorizado no servidor, auditado e usa link
            temporário.
          </p>
        </DetailSection>

        <DetailSection title="Candidaturas">
          {applicationsResult.error ? (
            <p className="text-error text-sm">
              Não foi possível carregar as candidaturas.
            </p>
          ) : applications.length ? (
            <ol className="grid gap-3">
              {applications.map((application) => (
                <li
                  key={application.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-ink font-bold">
                        {application.job?.title ?? "Vaga indisponível"}
                      </h3>
                      <p className="text-muted mt-1 text-xs">
                        {formatApplicationDate(application.submitted_at)}
                      </p>
                      {application.process_label ? (
                        <p className="text-muted mt-1 text-xs">
                          Processo: {application.process_label}
                        </p>
                      ) : null}
                    </div>
                    <span className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-bold">
                      {applicationStatusLabels[application.status]}
                    </span>
                  </div>
                  <Link
                    className="text-brand mt-3 inline-flex text-sm font-bold hover:underline"
                    href={`/admin/rh/vagas/${application.job_id}/candidaturas/${application.id}`}
                  >
                    Abrir candidatura
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">Nenhuma candidatura enviada.</p>
          )}
        </DetailSection>
      </div>
    </>
  );
}
