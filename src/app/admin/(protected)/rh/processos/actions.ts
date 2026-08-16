"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ApplicationStatus } from "@/lib/careers/applications";
import {
  communicationForSelectionStage,
  sendApplicationCommunication,
} from "@/lib/careers/communications/application-service";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  canManageSelectionCandidates,
  canTransitionSelectionProcess,
  selectionStageLabels,
  type CareerSelectionCandidate,
  type CareerSelectionProcess,
  type SelectionProcessStatus,
} from "@/lib/careers/selection-processes";
import {
  selectionCandidateAddSchema,
  selectionCandidateMoveSchema,
  selectionCandidateNoteSchema,
  selectionProcessFormSchema,
  selectionProcessTransitionSchema,
} from "@/lib/careers/selection-process-validation";

const processesPath = "/admin/rh/processos";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function fail(path: string, reason: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(reason)}`);
}

function revalidateProcess(processId: string, view?: string) {
  revalidatePath(processesPath);
  revalidatePath(`${processesPath}/${processId}`);
  if (view) revalidatePath(`${processesPath}/${processId}?view=${view}`);
  revalidatePath("/admin/rh");
}

async function audit(
  supabase: Awaited<ReturnType<typeof requireHrAccess>>["supabase"],
  actorId: string,
  action: string,
  entityId: string,
  beforeData?: unknown,
  afterData?: unknown,
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "career_selection_process",
    entity_id: entityId,
    before_data: beforeData,
    after_data: afterData,
  });
}

export async function createSelectionProcessAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("processes:manage");
  const parsed = selectionProcessFormSchema.safeParse({
    name: field(formData, "name"),
    jobId: field(formData, "job_id"),
    startsOn: field(formData, "starts_on"),
    endsOn: field(formData, "ends_on"),
  });
  if (!parsed.success) fail(`${processesPath}/novo`, "validation");

  const { data: job } = await supabase
    .from("career_jobs")
    .select("id")
    .eq("id", parsed.data.jobId)
    .maybeSingle();
  if (!job) fail(`${processesPath}/novo`, "job");

  const { data, error } = await supabase
    .from("career_selection_processes")
    .insert({
      job_id: parsed.data.jobId,
      name: parsed.data.name,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      status: "draft",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) fail(`${processesPath}/novo`, "save");

  await audit(supabase, user.id, "create", data.id, undefined, {
    job_id: parsed.data.jobId,
    name: parsed.data.name,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
    status: "draft",
  });
  revalidateProcess(data.id);
  redirect(`${processesPath}/${data.id}?status=created`);
}

export async function transitionSelectionProcessAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("processes:manage");
  const parsed = selectionProcessTransitionSchema.safeParse({
    processId: field(formData, "process_id"),
    status: field(formData, "status"),
  });
  if (!parsed.success) fail(processesPath, "transition");
  const path = `${processesPath}/${parsed.data.processId}`;

  const { data, error: readError } = await supabase
    .from("career_selection_processes")
    .select("*")
    .eq("id", parsed.data.processId)
    .maybeSingle();
  if (readError || !data) fail(processesPath, "not-found");
  const process = data as CareerSelectionProcess;
  if (!canTransitionSelectionProcess(process.status, parsed.data.status)) {
    fail(path, "transition");
  }

  const now = new Date().toISOString();
  const payload: {
    status: SelectionProcessStatus;
    updated_by: string;
    opened_at?: string;
    started_at?: string;
    closed_at?: string;
    cancelled_at?: string;
  } = { status: parsed.data.status, updated_by: user.id };
  if (parsed.data.status === "open") payload.opened_at = now;
  if (parsed.data.status === "in_progress") payload.started_at = now;
  if (parsed.data.status === "closed") payload.closed_at = now;
  if (parsed.data.status === "cancelled") payload.cancelled_at = now;

  const { error } = await supabase
    .from("career_selection_processes")
    .update(payload)
    .eq("id", process.id);
  if (error) fail(path, "transition");

  await audit(
    supabase,
    user.id,
    "status_update",
    process.id,
    { status: process.status },
    { status: parsed.data.status },
  );
  let communicationSummary = "";
  if (
    parsed.data.status === "closed" &&
    formData.get("send_communication") === "on"
  ) {
    const { data: participants } = await supabase
      .from("career_selection_process_candidates")
      .select("application_id")
      .eq("process_id", process.id);
    const results = await Promise.allSettled(
      (participants ?? []).map((participant) =>
        sendApplicationCommunication({
          applicationId: participant.application_id,
          template: "PROCESS_CLOSED",
          triggeredBy: "admin",
          createdBy: user.id,
          idempotencyKey: `process:${process.id}:closed:${participant.application_id}`,
        }),
      ),
    );
    communicationSummary = results.every(
      (result) =>
        result.status === "fulfilled" && result.value.status === "SENT",
    )
      ? "sent"
      : "failed";
  }
  revalidateProcess(process.id);
  redirect(
    `${path}?status=${encodeURIComponent(parsed.data.status)}${communicationSummary ? `&communication=${communicationSummary}` : ""}`,
  );
}

export async function addCandidateToSelectionProcessAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("processes:manage");
  const parsed = selectionCandidateAddSchema.safeParse({
    processId: field(formData, "process_id"),
    applicationId: field(formData, "application_id"),
  });
  if (!parsed.success) fail(processesPath, "candidate");
  const path = `${processesPath}/${parsed.data.processId}`;

  const [processResult, applicationResult] = await Promise.all([
    supabase
      .from("career_selection_processes")
      .select("*")
      .eq("id", parsed.data.processId)
      .maybeSingle(),
    supabase
      .from("career_job_applications")
      .select("id, job_id, candidate_id, status")
      .eq("id", parsed.data.applicationId)
      .maybeSingle(),
  ]);
  if (!processResult.data || !applicationResult.data) {
    fail(path, "candidate");
  }
  const process = processResult.data as CareerSelectionProcess;
  const application = applicationResult.data as {
    id: string;
    job_id: string;
    candidate_id: string;
    status: ApplicationStatus;
  };
  if (
    !canManageSelectionCandidates(process.status) ||
    application.job_id !== process.job_id ||
    application.status === "finalized" ||
    application.status === "withdrawn"
  ) {
    fail(path, "candidate");
  }

  const { data: processCandidate, error } = await supabase
    .from("career_selection_process_candidates")
    .insert({
      process_id: process.id,
      application_id: application.id,
      candidate_id: application.candidate_id,
      stage: "registered",
    })
    .select("id")
    .single();
  if (error || !processCandidate) {
    fail(path, error?.code === "23505" ? "duplicate" : "candidate");
  }

  await audit(supabase, user.id, "candidate_added", process.id, undefined, {
    process_candidate_id: processCandidate.id,
    candidate_id: application.candidate_id,
    application_id: application.id,
    stage: "registered",
  });
  revalidateProcess(process.id);
  revalidatePath(`/admin/rh/candidatos/${application.candidate_id}`);
  revalidatePath(`/admin/rh/vagas/${process.job_id}/candidaturas`);
  redirect(`${path}?status=candidate-added`);
}

export async function moveSelectionCandidateAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("processes:manage");
  const parsed = selectionCandidateMoveSchema.safeParse({
    processId: field(formData, "process_id"),
    processCandidateId: field(formData, "process_candidate_id"),
    stage: field(formData, "stage"),
    view: field(formData, "view"),
    sendCommunication: formData.get("send_communication") === "on",
    interviewDate: field(formData, "interview_date"),
    interviewTime: field(formData, "interview_time"),
    location: field(formData, "location"),
    instructions: field(formData, "instructions"),
  });
  if (!parsed.success) fail(processesPath, "movement");
  const path = `${processesPath}/${parsed.data.processId}`;

  const [processResult, candidateResult] = await Promise.all([
    supabase
      .from("career_selection_processes")
      .select("id, status")
      .eq("id", parsed.data.processId)
      .maybeSingle(),
    supabase
      .from("career_selection_process_candidates")
      .select("*")
      .eq("id", parsed.data.processCandidateId)
      .eq("process_id", parsed.data.processId)
      .maybeSingle(),
  ]);
  if (!processResult.data || !candidateResult.data) fail(path, "movement");
  const process = processResult.data as Pick<
    CareerSelectionProcess,
    "id" | "status"
  >;
  const candidate = candidateResult.data as CareerSelectionCandidate;
  if (
    !canManageSelectionCandidates(process.status) ||
    candidate.stage === parsed.data.stage
  ) {
    fail(`${path}?view=${parsed.data.view}`, "movement");
  }

  const communicationTemplate = parsed.data.sendCommunication
    ? communicationForSelectionStage(parsed.data.stage)
    : null;
  if (
    communicationTemplate === "INTERVIEW_INVITE" &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.data.interviewDate ?? "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.data.interviewTime ?? "") ||
      !parsed.data.location)
  ) {
    fail(`${path}?view=${parsed.data.view}`, "interview-data");
  }

  const { error } = await supabase
    .from("career_selection_process_candidates")
    .update({ stage: parsed.data.stage })
    .eq("id", candidate.id);
  if (error) fail(`${path}?view=${parsed.data.view}`, "movement");

  await audit(
    supabase,
    user.id,
    "candidate_moved",
    process.id,
    {
      process_candidate_id: candidate.id,
      candidate_id: candidate.candidate_id,
      stage: candidate.stage,
    },
    {
      process_candidate_id: candidate.id,
      candidate_id: candidate.candidate_id,
      stage: parsed.data.stage,
    },
  );
  let communication = "";
  if (communicationTemplate) {
    try {
      const result = await sendApplicationCommunication({
        applicationId: candidate.application_id,
        template: communicationTemplate,
        fields:
          communicationTemplate === "INTERVIEW_INVITE"
            ? {
                interviewDate: parsed.data.interviewDate,
                interviewTime: parsed.data.interviewTime,
                location: parsed.data.location,
                instructions: parsed.data.instructions,
              }
            : communicationTemplate === "NEXT_STAGE"
              ? {
                  nextStage: selectionStageLabels[parsed.data.stage],
                  instructions: parsed.data.instructions,
                }
              : undefined,
        triggeredBy: "admin",
        createdBy: user.id,
        idempotencyKey: `process-candidate:${candidate.id}:stage:${parsed.data.stage}:${candidate.updated_at}`,
      });
      communication = result.status === "SENT" ? "sent" : "failed";
    } catch {
      communication = "failed";
    }
  }
  revalidateProcess(process.id, parsed.data.view);
  redirect(
    `${path}?view=${parsed.data.view}&status=moved${communication ? `&communication=${communication}` : ""}`,
  );
}

export async function saveSelectionCandidateNoteAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("processes:manage");
  const parsed = selectionCandidateNoteSchema.safeParse({
    processId: field(formData, "process_id"),
    processCandidateId: field(formData, "process_candidate_id"),
    internalNote: field(formData, "internal_note"),
    view: field(formData, "view"),
  });
  if (!parsed.success) fail(processesPath, "note");
  const path = `${processesPath}/${parsed.data.processId}`;

  const { data, error: readError } = await supabase
    .from("career_selection_process_candidates")
    .select("id, internal_note")
    .eq("id", parsed.data.processCandidateId)
    .eq("process_id", parsed.data.processId)
    .maybeSingle();
  if (readError || !data) fail(`${path}?view=${parsed.data.view}`, "note");

  const { error } = await supabase
    .from("career_selection_process_candidates")
    .update({ internal_note: parsed.data.internalNote })
    .eq("id", data.id);
  if (error) fail(`${path}?view=${parsed.data.view}`, "note");

  await audit(
    supabase,
    user.id,
    "internal_note_update",
    parsed.data.processId,
    { process_candidate_id: data.id, has_note: Boolean(data.internal_note) },
    {
      process_candidate_id: data.id,
      has_note: Boolean(parsed.data.internalNote),
    },
  );
  revalidateProcess(parsed.data.processId, parsed.data.view);
  redirect(`${path}?view=${parsed.data.view}&status=note-saved`);
}
