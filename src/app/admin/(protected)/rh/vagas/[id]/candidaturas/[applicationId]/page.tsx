import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { CareerCommunicationForm } from "@/components/admin/career-communication-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  candidateStageLabels,
  careerApplicationSnapshotSchema,
  formatApplicationDate,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import {
  careerCommunicationTemplateLabels,
  type CareerCommunicationStatus,
  type CareerCommunicationTemplate,
} from "@/lib/careers/communications/types";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  applicationSourceLabels,
  commuteFeasibilityLabels,
  commuteTimeLabels,
  transitBenefitLabels,
  transportModeLabels,
  type ApplicationLogistics,
  type ApplicationSource,
} from "@/lib/careers/logistics";
import {
  calculateMatchInformationCoverage,
  matchResultSchema,
  matchStatusLabels,
  type ExplainableMatchResult,
} from "@/lib/careers/matching";
import { formatCandidateMonth, formatFileSize } from "@/lib/careers/profile";
import {
  selectionStageApprovalLabels,
  selectionStageNumbers,
  type SelectionStage,
} from "@/lib/careers/selection-processes";
import { recalculateApplicationMatchAction } from "../../aderencia/actions";
import {
  decideCareerApplicationStageAction,
  retryCareerApplicationCommunicationAction,
  scheduleCareerStageEventAction,
} from "../actions";

type HistoryRow = {
  id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  actor_kind: "candidate" | "admin" | "system";
  changed_at: string;
};

type MatchRunRow = {
  id: string;
  matrix_version: number;
  overall_score: number;
  hard_skills_score: number;
  result: unknown;
  calculated_at: string;
};

type CommunicationRow = {
  id: string;
  type: CareerCommunicationTemplate;
  subject: string;
  recipient_email: string;
  status: CareerCommunicationStatus;
  attempt_count: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  last_error_code: string | null;
  triggered_by: "candidate" | "admin" | "system";
  created_at: string;
  creator: { full_name: string | null } | null;
};

type StageHistoryRow = {
  id: string;
  from_stage: SelectionStage | null;
  to_stage: SelectionStage;
  decision: "submitted" | "approved" | "not_approved" | "hired" | "migrated";
  created_at: string;
  admin: { full_name: string | null } | null;
};

type StageEventRow = {
  stage: "interview" | "practical_test";
  scheduled_date: string;
  scheduled_time: string;
  location: string;
  instructions: string | null;
  internal_notes: string | null;
  invitation_sent_at: string | null;
};

const communicationStatusLabels: Record<CareerCommunicationStatus, string> = {
  PENDING: "Pendente",
  PROCESSING: "Processando",
  SENT: "Enviado — aceito pelo SMTP",
  FAILED: "Falha no envio",
  CANCELLED: "Cancelado",
};

function SnapshotSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-6">
      <h2 className="font-heading text-brand-dark text-xl font-semibold">
        {title}
      </h2>
      <div className="text-ink mt-5 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default async function CareerApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; applicationId: string }>;
  searchParams: Promise<{
    status?: string;
    error?: string;
    communication?: string;
  }>;
}) {
  const { id, applicationId } = await params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(applicationId).success
  )
    notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const [
    jobResult,
    applicationResult,
    historyResult,
    matchRunsResult,
    matrixResult,
    logisticsResult,
    communicationsResult,
    stageHistoryResult,
    stageEventsResult,
  ] = await Promise.all([
    supabase.from("career_jobs").select("id, title").eq("id", id).maybeSingle(),
    supabase
      .from("career_job_applications")
      .select("*")
      .eq("id", applicationId)
      .eq("job_id", id)
      .maybeSingle(),
    supabase
      .from("career_job_application_history")
      .select("id, from_status, to_status, actor_kind, changed_at")
      .eq("application_id", applicationId)
      .order("changed_at", { ascending: false }),
    supabase
      .from("career_application_match_runs")
      .select(
        "id, matrix_version, overall_score, hard_skills_score, result, calculated_at",
      )
      .eq("application_id", applicationId)
      .order("calculated_at", { ascending: false }),
    supabase
      .from("career_job_match_matrices")
      .select("id, version")
      .eq("job_id", id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("career_application_logistics")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle(),
    supabase
      .from("career_communications")
      .select(
        "id, type, subject, recipient_email, status, attempt_count, last_attempt_at, sent_at, failed_at, last_error_code, triggered_by, created_at, creator:profiles!career_communications_created_by_fkey(full_name)",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("career_application_stage_history")
      .select(
        "id, from_stage, to_stage, decision, created_at, admin:profiles!career_application_stage_history_admin_id_fkey(full_name)",
      )
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("career_application_stage_events")
      .select(
        "stage, scheduled_date, scheduled_time, location, instructions, internal_notes, invitation_sent_at",
      )
      .eq("application_id", applicationId),
  ]);
  if (
    jobResult.error ||
    !jobResult.data ||
    applicationResult.error ||
    !applicationResult.data
  )
    notFound();
  const application = applicationResult.data as CareerJobApplication;
  const { data: latestResume } = await supabase
    .from("candidate_resumes")
    .select("id")
    .eq("candidate_id", application.candidate_id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const snapshotResult = careerApplicationSnapshotSchema.safeParse(
    application.profile_snapshot,
  );
  const snapshot = snapshotResult.success ? snapshotResult.data : null;
  const history = (historyResult.data as HistoryRow[] | null) ?? [];
  const matchRuns = (matchRunsResult.data as MatchRunRow[] | null) ?? [];
  const latestMatch = matchRuns[0] ?? null;
  const parsedMatch = matchResultSchema.safeParse(latestMatch?.result);
  const match: ExplainableMatchResult | null = parsedMatch.success
    ? parsedMatch.data
    : null;
  const logistics =
    (logisticsResult.data as ApplicationLogistics | null) ?? null;
  const communications =
    (communicationsResult.data as unknown as CommunicationRow[] | null) ?? [];
  const stageHistory =
    (stageHistoryResult.data as unknown as StageHistoryRow[] | null) ?? [];
  const stageEvents =
    (stageEventsResult.data as unknown as StageEventRow[] | null) ?? [];
  const currentEvent = stageEvents.find(
    (item) => item.stage === application.candidate_stage,
  );
  const query = await searchParams;
  const detailPath = `/admin/rh/vagas/${id}/candidaturas/${applicationId}`;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas / Candidatura"
        title={snapshot?.candidate.full_name ?? "Candidatura"}
        description={`Snapshot profissional enviado para a vaga ${jobResult.data.title}.`}
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          className="bg-brand hover:bg-brand-dark inline-flex min-h-11 items-center rounded-full px-5 text-sm font-bold text-white"
          href={`/admin/rh/avaliacoes/${applicationId}`}
        >
          Avaliações humanas
        </Link>
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={`/admin/rh/vagas/${id}/candidaturas`}
        >
          Voltar para inscritos
        </Link>
        <Link
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
          href={`/admin/rh/candidatos/${application.candidate_id}`}
        >
          Abrir perfil atual
        </Link>
      </div>

      {query.status === "updated" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Status atualizado e registrado no histórico.
        </p>
      ) : query.status === "stage-updated" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Decisão registrada e etapa atualizada com sucesso.
        </p>
      ) : query.status === "event-saved" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Agendamento salvo e convite processado.
        </p>
      ) : null}
      {query.status === "match-calculated" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Indicador recalculado e nova entrada adicionada ao histórico.
        </p>
      ) : null}
      {query.status === "communication-sent" ||
      query.communication === "sent" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Comunicação enviada. O servidor SMTP aceitou o envio.
        </p>
      ) : query.status === "communication-failed" ||
        query.communication === "failed" ? (
        <p
          role="status"
          className="bg-warning/10 text-warning mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          A comunicação foi registrada, mas o SMTP não aceitou o envio. Ela pode
          ser reenviada pelo histórico.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "decision"
            ? "Não foi possível registrar a decisão. Atualize a página e confirme a etapa atual."
            : query.error?.startsWith("schedule")
              ? "Não foi possível salvar o agendamento para a etapa atual."
              : query.error === "transition"
                ? "Esta mudança de status não é permitida."
                : query.error === "calculation"
                  ? "Não foi possível calcular a aderência desta candidatura."
                  : "Não foi possível atualizar a candidatura."}
        </p>
      ) : null}

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted text-xs font-bold tracking-wide uppercase">
              Status atual
            </p>
            <p className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
              {applicationStatusLabels[application.status]}
            </p>
            <p className="text-muted mt-2 text-sm">
              Enviada em {formatApplicationDate(application.submitted_at)}
            </p>
            {application.process_label ? (
              <p className="text-ink mt-2 text-sm">
                Processo: <strong>{application.process_label}</strong>
              </p>
            ) : null}
          </div>
        </div>
        <div className="border-border-light mt-6 border-t pt-6">
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            Etapa da seleção
          </p>
          <p className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
            {selectionStageNumbers[application.candidate_stage]
              ? `Etapa ${selectionStageNumbers[application.candidate_stage]} de 4 — ${candidateStageLabels[application.candidate_stage]}`
              : candidateStageLabels[application.candidate_stage]}
          </p>
          {selectionStageApprovalLabels[application.candidate_stage] ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <ConfirmCommandForm
                action={decideCareerApplicationStageAction}
                message="Confirma a aprovação e o avanço desta candidatura? A decisão será registrada no histórico."
              >
                <input
                  type="hidden"
                  name="application_id"
                  value={application.id}
                />
                <input type="hidden" name="job_id" value={id} />
                <input
                  type="hidden"
                  name="expected_stage"
                  value={application.candidate_stage}
                />
                <input type="hidden" name="decision" value="approve" />
                <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white">
                  {selectionStageApprovalLabels[application.candidate_stage]}
                </button>
              </ConfirmCommandForm>
              <ConfirmCommandForm
                action={decideCareerApplicationStageAction}
                message="Confirma que esta candidatura não foi aprovada nesta etapa? Esta ação encerra a participação neste processo."
              >
                <input
                  type="hidden"
                  name="application_id"
                  value={application.id}
                />
                <input type="hidden" name="job_id" value={id} />
                <input
                  type="hidden"
                  name="expected_stage"
                  value={application.candidate_stage}
                />
                <input type="hidden" name="decision" value="not_approve" />
                <button className="border-error/40 text-error min-h-11 rounded-full border px-5 text-sm font-bold">
                  NÃO APROVAR
                </button>
              </ConfirmCommandForm>
            </div>
          ) : (
            <p className="text-muted mt-3 text-sm">
              Esta participação chegou a um resultado final e não aceita novas
              decisões.
            </p>
          )}
        </div>
      </section>

      {["interview", "practical_test"].includes(application.candidate_stage) ? (
        <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7">
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            Agendamento
          </p>
          <h2 className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
            {application.candidate_stage === "interview"
              ? "Entrevista"
              : "Teste prático"}
          </h2>
          <form
            action={scheduleCareerStageEventAction}
            className="mt-5 grid gap-4 sm:grid-cols-3"
          >
            <input type="hidden" name="application_id" value={application.id} />
            <input type="hidden" name="job_id" value={id} />
            <input
              type="hidden"
              name="stage"
              value={application.candidate_stage}
            />
            <label className="text-ink text-sm font-bold">
              Data
              <input
                name="scheduled_date"
                type="date"
                required
                defaultValue={currentEvent?.scheduled_date}
                className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-4 font-normal"
              />
            </label>
            <label className="text-ink text-sm font-bold">
              Horário
              <input
                name="scheduled_time"
                type="time"
                required
                defaultValue={currentEvent?.scheduled_time?.slice(0, 5)}
                className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-4 font-normal"
              />
            </label>
            <label className="text-ink text-sm font-bold">
              Local
              <input
                name="location"
                required
                maxLength={240}
                defaultValue={currentEvent?.location}
                className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-4 font-normal"
              />
            </label>
            <label className="text-ink text-sm font-bold sm:col-span-3">
              Instruções para o candidato
              <textarea
                name="instructions"
                rows={3}
                maxLength={2000}
                defaultValue={currentEvent?.instructions ?? ""}
                className="border-border-light mt-2 w-full rounded-xl border p-4 font-normal"
              />
            </label>
            <label className="text-ink text-sm font-bold sm:col-span-3">
              Observações internas (não enviadas)
              <textarea
                name="internal_notes"
                rows={3}
                maxLength={4000}
                defaultValue={currentEvent?.internal_notes ?? ""}
                className="border-border-light mt-2 w-full rounded-xl border p-4 font-normal"
              />
            </label>
            <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white sm:col-span-3">
              SALVAR E ENVIAR CONVITE
            </button>
          </form>
          {currentEvent?.invitation_sent_at ? (
            <p className="text-muted mt-3 text-xs">
              Último convite aceito pelo SMTP em{" "}
              {formatApplicationDate(currentEvent.invitation_sent_at)}.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7">
        <p className="text-muted text-xs font-bold tracking-wide uppercase">
          Comunicação com o candidato
        </p>
        <h2 className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
          Enviar comunicação
        </h2>
        <dl className="border-border-light my-5 grid gap-4 border-y py-5 sm:grid-cols-2">
          <div>
            <dt className="text-muted text-xs">Nome</dt>
            <dd className="font-bold">
              {snapshot?.candidate.full_name ?? "Não informado"}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">E-mail</dt>
            <dd className="font-bold">
              {snapshot?.candidate.email ?? "Não informado"}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Vaga</dt>
            <dd className="font-bold">{jobResult.data.title}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Etapa atual</dt>
            <dd className="font-bold">
              {candidateStageLabels[application.candidate_stage]}
            </dd>
          </div>
        </dl>
        <CareerCommunicationForm
          applicationId={applicationId}
          returnPath={detailPath}
          idempotencyKey={`admin:${applicationId}:${randomUUID()}`}
        />
      </section>

      <SnapshotSection title="Logística da vaga">
        {logistics ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-muted">Unidade no envio</dt>
              <dd className="font-bold">
                {logistics.unit_snapshot?.name ?? "Não se aplica"}
              </dd>
              {logistics.unit_snapshot ? (
                <dd className="text-muted mt-1 text-xs">
                  {logistics.unit_snapshot.neighborhood} ·{" "}
                  {logistics.unit_snapshot.city}/{logistics.unit_snapshot.state}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-muted">Possibilidade de deslocamento</dt>
              <dd className="font-bold">
                {logistics.commute_feasibility
                  ? commuteFeasibilityLabels[logistics.commute_feasibility]
                  : "Não se aplica"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Tempo estimado</dt>
              <dd className="font-bold">
                {logistics.commute_time
                  ? commuteTimeLabels[logistics.commute_time]
                  : "Não se aplica"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Vale-transporte</dt>
              <dd className="font-bold">
                {logistics.transit_benefit
                  ? transitBenefitLabels[logistics.transit_benefit]
                  : "Não se aplica"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Meios informados</dt>
              <dd className="font-bold">
                {logistics.transport_modes.length
                  ? logistics.transport_modes
                      .map((mode) => transportModeLabels[mode])
                      .join(", ")
                  : "Não informado"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Origem da candidatura</dt>
              <dd className="font-bold">
                {applicationSourceLabels[
                  (application.source ?? "site_inneuro") as ApplicationSource
                ] ?? "Não informada"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted">
            Esta candidatura não possui declaração logística registrada.
          </p>
        )}
        <p className="text-muted mt-5 text-xs">
          Informações operacionais autodeclaradas. Meio de transporte e
          vale-transporte não atribuem bônus ou penalidade à aderência.
        </p>
      </SnapshotSection>

      <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-muted text-xs font-bold tracking-wide uppercase">
              Apoio à triagem
            </p>
            <h2 className="font-heading text-brand-dark mt-1 text-2xl font-semibold">
              ADERÊNCIA À VAGA
            </h2>
            <p className="text-brand-dark mt-2 font-bold">
              {match
                ? `Indicador profissional: ${match.overallScore}%`
                : "Indicador ainda não calculado"}
            </p>
            {match ? (
              <p className="text-muted mt-2 text-sm">
                Hard skills vinculadas à vaga: {match.hardSkillsScore}% · Matriz
                v{latestMatch?.matrix_version} · Cobertura das informações:{" "}
                {calculateMatchInformationCoverage(match.items)}%
              </p>
            ) : null}
          </div>
          {matrixResult.data ? (
            <ConfirmCommandForm
              action={recalculateApplicationMatchAction}
              message="Recalcular com a versão atual da matriz? O cálculo anterior permanecerá no histórico."
            >
              <input type="hidden" name="job_id" value={id} />
              <input
                type="hidden"
                name="application_id"
                value={applicationId}
              />
              <button className="border-brand/30 text-brand-dark min-h-11 rounded-full border px-5 text-sm font-bold">
                {match ? "Recalcular" : "Calcular aderência"}
              </button>
            </ConfirmCommandForm>
          ) : (
            <Link
              className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
              href={`/admin/rh/vagas/${id}/aderencia`}
            >
              Configurar matriz
            </Link>
          )}
        </div>

        <p className="border-brand/20 bg-mint/60 text-brand-dark mt-5 rounded-2xl border p-4 text-sm font-bold">
          Indicador de apoio à triagem. A decisão final é responsabilidade do
          RH. Nenhuma ação é tomada automaticamente.
        </p>

        {match ? (
          <div className="mt-6 grid gap-4">
            {match.items.map((item) => (
              <article
                key={item.key}
                className="border-border-light rounded-2xl border p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-ink font-bold">{item.label}</h3>
                    <p className="text-muted mt-1 text-xs">
                      Peso {item.weight}% · Correspondência {item.score}%
                    </p>
                  </div>
                  <span className="bg-surface text-brand-dark rounded-full px-3 py-1 text-xs font-bold">
                    {matchStatusLabels[item.status]}
                  </span>
                </div>
                {item.evidence.length ? (
                  <div className="mt-4">
                    <h4 className="text-success text-xs font-bold tracking-wide uppercase">
                      Evidências de aderência
                    </h4>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {item.evidence.map((evidence, index) => (
                        <li key={`${evidence.source}-${index}`}>
                          <span className="text-success" aria-hidden="true">
                            ✓
                          </span>{" "}
                          {evidence.text}
                          <span className="text-muted block text-xs">
                            Fonte: {evidence.source}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.pointsToVerify.length ? (
                  <div className="mt-4">
                    <h4 className="text-warning text-xs font-bold tracking-wide uppercase">
                      Pontos a verificar
                    </h4>
                    <ul className="mt-2 grid gap-2 text-sm">
                      {item.pointsToVerify.map((point) => (
                        <li key={point}>• {point}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-muted mt-5 text-sm">
            O cálculo usa somente o snapshot profissional confirmado enviado
            nesta candidatura.
          </p>
        )}

        {matchRuns.length ? (
          <details className="border-border-light mt-6 border-t pt-5">
            <summary className="text-brand cursor-pointer text-sm font-bold">
              Histórico de cálculos ({matchRuns.length})
            </summary>
            <ol className="mt-4 grid gap-2 text-sm">
              {matchRuns.map((run) => (
                <li
                  key={run.id}
                  className="border-border-light flex flex-wrap justify-between gap-3 rounded-xl border p-3"
                >
                  <span>
                    Matriz v{run.matrix_version}:{" "}
                    <strong>{run.overall_score}%</strong>
                    {" · "}Hard skills {run.hard_skills_score}%
                  </span>
                  <span className="text-muted text-xs">
                    {formatApplicationDate(run.calculated_at)}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </section>

      {!snapshot ? (
        <p
          role="alert"
          className="bg-error/10 text-error mt-6 rounded-2xl p-5 font-bold"
        >
          O snapshot desta candidatura não pôde ser validado.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <SnapshotSection title="Contato enviado">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted">Nome</dt>
                <dd className="font-bold">{snapshot.candidate.full_name}</dd>
              </div>
              <div>
                <dt className="text-muted">E-mail</dt>
                <dd className="font-bold break-all">
                  {snapshot.candidate.email ?? "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">WhatsApp</dt>
                <dd className="font-bold">
                  {snapshot.profile?.whatsapp ?? "Não informado"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Localização</dt>
                <dd className="font-bold">
                  {[snapshot.profile?.city, snapshot.profile?.state]
                    .filter(Boolean)
                    .join("/") || "Não informada"}
                </dd>
              </div>
            </dl>
          </SnapshotSection>

          <SnapshotSection title="Objetivo e disponibilidade">
            <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
              Objetivo profissional
            </h3>
            <p className="mt-2 whitespace-pre-line">
              {snapshot.profile?.professional_objective ?? "Não informado"}
            </p>
            <h3 className="text-muted mt-5 text-xs font-bold tracking-wide uppercase">
              Disponibilidade
            </h3>
            <p className="mt-2 whitespace-pre-line">
              {snapshot.profile?.availability ?? "Não informada"}
            </p>
          </SnapshotSection>

          <SnapshotSection title="Experiências enviadas">
            {snapshot.experiences.length ? (
              <ol className="grid gap-4">
                {snapshot.experiences.map((item, index) => (
                  <li
                    key={`${item.company}-${item.start_date}-${index}`}
                    className="border-border-light rounded-2xl border p-4"
                  >
                    <p className="font-bold">
                      {item.job_title} · {item.company}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {formatCandidateMonth(item.start_date)} até{" "}
                      {item.is_current
                        ? "o momento"
                        : formatCandidateMonth(item.end_date)}
                    </p>
                    <p className="mt-3 whitespace-pre-line">
                      {item.activities}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted">Nenhuma experiência enviada.</p>
            )}
          </SnapshotSection>

          <SnapshotSection title="Formação enviada">
            {snapshot.education.length ? (
              <ol className="grid gap-4">
                {snapshot.education.map((item, index) => (
                  <li
                    key={`${item.institution}-${item.start_date}-${index}`}
                    className="border-border-light rounded-2xl border p-4"
                  >
                    <p className="font-bold">{item.course}</p>
                    <p className="text-muted mt-1">
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
              <p className="text-muted">Nenhuma formação enviada.</p>
            )}
          </SnapshotSection>

          <SnapshotSection title="Habilidades autodeclaradas">
            {snapshot.skills.length ? (
              <ul className="flex flex-wrap gap-2">
                {snapshot.skills.map((skill) => (
                  <li
                    key={skill}
                    className="bg-mint text-brand-dark rounded-full px-4 py-2 font-bold"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nenhuma habilidade enviada.</p>
            )}
            <p className="text-muted mt-4 text-xs">
              As habilidades são autodeclaradas e não representam validação da
              INNEURO.
            </p>
          </SnapshotSection>

          <SnapshotSection title="Currículo informado">
            {snapshot.resume ? (
              <>
                <p className="font-bold">
                  Versão {snapshot.resume.version} ·{" "}
                  {snapshot.resume.original_name}
                </p>
                <p className="text-muted mt-1 text-xs">
                  {formatFileSize(snapshot.resume.size_bytes)}
                </p>
                {latestResume ? (
                  <a
                    className="text-brand mt-4 inline-flex min-h-11 items-center font-bold hover:underline"
                    href={`/api/admin/rh/curriculos/${latestResume.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visualizar currículo original
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-muted">Nenhum currículo foi incluído.</p>
            )}
          </SnapshotSection>
        </div>
      )}

      <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-6">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Histórico de comunicações
        </h2>
        {communicationsResult.error ? (
          <p className="text-error mt-5 text-sm">
            Não foi possível carregar o histórico de comunicações.
          </p>
        ) : communications.length ? (
          <ol className="mt-5 grid gap-4">
            {communications.map((item) => (
              <li
                key={item.id}
                className="border-border-light rounded-2xl border p-4 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {careerCommunicationTemplateLabels[item.type]}
                    </p>
                    <p className="text-muted mt-1">{item.subject}</p>
                  </div>
                  <span className="bg-surface text-brand-dark rounded-full px-3 py-1 text-xs font-bold">
                    {communicationStatusLabels[item.status]}
                  </span>
                </div>
                <dl className="text-muted mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="inline font-bold">Destinatário: </dt>
                    <dd className="inline">{item.recipient_email}</dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Criada em: </dt>
                    <dd className="inline">
                      {formatApplicationDate(item.created_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Responsável: </dt>
                    <dd className="inline">
                      {item.creator?.full_name ??
                        (item.triggered_by === "candidate"
                          ? "Candidato / automação"
                          : "Sistema")}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline font-bold">Tentativas: </dt>
                    <dd className="inline">{item.attempt_count} de 3</dd>
                  </div>
                  {item.sent_at ? (
                    <div>
                      <dt className="inline font-bold">Enviada em: </dt>
                      <dd className="inline">
                        {formatApplicationDate(item.sent_at)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {["PENDING", "FAILED"].includes(item.status) &&
                item.attempt_count < 3 &&
                item.type !== "PASSWORD_RECOVERY" ? (
                  <form
                    action={retryCareerApplicationCommunicationAction}
                    className="mt-4"
                  >
                    <input
                      type="hidden"
                      name="communication_id"
                      value={item.id}
                    />
                    <input
                      type="hidden"
                      name="return_path"
                      value={detailPath}
                    />
                    <button className="border-brand/30 text-brand-dark min-h-9 rounded-full border px-4 text-xs font-bold">
                      {item.status === "PENDING"
                        ? "Processar envio"
                        : "Reenviar"}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted mt-5 text-sm">
            Nenhuma comunicação registrada para esta candidatura.
          </p>
        )}
      </section>

      <div className="mt-6">
        <SnapshotSection title="Histórico das etapas">
          {stageHistoryResult.error ? (
            <p className="text-error">
              Não foi possível carregar o histórico das etapas.
            </p>
          ) : stageHistory.length ? (
            <ol className="grid gap-3">
              {stageHistory.map((entry) => (
                <li
                  key={entry.id}
                  className="border-border-light flex flex-wrap justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <span>
                    <strong>{candidateStageLabels[entry.to_stage]}</strong>
                    {entry.from_stage
                      ? ` — anteriormente ${candidateStageLabels[entry.from_stage]}`
                      : " — entrada no funil"}
                    <span className="text-muted mt-1 block text-xs">
                      Decisão:{" "}
                      {entry.decision === "not_approved"
                        ? "Não aprovado"
                        : entry.decision === "hired"
                          ? "Contratado"
                          : entry.decision === "approved"
                            ? "Aprovado"
                            : "Registro inicial"}
                    </span>
                  </span>
                  <span className="text-muted text-xs">
                    {formatApplicationDate(entry.created_at)} ·{" "}
                    {entry.admin?.full_name ?? "Sistema"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">Nenhuma movimentação registrada.</p>
          )}
        </SnapshotSection>
      </div>

      <div className="mt-6">
        <SnapshotSection title="Histórico de status">
          {historyResult.error ? (
            <p className="text-error">Não foi possível carregar o histórico.</p>
          ) : history.length ? (
            <ol className="grid gap-3">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="border-border-light flex flex-wrap justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <span>
                    <strong>{applicationStatusLabels[entry.to_status]}</strong>
                    {entry.from_status
                      ? ` — anteriormente ${applicationStatusLabels[entry.from_status]}`
                      : " — candidatura criada"}
                  </span>
                  <span className="text-muted text-xs">
                    {formatApplicationDate(entry.changed_at)} ·{" "}
                    {entry.actor_kind === "candidate"
                      ? "Candidato"
                      : entry.actor_kind === "admin"
                        ? "RH"
                        : "Sistema"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted">Nenhuma alteração registrada.</p>
          )}
        </SnapshotSection>
      </div>
    </>
  );
}
