import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  calculateCandidateProfileCompletion,
  CANDIDATE_RESUME_BUCKET,
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

  const admin = createSupabaseAdminClient();
  const authResult = admin ? await admin.auth.admin.getUserById(id) : null;
  const email = authResult?.data.user?.email ?? null;
  const resumeLinks = await Promise.all(
    resumes.map(async (resume) => {
      const { data } = await supabase.storage
        .from(CANDIDATE_RESUME_BUCKET)
        .createSignedUrl(resume.storage_path, 300);
      return { ...resume, signedUrl: data?.signedUrl ?? null };
    }),
  );
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
      <HrNavigation current="candidates" canManageCandidates />

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
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">E-mail</dt>
              <dd className="text-ink mt-1 font-bold break-all">
                {email ?? "Não disponível"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">WhatsApp</dt>
              <dd className="text-ink mt-1 font-bold">
                {profile?.whatsapp ?? "Não informado"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Cidade</dt>
              <dd className="text-ink mt-1 font-bold">
                {profile?.city ?? "Não informada"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">UF</dt>
              <dd className="text-ink mt-1 font-bold">
                {profile?.state ?? "Não informada"}
              </dd>
            </div>
          </dl>
          <div className="border-border-light mt-5 border-t pt-5">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Objetivo profissional
            </h3>
            <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-line">
              {profile?.professional_objective ?? "Não informado"}
            </p>
          </div>
          <div className="border-border-light mt-5 border-t pt-5">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Sobre o candidato
            </h3>
            <p className="text-ink mt-2 text-sm leading-relaxed whitespace-pre-line">
              {profile?.about ?? "Não informado"}
            </p>
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
          {resumeLinks.length ? (
            <ol className="grid gap-3">
              {resumeLinks.map((resume) => (
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
                  {resume.signedUrl ? (
                    <a
                      className="text-brand text-sm font-bold hover:underline"
                      href={resume.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir PDF temporário
                    </a>
                  ) : (
                    <span className="text-muted text-xs">
                      Arquivo indisponível
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">Nenhum currículo enviado.</p>
          )}
          <p className="text-muted mt-4 text-xs">
            Os links expiram em 5 minutos e não são URLs públicas permanentes.
          </p>
        </DetailSection>
      </div>
    </>
  );
}
