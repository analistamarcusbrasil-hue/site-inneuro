import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  updateDeletionRequestAction,
  updateRetentionPolicyAction,
} from "./actions";

const categoryLabels: Record<string, string> = {
  profiles: "Perfis profissionais",
  applications: "Candidaturas",
  resumes: "Currículos",
  talent_pool: "Banco de Talentos",
};

type RetentionRow = {
  data_category: string;
  retention_days: number | null;
  automatic_deletion_enabled: boolean;
  notes: string | null;
};
type DeletionRow = {
  id: string;
  status: string;
  requested_at: string;
  resolution_note: string | null;
  candidate: { full_name: string } | null;
};

export default async function CareersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { supabase } = await requireHrAccess("settings:manage");
  const [retentionResult, deletionResult] = await Promise.all([
    supabase
      .from("career_retention_policies")
      .select("*")
      .order("data_category"),
    supabase
      .from("candidate_data_deletion_requests")
      .select(
        "id, status, requested_at, resolution_note, candidate:candidate_accounts(full_name)",
      )
      .order("requested_at", { ascending: false }),
  ]);
  const retention = (retentionResult.data as RetentionRow[] | null) ?? [];
  const deletionRequests =
    (deletionResult.data as unknown as DeletionRow[] | null) ?? [];
  const query = await searchParams;

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Recrutamento"
        title="Configurações e privacidade"
        description="Defina retenção e acompanhe solicitações de titulares com histórico auditável."
      />
      <HrNavigation
        current="settings"
        canManageJobs
        canManageCandidates
        canViewReports
        canManageSettings
      />
      {query.status ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Configuração atualizada com sucesso.
        </p>
      ) : null}
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Não foi possível concluir a alteração. Revise os dados e tente
          novamente.
        </p>
      ) : null}

      <section aria-labelledby="retention-title">
        <h2
          id="retention-title"
          className="font-heading text-brand-dark text-2xl font-semibold"
        >
          Política de retenção
        </h2>
        <p className="text-muted mt-2 text-sm">
          A exclusão automática permanece desabilitada. Definir um prazo não
          executa apagamento.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {retention.map((policy) => (
            <form
              key={policy.data_category}
              action={updateRetentionPolicyAction}
              className="border-border-light rounded-3xl border bg-white p-5"
            >
              <input
                type="hidden"
                name="category"
                value={policy.data_category}
              />
              <h3 className="text-ink font-bold">
                {categoryLabels[policy.data_category]}
              </h3>
              <label className="mt-4 block text-sm font-bold">
                Prazo em dias (opcional)
                <input
                  type="number"
                  name="days"
                  min={1}
                  max={3650}
                  defaultValue={policy.retention_days ?? ""}
                  className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-4 font-normal"
                />
              </label>
              <label className="mt-4 block text-sm font-bold">
                Observação
                <textarea
                  name="notes"
                  maxLength={1000}
                  defaultValue={policy.notes ?? ""}
                  className="border-border-light mt-2 min-h-24 w-full rounded-xl border p-4 font-normal"
                />
              </label>
              <p className="text-muted mt-3 text-xs">
                Exclusão automática: desabilitada
              </p>
              <button className="bg-brand mt-4 min-h-11 rounded-full px-5 text-sm font-bold text-white">
                Salvar política
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="deletion-title">
        <h2
          id="deletion-title"
          className="font-heading text-brand-dark text-2xl font-semibold"
        >
          Solicitações de exclusão
        </h2>
        {deletionRequests.length ? (
          <div className="mt-5 grid gap-4">
            {deletionRequests.map((request) => (
              <article
                key={request.id}
                className="border-border-light rounded-3xl border bg-white p-5"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-bold">
                      {request.candidate?.full_name ?? "Candidato indisponível"}
                    </h3>
                    <p className="text-muted mt-1 text-xs">
                      Solicitada em{" "}
                      {new Date(request.requested_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span className="bg-surface text-muted rounded-full px-3 py-1 text-xs font-bold">
                    {request.status}
                  </span>
                </div>
                {["requested", "in_review"].includes(request.status) ? (
                  <form
                    action={updateDeletionRequestAction}
                    className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end"
                  >
                    <input type="hidden" name="id" value={request.id} />
                    <label className="text-sm font-bold">
                      Situação
                      <select
                        name="status"
                        className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
                      >
                        <option value="in_review">Em análise</option>
                        <option value="completed">Concluída</option>
                        <option value="rejected">Rejeitada</option>
                      </select>
                    </label>
                    <label className="text-sm font-bold">
                      Registro da análise
                      <input
                        name="note"
                        maxLength={1000}
                        className="border-border-light mt-2 min-h-11 w-full rounded-xl border px-3 font-normal"
                      />
                    </label>
                    <button className="border-brand/30 text-brand-dark min-h-11 rounded-full border px-5 text-sm font-bold">
                      Atualizar
                    </button>
                  </form>
                ) : request.resolution_note ? (
                  <p className="text-muted mt-4 text-sm">
                    {request.resolution_note}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="border-border-light mt-5 rounded-3xl border bg-white p-6 text-sm">
            Nenhuma solicitação registrada.
          </p>
        )}
      </section>
    </>
  );
}
