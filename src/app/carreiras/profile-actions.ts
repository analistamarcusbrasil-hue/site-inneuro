"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import {
  candidateCertificationSchema,
  candidateEducationSchema,
  candidateExperienceSchema,
  candidateMoveRecordSchema,
  candidateOwnedRecordSchema,
  candidatePersonalProfileSchema,
  candidateSkillSchema,
} from "@/lib/careers/profile-validation";

const profilePath = "/carreiras/perfil";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function optionalId(formData: FormData) {
  const id = value(formData, "id");
  return id || undefined;
}

function monthToDate(month: string | null) {
  return month ? `${month}-01` : null;
}

function finish(status: string): never {
  revalidatePath(profilePath);
  redirect(`${profilePath}?status=${encodeURIComponent(status)}`);
}

function fail(section: string): never {
  redirect(`${profilePath}?error=${encodeURIComponent(section)}`);
}

async function candidateContext() {
  requireCareersPortalEnabled();
  return requireCandidateSession();
}

export async function saveCandidateProfileAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidatePersonalProfileSchema.safeParse({
    fullName: value(formData, "full_name"),
    email: value(formData, "email"),
    whatsapp: value(formData, "whatsapp"),
    city: value(formData, "city"),
    state: value(formData, "state"),
    neighborhood: value(formData, "neighborhood"),
    professionalObjective: value(formData, "professional_objective"),
    about: value(formData, "about"),
    availability: value(formData, "availability"),
  });
  if (!parsed.success) fail("profile-validation");

  const emailChanged = parsed.data.email !== user.email;
  if (emailChanged) {
    const { error } = await supabase.auth.updateUser({
      email: parsed.data.email,
    });
    if (error) fail("email");
  }

  const [{ error: accountError }, { error: profileError }] = await Promise.all([
    supabase
      .from("candidate_accounts")
      .update({ full_name: parsed.data.fullName })
      .eq("id", user.id),
    supabase.from("candidate_profiles").upsert(
      {
        candidate_id: user.id,
        whatsapp: parsed.data.whatsapp,
        city: parsed.data.city,
        state: parsed.data.state,
        neighborhood: parsed.data.neighborhood,
        professional_objective: parsed.data.professionalObjective,
        about: parsed.data.about,
        availability: parsed.data.availability,
        field_sources: {
          full_name: "manual",
          email: "manual",
          whatsapp: "manual",
          city: "manual",
          state: "manual",
          neighborhood: "manual",
          professional_objective: "manual",
          about: "manual",
          availability: "manual",
        },
      },
      { onConflict: "candidate_id" },
    ),
  ]);
  if (accountError || profileError) fail("profile-save");
  finish(emailChanged ? "profile-email-confirmation" : "profile-saved");
}

export async function saveCandidateExperienceAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateExperienceSchema.safeParse({
    id: optionalId(formData),
    company: value(formData, "company"),
    jobTitle: value(formData, "job_title"),
    startMonth: value(formData, "start_month"),
    endMonth: value(formData, "end_month"),
    isCurrent: checked(formData, "is_current"),
    activities: value(formData, "activities"),
  });
  if (!parsed.success) fail("experience-validation");

  const payload = {
    candidate_id: user.id,
    company: parsed.data.company,
    job_title: parsed.data.jobTitle,
    start_date: monthToDate(parsed.data.startMonth),
    end_date: parsed.data.isCurrent ? null : monthToDate(parsed.data.endMonth),
    is_current: parsed.data.isCurrent,
    activities: parsed.data.activities,
    data_source: "manual",
    source_extraction_id: null,
    source_item_index: null,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("candidate_experiences")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("candidate_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) fail("experience-save");
  } else {
    const { data: last } = await supabase
      .from("candidate_experiences")
      .select("sort_order")
      .eq("candidate_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("candidate_experiences").insert({
      ...payload,
      sort_order: (last?.sort_order ?? -1) + 1,
    });
    if (error) fail("experience-save");
  }
  finish("experience-saved");
}

export async function deleteCandidateExperienceAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateOwnedRecordSchema.safeParse({
    id: value(formData, "id"),
  });
  if (!parsed.success) fail("experience-delete");
  const { error } = await supabase
    .from("candidate_experiences")
    .delete()
    .eq("id", parsed.data.id)
    .eq("candidate_id", user.id);
  if (error) fail("experience-delete");
  finish("experience-deleted");
}

export async function saveCandidateEducationAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateEducationSchema.safeParse({
    id: optionalId(formData),
    educationLevel: value(formData, "education_level"),
    course: value(formData, "course"),
    institution: value(formData, "institution"),
    startMonth: value(formData, "start_month"),
    endMonth: value(formData, "end_month"),
    inProgress: checked(formData, "in_progress"),
  });
  if (!parsed.success) fail("education-validation");

  const payload = {
    candidate_id: user.id,
    education_level: parsed.data.educationLevel,
    course: parsed.data.course,
    institution: parsed.data.institution,
    start_date: monthToDate(parsed.data.startMonth),
    end_date: parsed.data.inProgress ? null : monthToDate(parsed.data.endMonth),
    in_progress: parsed.data.inProgress,
    data_source: "manual",
    source_extraction_id: null,
    source_item_index: null,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("candidate_education")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("candidate_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) fail("education-save");
  } else {
    const { data: last } = await supabase
      .from("candidate_education")
      .select("sort_order")
      .eq("candidate_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("candidate_education").insert({
      ...payload,
      sort_order: (last?.sort_order ?? -1) + 1,
    });
    if (error) fail("education-save");
  }
  finish("education-saved");
}

export async function deleteCandidateEducationAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateOwnedRecordSchema.safeParse({
    id: value(formData, "id"),
  });
  if (!parsed.success) fail("education-delete");
  const { error } = await supabase
    .from("candidate_education")
    .delete()
    .eq("id", parsed.data.id)
    .eq("candidate_id", user.id);
  if (error) fail("education-delete");
  finish("education-deleted");
}

export async function moveCandidateRecordAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateMoveRecordSchema.safeParse({
    id: value(formData, "id"),
    direction: value(formData, "direction"),
    recordType: value(formData, "record_type"),
  });
  if (!parsed.success) fail("reorder");

  const table =
    parsed.data.recordType === "experience"
      ? "candidate_experiences"
      : "candidate_education";
  const { data, error } = await supabase
    .from(table)
    .select("id, sort_order")
    .eq("candidate_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) fail("reorder");

  const currentIndex = data.findIndex((item) => item.id === parsed.data.id);
  const targetIndex =
    parsed.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= data.length) {
    finish("order-unchanged");
  }
  const current = data[currentIndex];
  const target = data[targetIndex];
  const [{ error: currentError }, { error: targetError }] = await Promise.all([
    supabase
      .from(table)
      .update({ sort_order: target.sort_order })
      .eq("id", current.id)
      .eq("candidate_id", user.id),
    supabase
      .from(table)
      .update({ sort_order: current.sort_order })
      .eq("id", target.id)
      .eq("candidate_id", user.id),
  ]);
  if (currentError || targetError) fail("reorder");
  finish("order-saved");
}

export async function saveCandidateCertificationAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateCertificationSchema.safeParse({
    id: optionalId(formData),
    name: value(formData, "name"),
    institution: value(formData, "institution"),
    completionYear: value(formData, "completion_year"),
    expiresAt: value(formData, "expires_at"),
  });
  if (!parsed.success) fail("certification-validation");
  const payload = {
    candidate_id: user.id,
    name: parsed.data.name,
    institution: parsed.data.institution,
    completion_year: parsed.data.completionYear,
    expires_at: parsed.data.expiresAt,
    data_source: "manual",
    source_extraction_id: null,
    source_item_index: null,
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("candidate_certifications")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("candidate_id", user.id)
      .select("id")
      .maybeSingle();
    if (error || !data) fail("certification-save");
  } else {
    const { count } = await supabase
      .from("candidate_certifications")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id);
    const { error } = await supabase.from("candidate_certifications").insert({
      ...payload,
      sort_order: count ?? 0,
    });
    if (error) fail("certification-save");
  }
  finish("certification-saved");
}

export async function deleteCandidateCertificationAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateOwnedRecordSchema.safeParse({
    id: value(formData, "id"),
  });
  if (!parsed.success) fail("certification-delete");
  const { error } = await supabase
    .from("candidate_certifications")
    .delete()
    .eq("id", parsed.data.id)
    .eq("candidate_id", user.id);
  if (error) fail("certification-delete");
  finish("certification-deleted");
}

export async function addCandidateSkillAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateSkillSchema.safeParse({
    name: value(formData, "name"),
  });
  if (!parsed.success) fail("skill-validation");
  const { count } = await supabase
    .from("candidate_skills")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);
  const { error } = await supabase.from("candidate_skills").insert({
    candidate_id: user.id,
    name: parsed.data.name,
    sort_order: count ?? 0,
    data_source: "manual",
  });
  if (error) fail(error.code === "23505" ? "skill-duplicate" : "skill-save");
  finish("skill-saved");
}

export async function deleteCandidateSkillAction(formData: FormData) {
  const { supabase, user } = await candidateContext();
  const parsed = candidateOwnedRecordSchema.safeParse({
    id: value(formData, "id"),
  });
  if (!parsed.success) fail("skill-delete");
  const { error } = await supabase
    .from("candidate_skills")
    .delete()
    .eq("id", parsed.data.id)
    .eq("candidate_id", user.id);
  if (error) fail("skill-delete");
  finish("skill-deleted");
}
