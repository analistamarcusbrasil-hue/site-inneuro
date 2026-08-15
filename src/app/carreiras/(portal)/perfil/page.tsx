import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { candidateLogoutAction } from "@/app/carreiras/actions";
import {
  addCandidateSkillAction,
  deleteCandidateCertificationAction,
  deleteCandidateEducationAction,
  deleteCandidateExperienceAction,
  deleteCandidateResumeAction,
  deleteCandidateSkillAction,
  moveCandidateRecordAction,
  uploadCandidateResumeAction,
} from "@/app/carreiras/profile-actions";
import {
  CandidateBaseProfileForm,
  CandidateCertificationForm,
  CandidateEducationForm,
  CandidateExperienceForm,
} from "@/components/careers/candidate-profile-forms";
import { Container } from "@/components/layout/container";
import { requireCandidateSession } from "@/lib/careers/auth";
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
import { resumeExtractionRecordSchema } from "@/lib/careers/resume-extraction";

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
  "resume-deleted": "Versão do currículo excluída.",
  "order-saved": "Ordem atualizada.",
  "order-unchanged": "O item já está nessa posição.",
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
    "Não conseguimos identificar todas as informações do currículo. Você pode completar seu perfil manualmente.",
  "resume-delete": "Não foi possível excluir esta versão do currículo.",
  reorder: "Não foi possível alterar a ordem.",
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

export default async function CandidateProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
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
      .order("version", { ascending: false }),
    supabase
      .from("candidate_resume_extractions")
      .select("*")
      .eq("candidate_id", user.id)
      .in("status", ["ready", "partial"])
      .order("created_at", { ascending: false }),
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
  const pendingExtractions = (extractionsResult.data ?? []).flatMap((item) => {
    const parsed = resumeExtractionRecordSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
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
                Seu perfil profissional
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
            title="Currículo"
            description="Envie somente PDF com texto selecionável, com até 10 MB. O arquivo fica privado; antes de atualizar seu perfil, você revisará tudo o que for identificado."
          >
            {pendingExtractions.length ? (
              <div className="bg-mint text-brand-dark mb-5 rounded-2xl p-5">
                <p className="font-bold">
                  Você tem {pendingExtractions.length} análise(s) para revisar.
                </p>
                <ul className="mt-3 grid gap-2">
                  {pendingExtractions.map((extraction) => (
                    <li key={extraction.id}>
                      <a
                        className="text-brand text-sm font-bold hover:underline"
                        href={`/carreiras/perfil/revisar-curriculo/${extraction.id}`}
                      >
                        Revisar informações identificadas em{" "}
                        {new Date(extraction.created_at).toLocaleString(
                          "pt-BR",
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <form
              action={uploadCandidateResumeAction}
              className="border-brand/20 bg-mint/30 rounded-2xl border p-5"
            >
              <label className="text-ink block text-sm font-bold">
                Escolher currículo em PDF
                <input
                  className="border-border-light mt-2 block w-full rounded-xl border bg-white p-3 text-sm font-normal"
                  name="resume"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                />
              </label>
              <button className="bg-brand hover:bg-brand-dark mt-4 min-h-11 rounded-full px-6 text-sm font-bold text-white">
                Enviar nova versão
              </button>
            </form>
            <ul className="mt-5 grid gap-3">
              {resumeLinks.map((resume) => (
                <li
                  key={resume.id}
                  className="border-border-light flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4"
                >
                  <div>
                    <p className="text-ink font-bold">
                      Versão {resume.version} · {resume.original_name}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {formatFileSize(resume.size_bytes)} ·{" "}
                      {new Date(resume.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {resume.signedUrl ? (
                      <a
                        className="text-brand text-sm font-bold hover:underline"
                        href={resume.signedUrl}
                      >
                        Abrir PDF
                      </a>
                    ) : null}
                    <form action={deleteCandidateResumeAction}>
                      <input type="hidden" name="id" value={resume.id} />
                      <button className="text-error text-sm font-bold hover:underline">
                        Excluir
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            {!resumeLinks.length ? (
              <p className="text-muted mt-4 text-sm">
                Nenhum currículo enviado.
              </p>
            ) : null}
          </ProfileSection>
        </div>
      </Container>
    </main>
  );
}
