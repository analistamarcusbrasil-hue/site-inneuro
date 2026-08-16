"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { careerApplicationStatusUpdateSchema } from "@/lib/careers/application-validation";
import {
  applicationStatusLabels,
  canTransitionApplication,
  type CareerJobApplication,
} from "@/lib/careers/applications";
import {
  communicationForApplicationStatus,
  communicationForSelectionStage,
  sendApplicationCommunication,
} from "@/lib/careers/communications/application-service";
import { consumeCareerAdminMailRateLimit } from "@/lib/careers/communications/rate-limit";
import { getCareerCommunicationService } from "@/lib/careers/communications/service";
import {
  adminSendCommunicationSchema,
  retryCareerCommunicationSchema,
} from "@/lib/careers/communications/validation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  careerStageDecisionSchema,
  careerStageEventSchema,
} from "@/lib/careers/selection-process-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function decideCareerApplicationStageAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = careerStageDecisionSchema.safeParse({
    applicationId: field(formData, "application_id"),
    jobId: field(formData, "job_id"),
    expectedStage: field(formData, "expected_stage"),
    decision: field(formData, "decision"),
    internalNote: field(formData, "internal_note"),
  });
  if (!parsed.success) redirect("/admin/rh/vagas?error=decision");
  const detailPath = `/admin/rh/vagas/${parsed.data.jobId}/candidaturas/${parsed.data.applicationId}`;
  const { data: nextStage, error } = await supabase.rpc(
    "decide_career_application_stage",
    {
      p_application_id: parsed.data.applicationId,
      p_decision: parsed.data.decision,
      p_expected_stage: parsed.data.expectedStage,
      p_internal_note: parsed.data.internalNote,
    },
  );
  if (error || typeof nextStage !== "string") {
    redirect(`${detailPath}?error=decision`);
  }

  const template = communicationForSelectionStage(nextStage);
  let communication = "failed";
  if (template) {
    try {
      const result = await sendApplicationCommunication({
        applicationId: parsed.data.applicationId,
        template,
        triggeredBy: "admin",
        createdBy: user.id,
        idempotencyKey: `application:${parsed.data.applicationId}:stage:${nextStage}`,
      });
      communication = result.status === "SENT" ? "sent" : "failed";
    } catch {
      communication = "failed";
    }
  }

  revalidatePath(`/admin/rh/vagas/${parsed.data.jobId}/candidaturas`);
  revalidatePath(detailPath);
  revalidatePath("/carreiras/candidaturas");
  redirect(`${detailPath}?status=stage-updated&communication=${communication}`);
}

export async function scheduleCareerStageEventAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = careerStageEventSchema.safeParse({
    applicationId: field(formData, "application_id"),
    jobId: field(formData, "job_id"),
    stage: field(formData, "stage"),
    scheduledDate: field(formData, "scheduled_date"),
    scheduledTime: field(formData, "scheduled_time"),
    location: field(formData, "location"),
    instructions: field(formData, "instructions"),
    internalNotes: field(formData, "internal_notes"),
  });
  if (!parsed.success) redirect("/admin/rh/vagas?error=schedule");
  const detailPath = `/admin/rh/vagas/${parsed.data.jobId}/candidaturas/${parsed.data.applicationId}`;
  const { data: application } = await supabase
    .from("career_job_applications")
    .select("candidate_stage")
    .eq("id", parsed.data.applicationId)
    .eq("job_id", parsed.data.jobId)
    .maybeSingle();
  if (!application || application.candidate_stage !== parsed.data.stage) {
    redirect(`${detailPath}?error=schedule-stage`);
  }
  const { error } = await supabase
    .from("career_application_stage_events")
    .upsert(
      {
        application_id: parsed.data.applicationId,
        stage: parsed.data.stage,
        scheduled_date: parsed.data.scheduledDate,
        scheduled_time: parsed.data.scheduledTime,
        location: parsed.data.location,
        instructions: parsed.data.instructions,
        internal_notes: parsed.data.internalNotes,
        created_by: user.id,
        updated_by: user.id,
        invitation_sent_at: null,
      },
      { onConflict: "application_id,stage" },
    );
  if (error) redirect(`${detailPath}?error=schedule`);

  const template =
    parsed.data.stage === "interview"
      ? "INTERVIEW_INVITE"
      : "PRACTICAL_TEST_INVITE";
  let communication = "failed";
  try {
    const result = await sendApplicationCommunication({
      applicationId: parsed.data.applicationId,
      template,
      fields: {
        interviewDate: parsed.data.scheduledDate,
        interviewTime: parsed.data.scheduledTime,
        location: parsed.data.location,
        instructions: parsed.data.instructions ?? undefined,
      },
      triggeredBy: "admin",
      createdBy: user.id,
      idempotencyKey: `application:${parsed.data.applicationId}:invite:${parsed.data.stage}:${parsed.data.scheduledDate}:${parsed.data.scheduledTime.replace(":", "")}`,
    });
    communication = result.status === "SENT" ? "sent" : "failed";
    if (communication === "sent") {
      await supabase
        .from("career_application_stage_events")
        .update({
          invitation_sent_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("application_id", parsed.data.applicationId)
        .eq("stage", parsed.data.stage);
    }
  } catch {
    communication = "failed";
  }
  revalidatePath(detailPath);
  redirect(`${detailPath}?status=event-saved&communication=${communication}`);
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

  let communicationStatus: "sent" | "failed" | null = null;
  if (formData.get("send_communication") === "on") {
    const template = communicationForApplicationStatus(parsed.data.status);
    if (template) {
      try {
        const result = await sendApplicationCommunication({
          applicationId: application.id,
          template,
          fields:
            template === "NEXT_STAGE"
              ? {
                  nextStage: applicationStatusLabels[parsed.data.status],
                  instructions: field(formData, "communication_instructions"),
                }
              : undefined,
          triggeredBy: "admin",
          createdBy: user.id,
          idempotencyKey: `application:${application.id}:status:${parsed.data.status}:${application.updated_at}`,
        });
        communicationStatus = result.status === "SENT" ? "sent" : "failed";
      } catch {
        communicationStatus = "failed";
      }
    }
  }

  revalidatePath(basePath);
  revalidatePath(detailPath);
  revalidatePath(`/admin/rh/candidatos/${application.candidate_id}`);
  redirect(
    `${detailPath}?status=updated${communicationStatus ? `&communication=${communicationStatus}` : ""}`,
  );
}

export async function sendCareerApplicationCommunicationAction(
  formData: FormData,
) {
  const { user } = await requireHrAccess("candidates:manage");
  const parsed = adminSendCommunicationSchema.safeParse({
    applicationId: field(formData, "application_id"),
    template: field(formData, "template"),
    idempotencyKey: field(formData, "idempotency_key"),
    nextStage: field(formData, "next_stage"),
    instructions: field(formData, "instructions"),
    eventDate: field(formData, "event_date"),
    interviewDate: field(formData, "interview_date"),
    interviewTime: field(formData, "interview_time"),
    location: field(formData, "location"),
    subject: field(formData, "subject"),
    message: field(formData, "message"),
  });
  const fallback = "/admin/rh/vagas?error=communication";
  if (!parsed.success) redirect(fallback);
  const contextPath = field(formData, "return_path");
  const safePath =
    /^\/admin\/rh\/vagas\/[0-9a-f-]+\/candidaturas\/[0-9a-f-]+$/i.test(
      contextPath,
    )
      ? contextPath
      : fallback;
  const admin = createSupabaseAdminClient();
  if (!admin || !(await consumeCareerAdminMailRateLimit(admin, user.id))) {
    redirect(`${safePath}?error=rate-limit`);
  }
  let result;
  try {
    result = await sendApplicationCommunication({
      applicationId: parsed.data.applicationId,
      template: parsed.data.template,
      fields: parsed.data,
      triggeredBy: "admin",
      createdBy: user.id,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } catch {
    redirect(`${safePath}?error=communication`);
  }
  revalidatePath(safePath);
  redirect(
    `${safePath}?status=communication-${result.status === "SENT" ? "sent" : "failed"}`,
  );
}

export async function retryCareerApplicationCommunicationAction(
  formData: FormData,
) {
  const { user } = await requireHrAccess("candidates:manage");
  const parsed = retryCareerCommunicationSchema.safeParse({
    communicationId: field(formData, "communication_id"),
  });
  const returnPath = field(formData, "return_path");
  const safePath =
    /^\/admin\/rh\/vagas\/[0-9a-f-]+\/candidaturas\/[0-9a-f-]+$/i.test(
      returnPath,
    )
      ? returnPath
      : "/admin/rh/vagas";
  if (!parsed.success) redirect(`${safePath}?error=communication`);
  const admin = createSupabaseAdminClient();
  if (!admin || !(await consumeCareerAdminMailRateLimit(admin, user.id))) {
    redirect(`${safePath}?error=rate-limit`);
  }
  const { data } = await admin
    .from("career_communications")
    .select("id, status, attempt_count, type")
    .eq("id", parsed.data.communicationId)
    .maybeSingle();
  if (
    !data ||
    !["PENDING", "FAILED"].includes(data.status) ||
    data.attempt_count >= 3 ||
    data.type === "PASSWORD_RECOVERY"
  ) {
    redirect(`${safePath}?error=retry`);
  }
  let result;
  try {
    result = await getCareerCommunicationService().process(
      parsed.data.communicationId,
    );
  } catch {
    redirect(`${safePath}?error=communication`);
  }
  revalidatePath(safePath);
  redirect(
    `${safePath}?status=communication-${result.status === "SENT" ? "sent" : "failed"}`,
  );
}
