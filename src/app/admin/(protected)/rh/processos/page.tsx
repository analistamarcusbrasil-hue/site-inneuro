import { ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  formatSelectionPeriodDate,
  selectionProcessStatuses,
  selectionProcessStatusLabels,
  type CareerSelectionProcess,
} from "@/lib/careers/selection-processes";

type ProcessCandidateRow = { process_id: string };

const statusClasses = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  in_progress: "bg-violet-100 text-violet-800",
  closed: "bg-slate-200 text-slate-800",
  cancelled: "bg-rose-100 text-rose-800",
} as const;

export default async function SelectionProcessesPage() {
  const { supabase } = await requireHrAccess("processes:manage");
  const [processesResult, candidatesResult] = await Promise.all([
    supabase
      .from("career_selection_processes")
      .select("*, job:career_jobs(id, title, status)")
      .order("updated_at", { ascending: false }),
    supabase.from("career_selection_process_candidates").select("process_id"),
  ]);
  const processes = processesResult.error
    ? []
    : ((processesResult.data as unknown as CareerSelectionProcess[] | null) ??
      []);
  const candidateCounts = new Map<string, number>();
  for (const row of (candidatesResult.data as ProcessCandidateRow[] | null) ??
    []) {
    candidateCounts.set(
      row.process_id,
      (candidateCounts.get(row.process_id) ?? 0) + 1,
    );
  }
  const statusCounts = Object.fromEntries(
    selectionProcessStatuses.map((status) => [
      status,
      processes.filter((process) => process.status === status).length,
    ]),
  ) as Record<(typeof selectionProcessStatuses)[number], number>;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Processos Seletivos"
        description="Organize períodos, candidatos e etapas com decisões exclusivamente humanas e histórico auditável."
      />
      <HrNavigation current="processes" canManageJobs canManageCandidates />

      <div className="mb-6">
        <Link
          href="/admin/rh/processos/novo"
          className="bg-brand hover:bg-brand-dark inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
        >
          <Plus size={18} aria-hidden="true" />
          Criar processo
        </Link>
      </div>

      <section
        aria-label="Resumo dos processos seletivos"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {selectionProcessStatuses.map((status) => (
          <article
            key={status}
            className="border-border-light rounded-2xl border bg-white p-5"
          >
            <p className="text-muted text-sm">
              {selectionProcessStatusLabels[status]}
            </p>
            <p className="font-heading text-brand-dark mt-2 text-3xl font-semibold">
              {statusCounts[status].toLocaleString("pt-BR")}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-7" aria-labelledby="process-list-title">
        <h2
          id="process-list-title"
          className="font-heading text-ink text-2xl font-semibold"
        >
          Todos os processos
        </h2>
        {processesResult.error ? (
          <p
            role="alert"
            className="bg-error/10 text-error mt-5 rounded-2xl p-4 text-sm font-bold"
          >
            Não foi possível carregar os processos seletivos.
          </p>
        ) : processes.length ? (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {processes.map((process) => (
              <article
                key={process.id}
                className="border-border-light rounded-3xl border bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClasses[process.status]}`}
                    >
                      {selectionProcessStatusLabels[process.status]}
                    </span>
                    <h3 className="font-heading text-brand-dark mt-3 text-xl font-semibold">
                      {process.name}
                    </h3>
                    <p className="text-muted mt-2 text-sm">
                      Vaga: {process.job?.title ?? "Vaga indisponível"}
                    </p>
                  </div>
                  <span className="bg-mint text-brand grid size-11 place-items-center rounded-2xl">
                    <ClipboardList size={20} aria-hidden="true" />
                  </span>
                </div>
                <p className="text-muted mt-4 text-xs">
                  Período: {formatSelectionPeriodDate(process.starts_on)} a{" "}
                  {formatSelectionPeriodDate(process.ends_on)}
                </p>
                <div className="border-border-light mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                  <span className="text-muted text-xs">
                    {candidateCounts.get(process.id) ?? 0} candidato(s)
                  </span>
                  <Link
                    className="text-brand text-sm font-bold hover:underline"
                    href={`/admin/rh/processos/${process.id}`}
                  >
                    Abrir processo
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-border-light mt-5 rounded-3xl border bg-white p-8 text-center">
            <ClipboardList className="text-brand mx-auto" aria-hidden="true" />
            <p className="text-ink mt-4 font-bold">
              Nenhum processo seletivo criado.
            </p>
            <p className="text-muted mt-2 text-sm">
              Crie um processo e vincule-o a uma vaga existente.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
