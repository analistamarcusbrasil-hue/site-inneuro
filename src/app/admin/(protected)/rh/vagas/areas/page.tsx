import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { ConfirmCommandForm } from "@/components/admin/confirm-command-form";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CareerJobArea } from "@/lib/careers/jobs";
import {
  createCareerJobAreaAction,
  toggleCareerJobAreaAction,
  updateCareerJobAreaAction,
} from "../actions";

const statusMessages: Record<string, string> = {
  "area-created": "Área criada.",
  "area-updated": "Nome da área atualizado.",
  "area-activated": "Área ativada.",
  "area-paused": "Área desativada.",
};

const errorMessages: Record<string, string> = {
  "area-validation": "Informe um nome válido para a área.",
  "area-save": "Não foi possível salvar a área.",
  "area-in-use": "A área possui vaga publicada e não pode ser desativada.",
};

export default async function CareerJobAreasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const query = await searchParams;
  const { supabase } = await requireHrAccess("jobs:manage");
  const [areasResult, jobsResult] = await Promise.all([
    supabase
      .from("career_job_areas")
      .select("*")
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("name"),
    supabase.from("career_jobs").select("area_id, status"),
  ]);
  const areas = (areasResult.data as CareerJobArea[] | null) ?? [];
  const jobs = jobsResult.data ?? [];

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas"
        title="Áreas profissionais"
        description="Centralize aqui as categorias utilizadas nas vagas. Áreas inativas deixam de aparecer em novos cadastros."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />
      {query.status && statusMessages[query.status] ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {statusMessages[query.status]}
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
        <h2 className="font-heading text-brand-dark text-xl font-semibold">
          Adicionar área
        </h2>
        <form
          action={createCareerJobAreaAction}
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <label className="text-ink flex-1 text-sm font-bold">
            Nome da área
            <input
              className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Exemplo: Qualidade"
            />
          </label>
          <button className="bg-brand hover:bg-brand-dark min-h-11 self-end rounded-full px-6 text-sm font-bold text-white">
            Adicionar
          </button>
        </form>
      </section>

      <section
        className="mt-6 grid gap-4 xl:grid-cols-2"
        aria-label="Áreas cadastradas"
      >
        {areas.map((area) => {
          const areaJobs = jobs.filter((job) => job.area_id === area.id);
          const published = areaJobs.filter(
            (job) => job.status === "published",
          ).length;
          return (
            <article
              key={area.id}
              className="border-border-light rounded-3xl border bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${area.is_active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                  >
                    {area.is_active ? "Ativa" : "Inativa"}
                  </span>
                  <p className="text-muted mt-3 text-xs">
                    {areaJobs.length} vaga(s) · {published} publicada(s)
                  </p>
                </div>
                <ConfirmCommandForm
                  action={toggleCareerJobAreaAction}
                  message={
                    area.is_active
                      ? "Desativar esta área para novas vagas?"
                      : "Ativar esta área?"
                  }
                >
                  <input type="hidden" name="id" value={area.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={area.is_active ? "false" : "true"}
                  />
                  <button className="border-brand/30 text-brand-dark min-h-10 rounded-full border px-4 text-xs font-bold">
                    {area.is_active ? "Desativar" : "Ativar"}
                  </button>
                </ConfirmCommandForm>
              </div>
              <form
                action={updateCareerJobAreaAction}
                className="mt-5 flex flex-col gap-3 sm:flex-row"
              >
                <input type="hidden" name="id" value={area.id} />
                <label className="text-ink flex-1 text-sm font-bold">
                  Nome
                  <input
                    className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={area.name}
                  />
                </label>
                <button className="text-brand min-h-11 self-end px-3 text-sm font-bold hover:underline">
                  Salvar nome
                </button>
              </form>
            </article>
          );
        })}
      </section>
    </>
  );
}
