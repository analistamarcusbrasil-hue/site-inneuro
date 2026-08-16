import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  formatApplicationDate,
  type ApplicationStatus,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  auxiliarySelectionStages,
  canManageSelectionCandidates,
  formatSelectionPeriodDate,
  mainSelectionStages,
  selectionProcessStatusLabels,
  selectionStageLabels,
  selectionStages,
  type CareerSelectionCandidate,
  type CareerSelectionProcess,
  type SelectionStage,
} from "@/lib/careers/selection-processes";
import {
  addCandidateToSelectionProcessAction,
  moveSelectionCandidateAction,
  saveSelectionCandidateNoteAction,
  transitionSelectionProcessAction,
} from "../actions";

type ParticipantRow = CareerSelectionCandidate & {
  candidate: { id: string; full_name: string } | null;
  application: {
    id: string;
    status: ApplicationStatus;
    submitted_at: string;
  } | null;
};

type AvailableApplicationRow = {
  id: string;
  candidate_id: string;
  status: ApplicationStatus;
  submitted_at: string;
  candidate: { id: string; full_name: string } | null;
};

type MovementRow = {
  id: string;
  candidate_id: string;
  from_stage: SelectionStage | null;
  to_stage: SelectionStage;
  moved_at: string;
  candidate: { full_name: string } | null;
  administrator: { full_name: string } | null;
};

const processStatusClasses = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-violet-100 text-violet-800",
  closed: "bg-slate-200 text-slate-800",
  cancelled: "bg-rose-100 text-rose-800",
} as const;

const statusMessages: Record<string, string> = {
  created: "Processo criado como rascunho.",
  open: "Processo aberto.",
  in_progress: "Processo iniciado.",
  closed: "Processo encerrado.",
  cancelled: "Processo cancelado.",
  "candidate-added": "Candidato adicionado em Inscritos.",
  moved: "Candidato movimentado e histórico registrado.",
  "note-saved": "Observação interna salva.",
};

const errorMessages: Record<string, string> = {
  transition: "Esta mudança de status não é permitida.",
  candidate: "Não foi possível adicionar esta candidatura ao processo.",
  duplicate: "Este candidato já participa do processo.",
  movement: "Não foi possível movimentar o candidato.",
  "interview-data":
    "Informe data, horário e local antes de enviar um convite de entrevista.",
  note: "Não foi possível salvar a observação interna.",
};

function CandidateControls({
  process,
  participant,
  view,
}: {
  process: CareerSelectionProcess;
  participant: ParticipantRow;
  view: "kanban" | "list";
}) {
  const manageable = canManageSelectionCandidates(process.status);
  return (
    <div className="mt-4 grid gap-3">
      {manageable ? (
        <form action={moveSelectionCandidateAction} className="grid gap-2">
          <input type="hidden" name="process_id" value={process.id} />
          <input
            type="hidden"
            name="process_candidate_id"
            value={participant.id}
          />
          <input type="hidden" name="view" value={view} />
          <label className="text-muted text-xs font-bold">
            Mover manualmente para
            <select
              name="stage"
              required
              defaultValue=""
              className="border-border-light text-ink mt-1 min-h-10 w-full rounded-xl border bg-white px-3 font-normal"
            >
              <option value="" disabled>
                Escolha a etapa
              </option>
              {selectionStages
                .filter((stage) => stage !== participant.stage)
                .map((stage) => (
                  <option key={stage} value={stage}>
                    {selectionStageLabels[stage]}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-ink flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              name="send_communication"
              className="size-4"
            />
            Enviar comunicação ao candidato
          </label>
          <details className="border-border-light rounded-xl border p-3">
            <summary className="text-brand cursor-pointer text-xs font-bold">
              Dados de entrevista ou orientações
            </summary>
            <div className="mt-3 grid gap-3">
              <p className="text-muted text-xs">
                Data, horário e local são obrigatórios quando a etapa escolhida
                for Entrevista.
              </p>
              <input
                name="interview_date"
                type="date"
                aria-label="Data da entrevista"
                className="border-border-light min-h-10 rounded-xl border px-3"
              />
              <input
                name="interview_time"
                type="time"
                aria-label="Horário da entrevista"
                className="border-border-light min-h-10 rounded-xl border px-3"
              />
              <input
                name="location"
                maxLength={240}
                placeholder="Local da entrevista"
                aria-label="Local da entrevista"
                className="border-border-light min-h-10 rounded-xl border px-3"
              />
              <textarea
                name="instructions"
                maxLength={2000}
                rows={3}
                placeholder="Orientações ao candidato"
                aria-label="Orientações ao candidato"
                className="border-border-light rounded-xl border p-3"
              />
            </div>
          </details>
          <button className="border-brand/30 text-brand-dark hover:bg-mint min-h-10 rounded-full border px-4 text-xs font-bold">
            Confirmar movimentação
          </button>
        </form>
      ) : null}

      <details className="border-border-light rounded-2xl border p-3">
        <summary className="text-brand cursor-pointer text-xs font-bold">
          Observação interna
          {participant.internal_note ? " — preenchida" : ""}
        </summary>
        <form action={saveSelectionCandidateNoteAction} className="mt-3">
          <input type="hidden" name="process_id" value={process.id} />
          <input
            type="hidden"
            name="process_candidate_id"
            value={participant.id}
          />
          <input type="hidden" name="view" value={view} />
          <label className="text-muted block text-xs font-bold">
            Uso exclusivo do RH
            <textarea
              name="internal_note"
              maxLength={4000}
              rows={4}
              defaultValue={participant.internal_note ?? ""}
              className="border-border-light text-ink mt-1 w-full rounded-xl border p-3 font-normal"
            />
          </label>
          <button className="bg-brand hover:bg-brand-dark mt-2 min-h-9 rounded-full px-4 text-xs font-bold text-white">
            Salvar observação
          </button>
        </form>
      </details>
    </div>
  );
}

function CandidateCard({
  process,
  participant,
  view,
}: {
  process: CareerSelectionProcess;
  participant: ParticipantRow;
  view: "kanban" | "list";
}) {
  return (
    <article className="border-border-light rounded-2xl border bg-white p-4">
      <h3 className="text-ink font-bold">
        {participant.candidate?.full_name ?? "Candidato indisponível"}
      </h3>
      <p className="text-muted mt-1 text-xs">
        Candidatura enviada em{" "}
        {participant.application
          ? formatApplicationDate(participant.application.submitted_at)
          : "data indisponível"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <Link
          className="text-brand font-bold hover:underline"
          href={`/admin/rh/candidatos/${participant.candidate_id}`}
        >
          Perfil atual
        </Link>
        <Link
          className="text-brand font-bold hover:underline"
          href={`/admin/rh/vagas/${process.job_id}/candidaturas/${participant.application_id}`}
        >
          Snapshot enviado
        </Link>
      </div>
      <CandidateControls
        process={process}
        participant={participant}
        view={view}
      />
    </article>
  );
}

export default async function SelectionProcessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    view?: string;
    status?: string;
    error?: string;
    communication?: string;
  }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const view = query.view === "list" ? "list" : "kanban";
  const { supabase } = await requireHrAccess("processes:manage");
  const [processResult, participantsResult, movementsResult] =
    await Promise.all([
      supabase
        .from("career_selection_processes")
        .select("*, job:career_jobs(id, title, status)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("career_selection_process_candidates")
        .select(
          "*, candidate:candidate_accounts(id, full_name), application:career_job_applications(id, status, submitted_at)",
        )
        .eq("process_id", id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("career_selection_movements")
        .select(
          "id, candidate_id, from_stage, to_stage, moved_at, candidate:candidate_accounts(full_name), administrator:profiles(full_name)",
        )
        .eq("process_id", id)
        .order("moved_at", { ascending: false })
        .limit(100),
    ]);
  if (processResult.error || !processResult.data) notFound();
  const process = processResult.data as unknown as CareerSelectionProcess;
  const participants =
    (participantsResult.data as unknown as ParticipantRow[] | null) ?? [];
  const movements =
    (movementsResult.data as unknown as MovementRow[] | null) ?? [];
  const participantApplicationIds = new Set(
    participants.map((participant) => participant.application_id),
  );
  const availableResult = canManageSelectionCandidates(process.status)
    ? await supabase
        .from("career_job_applications")
        .select(
          "id, candidate_id, status, submitted_at, candidate:candidate_accounts(id, full_name)",
        )
        .eq("job_id", process.job_id)
        .not("status", "in", "(finalized,withdrawn)")
        .order("submitted_at", { ascending: false })
    : { data: [], error: null };
  const availableApplications = (
    (availableResult.data as unknown as AvailableApplicationRow[] | null) ?? []
  ).filter((application) => !participantApplicationIds.has(application.id));
  const stageCounts = Object.fromEntries(
    selectionStages.map((stage) => [
      stage,
      participants.filter((participant) => participant.stage === stage).length,
    ]),
  ) as Record<SelectionStage, number>;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Processos Seletivos"
        title={process.name}
        description="Movimente candidatos somente por decisão humana. Nenhum score altera etapas automaticamente."
      />
      <HrNavigation current="processes" canManageJobs canManageCandidates />

      {query.status && statusMessages[query.status] ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {statusMessages[query.status]}
        </p>
      ) : null}
      {query.communication === "sent" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Comunicação registrada e aceita pelo servidor SMTP.
        </p>
      ) : query.communication === "failed" ? (
        <p
          role="status"
          className="bg-warning/10 text-warning mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          A etapa foi atualizada, mas o envio falhou e ficou registrado para
          reenvio.
        </p>
      ) : null}
      {query.error && errorMessages[query.error] ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {errorMessages[query.error]}
        </p>
      ) : null}

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${processStatusClasses[process.status]}`}
            >
              {selectionProcessStatusLabels[process.status]}
            </span>
            <p className="text-ink mt-4 font-bold">
              Vaga: {process.job?.title ?? "Vaga indisponível"}
            </p>
            <p className="text-muted mt-2 text-sm">
              Período: {formatSelectionPeriodDate(process.starts_on)} a{" "}
              {formatSelectionPeriodDate(process.ends_on)}
            </p>
            <p className="text-muted mt-1 text-sm">
              {participants.length} participante(s)
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/rh/processos"
              className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
            >
              Voltar
            </Link>
            <Link
              href={`/admin/rh/vagas/${process.job_id}`}
              className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
            >
              Abrir vaga
            </Link>
          </div>
        </div>

        <div className="border-border-light mt-6 flex flex-wrap gap-3 border-t pt-6">
          {process.status === "draft" ? (
            <ConfirmCommandForm
              action={transitionSelectionProcessAction}
              message="Abrir este processo seletivo?"
            >
              <input type="hidden" name="process_id" value={process.id} />
              <input type="hidden" name="status" value="open" />
              <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white">
                Abrir processo
              </button>
            </ConfirmCommandForm>
          ) : null}
          {process.status === "open" ? (
            <ConfirmCommandForm
              action={transitionSelectionProcessAction}
              message="Iniciar a etapa ativa deste processo seletivo?"
            >
              <input type="hidden" name="process_id" value={process.id} />
              <input type="hidden" name="status" value="in_progress" />
              <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white">
                Iniciar processo
              </button>
            </ConfirmCommandForm>
          ) : null}
          {process.status === "open" || process.status === "in_progress" ? (
            <ConfirmCommandForm
              action={transitionSelectionProcessAction}
              message="Encerrar este processo? Depois disso não será possível movimentar candidatos."
            >
              <input type="hidden" name="process_id" value={process.id} />
              <input type="hidden" name="status" value="closed" />
              <label className="text-ink flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  name="send_communication"
                  className="size-4"
                />
                Comunicar encerramento aos participantes
              </label>
              <button className="border-brand text-brand min-h-11 rounded-full border px-5 text-sm font-bold">
                Encerrar
              </button>
            </ConfirmCommandForm>
          ) : null}
          {process.status !== "closed" && process.status !== "cancelled" ? (
            <ConfirmCommandForm
              action={transitionSelectionProcessAction}
              message="Cancelar este processo seletivo? Esta ação encerra as movimentações."
            >
              <input type="hidden" name="process_id" value={process.id} />
              <input type="hidden" name="status" value="cancelled" />
              <button className="border-error text-error min-h-11 rounded-full border px-5 text-sm font-bold">
                Cancelar processo
              </button>
            </ConfirmCommandForm>
          ) : null}
        </div>
      </section>

      {canManageSelectionCandidates(process.status) ? (
        <section className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Candidaturas disponíveis
          </h2>
          <p className="text-muted mt-2 text-sm">
            A inclusão é uma decisão manual do RH. O candidato entrará na etapa
            Inscritos.
          </p>
          {availableResult.error ? (
            <p className="text-error mt-4 text-sm font-bold">
              Não foi possível consultar as candidaturas desta vaga.
            </p>
          ) : availableApplications.length ? (
            <ul className="mt-5 grid gap-3 lg:grid-cols-2">
              {availableApplications.map((application) => (
                <li
                  key={application.id}
                  className="border-border-light flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4"
                >
                  <div>
                    <p className="text-ink font-bold">
                      {application.candidate?.full_name ??
                        "Candidato indisponível"}
                    </p>
                    <p className="text-muted mt-1 text-xs">
                      {applicationStatusLabels[application.status]} ·{" "}
                      {formatApplicationDate(application.submitted_at)}
                    </p>
                  </div>
                  <form action={addCandidateToSelectionProcessAction}>
                    <input type="hidden" name="process_id" value={process.id} />
                    <input
                      type="hidden"
                      name="application_id"
                      value={application.id}
                    />
                    <button className="bg-brand hover:bg-brand-dark min-h-10 rounded-full px-4 text-xs font-bold text-white">
                      Adicionar ao processo
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mt-4 text-sm">
              Nenhuma nova candidatura ativa disponível para inclusão.
            </p>
          )}
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="pipeline-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="pipeline-title"
              className="font-heading text-ink text-2xl font-semibold"
            >
              Pipeline de candidatos
            </h2>
            <p className="text-muted mt-2 text-sm">
              Toda movimentação registra origem, destino, responsável e data.
            </p>
          </div>
          <div className="border-border-light flex rounded-full border bg-white p-1 text-sm font-bold">
            <Link
              href={`/admin/rh/processos/${process.id}?view=kanban`}
              aria-current={view === "kanban" ? "page" : undefined}
              className={`rounded-full px-4 py-2 ${view === "kanban" ? "bg-brand text-white" : "text-brand-dark"}`}
            >
              Kanban
            </Link>
            <Link
              href={`/admin/rh/processos/${process.id}?view=list`}
              aria-current={view === "list" ? "page" : undefined}
              className={`rounded-full px-4 py-2 ${view === "list" ? "bg-brand text-white" : "text-brand-dark"}`}
            >
              Lista
            </Link>
          </div>
        </div>

        {participantsResult.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-5 rounded-2xl p-4 font-bold"
          >
            Não foi possível carregar os participantes.
          </p>
        ) : view === "kanban" ? (
          <>
            <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {mainSelectionStages.map((stage) => (
                <section
                  key={stage}
                  className="border-border-light bg-surface/60 rounded-3xl border p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-brand-dark font-bold">
                      {selectionStageLabels[stage]}
                    </h3>
                    <span className="text-muted rounded-full bg-white px-2.5 py-1 text-xs font-bold">
                      {stageCounts[stage]}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {participants
                      .filter((participant) => participant.stage === stage)
                      .map((participant) => (
                        <CandidateCard
                          key={participant.id}
                          process={process}
                          participant={participant}
                          view={view}
                        />
                      ))}
                    {!stageCounts[stage] ? (
                      <p className="text-muted rounded-2xl bg-white p-4 text-xs">
                        Nenhum candidato nesta etapa.
                      </p>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {auxiliarySelectionStages.map((stage) => (
                <section
                  key={stage}
                  className="border-border-light rounded-3xl border bg-white p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-brand-dark font-bold">
                      {selectionStageLabels[stage]}
                    </h3>
                    <span className="bg-surface text-muted rounded-full px-3 py-1 text-xs font-bold">
                      {stageCounts[stage]}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {participants
                      .filter((participant) => participant.stage === stage)
                      .map((participant) => (
                        <CandidateCard
                          key={participant.id}
                          process={process}
                          participant={participant}
                          view={view}
                        />
                      ))}
                    {!stageCounts[stage] ? (
                      <p className="text-muted text-xs">
                        Nenhum candidato neste estado auxiliar.
                      </p>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <div className="border-border-light mt-5 overflow-x-auto rounded-3xl border bg-white">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-surface text-muted text-xs uppercase">
                <tr>
                  <th className="px-5 py-4">Candidato</th>
                  <th className="px-5 py-4">Etapa</th>
                  <th className="px-5 py-4">Candidatura</th>
                  <th className="px-5 py-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <tr
                    key={participant.id}
                    className="border-border-light border-t align-top"
                  >
                    <td className="px-5 py-4 font-bold">
                      {participant.candidate?.full_name ??
                        "Candidato indisponível"}
                    </td>
                    <td className="px-5 py-4">
                      {selectionStageLabels[participant.stage]}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {participant.application
                        ? formatApplicationDate(
                            participant.application.submitted_at,
                          )
                        : "Indisponível"}
                    </td>
                    <td className="w-[320px] px-5 py-4">
                      <CandidateControls
                        process={process}
                        participant={participant}
                        view={view}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!participants.length ? (
              <p className="text-muted p-6 text-center text-sm">
                Nenhum candidato adicionado ao processo.
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section className="border-border-light mt-8 rounded-3xl border bg-white p-5 sm:p-7">
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Histórico de movimentações
        </h2>
        <p className="text-muted mt-2 text-sm">
          Registro interno visível somente para administradores e RH autorizado.
        </p>
        {movementsResult.error ? (
          <p className="text-error mt-4 text-sm font-bold">
            Não foi possível carregar o histórico.
          </p>
        ) : movements.length ? (
          <ol className="mt-5 grid gap-3">
            {movements.map((movement) => (
              <li
                key={movement.id}
                className="border-border-light flex flex-wrap items-start justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-ink text-sm font-bold">
                    {movement.candidate?.full_name ?? "Candidato indisponível"}
                  </p>
                  <p className="text-muted mt-1 text-xs">
                    {movement.from_stage
                      ? `${selectionStageLabels[movement.from_stage]} → `
                      : "Entrada → "}
                    {selectionStageLabels[movement.to_stage]}
                  </p>
                </div>
                <p className="text-muted text-right text-xs">
                  {movement.administrator?.full_name ?? "Administrador"}
                  <br />
                  {formatApplicationDate(movement.moved_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted mt-4 text-sm">
            Nenhuma movimentação registrada.
          </p>
        )}
      </section>
    </>
  );
}
