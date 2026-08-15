import type { CareerJob, CareerJobArea } from "@/lib/careers/jobs";
import type { CompanyUnit } from "@/lib/careers/logistics";
import { formatCompanyUnitLocation } from "@/lib/careers/logistics";
import { workModeLabels, workModes } from "@/lib/careers/jobs";

const inputClass =
  "border-border-light focus:border-brand focus:ring-brand/15 mt-2 min-h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:ring-4";
const textareaClass = `${inputClass} min-h-32 py-3`;
const labelClass = "text-ink block text-sm font-bold";

function FieldHelp({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted mt-1 block text-xs leading-relaxed font-normal">
      {children}
    </span>
  );
}

export function HrJobForm({
  action,
  areas,
  units,
  job,
}: {
  action: (formData: FormData) => void | Promise<void>;
  areas: CareerJobArea[];
  units: CompanyUnit[];
  job?: CareerJob;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="grid gap-6">
      {job ? <input type="hidden" name="id" value={job.id} /> : null}

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Identificação da vaga
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={`${labelClass} sm:col-span-2`}>
            Título da vaga
            <input
              className={inputClass}
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="Exemplo: Assistente de atendimento"
              defaultValue={job?.title ?? ""}
            />
            <FieldHelp>Nome objetivo, com até 120 caracteres.</FieldHelp>
          </label>
          <label className={labelClass}>
            Área
            <select
              className={inputClass}
              name="area_id"
              required
              defaultValue={job?.area_id ?? areas[0]?.id ?? ""}
            >
              <option value="" disabled>
                Selecione uma área
              </option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                  {!area.is_active ? " (inativa)" : ""}
                </option>
              ))}
            </select>
            <FieldHelp>
              As áreas são administradas em RH → Vagas → Áreas.
            </FieldHelp>
          </label>
          <label className={labelClass}>
            Quantidade de posições
            <input
              className={inputClass}
              name="positions"
              type="number"
              min={1}
              max={100}
              required
              defaultValue={job?.positions ?? 1}
            />
          </label>
          <label className={labelClass}>
            Local
            <input
              className={inputClass}
              name="location"
              required
              minLength={2}
              maxLength={160}
              placeholder="Exemplo: Macapá/AP"
              defaultValue={job?.location ?? ""}
            />
          </label>
          <label className={labelClass}>
            Modalidade de trabalho
            <select
              className={inputClass}
              name="work_mode"
              required
              defaultValue={job?.work_mode ?? "onsite"}
            >
              {workModes.map((mode) => (
                <option key={mode} value={mode}>
                  {workModeLabels[mode]}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Unidade de trabalho
            <select
              className={inputClass}
              name="unit_id"
              defaultValue={job?.unit_id ?? ""}
            >
              <option value="">Sem unidade — somente vaga remota</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} — {formatCompanyUnitLocation(unit)}
                  {!unit.active ? " (inativa)" : ""}
                </option>
              ))}
            </select>
            <FieldHelp>
              Obrigatória para vagas presenciais ou híbridas. As unidades são
              administradas centralmente pelo RH.
            </FieldHelp>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Jornada ou horário, quando pertinente
            <textarea
              className={textareaClass}
              name="work_schedule"
              maxLength={500}
              placeholder="Informe somente quando o horário já estiver definido."
              defaultValue={job?.work_schedule ?? ""}
            />
            <FieldHelp>Campo opcional, com até 500 caracteres.</FieldHelp>
          </label>
        </div>
      </section>

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Conteúdo da oportunidade
        </h2>
        <div className="mt-5 grid gap-5">
          <label className={labelClass}>
            Descrição
            <textarea
              className={textareaClass}
              name="description"
              required
              minLength={20}
              maxLength={800}
              placeholder="Apresente a oportunidade de forma clara e breve."
              defaultValue={job?.description ?? ""}
            />
            <FieldHelp>
              Até 800 caracteres. Este texto também aparece resumido no card
              público.
            </FieldHelp>
          </label>
          <label className={labelClass}>
            Principais atividades
            <textarea
              className={`${textareaClass} min-h-48`}
              name="activities"
              required
              minLength={20}
              maxLength={5000}
              placeholder="Liste as responsabilidades principais, uma por linha."
              defaultValue={job?.activities ?? ""}
            />
          </label>
          <label className={labelClass}>
            Escolaridade
            <textarea
              className={textareaClass}
              name="schooling"
              required
              maxLength={1000}
              placeholder="Informe apenas a formação necessária para exercer a função."
              defaultValue={job?.schooling ?? ""}
            />
          </label>
          <label className={labelClass}>
            Experiência desejável
            <textarea
              className={textareaClass}
              name="desirable_experience"
              maxLength={1500}
              placeholder="Descreva experiências profissionais relevantes."
              defaultValue={job?.desirable_experience ?? ""}
            />
            <FieldHelp>Campo opcional.</FieldHelp>
          </label>
          <label className={labelClass}>
            Requisitos obrigatórios
            <textarea
              className={`${textareaClass} min-h-40`}
              name="required_requirements"
              required
              maxLength={3000}
              placeholder="Liste somente requisitos profissionais indispensáveis."
              defaultValue={job?.required_requirements ?? ""}
            />
          </label>
          <label className={labelClass}>
            Requisitos desejáveis
            <textarea
              className={`${textareaClass} min-h-40`}
              name="desirable_requirements"
              maxLength={3000}
              placeholder="Liste diferenciais profissionais, sem torná-los obrigatórios."
              defaultValue={job?.desirable_requirements ?? ""}
            />
            <FieldHelp>Campo opcional.</FieldHelp>
          </label>
          <label className={labelClass}>
            Habilidades
            <textarea
              className={textareaClass}
              name="skills"
              required
              maxLength={2000}
              placeholder="Exemplo: atendimento, organização e comunicação."
              defaultValue={job?.skills ?? ""}
            />
          </label>
          <label className={labelClass}>
            Certificações
            <textarea
              className={textareaClass}
              name="certifications"
              maxLength={1500}
              placeholder="Informe certificações profissionais quando necessárias."
              defaultValue={job?.certifications ?? ""}
            />
            <FieldHelp>Campo opcional.</FieldHelp>
          </label>
        </div>
        <aside className="bg-mint text-brand-dark mt-5 rounded-2xl p-4 text-sm leading-relaxed">
          Use somente critérios profissionais ligados à função. O sistema
          rejeita requisitos relacionados a características pessoais protegidas.
        </aside>
      </section>

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Período
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Data de abertura
            <input
              className={inputClass}
              name="opens_on"
              type="date"
              required
              defaultValue={job?.opens_on ?? today}
            />
          </label>
          <label className={labelClass}>
            Encerramento opcional
            <input
              className={inputClass}
              name="closes_on"
              type="date"
              defaultValue={job?.closes_on ?? ""}
            />
            <FieldHelp>
              Se preenchida, a vaga deixa de aparecer publicamente após essa
              data.
            </FieldHelp>
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="bg-brand hover:bg-brand-dark focus-visible:ring-tech min-h-12 rounded-full px-7 font-bold text-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none">
          {job ? "Salvar alterações" : "Criar como rascunho"}
        </button>
        <a
          className="border-brand/30 text-brand-dark hover:bg-mint inline-flex min-h-12 items-center justify-center rounded-full border px-7 font-bold"
          href={job ? `/admin/rh/vagas/${job.id}` : "/admin/rh/vagas"}
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
