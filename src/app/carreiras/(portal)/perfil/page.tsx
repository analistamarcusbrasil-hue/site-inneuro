import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { candidateLogoutAction } from "@/app/carreiras/actions";
import { requestCandidateDataDeletionAction } from "@/app/carreiras/privacy-actions";
import {
  addCandidateSkillAction,
  deleteCandidateCertificationAction,
  deleteCandidateEducationAction,
  deleteCandidateExperienceAction,
  deleteCandidateSkillAction,
  moveCandidateRecordAction,
} from "@/app/carreiras/profile-actions";
import {
  CandidateBaseProfileForm,
  CandidateCertificationForm,
  CandidateEducationForm,
  CandidateExperienceForm,
} from "@/components/careers/candidate-profile-forms";
import { CandidateResumeUpload } from "@/components/careers/candidate-resume-upload";
import { CandidateTalentPool } from "@/components/careers/candidate-talent-pool";
import { Container } from "@/components/layout/container";
import { requireCandidateSession } from "@/lib/careers/auth";
import { safeCareersDestination } from "@/lib/careers/auth-validation";
import {
  calculateCandidateProfileCompletion,
  CANDIDATE_RESUME_BUCKET,
  formatCandidateMonth,
  type CandidateCertification,
  type CandidateEducation,
  type CandidateExperience,
  type CandidateProfessionalProfile,
  type CandidateResume,
  type CandidateSkill,
} from "@/lib/careers/profile";
import {
  countExtractedResumeFields,
  resumeExtractionRecordSchema,
  type ResumeExtractionRecord,
} from "@/lib/careers/resume-extraction";
import type {
  TalentPoolArea,
  TalentPoolMembership,
} from "@/lib/careers/talent-pool";

export const metadata: Metadata = {
  title: "Perfil profissional | Carreiras INNEURO",
};

const statusMessages: Record<string, string> = {
  "profile-saved": "Dados pessoais salvos.",
  "profile-email-confirmation":
    "Dados salvos. Confirme o novo e-mail usando a mensagem enviada pelo Supabase.",
  "experience-saved": "Experiência profissional salva.",
  "experience-deleted": "Experiência profissional excluída.",
  "education-saved": "Formação salva.",
  "education-deleted": "Formação excluída.",
  "certification-saved": "Curso ou certificação salvo.",
  "certification-deleted": "Curso ou certificação excluído.",
  "skill-saved": "Habilidade adicionada.",
  "skill-deleted": "Habilidade excluída.",
  "resume-saved": "Currículo PDF enviado com segurança.",
  "resume-analysis-applied":
    "Informações selecionadas do currículo adicionadas ao perfil.",
  "resume-analysis-ignored":
    "As sugestões do currículo foram ignoradas. Seu perfil não foi alterado.",
  "order-saved": "Ordem atualizada.",
  "order-unchanged": "O item já está nessa posição.",
  "talent-saved": "Participação no Banco de Talentos atualizada.",
  "talent-left": "Você saiu do Banco de Talentos.",
  "talent-deletion-requested":
    "Solicitação de exclusão da participação registrada.",
  "data-deletion-requested":
    "Solicitação de exclusão dos dados registrada para análise.",
};

const errorMessages: Record<string, string> = {
  "profile-validation": "Revise os dados pessoais informados.",
  "profile-save": "Não foi possível salvar o perfil.",
  email: "Não foi possível solicitar a alteração do e-mail.",
  "experience-validation": "Revise os dados da experiência profissional.",
  "experience-save": "Não foi possível salvar a experiência.",
  "experience-delete": "Não foi possível excluir a experiência.",
  "education-validation": "Revise os dados da formação.",
  "education-save": "Não foi possível salvar a formação.",
  "education-delete": "Não foi possível excluir a formação.",
  "certification-validation": "Revise os dados do curso ou certificação.",
  "certification-save": "Não foi possível salvar o curso ou certificação.",
  "certification-delete": "Não foi possível excluir o curso ou certificação.",
  "skill-validation": "Informe uma habilidade válida.",
  "skill-duplicate": "Essa habilidade já está no seu perfil.",
  "skill-save": "Não foi possível adicionar a habilidade.",
  "skill-delete": "Não foi possível excluir a habilidade.",
  "resume-file": "Escolha um currículo em PDF.",
  "resume-size": "O currículo deve ter no máximo 10 MB.",
  "resume-type": "Envie somente um arquivo PDF válido.",
  "resume-upload": "Não foi possível enviar o currículo.",
  "resume-save": "O arquivo foi enviado, mas não pôde ser registrado.",
  "resume-analysis":
    "O currículo foi enviado, mas a análise não pôde ser registrada. Você pode completar o perfil manualmente.",
  "resume-analysis-failed":
    "Não encontramos texto suficiente neste PDF. Ele pode ser uma imagem ou digitalização. Envie uma versão com texto selecionável ou complete seu perfil manualmente.",
  "resume-required": "Envie seu currículo antes de confirmar sua candidatura.",
  reorder: "Não foi possível alterar a ordem.",
  "talent-areas": "Escolha pelo menos uma área profissional de interesse.",
  "talent-save": "Não foi possível atualizar o Banco de Talentos.",
  "talent-resume-required":
    "Envie seu currículo antes de participar do Banco de Talentos.",
  "talent-leave": "Não foi possível sair do Banco de Talentos.",
  "talent-deletion": "Não foi possível solicitar a exclusão.",
  "talent-deletion-pending":
    "Sua solicitação de exclusão ainda está sendo processada.",
  "data-deletion": "Não foi possível registrar a solicitação de exclusão.",
  "data-deletion-pending": "Já existe uma solicitação de exclusão em análise.",
};

function ProfileSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-border-light rounded-[2rem] border bg-white p-6 shadow-[0_14px_40px_rgba(3,37,27,0.05)] sm:p-8">
      <h2 className="font-heading text-brand-dark text-2xl font-semibold">
        {title}
      </h2>
      <p className="text-muted mt-2 max-w-3xl text-sm leading-relaxed">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function ResumeStartCard({
  candidateId,
  currentResume,
  next,
  onboarding,
  pendingExtractions,
}: {
  candidateId: string;
  currentResume: (CandidateResume & { signedUrl: string | null }) | null;
  next?: string;
  onboarding: boolean;
  pendingExtractions: ResumeExtractionRecord[];
}) {
  const latestExtraction = pendingExtractions[0] ?? null;
  const identifiedCount = latestExtraction
    ? countExtractedResumeFields(latestExtraction.extracted_data)
    : 0;

  return (
    <section className="border-brand/25 bg-mint/70 rounded-[2rem] border p-6 shadow-[0_18px_50px_rgba(3,37,27,0.08)] sm:p-8">
      <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
        {onboarding ? "Passo 1" : "Currículo profissional"}
      </p>
      <h2 className="font-heading text-brand-dark mt-3 text-2xl font-semibold sm:text-3xl">
        {onboarding ? "Envie seu currículo" : "Mantenha seu currículo atual"}
      </h2>
      <p className="text-ink mt-3 max-w-3xl leading-relaxed">
        {onboarding
          ? "Para continuar sua candidatura, envie primeiro seu currículo em PDF."
          : "Envie seu currículo em PDF. Vamos identificar suas informações profissionais e preencher seu perfil para você revisar."}
      </p>

      {latestExtraction ? (
        <div className="border-brand/20 mt-6 rounded-2xl border bg-white p-5">
          <p className="text-brand-dark font-bold">
            Encontramos {identifiedCount}{" "}
            {identifiedCount === 1 ? "informação" : "informações"} no seu
            currículo.
          </p>
          <p className="text-muted mt-2 text-sm">
            Nada será aplicado sem sua confirmação. Se já houver um valor
            manual, você verá a comparação antes de escolher.
          </p>
          <Link
            className="bg-brand hover:bg-brand-dark mt-4 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-bold text-white"
            href={`/carreiras/perfil/revisar-curriculo/${latestExtraction.id}`}
          >
            Revisar e preencher meu perfil
          </Link>
        </div>
      ) : null}
      <CandidateResumeUpload
        candidateId={candidateId}
        currentResume={currentResume}
        next={next}
      />
    </section>
  );
}

export default async function CandidateProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    error?: string;
    onboarding?: string;
    next?: string;
  }>;
}) {
  const { user, account, supabase } = await requireCandidateSession();
  const query = await searchParams;
  const [
    profileResult,
    experiencesResult,
    educationResult,
    certificationsResult,
    skillsResult,
    resumesResult,
    extractionsResult,
    talentMembershipResult,
    talentInterestsResult,
    talentAreasResult,
    consentsResult,
    deletionRequestResult,
  ] = await Promise.all([
    supabase
      .from("candidate_profiles")
      .select("*")
      .eq("candidate_id", user.id)
      .maybeSingle(),
    supabase
      .from("candidate_experiences")
      .select("*")
      .eq("candidate_id", user.id)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: false }),
    supabase
      .from("candidate_education")
      .select("*")
      .eq("candidate_id", user.id)
      .order("sort_order", { ascending: true })
      .order("start_date", { ascending: false }),
    supabase
      .from("candidate_certifications")
      .select("*")
      .eq("candidate_id", user.id)
      .order("sort_order", { ascending: true })
      .order("completion_year", { ascending: false }),
    supabase
      .from("candidate_skills")
      .select("*")
      .eq("candidate_id", user.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("candidate_resumes")
      .select("*")
      .eq("candidate_id", user.id)
      .order("version", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("candidate_resume_extractions")
      .select("*")
      .eq("candidate_id", user.id)
      .in("status", ["ready", "partial"])
      .order("created_at", { ascending: false }),
    supabase
      .from("career_talent_pool_memberships")
      .select("*")
      .eq("candidate_id", user.id)
      .maybeSingle(),
    supabase
      .from("career_talent_pool_interests")
      .select("area_id")
      .eq("candidate_id", user.id),
    supabase
      .from("career_job_areas")
      .select("id, name, slug, is_active")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("candidate_consents")
      .select("id, consent_type, purpose, granted, recorded_at")
      .eq("candidate_id", user.id)
      .order("recorded_at", { ascending: false }),
    supabase
      .from("candidate_data_deletion_requests")
      .select("id, status, requested_at")
      .eq("candidate_id", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile =
    (profileResult.data as CandidateProfessionalProfile | null) ?? null;
  const experiences =
    (experiencesResult.data as CandidateExperience[] | null) ?? [];
  const education = (educationResult.data as CandidateEducation[] | null) ?? [];
  const certifications =
    (certificationsResult.data as CandidateCertification[] | null) ?? [];
  const skills = (skillsResult.data as CandidateSkill[] | null) ?? [];
  const resumes = (resumesResult.data as CandidateResume[] | null) ?? [];
  const talentMembership =
    (talentMembershipResult.data as TalentPoolMembership | null) ?? null;
  const talentAreas = (talentAreasResult.data as TalentPoolArea[] | null) ?? [];
  const selectedTalentAreaIds = (talentInterestsResult.data ?? []).map(
    (interest) => String(interest.area_id),
  );
  const currentResume = resumes[0] ?? null;
  const pendingExtractions = (extractionsResult.data ?? []).flatMap((item) => {
    const parsed = resumeExtractionRecordSchema.safeParse(item);
    return parsed.success && parsed.data.resume_id === currentResume?.id
      ? [parsed.data]
      : [];
  });
  const consents = consentsResult.data ?? [];
  const deletionRequest = deletionRequestResult.data;
  const resumeLinks = await Promise.all(
    resumes.map(async (resume) => {
      const { data } = await supabase.storage
        .from(CANDIDATE_RESUME_BUCKET)
        .createSignedUrl(resume.storage_path, 300);
      return { ...resume, signedUrl: data?.signedUrl ?? null };
    }),
  );
  const safeNext = query.next ? safeCareersDestination(query.next) : undefined;
  const completion = calculateCandidateProfileCompletion({
    fullName: account.full_name,
    email: user.email,
    profile,
    experienceCount: experiences.length,
    educationCount: education.length,
    skillCount: skills.length,
    resumeCount: resumes.length,
  });

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-screen pt-28 pb-16 sm:pt-36 sm:pb-24"
    >
      <Container>
        <header className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
                Área privada do candidato
              </p>
              <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                {completion < 70
                  ? "Complete seu perfil profissional"
                  : "Seu perfil profissional"}
              </h1>
              <p className="text-muted mt-3 max-w-2xl leading-relaxed">
                Mantenha suas informações atualizadas. Você poderá editar ou
                excluir seus dados sempre que necessário.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="bg-brand hover:bg-brand-dark inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold text-white"
                href="/carreiras/candidaturas"
              >
                Minhas candidaturas
              </Link>
              <form action={candidateLogoutAction}>
                <button className="border-brand/30 text-brand-dark hover:bg-mint min-h-11 rounded-full border px-6 text-sm font-bold">
                  Sair da conta
                </button>
              </form>
            </div>
          </div>

          <section
            aria-label={`Perfil ${completion}% completo`}
            className="border-border-light mt-7 rounded-3xl border bg-white p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-brand-dark font-bold">
                Perfil {completion}% completo
              </p>
              <span className="text-muted text-xs">
                Indica somente o preenchimento
              </span>
            </div>
            <div className="bg-border-light mt-3 h-2 overflow-hidden rounded-full">
              <div
                className="bg-brand h-full rounded-full"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="text-muted mt-3 text-xs">
              Este percentual não é avaliação, pontuação ou score profissional.
            </p>
          </section>

          {query.status && statusMessages[query.status] ? (
            <p
              role="status"
              className="bg-mint text-brand-dark mt-5 rounded-2xl p-4 text-sm font-bold"
            >
              {statusMessages[query.status]}
            </p>
          ) : null}
          {query.error && errorMessages[query.error] ? (
            <p
              role="alert"
              className="bg-error/10 text-error mt-5 rounded-2xl p-4 text-sm font-bold"
            >
              {errorMessages[query.error]}
            </p>
          ) : null}
        </header>

        <div className="mx-auto mt-8 grid max-w-5xl gap-6">
          <ResumeStartCard
            candidateId={user.id}
            currentResume={resumeLinks[0] ?? null}
            next={safeNext}
            onboarding={query.onboarding === "resume"}
            pendingExtractions={pendingExtractions}
          />

          <ProfileSection
            title="Dados pessoais e objetivo"
            description="Solicitamos somente as informações necessárias ao recrutamento. Não informe CPF, RG ou dados médicos."
          >
            <CandidateBaseProfileForm
              fullName={account.full_name}
              email={user.email ?? ""}
              profile={profile}
            />
          </ProfileSection>

          <ProfileSection
            title="Banco de Talentos INNEURO"
            description="Autorize voluntariamente que o RH encontre seu perfil por critérios exclusivamente profissionais."
          >
            <CandidateTalentPool
              areas={talentAreas}
              membership={talentMembership}
              selectedAreaIds={selectedTalentAreaIds}
              hasResume={Boolean(currentResume)}
            />
          </ProfileSection>

          <ProfileSection
            title="Experiências profissionais"
            description="Adicione suas experiências, atualize as informações e organize a ordem de apresentação."
          >
            <div className="grid gap-4">
              {experiences.length ? (
                experiences.map((experience, index) => (
                  <article
                    key={experience.id}
                    className="border-border-light rounded-2xl border p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-ink font-bold">
                          {experience.job_title}
                        </h3>
                        <p className="text-muted mt-1 text-sm">
                          {experience.company}
                        </p>
                        <p className="text-muted mt-1 text-xs">
                          {formatCandidateMonth(experience.start_date)} até{" "}
                          {experience.is_current
                            ? "o momento"
                            : formatCandidateMonth(experience.end_date)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(["up", "down"] as const).map((direction) => (
                          <form
                            key={direction}
                            action={moveCandidateRecordAction}
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={experience.id}
                            />
                            <input
                              type="hidden"
                              name="record_type"
                              value="experience"
                            />
                            <input
                              type="hidden"
                              name="direction"
                              value={direction}
                            />
                            <button
                              className="border-border-light min-h-9 rounded-full border px-3 text-xs font-bold disabled:opacity-40"
                              disabled={
                                direction === "up"
                                  ? index === 0
                                  : index === experiences.length - 1
                              }
                            >
                              {direction === "up" ? "Subir" : "Descer"}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                    <p className="text-muted mt-3 text-sm leading-relaxed whitespace-pre-line">
                      {experience.activities}
                    </p>
                    <details className="border-border-light mt-4 border-t pt-4">
                      <summary className="text-brand cursor-pointer text-sm font-bold">
                        Editar experiência
                      </summary>
                      <div className="mt-5">
                        <CandidateExperienceForm experience={experience} />
                        <form
                          action={deleteCandidateExperienceAction}
                          className="mt-4"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={experience.id}
                          />
                          <button className="text-error text-sm font-bold hover:underline">
                            Excluir esta experiência
                          </button>
                        </form>
                      </div>
                    </details>
                  </article>
                ))
              ) : (
                <p className="text-muted rounded-2xl bg-slate-50 p-5 text-sm">
                  Nenhuma experiência adicionada.
                </p>
              )}
            </div>
            <details className="border-brand/20 bg-mint/30 mt-5 rounded-2xl border p-5">
              <summary className="text-brand cursor-pointer font-bold">
                Adicionar experiência
              </summary>
              <div className="mt-5">
                <CandidateExperienceForm />
              </div>
            </details>
          </ProfileSection>

          <ProfileSection
            title="Escolaridade"
            description="Cadastre suas formações concluídas ou em andamento."
          >
            <div className="grid gap-4">
              {education.length ? (
                education.map((item, index) => (
                  <article
                    key={item.id}
                    className="border-border-light rounded-2xl border p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
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
                      </div>
                      <div className="flex gap-2">
                        {(["up", "down"] as const).map((direction) => (
                          <form
                            key={direction}
                            action={moveCandidateRecordAction}
                          >
                            <input type="hidden" name="id" value={item.id} />
                            <input
                              type="hidden"
                              name="record_type"
                              value="education"
                            />
                            <input
                              type="hidden"
                              name="direction"
                              value={direction}
                            />
                            <button
                              className="border-border-light min-h-9 rounded-full border px-3 text-xs font-bold disabled:opacity-40"
                              disabled={
                                direction === "up"
                                  ? index === 0
                                  : index === education.length - 1
                              }
                            >
                              {direction === "up" ? "Subir" : "Descer"}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                    <details className="border-border-light mt-4 border-t pt-4">
                      <summary className="text-brand cursor-pointer text-sm font-bold">
                        Editar formação
                      </summary>
                      <div className="mt-5">
                        <CandidateEducationForm education={item} />
                        <form
                          action={deleteCandidateEducationAction}
                          className="mt-4"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <button className="text-error text-sm font-bold hover:underline">
                            Excluir esta formação
                          </button>
                        </form>
                      </div>
                    </details>
                  </article>
                ))
              ) : (
                <p className="text-muted rounded-2xl bg-slate-50 p-5 text-sm">
                  Nenhuma formação adicionada.
                </p>
              )}
            </div>
            <details className="border-brand/20 bg-mint/30 mt-5 rounded-2xl border p-5">
              <summary className="text-brand cursor-pointer font-bold">
                Adicionar formação
              </summary>
              <div className="mt-5">
                <CandidateEducationForm />
              </div>
            </details>
          </ProfileSection>

          <ProfileSection
            title="Cursos e certificações"
            description="Informe cursos relevantes e a validade quando ela existir."
          >
            <div className="grid gap-4">
              {certifications.length ? (
                certifications.map((item) => (
                  <article
                    key={item.id}
                    className="border-border-light rounded-2xl border p-5"
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
                    <details className="border-border-light mt-4 border-t pt-4">
                      <summary className="text-brand cursor-pointer text-sm font-bold">
                        Editar curso
                      </summary>
                      <div className="mt-5">
                        <CandidateCertificationForm certification={item} />
                        <form
                          action={deleteCandidateCertificationAction}
                          className="mt-4"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <button className="text-error text-sm font-bold hover:underline">
                            Excluir este curso
                          </button>
                        </form>
                      </div>
                    </details>
                  </article>
                ))
              ) : (
                <p className="text-muted rounded-2xl bg-slate-50 p-5 text-sm">
                  Nenhum curso ou certificação adicionado.
                </p>
              )}
            </div>
            <details className="border-brand/20 bg-mint/30 mt-5 rounded-2xl border p-5">
              <summary className="text-brand cursor-pointer font-bold">
                Adicionar curso ou certificação
              </summary>
              <div className="mt-5">
                <CandidateCertificationForm />
              </div>
            </details>
          </ProfileSection>

          <ProfileSection
            title="Habilidades"
            description="As competências são autodeclaradas por você. Adicionar uma habilidade não representa validação ou certificação pela INNEURO."
          >
            <ul className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  className="bg-mint text-brand-dark flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
                >
                  {skill.name}
                  <form action={deleteCandidateSkillAction}>
                    <input type="hidden" name="id" value={skill.id} />
                    <button
                      aria-label={`Excluir habilidade ${skill.name}`}
                      className="text-brand-dark/60 hover:text-error"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            {!skills.length ? (
              <p className="text-muted text-sm">
                Nenhuma habilidade adicionada.
              </p>
            ) : null}
            <form
              action={addCandidateSkillAction}
              className="mt-5 flex flex-col gap-3 sm:flex-row"
            >
              <label className="text-ink flex-1 text-sm font-bold">
                Nova habilidade
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="Exemplo: Atendimento"
                  className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
                />
              </label>
              <button className="bg-brand hover:bg-brand-dark min-h-11 self-end rounded-full px-6 text-sm font-bold text-white">
                Adicionar
              </button>
            </form>
          </ProfileSection>

          <ProfileSection
            title="Privacidade e seus dados"
            description="Consulte autorizações registradas e solicite a exclusão dos dados da conta. A solicitação passa por análise para preservar obrigações legais e históricos necessários."
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="text-ink font-bold">
                  Histórico de autorizações
                </h3>
                {consents.length ? (
                  <ol className="mt-3 grid gap-3 text-sm">
                    {consents.map((consent) => (
                      <li
                        key={consent.id}
                        className="border-border-light rounded-2xl border p-4"
                      >
                        <p className="font-bold">
                          {consent.granted
                            ? "Autorização registrada"
                            : "Autorização encerrada"}
                        </p>
                        <p className="text-muted mt-1 leading-relaxed">
                          {consent.purpose}
                        </p>
                        <p className="text-muted mt-2 text-xs">
                          {new Date(consent.recorded_at).toLocaleString(
                            "pt-BR",
                          )}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted mt-3 text-sm">
                    Nenhuma autorização adicional registrada.
                  </p>
                )}
              </div>
              <div className="border-border-light rounded-2xl border p-5">
                <h3 className="text-ink font-bold">Exclusão dos dados</h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  O pedido não apaga dados imediatamente. O RH analisará
                  candidaturas, obrigações aplicáveis e informará a conclusão.
                </p>
                {deletionRequest &&
                ["requested", "in_review"].includes(deletionRequest.status) ? (
                  <p className="bg-mint text-brand-dark mt-4 rounded-xl p-3 text-sm font-bold">
                    Solicitação em análise desde{" "}
                    {new Date(deletionRequest.requested_at).toLocaleDateString(
                      "pt-BR",
                    )}
                    .
                  </p>
                ) : (
                  <form
                    action={requestCandidateDataDeletionAction}
                    className="mt-4"
                  >
                    <button className="border-error text-error min-h-11 rounded-full border px-5 text-sm font-bold">
                      Solicitar exclusão dos meus dados
                    </button>
                  </form>
                )}
              </div>
            </div>
          </ProfileSection>
        </div>
      </Container>
    </main>
  );
}
