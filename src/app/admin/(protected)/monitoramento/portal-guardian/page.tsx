import {
  Activity,
  AlertTriangle,
  Clock3,
  FileArchive,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import {
  AdminBadge,
  AdminButton,
  AdminMetricCard,
  AdminSectionCard,
} from "@/components/admin/ui";
import { requireAdminPermission } from "@/lib/cms/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  runPortalGuardianDryRunAction,
  savePortalGuardianSettingsAction,
} from "./actions";

type Dashboard = {
  settings: Record<string, boolean | number>;
  health: {
    status: "HEALTHY" | "WARNING" | "CRITICAL";
    last_run: string | null;
    next_run: string | null;
    recent_failures: number;
  };
  requests: {
    open_total: number;
    attention: number;
    risk: number;
    overdue: number;
  };
  storage: { scheduling: number; resumes: number; media: number };
  finding_health: {
    orphan_suspected: number;
    orphan_confirmed: number;
    broken_references: number;
  };
  purge_due: number;
  resume_pending: number;
  findings: number;
  recent_runs: Array<{
    id: string;
    job_name: string;
    status: string;
    dry_run: boolean;
    started_at: string;
    finished_at: string | null;
    scanned_count: number;
    affected_count: number;
    failed_count: number;
    bytes_freed: number;
    error_code: string | null;
  }>;
};

const labels: Record<string, string> = {
  SUCCESS: "Concluído",
  PARTIAL: "Parcial",
  FAILED: "Falhou",
  RUNNING: "Em execução",
};

function formatBytes(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "unit",
    unit: "megabyte",
    maximumFractionDigits: 1,
  }).format(Number(value || 0) / 1048576);
}

export default async function PortalGuardianPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { profile } = await requireAdminPermission("settings.manage");
  const isSuperAdmin =
    profile.role === "super_admin" || profile.access_profile === "super_admin";
  const admin = createSupabaseAdminClient();
  const result = admin
    ? await admin.rpc("get_portal_guardian_dashboard")
    : null;
  const dashboard = result?.data as Dashboard | null;
  const unavailable = !admin || result?.error || !dashboard;

  return (
    <>
      <AdminPageHeading
        eyebrow="Sistema / Monitoramento"
        title="Portal Guardian"
        description="Saúde operacional, retenção segura e manutenção determinística do portal. Nenhuma decisão de exclusão usa IA."
        actions={
          isSuperAdmin && !unavailable ? (
            <form action={runPortalGuardianDryRunAction}>
              <AdminButton type="submit" variant="outline">
                <ShieldCheck size={17} />
                Executar simulação
              </AdminButton>
            </form>
          ) : null
        }
      />
      {query.success ? (
        <p
          role="status"
          className="bg-mint text-brand mb-5 rounded-xl p-4 font-bold"
        >
          {query.success === "dry-run"
            ? "Simulação concluída sem alterar dados ou arquivos."
            : "Configurações atualizadas."}
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-5 rounded-xl p-4 font-bold"
        >
          {query.error === "permission"
            ? "Somente o Superadministrador pode alterar ou executar o Guardian."
            : "Não foi possível concluir a operação do Portal Guardian."}
        </p>
      ) : null}

      {unavailable ? (
        <AdminSectionCard
          title="Guardian ainda não instalado"
          description="A interface está pronta, mas a migração e a função operacional ainda não foram aplicadas ao ambiente. Nenhuma automação está ativa."
        >
          <div className="bg-warning/10 text-ink flex gap-3 rounded-xl p-4 text-sm">
            <AlertTriangle className="text-warning shrink-0" size={20} />
            <p>
              Execute e revise primeiro o dry run documentado antes de habilitar
              qualquer chave destrutiva.
            </p>
          </div>
        </AdminSectionCard>
      ) : (
        <div className="space-y-6">
          <AdminSectionCard
            title="Status geral"
            description="Saúde calculada por atraso de job, falhas recentes e referências quebradas."
          >
            <div className="flex flex-wrap items-center gap-4">
              <AdminBadge
                variant={
                  dashboard.health.status === "HEALTHY"
                    ? "success"
                    : dashboard.health.status === "CRITICAL"
                      ? "danger"
                      : "warning"
                }
              >
                {dashboard.health.status}
              </AdminBadge>
              <p className="text-muted text-sm">
                Última execução:{" "}
                {dashboard.health.last_run
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "America/Sao_Paulo",
                    }).format(new Date(dashboard.health.last_run))
                  : "ainda não executado"}{" "}
                · {dashboard.health.recent_failures} falha(s) nas últimas 24
                horas
              </p>
            </div>
          </AdminSectionCard>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <AdminMetricCard
              label="15–16 dias"
              value={dashboard.requests.attention}
              description="Atenção operacional"
              icon={<Clock3 size={19} />}
              status="Atenção"
              statusVariant="warning"
            />
            <AdminMetricCard
              label="17–19 dias"
              value={dashboard.requests.risk}
              description="Próximas do prazo"
              icon={<AlertTriangle size={19} />}
              status="Risco"
              statusVariant="danger"
            />
            <AdminMetricCard
              label="20+ dias"
              value={dashboard.requests.overdue}
              description="Elegíveis ao encerramento"
              icon={<Activity size={19} />}
              status="Vencidas"
              statusVariant="danger"
            />
            <AdminMetricCard
              label="Anexos vencidos"
              value={dashboard.purge_due}
              description="Aguardando retenção"
              icon={<HardDrive size={19} />}
            />
            <AdminMetricCard
              label="Currículos pendentes"
              value={dashboard.resume_pending}
              description={`${dashboard.findings} achado(s) de Storage`}
              icon={<FileArchive size={19} />}
            />
          </div>

          <AdminSectionCard
            title="Armazenamento monitorado"
            description="Consumo calculado pelos metadados operacionais preservados."
          >
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Agendamentos", dashboard.storage.scheduling],
                ["Currículos", dashboard.storage.resumes],
                ["Mídia do site", dashboard.storage.media],
                [
                  "Total",
                  dashboard.storage.scheduling +
                    dashboard.storage.resumes +
                    dashboard.storage.media,
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-surface rounded-xl p-4">
                  <dt className="text-muted text-sm font-bold">{label}</dt>
                  <dd className="font-heading mt-1 text-xl font-semibold">
                    {formatBytes(Number(value))}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-muted mt-4 text-sm">
              Órfãos suspeitos: {dashboard.finding_health.orphan_suspected} ·
              confirmados: {dashboard.finding_health.orphan_confirmed} ·
              referências quebradas:{" "}
              {dashboard.finding_health.broken_references}
            </p>
          </AdminSectionCard>

          <AdminSectionCard
            title="Controles de emergência"
            description="Todas as chaves começam desligadas. A variável de ambiente de execução também precisa estar ativa."
          >
            <form
              action={savePortalGuardianSettingsAction}
              className="space-y-5"
            >
              <fieldset
                disabled={!isSuperAdmin}
                className="grid gap-3 md:grid-cols-2"
              >
                {[
                  [
                    "auto_close_enabled",
                    "Fechamento automático",
                    "Encerrar solicitações abertas há 20 dias.",
                  ],
                  [
                    "auto_purge_enabled",
                    "Retenção de anexos",
                    "Remover originais e previews após 7 dias.",
                  ],
                  [
                    "resume_optimizer_enabled",
                    "Otimização de currículos",
                    "Processar PDFs elegíveis sem bloquear candidaturas.",
                  ],
                ].map(([name, title, description]) => (
                  <label
                    key={name}
                    className="border-border-light flex min-h-24 items-start gap-3 rounded-xl border p-4"
                  >
                    <input
                      className="mt-1 size-5"
                      type="checkbox"
                      name={name}
                      defaultChecked={Boolean(dashboard.settings[name])}
                    />
                    <span>
                      <span className="block font-bold">{title}</span>
                      <span className="text-muted mt-1 block text-sm">
                        {description}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset
                disabled={!isSuperAdmin}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {[
                  [
                    "scheduling_close_days",
                    "Prazo máximo sem finalização",
                    "dias",
                    Number(dashboard.settings.scheduling_close_days),
                  ],
                  [
                    "completed_retention_days",
                    "Retenção após agendamento",
                    "dias",
                    Number(dashboard.settings.completed_retention_days),
                  ],
                  [
                    "unscheduled_retention_days",
                    "Retenção após não agendamento",
                    "dias",
                    Number(dashboard.settings.unscheduled_retention_days),
                  ],
                  [
                    "auto_closed_retention_days",
                    "Retenção após fechamento automático",
                    "dias",
                    Number(dashboard.settings.auto_closed_retention_days),
                  ],
                  [
                    "resume_small_mb",
                    "Analisar currículo a partir de",
                    "MB",
                    Number(dashboard.settings.resume_small_bytes) / 1048576,
                  ],
                  [
                    "resume_priority_mb",
                    "Prioridade de currículo",
                    "MB",
                    Number(dashboard.settings.resume_priority_bytes) / 1048576,
                  ],
                  [
                    "resume_min_savings_percent",
                    "Ganho mínimo percentual",
                    "%",
                    Number(dashboard.settings.resume_min_savings_percent),
                  ],
                  [
                    "resume_min_savings_kb",
                    "Ganho mínimo absoluto",
                    "KB",
                    Number(dashboard.settings.resume_min_savings_bytes) / 1024,
                  ],
                ].map(([name, label, suffix, value]) => (
                  <label key={String(name)} className="text-sm font-bold">
                    {label}
                    <span className="border-border-light mt-2 flex min-h-11 items-center rounded-xl border bg-white px-3">
                      <input
                        name={String(name)}
                        type="number"
                        min={
                          String(name).includes("retention_days") ||
                          name === "resume_min_savings_percent"
                            ? 1
                            : 0.1
                        }
                        step={String(name).includes("mb") ? 0.1 : 1}
                        defaultValue={Number(value)}
                        className="min-w-0 flex-1 bg-transparent outline-none"
                        required
                      />
                      <span className="text-muted">{suffix}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {isSuperAdmin ? (
                <AdminButton type="submit">Salvar controles</AdminButton>
              ) : (
                <p className="text-muted text-sm">
                  Somente o Superadministrador pode alterar estes controles.
                </p>
              )}
            </form>
          </AdminSectionCard>

          <AdminSectionCard
            title="Execuções recentes"
            description="Resultados sem dados pessoais, conteúdo de arquivos ou credenciais."
          >
            {dashboard.recent_runs.length ? (
              <div className="space-y-3">
                {dashboard.recent_runs.map((run) => (
                  <article
                    key={run.id}
                    className="border-border-light flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{run.job_name}</p>
                        <AdminBadge
                          variant={
                            run.status === "SUCCESS"
                              ? "success"
                              : run.status === "FAILED"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {labels[run.status] ?? run.status}
                        </AdminBadge>
                        {run.dry_run ? (
                          <AdminBadge variant="info">Simulação</AdminBadge>
                        ) : null}
                      </div>
                      <p className="text-muted mt-1 text-sm">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                          timeZone: "America/Sao_Paulo",
                        }).format(new Date(run.started_at))}
                      </p>
                    </div>
                    <p className="text-muted text-sm tabular-nums">
                      {run.scanned_count} verificados · {run.affected_count}{" "}
                      alterados · {run.failed_count} falhas
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm">Nenhuma execução registrada.</p>
            )}
          </AdminSectionCard>
        </div>
      )}
    </>
  );
}
