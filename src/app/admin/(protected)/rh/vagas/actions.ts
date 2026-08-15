"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import {
  canTransitionJob,
  slugifyJobValue,
  type CareerJob,
  type JobStatus,
} from "@/lib/careers/jobs";
import {
  careerJobAreaSchema,
  careerJobFormSchema,
  careerJobIdSchema,
  careerJobTransitionSchema,
} from "@/lib/careers/job-validation";

const jobsPath = "/admin/rh/vagas";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function fail(location: string, reason: string): never {
  redirect(`${location}?error=${encodeURIComponent(reason)}`);
}

function jobFormData(formData: FormData) {
  return {
    title: value(formData, "title"),
    areaId: value(formData, "area_id"),
    positions: value(formData, "positions"),
    location: value(formData, "location"),
    workMode: value(formData, "work_mode"),
    workSchedule: value(formData, "work_schedule"),
    description: value(formData, "description"),
    activities: value(formData, "activities"),
    schooling: value(formData, "schooling"),
    desirableExperience: value(formData, "desirable_experience"),
    requiredRequirements: value(formData, "required_requirements"),
    desirableRequirements: value(formData, "desirable_requirements"),
    skills: value(formData, "skills"),
    certifications: value(formData, "certifications"),
    opensOn: value(formData, "opens_on"),
    closesOn: value(formData, "closes_on"),
  };
}

function databasePayload(
  parsed: z.infer<typeof careerJobFormSchema>,
  userId: string,
) {
  return {
    title: parsed.title,
    area_id: parsed.areaId,
    positions: parsed.positions,
    location: parsed.location,
    work_mode: parsed.workMode,
    work_schedule: parsed.workSchedule,
    description: parsed.description,
    activities: parsed.activities,
    schooling: parsed.schooling,
    desirable_experience: parsed.desirableExperience,
    required_requirements: parsed.requiredRequirements,
    desirable_requirements: parsed.desirableRequirements,
    skills: parsed.skills,
    certifications: parsed.certifications,
    opens_on: parsed.opensOn,
    closes_on: parsed.closesOn,
    updated_by: userId,
  };
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof requireHrAccess>>["supabase"],
  title: string,
  table: "career_jobs" | "career_job_areas",
  excludeId?: string,
) {
  const base = slugifyJobValue(title) || "item";
  for (let suffix = 1; suffix <= 50; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    let query = supabase.from(table).select("id").eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function revalidateJobs(slug?: string) {
  revalidatePath(jobsPath);
  revalidatePath("/admin/rh");
  revalidatePath("/carreiras/vagas");
  if (slug) revalidatePath(`/carreiras/vagas/${slug}`);
}

export async function createCareerJobAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = careerJobFormSchema.safeParse(jobFormData(formData));
  if (!parsed.success) fail(`${jobsPath}/nova`, "validation");
  const { data: area } = await supabase
    .from("career_job_areas")
    .select("id")
    .eq("id", parsed.data.areaId)
    .eq("is_active", true)
    .maybeSingle();
  if (!area) fail(`${jobsPath}/nova`, "area");
  const slug = await uniqueSlug(supabase, parsed.data.title, "career_jobs");
  const { data, error } = await supabase
    .from("career_jobs")
    .insert({
      ...databasePayload(parsed.data, user.id),
      slug,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) fail(`${jobsPath}/nova`, "save");
  revalidateJobs(slug);
  redirect(`${jobsPath}/${data.id}?status=created`);
}

export async function updateCareerJobAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const id = careerJobIdSchema.safeParse({ id: value(formData, "id") });
  if (!id.success) fail(jobsPath, "not-found");
  const location = `${jobsPath}/${id.data.id}/editar`;
  const parsed = careerJobFormSchema.safeParse(jobFormData(formData));
  if (!parsed.success) fail(location, "validation");
  const { data: area } = await supabase
    .from("career_job_areas")
    .select("id")
    .eq("id", parsed.data.areaId)
    .eq("is_active", true)
    .maybeSingle();
  if (!area) fail(location, "area");
  const { data, error } = await supabase
    .from("career_jobs")
    .update(databasePayload(parsed.data, user.id))
    .eq("id", id.data.id)
    .select("id, slug")
    .maybeSingle();
  if (error || !data) fail(location, "save");
  revalidateJobs(data.slug);
  redirect(`${jobsPath}/${data.id}?status=updated`);
}

export async function transitionCareerJobAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = careerJobTransitionSchema.safeParse({
    id: value(formData, "id"),
    status: value(formData, "status"),
  });
  if (!parsed.success) fail(jobsPath, "transition");
  const location = `${jobsPath}/${parsed.data.id}`;
  const { data: job, error: readError } = await supabase
    .from("career_jobs")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readError || !job) fail(jobsPath, "not-found");
  const current = job as CareerJob;
  if (!canTransitionJob(current.status, parsed.data.status)) {
    fail(location, "transition");
  }
  if (parsed.data.status === "published") {
    const valid = careerJobFormSchema.safeParse({
      title: current.title,
      areaId: current.area_id,
      positions: current.positions,
      location: current.location,
      workMode: current.work_mode,
      workSchedule: current.work_schedule ?? "",
      description: current.description,
      activities: current.activities,
      schooling: current.schooling,
      desirableExperience: current.desirable_experience ?? "",
      requiredRequirements: current.required_requirements,
      desirableRequirements: current.desirable_requirements ?? "",
      skills: current.skills,
      certifications: current.certifications ?? "",
      opensOn: current.opens_on,
      closesOn: current.closes_on ?? "",
    });
    if (!valid.success) fail(location, "publish-validation");
    const { data: area } = await supabase
      .from("career_job_areas")
      .select("id")
      .eq("id", current.area_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!area) fail(location, "area");
  }
  const now = new Date().toISOString();
  const update: {
    status: JobStatus;
    updated_by: string;
    published_at?: string;
    published_by?: string;
  } = {
    status: parsed.data.status,
    updated_by: user.id,
  };
  if (parsed.data.status === "published") {
    update.published_at = current.published_at ?? now;
    update.published_by = user.id;
  }
  const { error } = await supabase
    .from("career_jobs")
    .update(update)
    .eq("id", current.id);
  if (error) fail(location, "transition");
  revalidateJobs(current.slug);
  redirect(`${location}?status=${encodeURIComponent(parsed.data.status)}`);
}

export async function duplicateCareerJobAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("jobs:manage");
  const parsed = careerJobIdSchema.safeParse({ id: value(formData, "id") });
  if (!parsed.success) fail(jobsPath, "not-found");
  const { data, error } = await supabase
    .from("career_jobs")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (error || !data) fail(jobsPath, "not-found");
  const source = data as CareerJob;
  const title = `Cópia de ${source.title}`.slice(0, 120);
  const slug = await uniqueSlug(supabase, title, "career_jobs");
  const { data: duplicate, error: duplicateError } = await supabase
    .from("career_jobs")
    .insert({
      slug,
      title,
      area_id: source.area_id,
      positions: source.positions,
      location: source.location,
      work_mode: source.work_mode,
      work_schedule: source.work_schedule,
      description: source.description,
      activities: source.activities,
      schooling: source.schooling,
      desirable_experience: source.desirable_experience,
      required_requirements: source.required_requirements,
      desirable_requirements: source.desirable_requirements,
      skills: source.skills,
      certifications: source.certifications,
      opens_on: source.opens_on,
      closes_on: source.closes_on,
      status: "draft",
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id")
    .single();
  if (duplicateError || !duplicate)
    fail(`${jobsPath}/${source.id}`, "duplicate");
  revalidateJobs(slug);
  redirect(`${jobsPath}/${duplicate.id}/editar?status=duplicated`);
}

export async function createCareerJobAreaAction(formData: FormData) {
  const { supabase } = await requireHrAccess("jobs:manage");
  const parsed = careerJobAreaSchema.safeParse({
    name: value(formData, "name"),
  });
  if (!parsed.success) fail(`${jobsPath}/areas`, "area-validation");
  const slug = await uniqueSlug(supabase, parsed.data.name, "career_job_areas");
  const { data: last } = await supabase
    .from("career_job_areas")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("career_job_areas").insert({
    name: parsed.data.name,
    slug,
    sort_order: (last?.sort_order ?? 0) + 10,
    is_active: true,
  });
  if (error) fail(`${jobsPath}/areas`, "area-save");
  revalidateJobs();
  redirect(`${jobsPath}/areas?status=area-created`);
}

export async function updateCareerJobAreaAction(formData: FormData) {
  const { supabase } = await requireHrAccess("jobs:manage");
  const parsed = careerJobAreaSchema.safeParse({
    id: value(formData, "id"),
    name: value(formData, "name"),
  });
  if (!parsed.success || !parsed.data.id) {
    fail(`${jobsPath}/areas`, "area-validation");
  }
  const slug = await uniqueSlug(
    supabase,
    parsed.data.name,
    "career_job_areas",
    parsed.data.id,
  );
  const { error } = await supabase
    .from("career_job_areas")
    .update({ name: parsed.data.name, slug })
    .eq("id", parsed.data.id);
  if (error) fail(`${jobsPath}/areas`, "area-save");
  revalidateJobs();
  redirect(`${jobsPath}/areas?status=area-updated`);
}

export async function toggleCareerJobAreaAction(formData: FormData) {
  const { supabase } = await requireHrAccess("jobs:manage");
  const id = z.string().uuid().safeParse(value(formData, "id"));
  const active = z.enum(["true", "false"]).safeParse(value(formData, "active"));
  if (!id.success || !active.success)
    fail(`${jobsPath}/areas`, "area-validation");
  const nextActive = active.data === "true";
  if (!nextActive) {
    const { count } = await supabase
      .from("career_jobs")
      .select("id", { count: "exact", head: true })
      .eq("area_id", id.data)
      .eq("status", "published");
    if (count) fail(`${jobsPath}/areas`, "area-in-use");
  }
  const { error } = await supabase
    .from("career_job_areas")
    .update({ is_active: nextActive })
    .eq("id", id.data);
  if (error) fail(`${jobsPath}/areas`, "area-save");
  revalidateJobs();
  redirect(
    `${jobsPath}/areas?status=${nextActive ? "area-activated" : "area-paused"}`,
  );
}
