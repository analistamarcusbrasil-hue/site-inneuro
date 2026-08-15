import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { careerApplicationSnapshotSchema } from "@/lib/careers/applications";
import {
  calculateEvaluationAverage,
  calculateHumanEvaluationAverage,
  evaluationCriteriaSchema,
  evaluationScoresSchema,
  interviewStatusLabels,
  interviewStatuses,
  interviewTypeLabels,
  interviewTypes,
  latestEvaluationByEvaluator,
  type CandidateEvaluation,
  type EvaluationTemplate,
  type InterviewStatus,
  type InterviewType,
} from "@/lib/careers/evaluations";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  assignApplicationEvaluatorAction,
  createCandidateInterviewAction,
  submitCandidateEvaluationAction,
} from "../actions";

type ApplicationRow = {
  id: string;
  job_id: string;
  profile_snapshot: unknown;
  job: { id: string; title: string } | null;
};
type EvaluationRow = CandidateEvaluation & {
  evaluator: { id: string; full_name: string | null } | null;
};
type AssignmentRow = {
  evaluator_id: string;
  assigned_at: string;
  evaluator: { id: string; full_name: string | null } | null;
};
type EvaluatorProfile = {
  id: string;
  full_name: string | null;
  role: string;
  hr_role: string | null;
};
type InterviewRow = {
  id: string;
  scheduled_at: string;
  interview_type: InterviewType;
  status: InterviewStatus;
  internal_notes: string | null;
  created_at: string;
  responsible: { id: string; full_name: string | null } | null;
};
type MatchRow = {
  overall_score: number;
  hard_skills_score: number;
  matrix_version: number;
  calculated_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function EvaluationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { applicationId } = await params;
  if (!z.string().uuid().safeParse(applicationId).success) notFound();
  const { supabase, user, hrRole } = await requireHrAccess(
    "assigned-candidates:evaluate",
  );
  const canManage = hrRole !== "reviewer";
  const { data: applicationData, error: applicationError } = await supabase
    .from("career_job_applications")
    .select("id, job_id, profile_snapshot, job:career_jobs(id, title)")
    .eq("id", applicationId)
    .maybeSingle();
  if (applicationError || !applicationData) notFound();
  const application = applicationData as unknown as ApplicationRow;

  const [
    templateResult,
    evaluationsResult,
    assignmentsResult,
    interviewsResult,
    evaluatorsResult,
    matchResult,
  ] = await Promise.all([
    supabase
      .from("career_evaluation_templates")
      .select("*")
      .eq("job_id", application.job_id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("career_candidate_evaluations")
      .select("*, evaluator:profiles(id, full_name)")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("career_application_evaluators")
      .select("evaluator_id, assigned_at, evaluator:profiles(id, full_name)")
      .eq("application_id", applicationId)
      .order("assigned_at", { ascending: true }),
    supabase
      .from("career_candidate_interviews")
      .select(
        "id, scheduled_at, interview_type, status, internal_notes, created_at, responsible:profiles!career_candidate_interviews_responsible_id_fkey(id, full_name)",
      )
      .eq("application_id", applicationId)
      .order("scheduled_at", { ascending: false }),
    canManage
      ? supabase
          .from("profiles")
          .select("id, full_name, role, hr_role")
          .order("full_name", { ascending: true })
      : Promise.resolve({ data: [] as EvaluatorProfile[], error: null }),
    supabase
      .from("career_application_match_runs")
      .select("overall_score, hard_skills_score, matrix_version, calculated_at")
      .eq("application_id", applicationId)
      .order("calculated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const template = (templateResult.data as EvaluationTemplate | null) ?? null;
  const criteria = evaluationCriteriaSchema.safeParse(template?.criteria);
  const evaluations =
    (evaluationsResult.data as unknown as EvaluationRow[] | null) ?? [];
  const latestEvaluations = latestEvaluationByEvaluator(evaluations).map(
    (evaluation) =>
      evaluations.find((item) => item.id === evaluation.id) as EvaluationRow,
  );
  const assignments =
    (assignmentsResult.data as unknown as AssignmentRow[] | null) ?? [];
  const interviews =
    (interviewsResult.data as unknown as InterviewRow[] | null) ?? [];
  const evaluators = (evaluatorsResult.data as EvaluatorProfile[] | null) ?? [];
  const match = (matchResult.data as MatchRow | null) ?? null;
  const snapshot = careerApplicationSnapshotSchema.safeParse(
    application.profile_snapshot,
  );
  const query = await searchParams;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Avaliações"
        title={
          snapshot.success ? snapshot.data.candidate.full_name : "Candidatura"
        }
        description={`Avaliação humana estruturada para ${application.job?.title ?? "vaga indisponível"}.`}
      />
      <HrNavigation
        current="evaluations"
        canManageJobs={canManage}
        canManageCandidates={canManage}
        canManageProcesses={canManage}
        canManageTalentPool={canManage}
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/admin/rh/avaliacoes"
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
        >
          Voltar para avaliações
        </Link>
        {canManage ? (
          <Link
            href={`/admin/rh/vagas/${application.job_id}/avaliacoes`}
            className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          >
            Modelo da vaga
          </Link>
        ) : null}
      </div>

      {query.status ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.status === "evaluation-saved"
            ? "Sua avaliação foi registrada sem alterar avaliações de outras pessoas."
            : query.status === "evaluator-assigned"
              ? "Avaliador atribuído à candidatura."
              : "Entrevista registrada."}
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Não foi possível concluir esta operação. Revise os dados e tente
          novamente.
        </p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="border-border-light rounded-3xl border bg-white p-6">
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            Média das avaliações humanas
          </p>
          <p className="font-heading text-brand-dark mt-2 text-4xl font-semibold">
            {calculateHumanEvaluationAverage(evaluations) === null
              ? "—"
              : `${calculateHumanEvaluationAverage(evaluations)?.toLocaleString("pt-BR")} / 5`}
          </p>
          <p className="text-muted mt-2 text-xs">
            Usa somente a versão humana mais recente de cada avaliador.
          </p>
        </div>
        <div className="border-border-light rounded-3xl border bg-white p-6">
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            Aderência automática à vaga
          </p>
          <p className="font-heading text-brand-dark mt-2 text-4xl font-semibold">
            {match ? `${match.overall_score}%` : "—"}
          </p>
          <p className="text-muted mt-2 text-xs">
            {match
              ? `Hard skills ${match.hard_skills_score}% · Matriz v${match.matrix_version}`
              : "Ainda não calculada."}
          </p>
        </div>
      </section>
      <p className="border-brand/20 bg-mint/60 text-brand-dark mt-4 rounded-2xl border p-4 text-sm font-bold">
        A nota humana e a aderência automática não são somadas. A decisão final
        é responsabilidade do RH.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Minha avaliação
          </h2>
          {!template || !criteria.success ? (
            <div className="mt-4">
              <p className="text-muted text-sm">
                O modelo de avaliação desta vaga ainda não foi configurado.
              </p>
              {canManage ? (
                <Link
                  href={`/admin/rh/vagas/${application.job_id}/avaliacoes`}
                  className="text-brand mt-3 inline-flex text-sm font-bold hover:underline"
                >
                  Criar modelo
                </Link>
              ) : null}
            </div>
          ) : (
            <ConfirmCommandForm
              action={submitCandidateEvaluationAction}
              message="Registrar esta avaliação? Uma nova versão será criada e as avaliações de outras pessoas não serão alteradas."
            >
              <input
                type="hidden"
                name="application_id"
                value={applicationId}
              />
              <input type="hidden" name="template_id" value={template.id} />
              <div className="mt-5 grid gap-4">
                {criteria.data.map((criterion) => (
                  <label
                    key={criterion.id}
                    className="text-ink text-sm font-bold"
                  >
                    {criterion.label}
                    <select
                      name={`score_${criterion.id}`}
                      required
                      defaultValue=""
                      className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
                    >
                      <option value="" disabled>
                        Selecione de 1 a 5
                      </option>
                      {[1, 2, 3, 4, 5].map((score) => (
                        <option key={score} value={score}>
                          {score}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="text-ink text-sm font-bold">
                  Comentário
                  <textarea
                    name="comment"
                    maxLength={3000}
                    rows={5}
                    placeholder="Registre observações profissionais objetivas."
                    className="border-border-light mt-2 w-full rounded-xl border p-4 font-normal"
                  />
                </label>
              </div>
              <button className="bg-brand hover:bg-brand-dark mt-5 min-h-11 rounded-full px-6 text-sm font-bold text-white">
                Registrar avaliação
              </button>
            </ConfirmCommandForm>
          )}
        </section>

        <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Avaliações individuais
          </h2>
          {evaluationsResult.error ? (
            <p className="text-error mt-4 text-sm">
              Não foi possível carregar as avaliações.
            </p>
          ) : latestEvaluations.length ? (
            <ol className="mt-5 grid gap-4">
              {latestEvaluations.map((evaluation) => {
                const scores = evaluationScoresSchema.safeParse(
                  evaluation.scores,
                );
                const average = scores.success
                  ? calculateEvaluationAverage(scores.data)
                  : null;
                return (
                  <li
                    key={evaluation.id}
                    className="border-border-light rounded-2xl border p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <strong className="text-ink">
                          {evaluation.evaluator?.full_name ?? "Avaliador"}
                        </strong>
                        <p className="text-muted mt-1 text-xs">
                          Versão {evaluation.evaluation_version} · Modelo v
                          {evaluation.template_version}
                        </p>
                      </div>
                      <span className="bg-mint text-brand-dark rounded-full px-3 py-1 text-sm font-bold">
                        {average?.toLocaleString("pt-BR") ?? "—"} / 5
                      </span>
                    </div>
                    {evaluation.comment ? (
                      <p className="text-ink mt-3 text-sm whitespace-pre-line">
                        {evaluation.comment}
                      </p>
                    ) : (
                      <p className="text-muted mt-3 text-xs">Sem comentário.</p>
                    )}
                    <p className="text-muted mt-3 text-xs">
                      {formatDate(evaluation.created_at)}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-muted mt-4 text-sm">
              Nenhuma avaliação registrada.
            </p>
          )}
          {evaluations.length > latestEvaluations.length ? (
            <p className="text-muted mt-4 text-xs">
              O histórico contém {evaluations.length - latestEvaluations.length}{" "}
              versão(ões) anterior(es), preservada(s) para auditoria.
            </p>
          ) : null}
        </section>
      </div>

      {canManage ? (
        <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Avaliadores
          </h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-ink text-sm font-bold">Atribuídos</h3>
              {assignments.length ? (
                <ul className="mt-3 grid gap-2">
                  {assignments.map((assignment) => (
                    <li
                      key={assignment.evaluator_id}
                      className="bg-surface rounded-xl p-3 text-sm"
                    >
                      <strong>
                        {assignment.evaluator?.full_name ?? "Avaliador"}
                      </strong>
                      <span className="text-muted ml-2 text-xs">
                        desde {formatDate(assignment.assigned_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted mt-3 text-sm">
                  Nenhum avaliador específico atribuído.
                </p>
              )}
            </div>
            <ConfirmCommandForm
              action={assignApplicationEvaluatorAction}
              message="Atribuir esta candidatura ao avaliador selecionado?"
            >
              <input
                type="hidden"
                name="application_id"
                value={applicationId}
              />
              <label className="text-ink text-sm font-bold">
                Novo avaliador
                <select
                  name="evaluator_id"
                  required
                  defaultValue=""
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
                >
                  <option value="" disabled>
                    Selecione
                  </option>
                  {evaluators.map((evaluator) => (
                    <option key={evaluator.id} value={evaluator.id}>
                      {evaluator.full_name ?? "Usuário administrativo"}
                    </option>
                  ))}
                </select>
              </label>
              <button className="border-brand/30 text-brand-dark mt-4 min-h-11 rounded-full border px-5 text-sm font-bold">
                Atribuir avaliador
              </button>
            </ConfirmCommandForm>
          </div>
        </section>
      ) : null}

      <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Entrevistas
        </h2>
        {interviews.length ? (
          <ol className="mt-5 grid gap-4 lg:grid-cols-2">
            {interviews.map((interview) => (
              <li
                key={interview.id}
                className="border-border-light rounded-2xl border p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <strong className="text-ink">
                    {formatDate(interview.scheduled_at)}
                  </strong>
                  <span className="bg-mint text-brand-dark rounded-full px-3 py-1 text-xs font-bold">
                    {interviewStatusLabels[interview.status]}
                  </span>
                </div>
                <p className="text-muted mt-2 text-sm">
                  {interviewTypeLabels[interview.interview_type]} · Responsável:{" "}
                  {interview.responsible?.full_name ?? "Não disponível"}
                </p>
                {interview.internal_notes ? (
                  <p className="text-ink mt-3 text-sm whitespace-pre-line">
                    {interview.internal_notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted mt-4 text-sm">
            Nenhuma entrevista registrada.
          </p>
        )}

        {canManage ? (
          <ConfirmCommandForm
            action={createCandidateInterviewAction}
            message="Registrar esta entrevista e suas observações internas?"
          >
            <input type="hidden" name="application_id" value={applicationId} />
            <div className="border-border-light mt-6 grid gap-4 border-t pt-6 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-ink text-sm font-bold">
                Data e hora
                <input
                  type="datetime-local"
                  name="scheduled_at"
                  required
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-4 font-normal"
                />
              </label>
              <label className="text-ink text-sm font-bold">
                Tipo
                <select
                  name="interview_type"
                  required
                  defaultValue="in_person"
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
                >
                  {interviewTypes.map((type) => (
                    <option key={type} value={type}>
                      {interviewTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-ink text-sm font-bold">
                Responsável
                <select
                  name="responsible_id"
                  required
                  defaultValue={user.id}
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
                >
                  {evaluators.map((evaluator) => (
                    <option key={evaluator.id} value={evaluator.id}>
                      {evaluator.full_name ?? "Usuário administrativo"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-ink text-sm font-bold">
                Status
                <select
                  name="status"
                  required
                  defaultValue="scheduled"
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
                >
                  {interviewStatuses.map((status) => (
                    <option key={status} value={status}>
                      {interviewStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-ink mt-4 block text-sm font-bold">
              Observações internas
              <textarea
                name="internal_notes"
                maxLength={4000}
                rows={4}
                className="border-border-light mt-2 w-full rounded-xl border p-4 font-normal"
              />
            </label>
            <button className="bg-brand hover:bg-brand-dark mt-5 min-h-11 rounded-full px-6 text-sm font-bold text-white">
              Registrar entrevista
            </button>
          </ConfirmCommandForm>
        ) : null}
      </section>
    </>
  );
}
