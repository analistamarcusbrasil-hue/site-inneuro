import "server-only";

import { randomUUID } from "node:crypto";
import { careerApplicationSnapshotSchema } from "@/lib/careers/applications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getCareerApplicationRecipient,
  getCareerPortalUrl,
  getCareerSiteUrl,
} from "./config";
import { getCareerCommunicationService } from "./service";
import type {
  AdminCareerCommunicationTemplate,
  CareerCommunicationTemplate,
} from "./types";
import { adminSendCommunicationSchema } from "./validation";

export type ApplicationCommunicationContext = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  submittedAt: string;
};

export type AdminCommunicationFields = {
  nextStage?: string;
  instructions?: string;
  eventDate?: string;
  interviewDate?: string;
  interviewTime?: string;
  location?: string;
  subject?: string;
  message?: string;
  talentPoolAuthorized?: boolean;
};

function adminUrl(context: ApplicationCommunicationContext) {
  return new URL(
    `/admin/rh/vagas/${context.jobId}/candidaturas/${context.applicationId}`,
    getCareerSiteUrl(),
  ).toString();
}

export async function loadApplicationCommunicationContext(
  applicationId: string,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("career_communications_not_configured");
  const { data, error } = await admin
    .from("career_job_applications")
    .select(
      "id, candidate_id, job_id, submitted_at, profile_snapshot, job:career_jobs(title)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !data) throw new Error("career_application_not_found");
  const snapshot = careerApplicationSnapshotSchema.parse(data.profile_snapshot);
  const job = data.job as unknown as { title: string } | null;
  const candidateEmail = snapshot.candidate.email;
  if (!job?.title || !candidateEmail) {
    throw new Error("career_application_contact_unavailable");
  }
  return {
    applicationId: data.id,
    jobId: data.job_id,
    jobTitle: job.title,
    candidateId: data.candidate_id,
    candidateName: snapshot.candidate.full_name,
    candidateEmail,
    candidatePhone: snapshot.profile?.whatsapp ?? undefined,
    submittedAt: data.submitted_at,
  } satisfies ApplicationCommunicationContext;
}

function candidateVariables(
  context: ApplicationCommunicationContext,
  template: AdminCareerCommunicationTemplate,
  fields: AdminCommunicationFields,
) {
  const common = {
    candidateName: context.candidateName,
    jobTitle: context.jobTitle,
    portalUrl: getCareerPortalUrl(),
  };
  switch (template) {
    case "NEXT_STAGE":
      return {
        ...common,
        nextStage: fields.nextStage,
        instructions: fields.instructions,
        eventDate: fields.eventDate,
      };
    case "INTERVIEW_INVITE":
    case "INTERVIEW_REMINDER":
    case "PRACTICAL_TEST_INVITE":
      return {
        ...common,
        interviewDate: fields.interviewDate,
        interviewTime: fields.interviewTime,
        location: fields.location,
        instructions: fields.instructions,
      };
    case "CUSTOM_MESSAGE":
      return {
        ...common,
        subject: fields.subject,
        message: fields.message,
      };
    case "REJECTED":
      return { ...common, talentPoolAuthorized: fields.talentPoolAuthorized };
    default:
      return common;
  }
}

export async function sendApplicationCommunication(input: {
  applicationId: string;
  template: AdminCareerCommunicationTemplate;
  fields?: AdminCommunicationFields;
  triggeredBy: "admin" | "system";
  createdBy?: string | null;
  idempotencyKey?: string;
}) {
  const context = await loadApplicationCommunicationContext(
    input.applicationId,
  );
  const fields = input.fields ?? {};
  if (input.template === "REJECTED") {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("career_communications_not_configured");
    const { data: membership } = await admin
      .from("career_talent_pool_memberships")
      .select("status")
      .eq("candidate_id", context.candidateId)
      .eq("status", "active")
      .maybeSingle();
    fields.talentPoolAuthorized = membership?.status === "active";
  }
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  adminSendCommunicationSchema.parse({
    applicationId: input.applicationId,
    template: input.template,
    idempotencyKey,
    ...fields,
  });
  return getCareerCommunicationService().send({
    candidateId: context.candidateId,
    applicationId: context.applicationId,
    jobId: context.jobId,
    template: input.template,
    recipientKind: "candidate",
    recipient: context.candidateEmail,
    variables: candidateVariables(context, input.template, fields),
    triggeredBy: input.triggeredBy,
    createdBy: input.createdBy ?? null,
    idempotencyKey,
  });
}

export async function notifyCareerApplicationCreated(
  context: ApplicationCommunicationContext,
) {
  const service = getCareerCommunicationService();
  const portalUrl = getCareerPortalUrl();
  const candidate = await service.queue({
    candidateId: context.candidateId,
    applicationId: context.applicationId,
    jobId: context.jobId,
    template: "APPLICATION_RECEIVED",
    recipientKind: "candidate",
    recipient: context.candidateEmail,
    variables: {
      candidateName: context.candidateName,
      jobTitle: context.jobTitle,
      portalUrl,
    },
    triggeredBy: "candidate",
    idempotencyKey: `application:${context.applicationId}:received`,
  });
  const internal = await service.queue({
    candidateId: context.candidateId,
    applicationId: context.applicationId,
    jobId: context.jobId,
    template: "INTERNAL_NEW_APPLICATION",
    recipientKind: "internal",
    recipient: getCareerApplicationRecipient(),
    variables: {
      candidateName: context.candidateName,
      candidateEmail: context.candidateEmail,
      candidatePhone: context.candidatePhone,
      jobTitle: context.jobTitle,
      submittedAt: context.submittedAt,
      applicationId: context.applicationId,
      adminUrl: adminUrl(context),
    },
    triggeredBy: "candidate",
    idempotencyKey: `application:${context.applicationId}:internal-new`,
  });
  const [candidateResult, internalResult] = await Promise.all([
    service.process(candidate.id),
    service.process(internal.id),
  ]);
  return { candidate: candidateResult, internal: internalResult };
}

export function communicationForSelectionStage(
  stage: string,
): AdminCareerCommunicationTemplate | null {
  const mapping: Record<string, AdminCareerCommunicationTemplate> = {
    interview: "STAGE_1_APPROVED",
    practical_test: "STAGE_2_APPROVED",
    hiring: "STAGE_3_APPROVED",
    hired: "FINAL_APPROVED",
    not_approved: "REJECTED",
  };
  return mapping[stage] ?? null;
}

export function communicationForApplicationStatus(
  status: string,
): AdminCareerCommunicationTemplate | null {
  if (status === "screening") return "UNDER_REVIEW";
  if (status === "in_process") return "NEXT_STAGE";
  if (status === "finalized") return "PROCESS_CLOSED";
  return null;
}

export function isSensitiveTemplate(template: CareerCommunicationTemplate) {
  return ["INTERVIEW_INVITE", "PRACTICAL_TEST_INVITE"].includes(template);
}
