import Link from "next/link";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CareerJob } from "@/lib/careers/jobs";
import { createSelectionProcessAction } from "../actions";

export default async function NewSelectionProcessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireHrAccess("processes:manage");
  const query = await searchParams;
  const { data, error } = await supabase
    .from("career_jobs")
    .select("id, title, status")
    .order("created_at", { ascending: false });
  const jobs = error
    ? []
    : ((data as Pick<CareerJob, "id" | "title" | "status">[] | null) ?? []);

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Processos Seletivos"
        title="Criar processo"
        description="Vincule uma vaga e defina o período. O processo será salvo como rascunho."
      />
      <HrNavigation current="processes" canManageJobs canManageCandidates />

      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "job"
            ? "Selecione uma vaga válida."
            : "Revise o nome, a vaga e o período informado."}
        </p>
      ) : null}

      {jobs.length ? (
        <form
          action={createSelectionProcessAction}
          className="border-border-light rounded-3xl border bg-white p-5 sm:p-7"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="text-ink block text-sm font-bold lg:col-span-2">
              Nome do processo
              <input
                name="name"
                required
                minLength={3}
                maxLength={160}
                placeholder="Exemplo: Processo Recepção — Setembro 2026"
                className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
              />
            </label>
            <label className="text-ink block text-sm font-bold lg:col-span-2">
              Vaga vinculada
              <select
                name="job_id"
                required
                defaultValue=""
                className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border bg-white px-4 font-normal outline-none"
              >
                <option value="" disabled>
                  Escolha uma vaga
                </option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
              <span className="text-muted mt-2 block text-xs font-normal">
                O processo usará somente as candidaturas enviadas para esta
                vaga.
              </span>
            </label>
            <label className="text-ink block text-sm font-bold">
              Início do período
              <input
                name="starts_on"
                type="date"
                required
                className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
              />
            </label>
            <label className="text-ink block text-sm font-bold">
              Encerramento do período
              <input
                name="ends_on"
                type="date"
                required
                className="border-border-light focus:border-brand mt-2 min-h-11 w-full rounded-xl border px-4 font-normal outline-none"
              />
            </label>
          </div>
          <div className="border-border-light mt-7 flex flex-wrap gap-3 border-t pt-6">
            <button className="bg-brand hover:bg-brand-dark min-h-11 rounded-full px-6 text-sm font-bold text-white">
              Salvar rascunho
            </button>
            <Link
              className="border-brand/30 text-brand-dark inline-flex min-h-11 items-center rounded-full border px-6 text-sm font-bold"
              href="/admin/rh/processos"
            >
              Cancelar
            </Link>
          </div>
        </form>
      ) : (
        <section className="border-border-light rounded-3xl border bg-white p-7 text-center">
          <p className="text-ink font-bold">
            Crie uma vaga antes de iniciar um processo seletivo.
          </p>
          <Link
            href="/admin/rh/vagas/nova"
            className="text-brand mt-3 inline-block text-sm font-bold hover:underline"
          >
            Criar vaga
          </Link>
        </section>
      )}
    </>
  );
}
