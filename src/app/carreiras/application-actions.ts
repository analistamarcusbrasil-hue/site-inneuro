"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { careerApplicationIdSchema } from "@/lib/careers/application-validation";
import { notifyNewCareerApplication } from "@/lib/careers/application-notification";
import { requireCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import { careerApplicationLogisticsSchema } from "@/lib/careers/logistics-validation";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function submitCareerJobApplicationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const { supabase, account, user } = await requireCandidateSession();
  const jobId = field(formData, "job_id");
  const slug = field(formData, "slug");
  const safeDestination = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ? `/carreiras/vagas/${slug}/candidatar`
    : "/carreiras/vagas";
  const { data: resume } = await supabase
    .from("candidate_resumes")
    .select("id")
    .eq("candidate_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!resume) {
    const params = new URLSearchParams({
      onboarding: "resume",
      error: "resume-required",
      next: safeDestination,
    });
    redirect(`/carreiras/perfil?${params.toString()}`);
  }
  const { data: job } = await supabase
    .from("career_jobs")
    .select("id, title, work_mode, unit_id")
    .eq("id", jobId)
    .maybeSingle();
  const parsed = careerApplicationLogisticsSchema.safeParse({
    jobId: field(formData, "job_id"),
    slug: field(formData, "slug"),
    requiresCommute: Boolean(
      job?.unit_id &&
      (job.work_mode === "onsite" || job.work_mode === "hybrid"),
    ),
    commuteFeasibility: field(formData, "commute_feasibility"),
    commuteTime: field(formData, "commute_time"),
    transportModes: formData.getAll("transport_modes").map(String),
    transitBenefit: field(formData, "transit_benefit"),
    source: field(formData, "source"),
    recruitmentConsent: formData.get("recruitment_consent") === "on",
    automatedSupportConsent: formData.get("automated_support_consent") === "on",
  });
  if (!parsed.success) redirect("/carreiras/vagas?error=application");

  const { data: applicationId, error } = await supabase.rpc(
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
    if (error.message.includes("resume_required")) {
      const params = new URLSearchParams({
        onboarding: "resume",
        error: "resume-required",
        next: safeDestination,
      });
      redirect(`/carreiras/perfil?${params.toString()}`);
    }
    const reason =
      error.code === "23505" || error.message.includes("active_application")
        ? "duplicate"
        : error.message.includes("job_not_available")
          ? "unavailable"
          : "save";
    redirect(`/carreiras/vagas/${parsed.data.slug}/candidatar?error=${reason}`);
  }

  const parsedApplicationId =
    careerApplicationIdSchema.safeParse(applicationId);
  if (!parsedApplicationId.success) {
    redirect(`/carreiras/vagas/${parsed.data.slug}/candidatar?error=save`);
  }

  const { data: profile } = await supabase
    .from("candidate_profiles")
    .select("whatsapp")
    .eq("candidate_id", user.id)
    .maybeSingle();

  await notifyNewCareerApplication({
    applicationId: parsedApplicationId.data,
    jobId: parsed.data.jobId,
    jobTitle: job?.title ?? "Vaga INNEURO",
    candidateId: user.id,
    candidateName: account.full_name,
    candidateEmail: user.email ?? "",
    candidatePhone: profile?.whatsapp ?? undefined,
    submittedAt: new Date(),
  });

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
