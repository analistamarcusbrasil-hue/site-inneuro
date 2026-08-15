"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  careerApplicationIdSchema,
  careerApplicationSubmissionSchema,
} from "@/lib/careers/application-validation";
import { requireCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function submitCareerJobApplicationAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = careerApplicationSubmissionSchema.safeParse({
    jobId: field(formData, "job_id"),
    slug: field(formData, "slug"),
  });
  if (!parsed.success) redirect("/carreiras/vagas?error=application");

  const { supabase } = await requireCandidateSession();
  const { error } = await supabase.rpc("submit_career_job_application", {
    p_job_id: parsed.data.jobId,
  });
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
