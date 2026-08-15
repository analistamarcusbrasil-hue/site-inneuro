import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeading } from "@/components/admin/admin-page-heading";
import { HrNavigation } from "@/components/admin/hr-navigation";
import { HrJobForm } from "@/components/admin/hr-job-form";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CareerJob, CareerJobArea } from "@/lib/careers/jobs";
import type { CompanyUnit } from "@/lib/careers/logistics";
import { updateCareerJobAction } from "../../actions";

export default async function EditCareerJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireHrAccess("jobs:manage");
  const [jobResult, areasResult, unitsResult] = await Promise.all([
    supabase.from("career_jobs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("career_job_areas")
      .select("*")
      .order("is_active", { ascending: false })
      .order("sort_order")
      .order("name"),
    supabase
      .from("company_units")
      .select("*")
      .order("active", { ascending: false })
      .order("name"),
  ]);
  if (jobResult.error || !jobResult.data) notFound();
  const job = jobResult.data as CareerJob;
  const areas = ((areasResult.data as CareerJobArea[] | null) ?? []).filter(
    (area) => area.is_active || area.id === job.area_id,
  );
  const units = ((unitsResult.data as CompanyUnit[] | null) ?? []).filter(
    (unit) => unit.active || unit.id === job.unit_id,
  );

  return (
    <>
      <AdminPageHeading
        eyebrow="RH / Vagas"
        title={`Editar: ${job.title}`}
        description="As alterações são salvas na vaga atual. A mudança de status é feita na tela de visualização."
      />
      <HrNavigation current="jobs" canManageJobs canManageCandidates />
      {query.status === "duplicated" ? (
        <p
          role="status"
          className="bg-mint text-brand-dark mb-6 rounded-2xl p-4 text-sm font-bold"
        >
          Cópia criada como rascunho. Revise todos os campos antes de publicar.
        </p>
      ) : null}
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
      <HrJobForm
        action={updateCareerJobAction}
        areas={areas}
        units={units}
        job={job}
      />
    </>
  );
}
