import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import {
  applyResumeExtractionAction,
  ignoreResumeExtractionAction,
} from "@/app/carreiras/resume-review-actions";
import { Container } from "@/components/layout/container";
import { requireCandidateSession } from "@/lib/careers/auth";
import type { CandidateProfessionalProfile } from "@/lib/careers/profile";
import {
  brazilianStates,
  educationLevels,
} from "@/lib/careers/profile-validation";
import {
  buildResumeFieldConflicts,
  isCompleteResumeCertification,
  isCompleteResumeEducation,
  isCompleteResumeExperience,
  resumeExtractionRecordSchema,
} from "@/lib/careers/resume-extraction";

export const metadata: Metadata = {
  title: "Revisar currículo | Carreiras INNEURO",
};

const inputClass =
  "border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-11 w-full rounded-xl border bg-white px-4 outline-none focus:ring-4";
const textareaClass = `${inputClass} min-h-28 py-3`;

function ReviewSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
      <h2 className="font-heading text-brand-dark text-xl font-semibold">
        {title}
      </h2>
      <p className="text-muted mt-2 text-sm leading-relaxed">{description}</p>
      <div className="mt-5 grid gap-4">{children}</div>
    </section>
  );
}

function ChoiceCard({
  name,
  label,
  current,
  conflict,
  children,
}: {
  name: string;
  label: string;
  current?: string | null;
  conflict?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="border-border-light rounded-2xl border p-4">
      <label className="text-ink flex items-start gap-3 text-sm font-bold">
        <input
          className="accent-brand mt-0.5 size-4 shrink-0"
          type="checkbox"
          name={`accept_${name}`}
          defaultChecked={!conflict}
        />
        <span>
          Usar {label.toLocaleLowerCase("pt-BR")}
          {conflict ? (
            <span className="text-warning ml-2 inline-block text-xs font-bold">
              Diferente do perfil atual
            </span>
          ) : null}
        </span>
      </label>
      {current ? (
        <p className="bg-surface text-muted mt-3 rounded-xl p-3 text-xs">
          <strong className="text-ink">Valor atual:</strong> {current}
        </p>
      ) : null}
      <label className="text-ink mt-3 block text-sm font-bold">
        Identificado no currículo — {label}
        {children}
      </label>
    </fieldset>
  );
}

export default async function ResumeReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { user, account, supabase } = await requireCandidateSession();
  const [extractionResult, profileResult, experiencesResult, educationResult] =
    await Promise.all([
      supabase
        .from("candidate_resume_extractions")
        .select("*")
        .eq("id", id)
        .eq("candidate_id", user.id)
        .maybeSingle(),
      supabase
        .from("candidate_profiles")
        .select("*")
        .eq("candidate_id", user.id)
        .maybeSingle(),
      supabase
        .from("candidate_experiences")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", user.id),
      supabase
        .from("candidate_education")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", user.id),
    ]);
  const extraction = resumeExtractionRecordSchema.safeParse(
    extractionResult.data,
  );
  if (
    extractionResult.error ||
    !extraction.success ||
    !["ready", "partial"].includes(extraction.data.status)
  ) {
    notFound();
  }
  const data = extraction.data.extracted_data;
  const profile =
    (profileResult.data as CandidateProfessionalProfile | null) ?? null;
  const conflicts = buildResumeFieldConflicts(
    {
      fullName: account.full_name,
      email: user.email,
      whatsapp: profile?.whatsapp,
      city: profile?.city,
      state: profile?.state,
      professionalObjective: profile?.professional_objective,
      about: profile?.about,
    },
    data,
  );
  const conflictSet = new Set(conflicts);
  const errorMessage =
    query.error === "nothing-selected"
      ? "Selecione ao menos uma informação ou escolha ignorar as sugestões."
      : query.error === "validation"
        ? "Revise os campos selecionados. Itens incompletos podem ser desmarcados."
        : query.error
          ? "Não foi possível concluir a revisão. Tente novamente."
          : null;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-surface min-h-screen pt-28 pb-16 sm:pt-36 sm:pb-24"
    >
      <Container>
        <header className="mx-auto max-w-4xl">
          <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
            Revisão obrigatória
          </p>
          <h1 className="font-heading text-brand-dark mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Encontramos estas informações no seu currículo. Revise antes de
            continuar.
          </h1>
          <p className="text-muted mt-4 max-w-3xl leading-relaxed">
            Marque somente o que deseja levar ao perfil. Você pode editar,
            remover desmarcando o item ou ignorar toda a análise. Nada é salvo
            automaticamente.
          </p>
          {extraction.data.warnings.length ? (
            <div className="bg-warning/10 text-ink mt-5 rounded-2xl p-4 text-sm">
              {extraction.data.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
          {conflicts.length ? (
            <p className="bg-mint text-brand-dark mt-5 rounded-2xl p-4 text-sm font-bold">
              Seu perfil já contém informações diferentes. Compare os valores
              atuais abaixo: nada será substituído sem sua seleção.
            </p>
          ) : null}
          {errorMessage ? (
            <p
              role="alert"
              className="bg-error/10 text-error mt-5 rounded-2xl p-4 text-sm font-bold"
            >
              {errorMessage}
            </p>
          ) : null}
        </header>

        <form
          action={applyResumeExtractionAction}
          className="mx-auto mt-8 grid max-w-4xl gap-6"
        >
          <input type="hidden" name="extraction_id" value={id} />

          {[
            data.fullName,
            data.email,
            data.whatsapp,
            data.city,
            data.state,
            data.professionalObjective,
            data.about,
          ].some(Boolean) ? (
            <ReviewSection
              title="Dados pessoais e apresentação"
              description="Compare os campos diferentes e corrija qualquer leitura incorreta antes de confirmar."
            >
              {data.fullName ? (
                <ChoiceCard
                  name="full_name"
                  label="Nome completo"
                  current={account.full_name}
                  conflict={conflictSet.has("fullName")}
                >
                  <input
                    className={inputClass}
                    name="full_name"
                    maxLength={120}
                    defaultValue={data.fullName}
                  />
                </ChoiceCard>
              ) : null}
              {data.email ? (
                <ChoiceCard
                  name="email"
                  label="E-mail"
                  current={user.email}
                  conflict={conflictSet.has("email")}
                >
                  <input
                    className={inputClass}
                    name="email"
                    type="email"
                    maxLength={254}
                    defaultValue={data.email}
                  />
                </ChoiceCard>
              ) : null}
              {data.whatsapp ? (
                <ChoiceCard
                  name="whatsapp"
                  label="WhatsApp"
                  current={profile?.whatsapp}
                  conflict={conflictSet.has("whatsapp")}
                >
                  <input
                    className={inputClass}
                    name="whatsapp"
                    type="tel"
                    maxLength={24}
                    defaultValue={data.whatsapp}
                  />
                </ChoiceCard>
              ) : null}
              {data.city ? (
                <ChoiceCard
                  name="city"
                  label="Cidade"
                  current={profile?.city}
                  conflict={conflictSet.has("city")}
                >
                  <input
                    className={inputClass}
                    name="city"
                    maxLength={100}
                    defaultValue={data.city}
                  />
                </ChoiceCard>
              ) : null}
              {data.state ? (
                <ChoiceCard
                  name="state"
                  label="UF"
                  current={profile?.state}
                  conflict={conflictSet.has("state")}
                >
                  <select
                    className={inputClass}
                    name="state"
                    defaultValue={data.state}
                  >
                    {brazilianStates.map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                  </select>
                </ChoiceCard>
              ) : null}
              {data.professionalObjective ? (
                <ChoiceCard
                  name="professional_objective"
                  label="Objetivo profissional"
                  current={profile?.professional_objective}
                  conflict={conflictSet.has("professionalObjective")}
                >
                  <textarea
                    className={textareaClass}
                    name="professional_objective"
                    maxLength={500}
                    defaultValue={data.professionalObjective}
                  />
                </ChoiceCard>
              ) : null}
              {data.about ? (
                <ChoiceCard
                  name="about"
                  label="Resumo profissional"
                  current={profile?.about}
                  conflict={conflictSet.has("about")}
                >
                  <textarea
                    className={`${textareaClass} min-h-40`}
                    name="about"
                    maxLength={3000}
                    defaultValue={data.about}
                  />
                </ChoiceCard>
              ) : null}
            </ReviewSection>
          ) : null}

          {data.experiences.length ? (
            <ReviewSection
              title="Experiências profissionais"
              description={`Seu perfil já possui ${experiencesResult.count ?? 0} experiência(s). Os itens selecionados serão adicionados, sem apagar os atuais.`}
            >
              <input
                type="hidden"
                name="experience_count"
                value={data.experiences.length}
              />
              {data.experiences.map((item, index) => (
                <fieldset
                  key={`${item.company}-${index}`}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <label className="text-ink flex items-center gap-3 text-sm font-bold">
                    <input
                      className="accent-brand size-4"
                      type="checkbox"
                      name={`experience_${index}_enabled`}
                      defaultChecked={isCompleteResumeExperience(item)}
                    />
                    Adicionar esta experiência
                  </label>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-ink text-sm font-bold">
                      Empresa
                      <input
                        className={inputClass}
                        name={`experience_${index}_company`}
                        maxLength={160}
                        defaultValue={item.company}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Cargo
                      <input
                        className={inputClass}
                        name={`experience_${index}_job_title`}
                        maxLength={160}
                        defaultValue={item.jobTitle}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Início
                      <input
                        className={inputClass}
                        name={`experience_${index}_start_month`}
                        type="month"
                        defaultValue={item.startMonth ?? ""}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Fim
                      <input
                        className={inputClass}
                        name={`experience_${index}_end_month`}
                        type="month"
                        defaultValue={item.endMonth ?? ""}
                      />
                    </label>
                    <label className="text-muted flex items-center gap-3 text-sm sm:col-span-2">
                      <input
                        className="accent-brand size-4"
                        type="checkbox"
                        name={`experience_${index}_is_current`}
                        defaultChecked={item.isCurrent}
                      />
                      Trabalho atual
                    </label>
                    <label className="text-ink text-sm font-bold sm:col-span-2">
                      Atividades
                      <textarea
                        className={textareaClass}
                        name={`experience_${index}_activities`}
                        maxLength={3000}
                        defaultValue={item.activities ?? ""}
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </ReviewSection>
          ) : (
            <input type="hidden" name="experience_count" value="0" />
          )}

          {data.education.length ? (
            <ReviewSection
              title="Formação"
              description={`Seu perfil já possui ${educationResult.count ?? 0} formação(ões). Se algum dado estiver incompleto, edite-o ou desmarque o item.`}
            >
              <input
                type="hidden"
                name="education_count"
                value={data.education.length}
              />
              {data.education.map((item, index) => (
                <fieldset
                  key={`${item.course}-${index}`}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <label className="text-ink flex items-center gap-3 text-sm font-bold">
                    <input
                      className="accent-brand size-4"
                      type="checkbox"
                      name={`education_${index}_enabled`}
                      defaultChecked={isCompleteResumeEducation(item)}
                    />
                    Adicionar esta formação
                  </label>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-ink text-sm font-bold">
                      Nível
                      <select
                        className={inputClass}
                        name={`education_${index}_level`}
                        defaultValue={item.educationLevel ?? ""}
                      >
                        <option value="">Selecione</option>
                        {educationLevels.map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Curso
                      <input
                        className={inputClass}
                        name={`education_${index}_course`}
                        maxLength={180}
                        defaultValue={item.course}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold sm:col-span-2">
                      Instituição
                      <input
                        className={inputClass}
                        name={`education_${index}_institution`}
                        maxLength={180}
                        defaultValue={item.institution}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Início
                      <input
                        className={inputClass}
                        name={`education_${index}_start_month`}
                        type="month"
                        defaultValue={item.startMonth ?? ""}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Conclusão
                      <input
                        className={inputClass}
                        name={`education_${index}_end_month`}
                        type="month"
                        defaultValue={item.endMonth ?? ""}
                      />
                    </label>
                    <label className="text-muted flex items-center gap-3 text-sm sm:col-span-2">
                      <input
                        className="accent-brand size-4"
                        type="checkbox"
                        name={`education_${index}_in_progress`}
                        defaultChecked={item.inProgress}
                      />
                      Em andamento
                    </label>
                  </div>
                </fieldset>
              ))}
            </ReviewSection>
          ) : (
            <input type="hidden" name="education_count" value="0" />
          )}

          {data.certifications.length ? (
            <ReviewSection
              title="Cursos e certificações"
              description="Complete campos ausentes ou desmarque o item para ignorá-lo."
            >
              <input
                type="hidden"
                name="certification_count"
                value={data.certifications.length}
              />
              {data.certifications.map((item, index) => (
                <fieldset
                  key={`${item.name}-${index}`}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <label className="text-ink flex items-center gap-3 text-sm font-bold">
                    <input
                      className="accent-brand size-4"
                      type="checkbox"
                      name={`certification_${index}_enabled`}
                      defaultChecked={isCompleteResumeCertification(item)}
                    />
                    Adicionar este curso ou certificação
                  </label>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="text-ink text-sm font-bold">
                      Nome
                      <input
                        className={inputClass}
                        name={`certification_${index}_name`}
                        maxLength={180}
                        defaultValue={item.name}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Instituição
                      <input
                        className={inputClass}
                        name={`certification_${index}_institution`}
                        maxLength={180}
                        defaultValue={item.institution ?? ""}
                      />
                    </label>
                    <label className="text-ink text-sm font-bold">
                      Ano
                      <input
                        className={inputClass}
                        name={`certification_${index}_year`}
                        type="number"
                        min={1900}
                        max={2100}
                        defaultValue={item.completionYear ?? ""}
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
            </ReviewSection>
          ) : (
            <input type="hidden" name="certification_count" value="0" />
          )}

          {data.skills.length ? (
            <ReviewSection
              title="Habilidades profissionais"
              description="Estas habilidades são autodeclaradas e não representam validação pela INNEURO."
            >
              <input
                type="hidden"
                name="skill_count"
                value={data.skills.length}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {data.skills.map((skill, index) => (
                  <label
                    key={`${skill}-${index}`}
                    className="border-border-light text-ink flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold"
                  >
                    <input
                      className="accent-brand size-4"
                      type="checkbox"
                      name={`skill_${index}_enabled`}
                      defaultChecked
                    />
                    <input
                      aria-label={`Editar habilidade ${skill}`}
                      className="min-w-0 flex-1 bg-transparent outline-none"
                      name={`skill_${index}_name`}
                      maxLength={80}
                      defaultValue={skill}
                    />
                  </label>
                ))}
              </div>
            </ReviewSection>
          ) : (
            <input type="hidden" name="skill_count" value="0" />
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 rounded-full px-7 font-bold text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
              Confirmar informações selecionadas
            </button>
            <button
              className="border-brand/30 text-brand-dark hover:bg-mint min-h-12 rounded-full border px-7 font-bold"
              type="submit"
              name="apply_all"
              value="true"
            >
              Aplicar todas as informações identificadas
            </button>
            <a
              className="border-brand/30 text-brand-dark hover:bg-mint inline-flex min-h-12 items-center justify-center rounded-full border px-7 font-bold"
              href="/carreiras/perfil"
            >
              Revisar depois
            </a>
          </div>
        </form>

        <form
          action={ignoreResumeExtractionAction}
          className="mx-auto mt-4 max-w-4xl"
        >
          <input type="hidden" name="extraction_id" value={id} />
          <button className="text-muted hover:text-error min-h-11 text-sm font-bold hover:underline">
            Ignorar todas as informações identificadas
          </button>
        </form>
      </Container>
    </main>
  );
}
