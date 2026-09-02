"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { careerApplicationStatusUpdateSchema } from "@/lib/careers/application-validation";
import {
  applicationStatusLabels,
  candidateStageLabels,
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

export type BulkCareerApplicationsState = {
  status: "idle" | "success" | "error";
  message: string;
  updatedAt?: number;
  refreshRequired?: boolean;
  fromStage?: CareerJobApplication["candidate_stage"];
  nextStage?: CareerJobApplication["candidate_stage"];
  movedCount?: number;
};

const bulkCareerApplicationsSchema = z.object({
  jobId: z.string().uuid(),
  applicationIds: z.array(z.string().uuid()).min(1).max(100),
  operation: z.enum([
    "approve",
    "not_approve",
    "add_tag",
    "remove_tag",
    "favorite",
    "unfavorite",
    "send_communication",
  ]),
  expectedStage: z
    .enum([
      "resume",
      "interview",
      "practical_test",
      "hiring",
      "hired",
      "not_approved",
    ])
    .optional(),
  internalNote: z.string().trim().max(4000).optional(),
  value: z.string().trim().max(40).optional(),
});

export async function bulkCareerApplicationsAction(
  _previousState: BulkCareerApplicationsState,
  formData: FormData,
): Promise<BulkCareerApplicationsState> {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  let applicationIds: unknown = [];
  try {
    applicationIds = JSON.parse(field(formData, "application_ids"));
  } catch {
    applicationIds = [];
  }
  const parsed = bulkCareerApplicationsSchema.safeParse({
    jobId: field(formData, "job_id"),
    applicationIds,
    operation: field(formData, "operation"),
    expectedStage: field(formData, "expected_stage") || undefined,
    internalNote: field(formData, "internal_note") || undefined,
    value: field(formData, "value") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Revise a seleção e os dados da operação em lote.",
      updatedAt: Date.now(),
    };
  }

  const data = parsed.data;
  if (["approve", "not_approve"].includes(data.operation)) {
    if (
      !data.expectedStage ||
      ["hired", "not_approved"].includes(data.expectedStage)
    ) {
      return {
        status: "error",
        message: "A seleção precisa estar na mesma etapa ativa.",
        updatedAt: Date.now(),
      };
    }
    const { data: result, error } = await supabase.rpc(
      "bulk_decide_career_applications",
      {
        p_job_id: data.jobId,
        p_application_ids: data.applicationIds,
        p_decision: data.operation,
        p_expected_stage: data.expectedStage,
        p_internal_note: data.internalNote ?? null,
      },
    );
    if (error) {
      const stageChanged = error.message.includes("candidate_stage_changed");
      if (stageChanged) {
        revalidatePath(`/admin/rh/vagas/${data.jobId}/candidaturas`);
      }
      return {
        status: "error",
        message: stageChanged
          ? "Este candidato já foi movimentado. A lista será atualizada."
          : "Não foi possível concluir a movimentação. Nenhuma candidatura foi alterada.",
        updatedAt: Date.now(),
        refreshRequired: stageChanged,
      };
    }

    const rawNextStage =
      result && typeof result === "object" && "nextStage" in result
        ? String(result.nextStage)
        : "";
    const nextStage = bulkCareerApplicationsSchema.shape.expectedStage.safeParse(
      rawNextStage,
    );
    const movedCount =
      result && typeof result === "object" && "movedCount" in result
        ? Number(result.movedCount)
        : data.applicationIds.length;
    if (!nextStage.success || !nextStage.data || !Number.isFinite(movedCount)) {
      return {
        status: "error",
        message: "A movimentação foi concluída, mas a lista precisa ser atualizada.",
        updatedAt: Date.now(),
        refreshRequired: true,
      };
    }
    const confirmedNextStage = nextStage.data;

    revalidatePath(`/admin/rh/vagas/${data.jobId}/candidaturas`);
    revalidatePath("/carreiras/candidaturas");
    const template = communicationForSelectionStage(confirmedNextStage);
    if (template) {
      after(async () => {
        await Promise.allSettled(
          data.applicationIds.map((applicationId) =>
            sendApplicationCommunication({
              applicationId,
              template,
              triggeredBy: "admin",
              createdBy: user.id,
              idempotencyKey: `application:${applicationId}:stage:${confirmedNextStage}`,
            }),
          ),
        );
      });
    }
    const message =
      data.operation === "not_approve"
        ? movedCount === 1
          ? "Candidato movido para Não aprovados."
          : `${movedCount} candidatos movidos para Não aprovados.`
        : movedCount === 1
          ? `✓ Candidato aprovado e movido para ${candidateStageLabels[confirmedNextStage]}.`
          : `✓ ${movedCount} candidatos aprovados e movidos para ${candidateStageLabels[confirmedNextStage]}.`;
    return {
      status: "success",
      message,
      updatedAt: Date.now(),
      fromStage: data.expectedStage,
      nextStage: confirmedNextStage,
      movedCount,
    };
  }

  if (data.operation === "send_communication") {
    const { data: applications, error } = await supabase
      .from("career_job_applications")
      .select("id, candidate_stage")
      .eq("job_id", data.jobId)
      .in("id", data.applicationIds);
    if (error || applications?.length !== data.applicationIds.length) {
      return {
        status: "error",
        message: "Não foi possível validar todas as candidaturas selecionadas.",
        updatedAt: Date.now(),
      };
    }
    const results = await Promise.allSettled(
      applications.map((application) => {
        const template = communicationForSelectionStage(
          application.candidate_stage,
        );
        if (!template) throw new Error("stage_without_template");
        return sendApplicationCommunication({
          applicationId: application.id,
          template,
          triggeredBy: "admin",
          createdBy: user.id,
          idempotencyKey: `application:${application.id}:stage:${application.candidate_stage}:manual`,
        });
      }),
    );
    const failures = results.filter(
      (item) => item.status === "rejected" || item.value.status !== "SENT",
    ).length;
    return {
      status: failures === results.length ? "error" : "success",
      message: `${results.length - failures} comunicação(ões) enviada(s); ${failures} não enviada(s).`,
      updatedAt: Date.now(),
    };
  }

  const { error } = await supabase.rpc("update_career_applications_metadata", {
    p_job_id: data.jobId,
    p_application_ids: data.applicationIds,
    p_operation: data.operation,
    p_value: data.value ?? null,
  });
  if (error) {
    return {
      status: "error",
      message: "Não foi possível atualizar os metadados selecionados.",
      updatedAt: Date.now(),
    };
  }
  revalidatePath(`/admin/rh/vagas/${data.jobId}/candidaturas`);
  return {
    status: "success",
    message: `${data.applicationIds.length} candidatura(s) atualizada(s).`,
    updatedAt: Date.now(),
  };
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
