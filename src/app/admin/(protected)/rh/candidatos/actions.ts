"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/cms/auth";
import {
  candidateCertificationSchema,
  candidateEducationSchema,
  candidateExperienceSchema,
  candidateOwnedRecordSchema,
  candidateSkillSchema,
} from "@/lib/careers/profile-validation";
import {
  CANDIDATE_RESUME_BUCKET,
  CANDIDATE_RESUME_MAX_BYTES,
  hasPdfMagicNumber,
} from "@/lib/careers/profile";
import {
  parseResumeText,
  RESUME_PARSER_VERSION,
  type ResumeExtraction,
} from "@/lib/careers/resume-extraction";
import { extractCandidateResumePdf } from "@/lib/careers/resume-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const candidateIdSchema = z.string().uuid();
const profileSchema = z.object({
  candidateId: candidateIdSchema,
  fullName: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().max(30).nullable(),
  city: z.string().trim().max(120).nullable(),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  neighborhood: z.string().trim().max(120).nullable(),
  professionalObjective: z.string().trim().max(1000).nullable(),
  about: z.string().trim().max(3000).nullable(),
  availability: z.string().trim().max(500).nullable(),
});

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function optionalValue(formData: FormData, name: string) {
  return value(formData, name).trim() || null;
}

function optionalId(formData: FormData) {
  return value(formData, "id") || undefined;
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function monthToDate(month: string | null) {
  return month ? `${month}-01` : null;
}

function candidatePath(candidateId: string) {
  return `/admin/rh/candidatos/${candidateId}`;
}

function finish(candidateId: string, status: string): never {
  const path = candidatePath(candidateId);
  revalidatePath(path);
  redirect(`${path}?status=${encodeURIComponent(status)}`);
}

function fail(candidateId: string, reason: string): never {
  redirect(`${candidatePath(candidateId)}?error=${encodeURIComponent(reason)}`);
}

async function adminContext(candidateId: string) {
  const parsedId = candidateIdSchema.safeParse(candidateId);
  if (!parsedId.success) redirect("/admin/rh/candidatos?error=validation");
  const session = await requireAdminPermission("hr.manage");
  const { data: candidate } = await session.supabase
    .from("candidate_accounts")
    .select("id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!candidate) redirect("/admin/rh/candidatos?error=not-found");
  return { ...session, candidateId: parsedId.data };
}

async function auditCandidateChange(
  supabase: Awaited<ReturnType<typeof requireAdminPermission>>["supabase"],
  actorId: string,
  candidateId: string,
  action: string,
  resumeId?: string | null,
  fields?: string[],
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: resumeId ? "candidate_resume" : "candidate_profile",
    entity_id: resumeId ?? candidateId,
    after_data: {
      candidate_id: candidateId,
      ...(resumeId ? { resume_id: resumeId } : {}),
      ...(fields?.length ? { fields } : {}),
    },
  });
}

export async function saveCandidateProfileByAdminAction(formData: FormData) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = profileSchema.safeParse({
    candidateId,
    fullName: value(formData, "full_name"),
    whatsapp: optionalValue(formData, "whatsapp"),
    city: optionalValue(formData, "city"),
    state: optionalValue(formData, "state"),
    neighborhood: optionalValue(formData, "neighborhood"),
    professionalObjective: optionalValue(formData, "professional_objective"),
    about: optionalValue(formData, "about"),
    availability: optionalValue(formData, "availability"),
  });
  if (!parsed.success) fail(candidateId, "profile-validation");
  const [{ error: accountError }, { error: profileError }] = await Promise.all([
    supabase
      .from("candidate_accounts")
      .update({ full_name: parsed.data.fullName })
      .eq("id", candidateId),
    supabase.from("candidate_profiles").upsert(
      {
        candidate_id: candidateId,
        whatsapp: parsed.data.whatsapp,
        city: parsed.data.city,
        state: parsed.data.state,
        neighborhood: parsed.data.neighborhood,
        professional_objective: parsed.data.professionalObjective,
        about: parsed.data.about,
        availability: parsed.data.availability,
        field_sources: {
          full_name: "manual",
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
  if (accountError || profileError) fail(candidateId, "profile-save");
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_PROFILE_UPDATED_BY_ADMIN",
    null,
    [
      "full_name",
      "whatsapp",
      "city",
      "state",
      "neighborhood",
      "professional_objective",
      "about",
      "availability",
    ],
  );
  finish(candidateId, "profile-updated");
}

export async function saveCandidateExperienceByAdminAction(formData: FormData) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = candidateExperienceSchema.safeParse({
    id: optionalId(formData),
    company: value(formData, "company"),
    jobTitle: value(formData, "job_title"),
    startMonth: value(formData, "start_month"),
    endMonth: value(formData, "end_month"),
    isCurrent: checked(formData, "is_current"),
    activities: value(formData, "activities"),
  });
  if (!parsed.success) fail(candidateId, "experience-validation");
  const payload = {
    candidate_id: candidateId,
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
  const operation = parsed.data.id
    ? supabase
        .from("candidate_experiences")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("candidate_id", candidateId)
    : supabase.from("candidate_experiences").insert({
        ...payload,
        sort_order: Number(formData.get("sort_order") ?? 0),
      });
  const { error } = await operation;
  if (error) fail(candidateId, "experience-save");
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_PROFILE_UPDATED_BY_ADMIN",
    null,
    ["experiences"],
  );
  finish(candidateId, "profile-updated");
}

export async function deleteCandidateExperienceByAdminAction(
  formData: FormData,
) {
  return deleteStructuredRecord(
    formData,
    "candidate_experiences",
    "experiences",
  );
}

export async function saveCandidateEducationByAdminAction(formData: FormData) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = candidateEducationSchema.safeParse({
    id: optionalId(formData),
    educationLevel: value(formData, "education_level"),
    course: value(formData, "course"),
    institution: value(formData, "institution"),
    startMonth: value(formData, "start_month"),
    endMonth: value(formData, "end_month"),
    inProgress: checked(formData, "in_progress"),
  });
  if (!parsed.success) fail(candidateId, "education-validation");
  const payload = {
    candidate_id: candidateId,
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
  const operation = parsed.data.id
    ? supabase
        .from("candidate_education")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("candidate_id", candidateId)
    : supabase.from("candidate_education").insert({
        ...payload,
        sort_order: Number(formData.get("sort_order") ?? 0),
      });
  const { error } = await operation;
  if (error) fail(candidateId, "education-save");
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_PROFILE_UPDATED_BY_ADMIN",
    null,
    ["education"],
  );
  finish(candidateId, "profile-updated");
}

export async function deleteCandidateEducationByAdminAction(
  formData: FormData,
) {
  return deleteStructuredRecord(formData, "candidate_education", "education");
}

export async function saveCandidateCertificationByAdminAction(
  formData: FormData,
) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = candidateCertificationSchema.safeParse({
    id: optionalId(formData),
    name: value(formData, "name"),
    institution: value(formData, "institution"),
    completionYear: value(formData, "completion_year"),
    expiresAt: value(formData, "expires_at"),
  });
  if (!parsed.success) fail(candidateId, "certification-validation");
  const payload = {
    candidate_id: candidateId,
    name: parsed.data.name,
    institution: parsed.data.institution,
    completion_year: parsed.data.completionYear,
    expires_at: parsed.data.expiresAt,
    data_source: "manual",
    source_extraction_id: null,
    source_item_index: null,
  };
  const operation = parsed.data.id
    ? supabase
        .from("candidate_certifications")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("candidate_id", candidateId)
    : supabase.from("candidate_certifications").insert({
        ...payload,
        sort_order: Number(formData.get("sort_order") ?? 0),
      });
  const { error } = await operation;
  if (error) fail(candidateId, "certification-save");
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_PROFILE_UPDATED_BY_ADMIN",
    null,
    ["certifications"],
  );
  finish(candidateId, "profile-updated");
}

export async function deleteCandidateCertificationByAdminAction(
  formData: FormData,
) {
  return deleteStructuredRecord(
    formData,
    "candidate_certifications",
    "certifications",
  );
}

export async function saveCandidateSkillByAdminAction(formData: FormData) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = candidateSkillSchema.safeParse({
    name: value(formData, "name"),
  });
  if (!parsed.success) fail(candidateId, "skill-validation");
  const id = optionalId(formData);
  const operation = id
    ? supabase
        .from("candidate_skills")
        .update({ name: parsed.data.name, data_source: "manual" })
        .eq("id", id)
        .eq("candidate_id", candidateId)
    : supabase.from("candidate_skills").insert({
        candidate_id: candidateId,
        name: parsed.data.name,
        sort_order: Number(formData.get("sort_order") ?? 0),
        data_source: "manual",
      });
  const { error } = await operation;
  if (error) fail(candidateId, "skill-save");
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_PROFILE_UPDATED_BY_ADMIN",
    null,
    ["skills"],
  );
  finish(candidateId, "profile-updated");
}

export async function deleteCandidateSkillByAdminAction(formData: FormData) {
  return deleteStructuredRecord(formData, "candidate_skills", "skills");
}

async function deleteStructuredRecord(
  formData: FormData,
  table:
    | "candidate_experiences"
    | "candidate_education"
    | "candidate_certifications"
    | "candidate_skills",
  field: string,
) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = candidateOwnedRecordSchema.safeParse({
    id: value(formData, "id"),
  });
  if (!parsed.success) fail(candidateId, `${field}-validation`);
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", parsed.data.id)
    .eq("candidate_id", candidateId);
  if (error) fail(candidateId, `${field}-delete`);
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_PROFILE_UPDATED_BY_ADMIN",
    null,
    [field],
  );
  finish(candidateId, "profile-updated");
}

export async function replaceCandidateResumeByAdminAction(formData: FormData) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const file = formData.get("resume");
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > CANDIDATE_RESUME_MAX_BYTES
  ) {
    fail(candidateId, "resume-validation");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    file.type !== "application/pdf" ||
    !file.name.toLowerCase().endsWith(".pdf") ||
    !hasPdfMagicNumber(bytes.slice(0, 5))
  ) {
    fail(candidateId, "resume-validation");
  }
  const storagePath = `${candidateId}/${Date.now()}-${randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(CANDIDATE_RESUME_BUCKET)
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) fail(candidateId, "resume-upload");

  let extraction: {
    data: ResumeExtraction;
    textHash: string | null;
    totalPages: number | null;
    warnings: string[];
    status: "ready" | "partial" | "failed";
  };
  try {
    extraction = await extractCandidateResumePdf(bytes);
  } catch {
    extraction = {
      data: parseResumeText(""),
      textHash: null,
      totalPages: null,
      warnings: ["Não foi possível ler o texto deste PDF."],
      status: "failed",
    };
  }
  const originalName =
    file.name
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 255) || "curriculo.pdf";
  const { data, error } = await supabase.rpc("admin_replace_candidate_resume", {
    p_candidate_id: candidateId,
    p_original_name: originalName,
    p_storage_path: storagePath,
    p_size_bytes: file.size,
    p_extraction_status: extraction.status,
    p_extracted_data: extraction.data,
    p_warnings: extraction.warnings,
    p_parser_version: RESUME_PARSER_VERSION,
    p_text_sha256: extraction.textHash,
    p_total_pages: extraction.totalPages,
  });
  const replacement = Array.isArray(data) ? data[0] : data;
  if (error || !replacement?.resume_id) {
    await supabase.storage.from(CANDIDATE_RESUME_BUCKET).remove([storagePath]);
    fail(candidateId, "resume-replace");
  }
  if (replacement.old_storage_path) {
    const { error: removeError } = await supabase.storage
      .from(CANDIDATE_RESUME_BUCKET)
      .remove([replacement.old_storage_path]);
    if (removeError) {
      const admin = createSupabaseAdminClient();
      await admin?.storage
        .from(CANDIDATE_RESUME_BUCKET)
        .remove([replacement.old_storage_path]);
    }
  }
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_RESUME_REPLACED_BY_ADMIN",
    replacement.resume_id,
  );
  finish(candidateId, "resume-replaced");
}

export async function deleteCandidateResumeByAdminAction(formData: FormData) {
  const candidateId = value(formData, "candidate_id");
  const { supabase, user } = await adminContext(candidateId);
  const parsed = candidateOwnedRecordSchema.safeParse({
    id: value(formData, "id"),
  });
  if (!parsed.success) fail(candidateId, "resume-validation");
  const { data, error } = await supabase.rpc("admin_delete_candidate_resume", {
    p_candidate_id: candidateId,
    p_resume_id: parsed.data.id,
  });
  const deleted = Array.isArray(data) ? data[0] : data;
  if (error || !deleted?.storage_path) fail(candidateId, "resume-delete");
  const { error: removeError } = await supabase.storage
    .from(CANDIDATE_RESUME_BUCKET)
    .remove([deleted.storage_path]);
  if (removeError) {
    const admin = createSupabaseAdminClient();
    const { error: fallbackError } = admin
      ? await admin.storage
          .from(CANDIDATE_RESUME_BUCKET)
          .remove([deleted.storage_path])
      : { error: removeError };
    if (fallbackError) fail(candidateId, "resume-storage-delete");
  }
  await auditCandidateChange(
    supabase,
    user.id,
    candidateId,
    "CANDIDATE_RESUME_DELETED_BY_ADMIN",
    parsed.data.id,
  );
  finish(candidateId, "resume-deleted");
}
