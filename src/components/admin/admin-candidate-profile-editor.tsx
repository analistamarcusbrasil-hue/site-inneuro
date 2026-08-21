import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import {
  deleteCandidateCertificationByAdminAction,
  deleteCandidateEducationByAdminAction,
  deleteCandidateExperienceByAdminAction,
  deleteCandidateSkillByAdminAction,
  saveCandidateCertificationByAdminAction,
  saveCandidateEducationByAdminAction,
  saveCandidateExperienceByAdminAction,
  saveCandidateProfileByAdminAction,
  saveCandidateSkillByAdminAction,
} from "@/app/admin/(protected)/rh/candidatos/actions";
import {
  monthInputValue,
  type CandidateCertification,
  type CandidateEducation,
  type CandidateExperience,
  type CandidateProfessionalProfile,
  type CandidateSkill,
} from "@/lib/careers/profile";

const inputClass =
  "border-border-light mt-1 min-h-11 w-full rounded-xl border px-3 font-normal";

function HiddenCandidate({ id }: { id: string }) {
  return <input type="hidden" name="candidate_id" value={id} />;
}

function SaveButton({ label = "Salvar alteração" }: { label?: string }) {
  return (
    <button className="bg-brand hover:bg-brand-dark mt-4 min-h-11 rounded-full px-5 text-sm font-bold text-white">
      {label}
    </button>
  );
}

function DeleteRecord({
  candidateId,
  id,
  action,
  label,
}: {
  candidateId: string;
  id: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
}) {
  return (
    <ConfirmCommandForm action={action} message={`Excluir ${label}?`}>
      <HiddenCandidate id={candidateId} />
      <input type="hidden" name="id" value={id} />
      <button className="text-error mt-3 min-h-10 text-sm font-bold hover:underline">
        Excluir
      </button>
    </ConfirmCommandForm>
  );
}

function ExperienceForm({
  candidateId,
  item,
  sortOrder,
}: {
  candidateId: string;
  item?: CandidateExperience;
  sortOrder: number;
}) {
  return (
    <form
      action={saveCandidateExperienceByAdminAction}
      className="grid gap-3 sm:grid-cols-2"
    >
      <HiddenCandidate id={candidateId} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="sort_order" value={sortOrder} />
      <label className="text-sm font-bold">
        Empresa
        <input
          className={inputClass}
          name="company"
          required
          defaultValue={item?.company ?? ""}
        />
      </label>
      <label className="text-sm font-bold">
        Cargo
        <input
          className={inputClass}
          name="job_title"
          required
          defaultValue={item?.job_title ?? ""}
        />
      </label>
      <label className="text-sm font-bold">
        Início
        <input
          className={inputClass}
          name="start_month"
          type="month"
          required
          defaultValue={monthInputValue(item?.start_date)}
        />
      </label>
      <label className="text-sm font-bold">
        Fim
        <input
          className={inputClass}
          name="end_month"
          type="month"
          defaultValue={monthInputValue(item?.end_date)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
        <input
          name="is_current"
          type="checkbox"
          defaultChecked={item?.is_current}
        />
        Emprego atual
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Atividades
        <textarea
          className={`${inputClass} min-h-28 py-3`}
          name="activities"
          required
          defaultValue={item?.activities ?? ""}
        />
      </label>
      <div className="sm:col-span-2">
        <SaveButton
          label={item ? "Salvar experiência" : "Adicionar experiência"}
        />
      </div>
    </form>
  );
}

function EducationForm({
  candidateId,
  item,
  sortOrder,
}: {
  candidateId: string;
  item?: CandidateEducation;
  sortOrder: number;
}) {
  return (
    <form
      action={saveCandidateEducationByAdminAction}
      className="grid gap-3 sm:grid-cols-2"
    >
      <HiddenCandidate id={candidateId} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="sort_order" value={sortOrder} />
      <label className="text-sm font-bold">
        Nível
        <input
          className={inputClass}
          name="education_level"
          required
          defaultValue={item?.education_level ?? ""}
        />
      </label>
      <label className="text-sm font-bold">
        Curso
        <input
          className={inputClass}
          name="course"
          required
          defaultValue={item?.course ?? ""}
        />
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Instituição
        <input
          className={inputClass}
          name="institution"
          required
          defaultValue={item?.institution ?? ""}
        />
      </label>
      <label className="text-sm font-bold">
        Início
        <input
          className={inputClass}
          name="start_month"
          type="month"
          required
          defaultValue={monthInputValue(item?.start_date)}
        />
      </label>
      <label className="text-sm font-bold">
        Fim
        <input
          className={inputClass}
          name="end_month"
          type="month"
          defaultValue={monthInputValue(item?.end_date)}
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
        <input
          name="in_progress"
          type="checkbox"
          defaultChecked={item?.in_progress}
        />
        Em andamento
      </label>
      <div className="sm:col-span-2">
        <SaveButton label={item ? "Salvar formação" : "Adicionar formação"} />
      </div>
    </form>
  );
}

function CertificationForm({
  candidateId,
  item,
  sortOrder,
}: {
  candidateId: string;
  item?: CandidateCertification;
  sortOrder: number;
}) {
  return (
    <form
      action={saveCandidateCertificationByAdminAction}
      className="grid gap-3 sm:grid-cols-2"
    >
      <HiddenCandidate id={candidateId} />
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="sort_order" value={sortOrder} />
      <label className="text-sm font-bold">
        Curso ou certificação
        <input
          className={inputClass}
          name="name"
          required
          defaultValue={item?.name ?? ""}
        />
      </label>
      <label className="text-sm font-bold">
        Instituição
        <input
          className={inputClass}
          name="institution"
          required
          defaultValue={item?.institution ?? ""}
        />
      </label>
      <label className="text-sm font-bold">
        Ano de conclusão
        <input
          className={inputClass}
          name="completion_year"
          type="number"
          min="1900"
          max="2100"
          required
          defaultValue={item?.completion_year ?? new Date().getFullYear()}
        />
      </label>
      <label className="text-sm font-bold">
        Validade
        <input
          className={inputClass}
          name="expires_at"
          type="date"
          defaultValue={item?.expires_at ?? ""}
        />
      </label>
      <div className="sm:col-span-2">
        <SaveButton
          label={item ? "Salvar certificação" : "Adicionar certificação"}
        />
      </div>
    </form>
  );
}

export function AdminCandidateProfileEditor({
  candidateId,
  fullName,
  profile,
  experiences,
  education,
  certifications,
  skills,
}: {
  candidateId: string;
  fullName: string;
  profile: CandidateProfessionalProfile | null;
  experiences: CandidateExperience[];
  education: CandidateEducation[];
  certifications: CandidateCertification[];
  skills: CandidateSkill[];
}) {
  return (
    <section
      id="edicao-administrativa"
      className="border-warning/30 mb-6 rounded-3xl border bg-white p-5 sm:p-7"
    >
      <p className="text-warning text-xs font-bold tracking-wide uppercase">
        Alteração administrativa
      </p>
      <h2 className="font-heading text-brand-dark mt-2 text-xl font-semibold">
        Editar dados profissionais atuais
      </h2>
      <p className="text-muted mt-2 text-sm">
        As alterações são auditadas e não modificam snapshots de candidaturas já
        enviadas.
      </p>

      <div className="mt-5 grid gap-3">
        <details className="border-border-light rounded-2xl border p-4">
          <summary className="cursor-pointer font-bold">
            Dados básicos, objetivo e disponibilidade
          </summary>
          <form
            action={saveCandidateProfileByAdminAction}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          >
            <HiddenCandidate id={candidateId} />
            <label className="text-sm font-bold sm:col-span-2">
              Nome completo
              <input
                className={inputClass}
                name="full_name"
                required
                defaultValue={fullName}
              />
            </label>
            <label className="text-sm font-bold">
              WhatsApp
              <input
                className={inputClass}
                name="whatsapp"
                defaultValue={profile?.whatsapp ?? ""}
              />
            </label>
            <label className="text-sm font-bold">
              Cidade
              <input
                className={inputClass}
                name="city"
                defaultValue={profile?.city ?? ""}
              />
            </label>
            <label className="text-sm font-bold">
              UF
              <input
                className={inputClass}
                name="state"
                maxLength={2}
                defaultValue={profile?.state ?? ""}
              />
            </label>
            <label className="text-sm font-bold">
              Bairro
              <input
                className={inputClass}
                name="neighborhood"
                defaultValue={profile?.neighborhood ?? ""}
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Objetivo
              <textarea
                className={`${inputClass} min-h-24 py-3`}
                name="professional_objective"
                defaultValue={profile?.professional_objective ?? ""}
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Sobre
              <textarea
                className={`${inputClass} min-h-28 py-3`}
                name="about"
                defaultValue={profile?.about ?? ""}
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Disponibilidade
              <textarea
                className={`${inputClass} min-h-20 py-3`}
                name="availability"
                defaultValue={profile?.availability ?? ""}
              />
            </label>
            <div className="sm:col-span-2">
              <SaveButton />
            </div>
          </form>
        </details>

        <details className="border-border-light rounded-2xl border p-4">
          <summary className="cursor-pointer font-bold">
            Experiências profissionais
          </summary>
          <div className="mt-4 grid gap-4">
            {experiences.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <ExperienceForm
                  candidateId={candidateId}
                  item={item}
                  sortOrder={item.sort_order}
                />
                <DeleteRecord
                  candidateId={candidateId}
                  id={item.id}
                  action={deleteCandidateExperienceByAdminAction}
                  label="esta experiência"
                />
              </div>
            ))}
            <div className="rounded-2xl bg-slate-50 p-4">
              <ExperienceForm
                candidateId={candidateId}
                sortOrder={experiences.length}
              />
            </div>
          </div>
        </details>

        <details className="border-border-light rounded-2xl border p-4">
          <summary className="cursor-pointer font-bold">Formação</summary>
          <div className="mt-4 grid gap-4">
            {education.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <EducationForm
                  candidateId={candidateId}
                  item={item}
                  sortOrder={item.sort_order}
                />
                <DeleteRecord
                  candidateId={candidateId}
                  id={item.id}
                  action={deleteCandidateEducationByAdminAction}
                  label="esta formação"
                />
              </div>
            ))}
            <div className="rounded-2xl bg-slate-50 p-4">
              <EducationForm
                candidateId={candidateId}
                sortOrder={education.length}
              />
            </div>
          </div>
        </details>

        <details className="border-border-light rounded-2xl border p-4">
          <summary className="cursor-pointer font-bold">
            Cursos e certificações
          </summary>
          <div className="mt-4 grid gap-4">
            {certifications.map((item) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                <CertificationForm
                  candidateId={candidateId}
                  item={item}
                  sortOrder={item.sort_order}
                />
                <DeleteRecord
                  candidateId={candidateId}
                  id={item.id}
                  action={deleteCandidateCertificationByAdminAction}
                  label="esta certificação"
                />
              </div>
            ))}
            <div className="rounded-2xl bg-slate-50 p-4">
              <CertificationForm
                candidateId={candidateId}
                sortOrder={certifications.length}
              />
            </div>
          </div>
        </details>

        <details className="border-border-light rounded-2xl border p-4">
          <summary className="cursor-pointer font-bold">Habilidades</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {skills.map((skill) => (
              <div key={skill.id} className="rounded-2xl bg-slate-50 p-4">
                <form action={saveCandidateSkillByAdminAction}>
                  <HiddenCandidate id={candidateId} />
                  <input type="hidden" name="id" value={skill.id} />
                  <label className="text-sm font-bold">
                    Habilidade
                    <input
                      className={inputClass}
                      name="name"
                      required
                      defaultValue={skill.name}
                    />
                  </label>
                  <SaveButton label="Salvar habilidade" />
                </form>
                <DeleteRecord
                  candidateId={candidateId}
                  id={skill.id}
                  action={deleteCandidateSkillByAdminAction}
                  label="esta habilidade"
                />
              </div>
            ))}
            <form
              action={saveCandidateSkillByAdminAction}
              className="rounded-2xl bg-slate-50 p-4"
            >
              <HiddenCandidate id={candidateId} />
              <input type="hidden" name="sort_order" value={skills.length} />
              <label className="text-sm font-bold">
                Nova habilidade
                <input className={inputClass} name="name" required />
              </label>
              <SaveButton label="Adicionar habilidade" />
            </form>
          </div>
        </details>
      </div>
    </section>
  );
}
