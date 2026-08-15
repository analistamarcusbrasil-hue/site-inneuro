"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { careerApplicationStatusUpdateSchema } from "@/lib/careers/application-validation";
import {
  canTransitionApplication,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function updateCareerApplicationStatusAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = careerApplicationStatusUpdateSchema.safeParse({
    applicationId: field(formData, "application_id"),
    jobId: field(formData, "job_id"),
    status: field(formData, "status"),
    processLabel: field(formData, "process_label"),
  });
  if (!parsed.success) redirect("/admin/rh/vagas?error=application");

  const basePath = `/admin/rh/vagas/${parsed.data.jobId}/candidaturas`;
  const detailPath = `${basePath}/${parsed.data.applicationId}`;
  const { data, error: readError } = await supabase
    .from("career_job_applications")
    .select("*")
    .eq("id", parsed.data.applicationId)
    .eq("job_id", parsed.data.jobId)
    .maybeSingle();
  if (readError || !data) redirect(`${basePath}?error=not-found`);
  const application = data as CareerJobApplication;
  if (!canTransitionApplication(application.status, parsed.data.status)) {
    redirect(`${detailPath}?error=transition`);
  }

  const { error } = await supabase
    .from("career_job_applications")
    .update({
      status: parsed.data.status,
      process_label: parsed.data.processLabel,
    })
    .eq("id", application.id);
  if (error) redirect(`${detailPath}?error=save`);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "status_update",
    entity_type: "career_job_application",
    entity_id: application.id,
    before_data: {
      status: application.status,
      process_label: application.process_label,
    },
    after_data: {
      status: parsed.data.status,
      process_label: parsed.data.processLabel,
    },
  });

  revalidatePath(basePath);
  revalidatePath(detailPath);
  revalidatePath(`/admin/rh/candidatos/${application.candidate_id}`);
  redirect(`${detailPath}?status=updated`);
}
