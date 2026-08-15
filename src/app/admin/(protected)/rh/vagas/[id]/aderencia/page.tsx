import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  defaultMatchCriteria,
  matchMatrixCriteriaSchema,
  type MatchMatrixCriterion,
} from "@/lib/careers/matching";
import { saveJobMatchMatrixAction } from "./actions";

type MatrixRow = {
  id: string;
  version: number;
  criteria: unknown;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function JobMatchingMatrixPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, matricesResult, applicationsResult] = await Promise.all([
    supabase.from("career_jobs").select("id, title").eq("id", id).maybeSingle(),
    supabase
      .from("career_job_match_matrices")
      .select("id, version, criteria, created_at")
      .eq("job_id", id)
      .order("version", { ascending: false }),
    supabase
      .from("career_job_applications")
      .select("id", { count: "exact", head: true })
      .eq("job_id", id),
  ]);
  if (jobResult.error || !jobResult.data) notFound();
  const matrices = (matricesResult.data as MatrixRow[] | null) ?? [];
  const parsedCurrent = matchMatrixCriteriaSchema.safeParse(
    matrices[0]?.criteria,
  );
  const currentCriteria: MatchMatrixCriterion[] = parsedCurrent.success
    ? parsedCurrent.data
    : defaultMatchCriteria;
  const query = await searchParams;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas / Apoio à triagem"
        title={`Matriz de aderência — ${jobResult.data.title}`}
        description="Defina os pesos profissionais usados para explicar a aderência de cada candidatura a esta vaga."
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
          href={`/admin/rh/vagas/${id}/candidaturas`}
          className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-bold"
        >
          Ver candidaturas
        </Link>
      </div>

      {query.status === "saved" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Nova versão da matriz salva. As candidaturas válidas foram
          recalculadas sem apagar o histórico anterior.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "weights"
            ? "A soma dos seis pesos deve ser exatamente 100%."
            : query.error === "calculation"
              ? "A matriz foi criada, mas nem todos os cálculos puderam ser gravados. Recalcule a candidatura na tela individual."
              : "Não foi possível salvar a matriz de aderência."}
        </p>
      ) : null}

      <aside className="border-brand/20 bg-mint/60 text-brand-dark mb-6 rounded-3xl border p-5 text-sm leading-relaxed">
        <strong>Indicador de apoio à triagem.</strong> A decisão final é
        responsabilidade do RH. O sistema não rejeita, aprova ou movimenta
        candidatos automaticamente.
      </aside>

      <section className="border-border-light rounded-3xl border bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-brand-dark text-xl font-semibold">
              {matrices.length
                ? `Criar versão ${matrices[0].version + 1}`
                : "Criar matriz inicial"}
            </h2>
            <p className="text-muted mt-2 max-w-3xl text-sm">
              Ajuste apenas a importância relativa de critérios profissionais.
              Ao salvar, uma nova versão imutável é criada.
            </p>
          </div>
          <span className="bg-surface text-muted rounded-full px-4 py-2 text-xs font-bold">
            {applicationsResult.count ?? 0} candidatura(s)
          </span>
        </div>

        <ConfirmCommandForm
          action={saveJobMatchMatrixAction}
          message="Salvar uma nova versão da matriz e recalcular as candidaturas desta vaga? O histórico anterior será preservado."
        >
          <input type="hidden" name="job_id" value={id} />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {currentCriteria.map((criterion) => (
              <label
                key={criterion.key}
                className="border-border-light text-ink rounded-2xl border p-4 text-sm font-bold"
              >
                {criterion.label}
                <span className="text-muted mt-1 block text-xs font-normal">
                  Peso entre 0% e 100%
                </span>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    name={`weight_${criterion.key}`}
                    defaultValue={criterion.weight}
                    min={0}
                    max={100}
                    step={1}
                    required
                    className="border-border-light focus:border-brand min-h-11 min-w-0 flex-1 rounded-xl border px-4 font-normal outline-none"
                  />
                  <span aria-hidden="true">%</span>
                </div>
              </label>
            ))}
          </div>
          <div className="border-border-light mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            <p className="text-muted max-w-2xl text-xs leading-relaxed">
              Fontes usadas: snapshot confirmado do perfil, experiências,
              formação, habilidades, certificações e disponibilidade. Dados de
              currículo não confirmados não entram no cálculo.
            </p>
            <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white">
              Salvar nova versão
            </button>
          </div>
        </ConfirmCommandForm>
      </section>

      <section
        className="border-border-light mt-6 rounded-3xl border bg-white p-5 sm:p-7"
        aria-labelledby="matrix-history-title"
      >
        <h2
          id="matrix-history-title"
          className="font-heading text-brand-dark text-xl font-semibold"
        >
          Histórico de matrizes
        </h2>
        {matricesResult.error ? (
          <p className="text-error mt-4 text-sm">
            Não foi possível carregar o histórico.
          </p>
        ) : matrices.length ? (
          <ol className="mt-5 grid gap-4">
            {matrices.map((matrix) => {
              const parsed = matchMatrixCriteriaSchema.safeParse(
                matrix.criteria,
              );
              return (
                <li
                  key={matrix.id}
                  className="border-border-light rounded-2xl border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-ink font-bold">
                      Versão {matrix.version}
                    </p>
                    <p className="text-muted text-xs">
                      {formatDate(matrix.created_at)}
                    </p>
                  </div>
                  {parsed.success ? (
                    <ul className="text-muted mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                      {parsed.data.map((criterion) => (
                        <li key={criterion.key}>
                          {criterion.label}:{" "}
                          <strong>{criterion.weight}%</strong>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-warning mt-3 text-xs">
                      Matriz histórica indisponível para visualização.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-muted mt-4 text-sm">Nenhuma matriz configurada.</p>
        )}
      </section>
    </>
  );
}
