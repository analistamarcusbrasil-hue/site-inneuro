import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  defaultEvaluationCriteria,
  evaluationCriteriaSchema,
  type EvaluationTemplate,
} from "@/lib/careers/evaluations";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import { saveEvaluationTemplateAction } from "../../../avaliacoes/actions";

export default async function JobEvaluationTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, templatesResult] = await Promise.all([
    supabase.from("career_jobs").select("id, title").eq("id", id).maybeSingle(),
    supabase
      .from("career_evaluation_templates")
      .select("*")
      .eq("job_id", id)
      .order("version", { ascending: false }),
  ]);
  if (jobResult.error || !jobResult.data) notFound();
  const templates = (templatesResult.data as EvaluationTemplate[] | null) ?? [];
  const query = await searchParams;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas / Avaliação humana"
        title={`Modelo de avaliação — ${jobResult.data.title}`}
        description="Crie versões estruturadas dos critérios profissionais usados pelos avaliadores desta vaga."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/admin/rh/vagas/${id}`}
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
        >
          Voltar para a vaga
        </Link>
        <Link
          href="/admin/rh/avaliacoes"
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
        >
          Abrir avaliações
        </Link>
      </div>

      {query.status === "saved" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Nova versão do modelo criada. Avaliações anteriores foram preservadas.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "criteria"
            ? "Revise os critérios. Use somente aspectos profissionais relacionados à vaga."
            : "Não foi possível criar o modelo de avaliação."}
        </p>
      ) : null}

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          {templates.length
            ? `Criar versão ${templates[0].version + 1}`
            : "Criar modelo inicial"}
        </h2>
        <p className="text-muted mt-2 text-sm">
          Os seis critérios institucionais são mantidos. Você pode acrescentar
          até seis critérios profissionais específicos desta vaga.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {defaultEvaluationCriteria.map((criterion) => (
            <div
              key={criterion.id}
              className="bg-mint/60 text-brand-dark rounded-2xl p-4 text-sm font-bold"
            >
              {criterion.label}
              <span className="text-muted mt-1 block text-xs font-normal">
                Escala de 1 a 5
              </span>
            </div>
          ))}
        </div>

        <ConfirmCommandForm
          action={saveEvaluationTemplateAction}
          message="Criar uma nova versão deste modelo? As versões e avaliações anteriores serão preservadas."
        >
          <input type="hidden" name="job_id" value={id} />
          <fieldset className="border-border-light mt-6 border-t pt-6">
            <legend className="text-ink font-bold">
              Critérios customizados opcionais
            </legend>
            <p className="text-muted mt-1 text-xs">
              Não use aparência, idade, sexo ou qualquer característica pessoal
              protegida.
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <label key={index} className="text-ink text-sm font-bold">
                  Critério {index + 1}
                  <input
                    name="custom_criterion"
                    maxLength={120}
                    placeholder="Ex.: Domínio do sistema utilizado na área"
                    className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <button className="bg-brand hover:bg-brand-dark mt-6 min-h-11 rounded-full px-6 text-sm font-bold text-white">
            Salvar nova versão
          </button>
        </ConfirmCommandForm>
      </section>

      <section
        className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7"
        aria-labelledby="template-history-title"
      >
        <h2
          id="template-history-title"
          className="font-heading text-brand-dark text-xl font-semibold"
        >
          Histórico de modelos
        </h2>
        {templatesResult.error ? (
          <p className="text-error mt-4 text-sm">
            Não foi possível carregar o histórico.
          </p>
        ) : templates.length ? (
          <ol className="mt-5 grid gap-4">
            {templates.map((template) => {
              const criteria = evaluationCriteriaSchema.safeParse(
                template.criteria,
              );
              return (
                <li
                  key={template.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <strong className="text-ink">
                      Versão {template.version}
                    </strong>
                    <span className="text-muted text-xs">
                      {new Date(template.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {criteria.success ? (
                    <ul className="text-muted mt-3 flex flex-wrap gap-2 text-xs">
                      {criteria.data.map((criterion) => (
                        <li
                          key={criterion.id}
                          className="bg-surface rounded-full px-3 py-1"
                        >
                          {criterion.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-warning mt-3 text-xs">
                      Critérios históricos indisponíveis.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-muted mt-4 text-sm">Nenhum modelo criado.</p>
        )}
      </section>
    </>
  );
}
