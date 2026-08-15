"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  evaluationCriteriaSchema,
  evaluationScoresSchema,
  defaultEvaluationCriteria,
} from "@/lib/careers/evaluations";
import {
  candidateEvaluationFormSchema,
  evaluationTemplateFormSchema,
  evaluatorAssignmentSchema,
  interviewFormSchema,
} from "@/lib/careers/evaluation-validation";
import { requireHrAccess } from "@/lib/careers/hr-auth";

const evaluationsPath = "/admin/rh/avaliacoes";

function detailPath(applicationId: string) {
  return `${evaluationsPath}/${applicationId}`;
}

async function audit(
  supabase: Awaited<ReturnType<typeof requireHrAccess>>["supabase"],
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  afterData: unknown,
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    after_data: afterData,
  });
}

export async function saveEvaluationTemplateAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = evaluationTemplateFormSchema.safeParse({
    jobId: String(formData.get("job_id") ?? ""),
    customCriteria: formData.getAll("custom_criterion").map(String),
  });
  const jobId = String(formData.get("job_id") ?? "");
  const path = `/admin/rh/vagas/${jobId}/avaliacoes`;
  if (!parsed.success) redirect(`${path}?error=criteria`);

  const { data: job } = await supabase
    .from("career_jobs")
    .select("id")
    .eq("id", parsed.data.jobId)
    .maybeSingle();
  if (!job) redirect("/admin/rh/vagas?error=not-found");
  const { data: previous } = await supabase
    .from("career_evaluation_templates")
    .select("version")
    .eq("job_id", parsed.data.jobId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const criteria = evaluationCriteriaSchema.parse([
    ...defaultEvaluationCriteria,
    ...parsed.data.customCriteria.map((label) => ({
      id: `custom_${randomUUID()}`,
      label,
    })),
  ]);
  const version = Number(previous?.version ?? 0) + 1;
  const { data, error } = await supabase
    .from("career_evaluation_templates")
    .insert({
      job_id: parsed.data.jobId,
      version,
      criteria,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`${path}?error=save`);

  await audit(
    supabase,
    user.id,
    "evaluation_template_created",
    "career_evaluation_template",
    data.id,
    { job_id: parsed.data.jobId, version, criteria },
  );
  revalidatePath(path);
  revalidatePath(`/admin/rh/vagas/${parsed.data.jobId}`);
  redirect(`${path}?status=saved`);
}

export async function assignApplicationEvaluatorAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = evaluatorAssignmentSchema.safeParse({
    applicationId: String(formData.get("application_id") ?? ""),
    evaluatorId: String(formData.get("evaluator_id") ?? ""),
  });
  if (!parsed.success) redirect(`${evaluationsPath}?error=assignment`);
  const path = detailPath(parsed.data.applicationId);
  const [applicationResult, evaluatorResult] = await Promise.all([
    supabase
      .from("career_job_applications")
      .select("id")
      .eq("id", parsed.data.applicationId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, role, hr_role")
      .eq("id", parsed.data.evaluatorId)
      .maybeSingle(),
  ]);
  const evaluator = evaluatorResult.data as {
    id: string;
    role: string;
    hr_role: string | null;
  } | null;
  if (
    !applicationResult.data ||
    !evaluator ||
    (!evaluator.hr_role && !["admin", "super_admin"].includes(evaluator.role))
  ) {
    redirect(`${path}?error=assignment`);
  }
  const { error } = await supabase
    .from("career_application_evaluators")
    .insert({
      application_id: parsed.data.applicationId,
      evaluator_id: parsed.data.evaluatorId,
      assigned_by: user.id,
    });
  if (error && error.code !== "23505") redirect(`${path}?error=assignment`);

  await audit(
    supabase,
    user.id,
    "application_evaluator_assigned",
    "career_job_application",
    parsed.data.applicationId,
    { evaluator_id: parsed.data.evaluatorId },
  );
  revalidatePath(path);
  revalidatePath(evaluationsPath);
  redirect(`${path}?status=evaluator-assigned`);
}

export async function submitCandidateEvaluationAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess(
    "assigned-candidates:evaluate",
  );
  const parsed = candidateEvaluationFormSchema.safeParse({
    applicationId: String(formData.get("application_id") ?? ""),
    templateId: String(formData.get("template_id") ?? ""),
    comment: String(formData.get("comment") ?? ""),
  });
  if (!parsed.success) redirect(`${evaluationsPath}?error=evaluation`);
  const path = detailPath(parsed.data.applicationId);
  const [applicationResult, templateResult] = await Promise.all([
    supabase
      .from("career_job_applications")
      .select("id, job_id")
      .eq("id", parsed.data.applicationId)
      .maybeSingle(),
    supabase
      .from("career_evaluation_templates")
      .select("id, job_id, version, criteria")
      .eq("id", parsed.data.templateId)
      .maybeSingle(),
  ]);
  if (
    !applicationResult.data ||
    !templateResult.data ||
    applicationResult.data.job_id !== templateResult.data.job_id
  ) {
    redirect(`${path}?error=evaluation`);
  }
  const criteria = evaluationCriteriaSchema.safeParse(
    templateResult.data.criteria,
  );
  if (!criteria.success) redirect(`${path}?error=evaluation`);
  const scores = evaluationScoresSchema.safeParse(
    Object.fromEntries(
      criteria.data.map((criterion) => [
        criterion.id,
        Number(formData.get(`score_${criterion.id}`)),
      ]),
    ),
  );
  if (
    !scores.success ||
    Object.keys(scores.data).length !== criteria.data.length
  ) {
    redirect(`${path}?error=evaluation`);
  }
  const { data: previous } = await supabase
    .from("career_candidate_evaluations")
    .select("evaluation_version")
    .eq("application_id", parsed.data.applicationId)
    .eq("template_id", parsed.data.templateId)
    .eq("evaluator_id", user.id)
    .order("evaluation_version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const evaluationVersion = Number(previous?.evaluation_version ?? 0) + 1;
  const { data, error } = await supabase
    .from("career_candidate_evaluations")
    .insert({
      application_id: parsed.data.applicationId,
      template_id: parsed.data.templateId,
      template_version: templateResult.data.version,
      evaluator_id: user.id,
      evaluation_version: evaluationVersion,
      scores: scores.data,
      comment: parsed.data.comment,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`${path}?error=evaluation`);

  await audit(
    supabase,
    user.id,
    "candidate_evaluation_submitted",
    "career_candidate_evaluation",
    data.id,
    {
      application_id: parsed.data.applicationId,
      template_id: parsed.data.templateId,
      template_version: templateResult.data.version,
      evaluation_version: evaluationVersion,
      scores: scores.data,
      has_comment: Boolean(parsed.data.comment),
    },
  );
  revalidatePath(path);
  revalidatePath(evaluationsPath);
  redirect(`${path}?status=evaluation-saved`);
}

export async function createCandidateInterviewAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = interviewFormSchema.safeParse({
    applicationId: String(formData.get("application_id") ?? ""),
    scheduledAt: String(formData.get("scheduled_at") ?? ""),
    interviewType: String(formData.get("interview_type") ?? ""),
    responsibleId: String(formData.get("responsible_id") ?? ""),
    status: String(formData.get("status") ?? ""),
    internalNotes: String(formData.get("internal_notes") ?? ""),
  });
  if (!parsed.success) redirect(`${evaluationsPath}?error=interview`);
  const path = detailPath(parsed.data.applicationId);
  const [applicationResult, responsibleResult] = await Promise.all([
    supabase
      .from("career_job_applications")
      .select("id")
      .eq("id", parsed.data.applicationId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id, role, hr_role")
      .eq("id", parsed.data.responsibleId)
      .maybeSingle(),
  ]);
  if (!applicationResult.data || !responsibleResult.data) {
    redirect(`${path}?error=interview`);
  }
  const { data, error } = await supabase
    .from("career_candidate_interviews")
    .insert({
      application_id: parsed.data.applicationId,
      scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
      interview_type: parsed.data.interviewType,
      responsible_id: parsed.data.responsibleId,
      status: parsed.data.status,
      internal_notes: parsed.data.internalNotes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`${path}?error=interview`);

  await audit(
    supabase,
    user.id,
    "candidate_interview_registered",
    "career_candidate_interview",
    data.id,
    {
      application_id: parsed.data.applicationId,
      scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
      interview_type: parsed.data.interviewType,
      responsible_id: parsed.data.responsibleId,
      status: parsed.data.status,
      has_internal_notes: Boolean(parsed.data.internalNotes),
    },
  );
  revalidatePath(path);
  redirect(`${path}?status=interview-saved`);
}
