import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  adminApplicationTransitions,
  applicationStatusLabels,
  careerApplicationSnapshotSchema,
  formatApplicationDate,
  type ApplicationStatus,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import { formatCandidateMonth, formatFileSize } from "@/lib/careers/profile";
import { updateCareerApplicationStatusAction } from "../actions";

type HistoryRow = {
  id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  actor_kind: "candidate" | "admin" | "system";
  changed_at: string;
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
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { id, applicationId } = await params;
  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(applicationId).success
  )
    notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, applicationResult, historyResult] = await Promise.all([
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
  ]);
  if (
    jobResult.error ||
    !jobResult.data ||
    applicationResult.error ||
    !applicationResult.data
  )
    notFound();
  const application = applicationResult.data as CareerJobApplication;
  const snapshotResult = careerApplicationSnapshotSchema.safeParse(
    application.profile_snapshot,
  );
  const snapshot = snapshotResult.success ? snapshotResult.data : null;
  const history = (historyResult.data as HistoryRow[] | null) ?? [];
  const transitions = adminApplicationTransitions[application.status];
  const query = await searchParams;

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
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "transition"
            ? "Esta mudança de status não é permitida."
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
        {transitions.length ? (
          <ConfirmCommandForm
            action={updateCareerApplicationStatusAction}
            message="Confirma a atualização do status desta candidatura?"
          >
            <div className="border-border-light mt-6 grid gap-4 border-t pt-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input
                type="hidden"
                name="application_id"
                value={application.id}
              />
              <input type="hidden" name="job_id" value={id} />
              <label className="text-ink text-sm font-bold">
                Novo status
                <select
                  name="status"
                  required
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal"
                >
                  {transitions.map((status) => (
                    <option key={status} value={status}>
                      {applicationStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-ink text-sm font-bold">
                Processo seletivo (opcional)
                <input
                  name="process_label"
                  defaultValue={application.process_label ?? ""}
                  maxLength={160}
                  placeholder="Ex.: Processo 2026.2"
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-4 font-normal"
                />
              </label>
              <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-5 text-sm font-bold text-white">
                Atualizar
              </button>
            </div>
          </ConfirmCommandForm>
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
              </>
            ) : (
              <p className="text-muted">Nenhum currículo foi incluído.</p>
            )}
          </SnapshotSection>
        </div>
      )}

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
    </>
  );
}
