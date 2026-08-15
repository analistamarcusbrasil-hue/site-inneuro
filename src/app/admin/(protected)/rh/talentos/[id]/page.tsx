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
import {
  selectionProcessStatusLabels,
  selectionStageLabels,
  type SelectionProcessStatus,
  type SelectionStage,
} from "@/lib/careers/selection-processes";
import {
  formatTalentPoolUpdate,
  type TalentPoolMembership,
} from "@/lib/careers/talent-pool";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CandidateAccountRow = { id: string; full_name: string };
type TalentInterestRow = { area: { name: string } | null };
type ApplicationRow = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  submitted_at: string;
  job: { title: string } | null;
};
type ProcessHistoryRow = {
  id: string;
  stage: SelectionStage;
  created_at: string;
  updated_at: string;
  process: {
    id: string;
    name: string;
    status: SelectionProcessStatus;
    job: { title: string } | null;
  } | null;
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

export default async function HrTalentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("talent-bank:manage");
  const [
    membershipResult,
    accountResult,
    profileResult,
    interestsResult,
    experiencesResult,
    educationResult,
    certificationsResult,
    skillsResult,
    resumesResult,
    applicationsResult,
    processesResult,
  ] = await Promise.all([
    supabase
      .from("career_talent_pool_memberships")
      .select("*")
      .eq("candidate_id", id)
      .in("status", ["active", "deletion_requested"])
      .maybeSingle(),
    supabase
      .from("candidate_accounts")
      .select("id, full_name")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", id)
      .maybeSingle(),
    supabase
      .from("career_talent_pool_interests")
      .select("area:career_job_areas(name)")
      .eq("candidate_id", id),
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
      .select("id, job_id, status, submitted_at, job:career_jobs(title)")
      .eq("candidate_id", id)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("career_selection_process_candidates")
      .select(
        "id, stage, created_at, updated_at, process:career_selection_processes(id, name, status, job:career_jobs(title))",
      )
      .eq("candidate_id", id)
      .order("updated_at", { ascending: false }),
  ]);
  if (
    membershipResult.error ||
    !membershipResult.data ||
    accountResult.error ||
    !accountResult.data
  ) {
    notFound();
  }

  const membership = membershipResult.data as TalentPoolMembership;
  const account = accountResult.data as CandidateAccountRow;
  const profile =
    (profileResult.data as CandidateProfessionalProfile | null) ?? null;
  const interests =
    (interestsResult.data as unknown as TalentInterestRow[] | null) ?? [];
  const experiences =
    (experiencesResult.data as CandidateExperience[] | null) ?? [];
  const education = (educationResult.data as CandidateEducation[] | null) ?? [];
  const certifications =
    (certificationsResult.data as CandidateCertification[] | null) ?? [];
  const skills = (skillsResult.data as CandidateSkill[] | null) ?? [];
  const resumes = (resumesResult.data as CandidateResume[] | null) ?? [];
  const applications =
    (applicationsResult.data as unknown as ApplicationRow[] | null) ?? [];
  const processes =
    (processesResult.data as unknown as ProcessHistoryRow[] | null) ?? [];
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

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Banco de Talentos"
        title={account.full_name}
        description="Perfil profissional autodeclarado. A participação no Banco de Talentos é voluntária e não representa pontuação ou recomendação automática."
      />
      <HrNavigation current="talent" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white p-5">
        <div>
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            Última atualização profissional
          </p>
          <p className="text-brand-dark mt-1 font-bold">
            {formatTalentPoolUpdate(membership.professional_updated_at)}
          </p>
        </div>
        {membership.status === "deletion_requested" ? (
          <span className="bg-warning/10 text-warning rounded-full px-4 py-2 text-xs font-bold">
            Exclusão solicitada
          </span>
        ) : (
          <span className="bg-mint text-brand-dark rounded-full px-4 py-2 text-xs font-bold">
            Participando do banco
          </span>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title="Perfil e interesses">
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
              <dt className="text-muted">Cidade/UF</dt>
              <dd className="text-ink mt-1 font-bold">
                {[profile?.city, profile?.state].filter(Boolean).join("/") ||
                  "Não informado"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Disponibilidade</dt>
              <dd className="text-ink mt-1 font-bold whitespace-pre-line">
                {profile?.availability ?? "Não informada"}
              </dd>
            </div>
          </dl>
          <div className="border-border-light mt-5 border-t pt-5">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Áreas de interesse
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {interests.length ? (
                interests.map((item) =>
                  item.area?.name ? (
                    <span
                      key={item.area.name}
                      className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-bold"
                    >
                      {item.area.name}
                    </span>
                  ) : null,
                )
              ) : (
                <p className="text-muted text-sm">Nenhuma área informada.</p>
              )}
            </div>
          </div>
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
          <p className="text-muted mt-4 text-xs">
            As habilidades são autodeclaradas e não foram automaticamente
            verificadas.
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
            Os links expiram em 5 minutos.
          </p>
        </DetailSection>

        <DetailSection title="Candidaturas">
          {applications.length ? (
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

        <DetailSection title="Processos seletivos anteriores e atuais">
          {processes.length ? (
            <ol className="grid gap-3">
              {processes.map((item) => (
                <li
                  key={item.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-ink font-bold">
                        {item.process?.name ?? "Processo indisponível"}
                      </h3>
                      <p className="text-muted mt-1 text-xs">
                        {item.process?.job?.title ?? "Vaga indisponível"}
                      </p>
                    </div>
                    <span className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-bold">
                      {selectionStageLabels[item.stage]}
                    </span>
                  </div>
                  <p className="text-muted mt-3 text-xs">
                    Processo:{" "}
                    {item.process
                      ? selectionProcessStatusLabels[item.process.status]
                      : "Indisponível"}{" "}
                    · Atualizado em {formatTalentPoolUpdate(item.updated_at)}
                  </p>
                  {item.process ? (
                    <Link
                      className="text-brand mt-3 inline-flex text-sm font-bold hover:underline"
                      href={`/admin/rh/processos/${item.process.id}`}
                    >
                      Abrir processo
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted text-sm">
              Nenhuma participação em processo seletivo.
            </p>
          )}
        </DetailSection>
      </div>
    </>
  );
}
