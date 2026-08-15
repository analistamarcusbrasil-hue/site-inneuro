"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  careerApplicationSnapshotSchema,
  type CareerApplicationSnapshot,
} from "@/lib/careers/applications";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import type { CareerJob } from "@/lib/careers/jobs";
import {
  calculateExplainableMatch,
  matchCriterionKeys,
  matchMatrixCriteriaSchema,
  type MatchMatrixCriterion,
} from "@/lib/careers/matching";
import {
  matchMatrixFormSchema,
  recalculateMatchSchema,
} from "@/lib/careers/matching-validation";

type HrSupabase = Awaited<ReturnType<typeof requireHrAccess>>["supabase"];
type MatchMatrixRow = {
  id: string;
  job_id: string;
  version: number;
  criteria: unknown;
};
type MatchApplicationRow = {
  id: string;
  profile_snapshot: unknown;
};

function matrixPath(jobId: string) {
  return `/admin/rh/vagas/${jobId}/aderencia`;
}

async function loadJob(supabase: HrSupabase, jobId: string) {
  const { data } = await supabase
    .from("career_jobs")
    .select("*, area:career_job_areas(id, name, slug, is_active)")
    .eq("id", jobId)
    .maybeSingle();
  return (data as CareerJob | null) ?? null;
}

function buildRun(
  job: CareerJob,
  matrix: MatchMatrixRow,
  application: MatchApplicationRow,
  actorId: string,
) {
  const criteria = matchMatrixCriteriaSchema.safeParse(matrix.criteria);
  const snapshot = careerApplicationSnapshotSchema.safeParse(
    application.profile_snapshot,
  );
  if (!criteria.success || !snapshot.success) return null;
  const result = calculateExplainableMatch({
    job,
    snapshot: snapshot.data as CareerApplicationSnapshot,
    criteria: criteria.data,
  });
  return {
    application_id: application.id,
    matrix_id: matrix.id,
    matrix_version: matrix.version,
    overall_score: result.overallScore,
    hard_skills_score: result.hardSkillsScore,
    result,
    calculated_by: actorId,
  };
}

async function auditMatrix(
  supabase: HrSupabase,
  actorId: string,
  action: string,
  entityId: string,
  afterData: unknown,
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "career_job_match_matrix",
    entity_id: entityId,
    after_data: afterData,
  });
}

export async function saveJobMatchMatrixAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = matchMatrixFormSchema.safeParse({
    jobId: String(formData.get("job_id") ?? ""),
    weights: Object.fromEntries(
      matchCriterionKeys.map((key) => [key, formData.get(`weight_${key}`)]),
    ),
  });
  if (!parsed.success) {
    const jobId = String(formData.get("job_id") ?? "");
    redirect(`${matrixPath(jobId)}?error=weights`);
  }
  const job = await loadJob(supabase, parsed.data.jobId);
  if (!job) redirect("/admin/rh/vagas?error=not-found");

  const { data: previous } = await supabase
    .from("career_job_match_matrices")
    .select("version")
    .eq("job_id", job.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = Number(previous?.version ?? 0) + 1;
  const criteria = parsed.data.criteria as MatchMatrixCriterion[];
  const { data: matrixData, error: matrixError } = await supabase
    .from("career_job_match_matrices")
    .insert({
      job_id: job.id,
      version,
      criteria,
      created_by: user.id,
    })
    .select("id, job_id, version, criteria")
    .single();
  if (matrixError || !matrixData) {
    redirect(`${matrixPath(job.id)}?error=save`);
  }
  const matrix = matrixData as MatchMatrixRow;
  const { data: applicationData } = await supabase
    .from("career_job_applications")
    .select("id, profile_snapshot")
    .eq("job_id", job.id);
  const runs = ((applicationData as MatchApplicationRow[] | null) ?? [])
    .map((application) => buildRun(job, matrix, application, user.id))
    .filter((run): run is NonNullable<typeof run> => Boolean(run));
  if (runs.length) {
    const { error } = await supabase
      .from("career_application_match_runs")
      .insert(runs);
    if (error) redirect(`${matrixPath(job.id)}?error=calculation`);
  }

  await auditMatrix(supabase, user.id, "matching_matrix_created", matrix.id, {
    job_id: job.id,
    version,
    criteria,
    recalculated_applications: runs.length,
  });
  revalidatePath(matrixPath(job.id));
  revalidatePath(`/admin/rh/vagas/${job.id}`);
  revalidatePath(`/admin/rh/vagas/${job.id}/candidaturas`);
  redirect(`${matrixPath(job.id)}?status=saved`);
}

export async function recalculateApplicationMatchAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = recalculateMatchSchema.safeParse({
    jobId: String(formData.get("job_id") ?? ""),
    applicationId: String(formData.get("application_id") ?? ""),
  });
  if (!parsed.success) redirect("/admin/rh/vagas?error=calculation");
  const detailPath = `/admin/rh/vagas/${parsed.data.jobId}/candidaturas/${parsed.data.applicationId}`;
  const [job, matrixResult, applicationResult] = await Promise.all([
    loadJob(supabase, parsed.data.jobId),
    supabase
      .from("career_job_match_matrices")
      .select("id, job_id, version, criteria")
      .eq("job_id", parsed.data.jobId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("career_job_applications")
      .select("id, profile_snapshot")
      .eq("id", parsed.data.applicationId)
      .eq("job_id", parsed.data.jobId)
      .maybeSingle(),
  ]);
  if (!job || !matrixResult.data || !applicationResult.data) {
    redirect(`${detailPath}?error=calculation`);
  }
  const run = buildRun(
    job,
    matrixResult.data as MatchMatrixRow,
    applicationResult.data as MatchApplicationRow,
    user.id,
  );
  if (!run) redirect(`${detailPath}?error=calculation`);
  const { data: runData, error } = await supabase
    .from("career_application_match_runs")
    .insert(run)
    .select("id")
    .single();
  if (error || !runData) redirect(`${detailPath}?error=calculation`);

  await auditMatrix(
    supabase,
    user.id,
    "application_match_recalculated",
    run.matrix_id,
    {
      application_id: parsed.data.applicationId,
      run_id: runData.id,
      matrix_version: run.matrix_version,
      overall_score: run.overall_score,
    },
  );
  revalidatePath(detailPath);
  revalidatePath(`/admin/rh/vagas/${parsed.data.jobId}/candidaturas`);
  redirect(`${detailPath}?status=match-calculated`);
}
