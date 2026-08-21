"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCandidateSession } from "@/lib/careers/auth";
import { safeCareersDestination } from "@/lib/careers/auth-validation";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import {
  candidateCertificationSchema,
  candidateEducationSchema,
  candidateExperienceSchema,
  candidateSkillSchema,
} from "@/lib/careers/profile-validation";
import {
  isCompleteResumeCertification,
  isCompleteResumeEducation,
  isCompleteResumeExperience,
  resumeExtractionRecordSchema,
} from "@/lib/careers/resume-extraction";

const reviewPath = "/carreiras/perfil/revisar-curriculo";
const extractionIdSchema = z.string().uuid();
const optionalReviewText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((text) => text || null);

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function monthToDate(month: string | null) {
  return month ? `${month}-01` : null;
}

function fail(id: string, reason: string): never {
  redirect(`${reviewPath}/${id}?error=${encodeURIComponent(reason)}`);
}

async function reviewContext(formData: FormData) {
  requireCareersPortalEnabled();
  const context = await requireCandidateSession();
  const id = extractionIdSchema.safeParse(value(formData, "extraction_id"));
  if (!id.success) redirect("/carreiras/perfil?error=resume-analysis");
  const requestedNext = value(formData, "next");
  const next = requestedNext ? safeCareersDestination(requestedNext) : null;
  return { ...context, extractionId: id.data, next };
}

async function loadPendingExtraction(
  supabase: Awaited<ReturnType<typeof requireCandidateSession>>["supabase"],
  candidateId: string,
  extractionId: string,
) {
  const { data, error } = await supabase
    .from("candidate_resume_extractions")
    .select("*")
    .eq("id", extractionId)
    .eq("candidate_id", candidateId)
    .in("status", ["ready", "partial"])
    .maybeSingle();
  const parsed = resumeExtractionRecordSchema.safeParse(data);
  return error || !parsed.success ? null : parsed.data;
}

export async function ignoreResumeExtractionAction(formData: FormData) {
  const { supabase, user, extractionId, next } = await reviewContext(formData);
  const extraction = await loadPendingExtraction(
    supabase,
    user.id,
    extractionId,
  );
  if (!extraction) fail(extractionId, "unavailable");
  const { error } = await supabase
    .from("candidate_resume_extractions")
    .update({ status: "ignored", ignored_at: new Date().toISOString() })
    .eq("id", extractionId)
    .eq("candidate_id", user.id);
  if (error) fail(extractionId, "save");
  revalidatePath("/carreiras/perfil");
  redirect(next ?? "/carreiras/perfil?status=resume-analysis-ignored");
}

export async function applyResumeExtractionAction(formData: FormData) {
  const { supabase, user, extractionId, next } = await reviewContext(formData);
  const extraction = await loadPendingExtraction(
    supabase,
    user.id,
    extractionId,
  );
  if (!extraction) fail(extractionId, "unavailable");

  const { data: currentProfile } = await supabase
    .from("candidate_profiles")
    .select("field_sources")
    .eq("candidate_id", user.id)
    .maybeSingle();
  const fieldSources = {
    ...((currentProfile?.field_sources as Record<string, string> | null) ?? {}),
  };
  const profileUpdates: Record<string, string | null | Record<string, string>> =
    {
      candidate_id: user.id,
    };
  const applyAll = value(formData, "apply_all") === "true";
  const extractedPersonalValues: Record<string, string | null> = {
    full_name: extraction.extracted_data.fullName,
    email: extraction.extracted_data.email,
    whatsapp: extraction.extracted_data.whatsapp,
    city: extraction.extracted_data.city,
    state: extraction.extracted_data.state,
    professional_objective: extraction.extracted_data.professionalObjective,
    about: extraction.extracted_data.about,
  };
  let selectedCount = 0;

  const personalFields = [
    ["full_name", z.string().trim().min(2).max(120)],
    ["email", z.string().trim().email().max(254)],
    [
      "whatsapp",
      z
        .string()
        .trim()
        .max(24)
        .refine((item) => {
          const digits = item.replace(/\D/g, "");
          return digits.length >= 10 && digits.length <= 13;
        }),
    ],
    ["city", z.string().trim().min(2).max(100)],
    [
      "state",
      z.enum([
        "AC",
        "AL",
        "AP",
        "AM",
        "BA",
        "CE",
        "DF",
        "ES",
        "GO",
        "MA",
        "MT",
        "MS",
        "MG",
        "PA",
        "PB",
        "PR",
        "PE",
        "PI",
        "RJ",
        "RN",
        "RS",
        "RO",
        "RR",
        "SC",
        "SP",
        "SE",
        "TO",
      ]),
    ],
    ["professional_objective", optionalReviewText(500)],
    ["about", optionalReviewText(3000)],
  ] as const;

  const experienceCount = Math.min(
    Math.max(Number(value(formData, "experience_count")) || 0, 0),
    30,
  );
  const educationCount = Math.min(
    Math.max(Number(value(formData, "education_count")) || 0, 0),
    30,
  );
  const certificationCount = Math.min(
    Math.max(Number(value(formData, "certification_count")) || 0, 0),
    50,
  );
  const skillCount = Math.min(
    Math.max(Number(value(formData, "skill_count")) || 0, 0),
    60,
  );
  let validatedSelectionCount = 0;

  for (const [field, schema] of personalFields) {
    if (
      applyAll
        ? !extractedPersonalValues[field]
        : !checked(formData, `accept_${field}`)
    )
      continue;
    if (!schema.safeParse(value(formData, field)).success) {
      fail(extractionId, "validation");
    }
    validatedSelectionCount += 1;
  }
  for (let index = 0; index < experienceCount; index += 1) {
    if (!applyAll && !checked(formData, `experience_${index}_enabled`))
      continue;
    if (
      applyAll &&
      !isCompleteResumeExperience(extraction.extracted_data.experiences[index])
    )
      continue;
    const parsed = candidateExperienceSchema.safeParse({
      company: value(formData, `experience_${index}_company`),
      jobTitle: value(formData, `experience_${index}_job_title`),
      startMonth: value(formData, `experience_${index}_start_month`),
      endMonth: value(formData, `experience_${index}_end_month`),
      isCurrent: checked(formData, `experience_${index}_is_current`),
      activities: value(formData, `experience_${index}_activities`),
    });
    if (!parsed.success) fail(extractionId, "validation");
    validatedSelectionCount += 1;
  }
  for (let index = 0; index < educationCount; index += 1) {
    if (!applyAll && !checked(formData, `education_${index}_enabled`)) continue;
    if (
      applyAll &&
      !isCompleteResumeEducation(extraction.extracted_data.education[index])
    )
      continue;
    const parsed = candidateEducationSchema.safeParse({
      educationLevel: value(formData, `education_${index}_level`),
      course: value(formData, `education_${index}_course`),
      institution: value(formData, `education_${index}_institution`),
      startMonth: value(formData, `education_${index}_start_month`),
      endMonth: value(formData, `education_${index}_end_month`),
      inProgress: checked(formData, `education_${index}_in_progress`),
    });
    if (!parsed.success) fail(extractionId, "validation");
    validatedSelectionCount += 1;
  }
  for (let index = 0; index < certificationCount; index += 1) {
    if (!applyAll && !checked(formData, `certification_${index}_enabled`))
      continue;
    if (
      applyAll &&
      !isCompleteResumeCertification(
        extraction.extracted_data.certifications[index],
      )
    )
      continue;
    const parsed = candidateCertificationSchema.safeParse({
      name: value(formData, `certification_${index}_name`),
      institution: value(formData, `certification_${index}_institution`),
      completionYear: value(formData, `certification_${index}_year`),
      expiresAt: "",
    });
    if (!parsed.success) fail(extractionId, "validation");
    validatedSelectionCount += 1;
  }
  for (let index = 0; index < skillCount; index += 1) {
    if (!applyAll && !checked(formData, `skill_${index}_enabled`)) continue;
    if (
      !candidateSkillSchema.safeParse({
        name: value(formData, `skill_${index}_name`),
      }).success
    ) {
      fail(extractionId, "validation");
    }
    validatedSelectionCount += 1;
  }
  if (!validatedSelectionCount) fail(extractionId, "nothing-selected");

  for (const [field, schema] of personalFields) {
    if (
      applyAll
        ? !extractedPersonalValues[field]
        : !checked(formData, `accept_${field}`)
    )
      continue;
    const parsed = schema.safeParse(value(formData, field));
    if (!parsed.success) fail(extractionId, "validation");
    selectedCount += 1;
    fieldSources[field] = "resume";
    if (field === "full_name") {
      if (parsed.data === null) fail(extractionId, "validation");
      const { error } = await supabase
        .from("candidate_accounts")
        .update({ full_name: parsed.data })
        .eq("id", user.id);
      if (error) fail(extractionId, "save");
    } else if (field === "email") {
      if (parsed.data === null) fail(extractionId, "validation");
      if (parsed.data !== user.email) {
        const { error } = await supabase.auth.updateUser({
          email: parsed.data,
        });
        if (error) fail(extractionId, "email");
      }
    } else {
      profileUpdates[field] = parsed.data;
    }
  }

  if (
    Object.keys(profileUpdates).length > 1 ||
    Object.keys(fieldSources).length
  ) {
    profileUpdates.field_sources = fieldSources;
    const { error } = await supabase
      .from("candidate_profiles")
      .upsert(profileUpdates, { onConflict: "candidate_id" });
    if (error) fail(extractionId, "save");
  }

  const { count: existingExperienceCount } = await supabase
    .from("candidate_experiences")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);
  for (let index = 0; index < experienceCount; index += 1) {
    if (!applyAll && !checked(formData, `experience_${index}_enabled`))
      continue;
    if (
      applyAll &&
      !isCompleteResumeExperience(extraction.extracted_data.experiences[index])
    )
      continue;
    const parsed = candidateExperienceSchema.safeParse({
      company: value(formData, `experience_${index}_company`),
      jobTitle: value(formData, `experience_${index}_job_title`),
      startMonth: value(formData, `experience_${index}_start_month`),
      endMonth: value(formData, `experience_${index}_end_month`),
      isCurrent: checked(formData, `experience_${index}_is_current`),
      activities: value(formData, `experience_${index}_activities`),
    });
    if (!parsed.success) fail(extractionId, "validation");
    const { error } = await supabase.from("candidate_experiences").upsert(
      {
        candidate_id: user.id,
        company: parsed.data.company,
        job_title: parsed.data.jobTitle,
        start_date: monthToDate(parsed.data.startMonth),
        end_date: parsed.data.isCurrent
          ? null
          : monthToDate(parsed.data.endMonth),
        is_current: parsed.data.isCurrent,
        activities: parsed.data.activities,
        sort_order: (existingExperienceCount ?? 0) + index,
        data_source: "resume",
        source_extraction_id: extractionId,
        source_item_index: index,
      },
      { onConflict: "source_extraction_id,source_item_index" },
    );
    if (error) fail(extractionId, "save");
    selectedCount += 1;
  }

  const { count: existingEducationCount } = await supabase
    .from("candidate_education")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);
  for (let index = 0; index < educationCount; index += 1) {
    if (!applyAll && !checked(formData, `education_${index}_enabled`)) continue;
    if (
      applyAll &&
      !isCompleteResumeEducation(extraction.extracted_data.education[index])
    )
      continue;
    const parsed = candidateEducationSchema.safeParse({
      educationLevel: value(formData, `education_${index}_level`),
      course: value(formData, `education_${index}_course`),
      institution: value(formData, `education_${index}_institution`),
      startMonth: value(formData, `education_${index}_start_month`),
      endMonth: value(formData, `education_${index}_end_month`),
      inProgress: checked(formData, `education_${index}_in_progress`),
    });
    if (!parsed.success) fail(extractionId, "validation");
    const { error } = await supabase.from("candidate_education").upsert(
      {
        candidate_id: user.id,
        education_level: parsed.data.educationLevel,
        course: parsed.data.course,
        institution: parsed.data.institution,
        start_date: monthToDate(parsed.data.startMonth),
        end_date: parsed.data.inProgress
          ? null
          : monthToDate(parsed.data.endMonth),
        in_progress: parsed.data.inProgress,
        sort_order: (existingEducationCount ?? 0) + index,
        data_source: "resume",
        source_extraction_id: extractionId,
        source_item_index: index,
      },
      { onConflict: "source_extraction_id,source_item_index" },
    );
    if (error) fail(extractionId, "save");
    selectedCount += 1;
  }

  const { count: existingCertificationCount } = await supabase
    .from("candidate_certifications")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);
  for (let index = 0; index < certificationCount; index += 1) {
    if (!applyAll && !checked(formData, `certification_${index}_enabled`))
      continue;
    if (
      applyAll &&
      !isCompleteResumeCertification(
        extraction.extracted_data.certifications[index],
      )
    )
      continue;
    const parsed = candidateCertificationSchema.safeParse({
      name: value(formData, `certification_${index}_name`),
      institution: value(formData, `certification_${index}_institution`),
      completionYear: value(formData, `certification_${index}_year`),
      expiresAt: "",
    });
    if (!parsed.success) fail(extractionId, "validation");
    const { error } = await supabase.from("candidate_certifications").upsert(
      {
        candidate_id: user.id,
        name: parsed.data.name,
        institution: parsed.data.institution,
        completion_year: parsed.data.completionYear,
        expires_at: null,
        sort_order: (existingCertificationCount ?? 0) + index,
        data_source: "resume",
        source_extraction_id: extractionId,
        source_item_index: index,
      },
      { onConflict: "source_extraction_id,source_item_index" },
    );
    if (error) fail(extractionId, "save");
    selectedCount += 1;
  }

  const { data: existingSkills } = await supabase
    .from("candidate_skills")
    .select("name")
    .eq("candidate_id", user.id);
  const knownSkills = new Set(
    (existingSkills ?? []).map((item) =>
      item.name.trim().toLocaleLowerCase("pt-BR"),
    ),
  );
  const { count: existingSkillCount } = await supabase
    .from("candidate_skills")
    .select("id", { count: "exact", head: true })
    .eq("candidate_id", user.id);
  for (let index = 0; index < skillCount; index += 1) {
    if (!applyAll && !checked(formData, `skill_${index}_enabled`)) continue;
    const parsed = candidateSkillSchema.safeParse({
      name: value(formData, `skill_${index}_name`),
    });
    if (!parsed.success) fail(extractionId, "validation");
    const normalized = parsed.data.name.toLocaleLowerCase("pt-BR");
    if (!knownSkills.has(normalized)) {
      const { error } = await supabase.from("candidate_skills").insert({
        candidate_id: user.id,
        name: parsed.data.name,
        sort_order: (existingSkillCount ?? 0) + index,
        data_source: "resume",
        source_extraction_id: extractionId,
        source_item_index: index,
      });
      if (error) fail(extractionId, "save");
      knownSkills.add(normalized);
    }
    selectedCount += 1;
  }

  if (!selectedCount) fail(extractionId, "nothing-selected");
  const { error: finishError } = await supabase
    .from("candidate_resume_extractions")
    .update({ status: "applied", applied_at: new Date().toISOString() })
    .eq("id", extractionId)
    .eq("candidate_id", user.id);
  if (finishError) fail(extractionId, "save");
  revalidatePath("/carreiras/perfil");
  redirect(next ?? "/carreiras/perfil?status=resume-analysis-applied");
}
