"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireHrAccess } from "@/lib/careers/hr-auth";

const settingsPath = "/admin/rh/configuracoes";
const categories = [
  "profiles",
  "applications",
  "resumes",
  "talent_pool",
] as const;

export async function updateRetentionPolicyAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("settings:manage");
  const parsed = z
    .object({
      category: z.enum(categories),
      days: z
        .union([z.literal(""), z.coerce.number().int().min(1).max(3650)])
        .transform((value) => value || null),
      notes: z
        .string()
        .trim()
        .max(1000)
        .transform((value) => value || null),
    })
    .safeParse({
      category: String(formData.get("category") ?? ""),
      days: String(formData.get("days") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  if (!parsed.success) redirect(`${settingsPath}?error=retention-validation`);
  const { data: before } = await supabase
    .from("career_retention_policies")
    .select("*")
    .eq("data_category", parsed.data.category)
    .maybeSingle();
  const payload = {
    retention_days: parsed.data.days,
    notes: parsed.data.notes,
    automatic_deletion_enabled: false,
    updated_by: user.id,
  };
  const { error } = await supabase
    .from("career_retention_policies")
    .update(payload)
    .eq("data_category", parsed.data.category);
  if (error) redirect(`${settingsPath}?error=retention-save`);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "career_retention_policy_updated",
    entity_type: "career_retention_policy",
    before_data: before,
    after_data: { data_category: parsed.data.category, ...payload },
  });
  revalidatePath(settingsPath);
  redirect(`${settingsPath}?status=retention-saved`);
}

export async function updateDeletionRequestAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("settings:manage");
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["in_review", "completed", "rejected"]),
      note: z
        .string()
        .trim()
        .max(1000)
        .transform((value) => value || null),
    })
    .safeParse({
      id: String(formData.get("id") ?? ""),
      status: String(formData.get("status") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
  if (!parsed.success) redirect(`${settingsPath}?error=request-validation`);
  const { data: before } = await supabase
    .from("candidate_data_deletion_requests")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!before || !["requested", "in_review"].includes(before.status)) {
    redirect(`${settingsPath}?error=request-state`);
  }
  const payload = {
    status: parsed.data.status,
    resolution_note: parsed.data.note,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  };
  const { error } = await supabase
    .from("candidate_data_deletion_requests")
    .update(payload)
    .eq("id", parsed.data.id)
    .in("status", ["requested", "in_review"]);
  if (error) redirect(`${settingsPath}?error=request-save`);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "candidate_data_deletion_request_updated",
    entity_type: "candidate_data_deletion_request",
    entity_id: parsed.data.id,
    before_data: before,
    after_data: payload,
  });
  revalidatePath(settingsPath);
  redirect(`${settingsPath}?status=request-saved`);
}
