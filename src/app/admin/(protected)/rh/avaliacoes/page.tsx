import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import {
  applicationStatusLabels,
  careerApplicationSnapshotSchema,
  formatApplicationDate,
  type ApplicationStatus,
} from "@/lib/careers/applications";
import {
  calculateHumanEvaluationAverage,
  type CandidateEvaluation,
} from "@/lib/careers/evaluations";
import { requireHrAccess } from "@/lib/careers/hr-auth";

type ApplicationRow = {
  id: string;
  status: ApplicationStatus;
  profile_snapshot: unknown;
  submitted_at: string;
  job: { id: string; title: string } | null;
};
type MatchRunRow = {
  application_id: string;
  overall_score: number;
  calculated_at: string;
};

export default async function EvaluationsPage() {
  const { supabase, hrRole } = await requireHrAccess(
    "assigned-candidates:evaluate",
  );
  const canManage = hrRole !== "reviewer";
  const { data, error } = await supabase
    .from("career_job_applications")
    .select(
      "id, status, profile_snapshot, submitted_at, job:career_jobs(id, title)",
    )
    .order("submitted_at", { ascending: false });
  const applications = (data as unknown as ApplicationRow[] | null) ?? [];
  const applicationIds = applications.map((application) => application.id);
  const empty = { data: [] as unknown[], error: null };
  const [evaluationsResult, matchesResult] = applicationIds.length
    ? await Promise.all([
        supabase
          .from("career_candidate_evaluations")
          .select("*")
          .in("application_id", applicationIds),
        supabase
          .from("career_application_match_runs")
          .select("application_id, overall_score, calculated_at")
          .in("application_id", applicationIds)
          .order("calculated_at", { ascending: false }),
      ])
    : [empty, empty];
  const evaluations =
    (evaluationsResult.data as CandidateEvaluation[] | null) ?? [];
  const evaluationsByApplication = new Map<string, CandidateEvaluation[]>();
  for (const evaluation of evaluations) {
    evaluationsByApplication.set(evaluation.application_id, [
      ...(evaluationsByApplication.get(evaluation.application_id) ?? []),
      evaluation,
    ]);
  }
  const latestMatchByApplication = new Map<string, MatchRunRow>();
  for (const match of (matchesResult.data as MatchRunRow[] | null) ?? []) {
    if (!latestMatchByApplication.has(match.application_id)) {
      latestMatchByApplication.set(match.application_id, match);
    }
  }

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Avaliações humanas"
        description={
          canManage
            ? "Acompanhe avaliações estruturadas das candidaturas e organize entrevistas."
            : "Consulte e avalie somente as candidaturas atribuídas a você."
        }
      />
      <HrNavigation
        current="evaluations"
        canManageJobs={canManage}
        canManageCandidates={canManage}
        canManageProcesses={canManage}
        canManageTalentPool={canManage}
      />

      <aside className="border-brand/20 bg-mint/60 text-brand-dark mb-6 rounded-2xl border p-4 text-sm">
        Notas humanas e aderência automática são indicadores separados. A
        decisão final permanece com o RH.
      </aside>

      {error || evaluationsResult.error || matchesResult.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error rounded-2xl p-5 font-bold"
        >
          Não foi possível carregar as avaliações.
        </p>
      ) : applications.length ? (
        <ul className="grid gap-4 lg:grid-cols-2">
          {applications.map((application) => {
            const snapshot = careerApplicationSnapshotSchema.safeParse(
              application.profile_snapshot,
            );
            const humanAverage = calculateHumanEvaluationAverage(
              evaluationsByApplication.get(application.id) ?? [],
            );
            const match = latestMatchByApplication.get(application.id);
            return (
              <li key={application.id}>
                <Link
                  href={`${evaluationsPath}/${application.id}`}
                  className="border-border-light hover:border-brand group block h-full rounded-3xl border bg-white p-6 transition-colors"
                >
                  <p className="text-muted text-xs font-bold tracking-wide uppercase">
                    {application.job?.title ?? "Vaga indisponível"}
                  </p>
                  <h2 className="font-heading text-brand-dark mt-2 text-xl font-semibold">
                    {snapshot.success
                      ? snapshot.data.candidate.full_name
                      : "Candidatura"}
                  </h2>
                  <p className="text-muted mt-2 text-xs">
                    {formatApplicationDate(application.submitted_at)} ·{" "}
                    {applicationStatusLabels[application.status]}
                  </p>
                  <div className="border-border-light mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                    <div>
                      <span className="text-muted block text-xs">
                        Média humana
                      </span>
                      <strong className="text-brand-dark">
                        {humanAverage === null
                          ? "Sem avaliação"
                          : `${humanAverage.toLocaleString("pt-BR")} / 5`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted block text-xs">
                        Aderência à vaga
                      </span>
                      <strong className="text-brand-dark">
                        {match ? `${match.overall_score}%` : "Não calculada"}
                      </strong>
                    </div>
                  </div>
                  <p className="text-brand mt-5 text-sm font-bold group-hover:underline">
                    Abrir avaliação
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <section className="border-border-light rounded-3xl border bg-white p-8 text-center">
          <h2 className="font-heading text-brand-dark text-xl font-semibold">
            Nenhuma candidatura disponível
          </h2>
          <p className="text-muted mt-2 text-sm">
            As candidaturas atribuídas aparecerão aqui.
          </p>
        </section>
      )}
    </>
  );
}

const evaluationsPath = "/admin/rh/avaliacoes";
