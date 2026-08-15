import {
  saveCandidateCertificationAction,
  saveCandidateEducationAction,
  saveCandidateExperienceAction,
  saveCandidateProfileAction,
} from "@/app/carreiras/profile-actions";
import type {
  CandidateCertification,
  CandidateEducation,
  CandidateExperience,
  CandidateProfessionalProfile,
} from "@/lib/careers/profile";
import { monthInputValue } from "@/lib/careers/profile";
import {
  brazilianStates,
  educationLevels,
} from "@/lib/careers/profile-validation";

const inputClass =
  "border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:ring-4";
const textareaClass = `${inputClass} min-h-28 py-3`;
const labelClass = "text-ink block text-sm font-bold";

export function CandidateBaseProfileForm({
  fullName,
  email,
  profile,
}: {
  fullName: string;
  email: string;
  profile: CandidateProfessionalProfile | null;
}) {
  return (
    <form
      action={saveCandidateProfileAction}
      className="grid gap-5 sm:grid-cols-2"
    >
      <label className={labelClass}>
        Nome completo
        <input
          className={inputClass}
          name="full_name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={fullName}
        />
      </label>
      <label className={labelClass}>
        E-mail
        <input
          className={inputClass}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          defaultValue={email}
        />
        <span className="text-muted mt-1 block text-xs font-normal">
          A alteração do e-mail pode exigir uma nova confirmação.
        </span>
      </label>
      <label className={labelClass}>
        WhatsApp
        <input
          className={inputClass}
          name="whatsapp"
          type="tel"
          autoComplete="tel"
          required
          maxLength={24}
          placeholder="(96) 99999-9999"
          defaultValue={profile?.whatsapp ?? ""}
        />
      </label>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className={labelClass}>
          Cidade
          <input
            className={inputClass}
            name="city"
            autoComplete="address-level2"
            required
            maxLength={100}
            defaultValue={profile?.city ?? ""}
          />
        </label>
        <label className={labelClass}>
          UF
          <select
            className={inputClass}
            name="state"
            autoComplete="address-level1"
            required
            defaultValue={profile?.state ?? "AP"}
          >
            {brazilianStates.map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
      </div>
      <label className={`${labelClass} sm:col-span-2`}>
        Bairro (opcional)
        <input
          className={inputClass}
          name="neighborhood"
          autoComplete="address-level3"
          maxLength={120}
          placeholder="Informe apenas o bairro; não precisamos do endereço completo."
          defaultValue={profile?.neighborhood ?? ""}
        />
        <span className="text-muted mt-1 block text-xs font-normal">
          Usado somente como contexto operacional. Não informe rua, número ou
          localização GPS.
        </span>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Objetivo profissional
        <textarea
          className={textareaClass}
          name="professional_objective"
          maxLength={500}
          placeholder="Descreva em poucas linhas a área ou função em que deseja atuar."
          defaultValue={profile?.professional_objective ?? ""}
        />
        <span className="text-muted mt-1 block text-xs font-normal">
          Até 500 caracteres.
        </span>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Fale sobre sua experiência e trajetória profissional
        <textarea
          className={`${textareaClass} min-h-40`}
          name="about"
          maxLength={3000}
          placeholder="Conte de forma objetiva suas principais experiências, responsabilidades e aprendizados."
          defaultValue={profile?.about ?? ""}
        />
        <span className="text-muted mt-1 block text-xs font-normal">
          Até 3.000 caracteres. Não informe dados médicos ou documentos
          pessoais.
        </span>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Disponibilidade profissional
        <textarea
          className={textareaClass}
          name="availability"
          maxLength={800}
          placeholder="Exemplo: disponibilidade pela manhã e à tarde, de segunda a sexta."
          defaultValue={profile?.availability ?? ""}
        />
        <span className="text-muted mt-1 block text-xs font-normal">
          Informe dias, turnos e outras condições objetivas de disponibilidade.
        </span>
      </label>
      <div className="sm:col-span-2">
        <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 rounded-full px-7 font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
          Salvar dados pessoais
        </button>
      </div>
    </form>
  );
}

export function CandidateExperienceForm({
  experience,
}: {
  experience?: CandidateExperience;
}) {
  return (
    <form
      action={saveCandidateExperienceAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      {experience ? (
        <input type="hidden" name="id" value={experience.id} />
      ) : null}
      <label className={labelClass}>
        Empresa
        <input
          className={inputClass}
          name="company"
          required
          maxLength={160}
          defaultValue={experience?.company ?? ""}
        />
      </label>
      <label className={labelClass}>
        Cargo
        <input
          className={inputClass}
          name="job_title"
          required
          maxLength={160}
          defaultValue={experience?.job_title ?? ""}
        />
      </label>
      <label className={labelClass}>
        Data inicial
        <input
          className={inputClass}
          name="start_month"
          type="month"
          required
          defaultValue={monthInputValue(experience?.start_date)}
        />
      </label>
      <label className={labelClass}>
        Data final
        <input
          className={inputClass}
          name="end_month"
          type="month"
          defaultValue={monthInputValue(experience?.end_date)}
        />
      </label>
      <label className="text-muted flex items-center gap-3 text-sm sm:col-span-2">
        <input
          className="accent-brand size-4"
          name="is_current"
          type="checkbox"
          defaultChecked={experience?.is_current ?? false}
        />
        Trabalho atualmente nesta empresa
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Principais atividades
        <textarea
          className={textareaClass}
          name="activities"
          required
          maxLength={3000}
          defaultValue={experience?.activities ?? ""}
        />
      </label>
      <div className="sm:col-span-2">
        <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white">
          {experience ? "Salvar experiência" : "Adicionar experiência"}
        </button>
      </div>
    </form>
  );
}

export function CandidateEducationForm({
  education,
}: {
  education?: CandidateEducation;
}) {
  return (
    <form
      action={saveCandidateEducationAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      {education ? (
        <input type="hidden" name="id" value={education.id} />
      ) : null}
      <label className={labelClass}>
        Nível
        <select
          className={inputClass}
          name="education_level"
          required
          defaultValue={education?.education_level ?? "Ensino médio"}
        >
          {educationLevels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Curso
        <input
          className={inputClass}
          name="course"
          required
          maxLength={180}
          defaultValue={education?.course ?? ""}
        />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Instituição
        <input
          className={inputClass}
          name="institution"
          required
          maxLength={180}
          defaultValue={education?.institution ?? ""}
        />
      </label>
      <label className={labelClass}>
        Início
        <input
          className={inputClass}
          name="start_month"
          type="month"
          required
          defaultValue={monthInputValue(education?.start_date)}
        />
      </label>
      <label className={labelClass}>
        Conclusão
        <input
          className={inputClass}
          name="end_month"
          type="month"
          defaultValue={monthInputValue(education?.end_date)}
        />
      </label>
      <label className="text-muted flex items-center gap-3 text-sm sm:col-span-2">
        <input
          className="accent-brand size-4"
          name="in_progress"
          type="checkbox"
          defaultChecked={education?.in_progress ?? false}
        />
        Formação em andamento
      </label>
      <div className="sm:col-span-2">
        <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white">
          {education ? "Salvar formação" : "Adicionar formação"}
        </button>
      </div>
    </form>
  );
}

export function CandidateCertificationForm({
  certification,
}: {
  certification?: CandidateCertification;
}) {
  return (
    <form
      action={saveCandidateCertificationAction}
      className="grid gap-4 sm:grid-cols-2"
    >
      {certification ? (
        <input type="hidden" name="id" value={certification.id} />
      ) : null}
      <label className={labelClass}>
        Nome
        <input
          className={inputClass}
          name="name"
          required
          maxLength={180}
          defaultValue={certification?.name ?? ""}
        />
      </label>
      <label className={labelClass}>
        Instituição
        <input
          className={inputClass}
          name="institution"
          required
          maxLength={180}
          defaultValue={certification?.institution ?? ""}
        />
      </label>
      <label className={labelClass}>
        Ano
        <input
          className={inputClass}
          name="completion_year"
          type="number"
          min={1900}
          max={new Date().getFullYear() + 1}
          required
          defaultValue={
            certification?.completion_year ?? new Date().getFullYear()
          }
        />
      </label>
      <label className={labelClass}>
        Validade opcional
        <input
          className={inputClass}
          name="expires_at"
          type="date"
          defaultValue={certification?.expires_at ?? ""}
        />
      </label>
      <div className="sm:col-span-2">
        <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white">
          {certification ? "Salvar curso" : "Adicionar curso"}
        </button>
      </div>
    </form>
  );
}
