"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/lib/cms/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const guardianPath = "/admin/monitoramento/portal-guardian";

function isSuperAdmin(profile: {
  role: string;
  access_profile?: string | null;
}) {
  return (
    profile.role === "super_admin" || profile.access_profile === "super_admin"
  );
}

export async function savePortalGuardianSettingsAction(formData: FormData) {
  const { user, profile } = await requireAdminPermission("settings.manage");
  if (!isSuperAdmin(profile)) redirect(`${guardianPath}?error=permission`);
  const admin = createSupabaseAdminClient();
  if (!admin) redirect(`${guardianPath}?error=config`);

  const toggles = [
    "auto_close_enabled",
    "auto_purge_enabled",
    "resume_optimizer_enabled",
  ] as const;
  const values = Object.fromEntries(
    toggles.map((key) => [key, formData.get(key) === "on"]),
  );
  const numbers = {
    scheduling_close_days: Number(formData.get("scheduling_close_days")),
    completed_retention_days: Number(formData.get("completed_retention_days")),
    unscheduled_retention_days: Number(
      formData.get("unscheduled_retention_days"),
    ),
    auto_closed_retention_days: Number(
      formData.get("auto_closed_retention_days"),
    ),
    resume_small_bytes: Math.round(
      Number(formData.get("resume_small_mb")) * 1024 * 1024,
    ),
    resume_priority_bytes: Math.round(
      Number(formData.get("resume_priority_mb")) * 1024 * 1024,
    ),
    resume_min_savings_percent: Number(
      formData.get("resume_min_savings_percent"),
    ),
    resume_min_savings_bytes: Math.round(
      Number(formData.get("resume_min_savings_kb")) * 1024,
    ),
  };
  if (
    !Number.isInteger(numbers.scheduling_close_days) ||
    numbers.scheduling_close_days < 7 ||
    numbers.scheduling_close_days > 90 ||
    !Number.isInteger(numbers.completed_retention_days) ||
    numbers.completed_retention_days < 1 ||
    numbers.completed_retention_days > 30 ||
    !Number.isInteger(numbers.unscheduled_retention_days) ||
    numbers.unscheduled_retention_days < 1 ||
    numbers.unscheduled_retention_days > 30 ||
    !Number.isInteger(numbers.auto_closed_retention_days) ||
    numbers.auto_closed_retention_days < 1 ||
    numbers.auto_closed_retention_days > 30 ||
    numbers.resume_small_bytes < 102400 ||
    numbers.resume_small_bytes > 5242880 ||
    numbers.resume_priority_bytes < numbers.resume_small_bytes ||
    numbers.resume_min_savings_percent < 1 ||
    numbers.resume_min_savings_percent > 90 ||
    numbers.resume_min_savings_bytes < 10240 ||
    numbers.resume_min_savings_bytes > 5242880
  )
    redirect(`${guardianPath}?error=validation`);
  const current = await admin
    .from("portal_guardian_settings")
    .select("*")
    .eq("singleton", true)
    .single();
  if (current.error) redirect(`${guardianPath}?error=save`);
  const update = { ...values, ...numbers };
  const { error } = await admin
    .from("portal_guardian_settings")
    .update({
      ...update,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("singleton", true);
  if (error) redirect(`${guardianPath}?error=save`);
  await admin.from("audit_logs").insert({
    actor_id: user.id,
    action: "PORTAL_GUARDIAN_SETTINGS_UPDATED",
    entity_type: "portal_guardian_settings",
    entity_id: "singleton",
    before_data: current.data,
    after_data: update,
  });
  revalidatePath(guardianPath);
  redirect(`${guardianPath}?success=saved`);
}

export async function runPortalGuardianDryRunAction() {
  const { profile } = await requireAdminPermission("settings.manage");
  if (!isSuperAdmin(profile)) redirect(`${guardianPath}?error=permission`);
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !url) redirect(`${guardianPath}?error=config`);
  const response = await fetch(`${url}/functions/v1/portal-guardian`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ dryRun: true, batchSize: 100 }),
    cache: "no-store",
  });
  if (!response.ok) redirect(`${guardianPath}?error=dry-run`);
  revalidatePath(guardianPath);
  redirect(`${guardianPath}?success=dry-run`);
}
