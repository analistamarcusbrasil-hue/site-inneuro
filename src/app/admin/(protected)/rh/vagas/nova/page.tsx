import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { HrJobForm } from "@/components/admin/hr-job-form";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CareerJobArea } from "@/lib/careers/jobs";
import { createCareerJobAction } from "../actions";

export default async function NewCareerJobPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase } = await requireHrAccess("jobs:manage");
  const query = await searchParams;
  const { data } = await supabase
    .from("career_job_areas")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  const areas = (data as CareerJobArea[] | null) ?? [];

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas"
        title="Criar vaga"
        description="Preencha somente critérios profissionais relacionados à função. A vaga será salva como rascunho."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />
      {query.error ? (
        <p
          role="alert"
          className="bg-error/10 text-error mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          {query.error === "area"
            ? "Selecione uma área ativa."
            : "Revise os campos. Não use critérios relacionados a características pessoais protegidas."}
        </p>
      ) : null}
      {areas.length ? (
        <HrJobForm action={createCareerJobAction} areas={areas} />
      ) : (
        <div className="border-border-light rounded-3xl border bg-white p-6">
          <p className="text-ink font-bold">
            Cadastre uma área ativa antes de criar a vaga.
          </p>
          <Link
            className="text-brand mt-3 inline-block text-sm font-bold hover:underline"
            href="/admin/rh/vagas/areas"
          >
            Administrar áreas
          </Link>
        </div>
      )}
    </>
  );
}
import Link from "next/link";
