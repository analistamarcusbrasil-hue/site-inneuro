"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { careerApplicationIdSchema } from "@/lib/careers/application-validation";
import { requireCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import { careerApplicationLogisticsSchema } from "@/lib/careers/logistics-validation";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function submitCareerJobApplicationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const { supabase } = await requireCandidateSession();
  const jobId = field(formData, "job_id");
  const { data: job } = await supabase
    .from("career_jobs")
    .select("id, work_mode, unit_id")
    .eq("id", jobId)
    .maybeSingle();
  const parsed = careerApplicationLogisticsSchema.safeParse({
    jobId: field(formData, "job_id"),
    slug: field(formData, "slug"),
    requiresCommute: job?.work_mode === "onsite" || job?.work_mode === "hybrid",
    commuteFeasibility: field(formData, "commute_feasibility"),
    commuteTime: field(formData, "commute_time"),
    transportModes: formData.getAll("transport_modes").map(String),
    transitBenefit: field(formData, "transit_benefit"),
    source: field(formData, "source"),
    recruitmentConsent: formData.get("recruitment_consent") === "on",
    automatedSupportConsent: formData.get("automated_support_consent") === "on",
  });
  if (!parsed.success) redirect("/carreiras/vagas?error=application");

  const { error } = await supabase.rpc(
    "submit_career_job_application_with_logistics",
    {
      p_job_id: parsed.data.jobId,
      p_commute_feasibility: parsed.data.commuteFeasibility,
      p_commute_time: parsed.data.commuteTime,
      p_transport_modes: parsed.data.transportModes,
      p_transit_benefit: parsed.data.transitBenefit,
      p_source: parsed.data.source,
      p_recruitment_consent: parsed.data.recruitmentConsent,
      p_automated_support_consent: parsed.data.automatedSupportConsent,
    },
  );
  if (error) {
    const reason =
      error.code === "23505" || error.message.includes("active_application")
        ? "duplicate"
        : error.message.includes("job_not_available")
          ? "unavailable"
          : "save";
    redirect(`/carreiras/vagas/${parsed.data.slug}/candidatar?error=${reason}`);
  }

  revalidatePath("/carreiras/candidaturas");
  redirect("/carreiras/candidaturas?status=submitted");
}

export async function withdrawCareerJobApplicationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = careerApplicationIdSchema.safeParse(
    field(formData, "application_id"),
  );
  if (!parsed.success) redirect("/carreiras/candidaturas?error=withdraw");

  const { supabase } = await requireCandidateSession();
  const { error } = await supabase.rpc("withdraw_career_job_application", {
    p_application_id: parsed.data,
  });
  if (error) redirect("/carreiras/candidaturas?error=withdraw");

  revalidatePath("/carreiras/candidaturas");
  redirect("/carreiras/candidaturas?status=withdrawn");
}
