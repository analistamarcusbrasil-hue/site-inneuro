import type { SupabaseClient } from "@supabase/supabase-js";
import { hasAdminPermission } from "@/lib/admin/permissions";
import type { AdminProfile } from "@/types/cms";

export type OperationalEvaluator = Pick<
  AdminProfile,
  | "id"
  | "full_name"
  | "role"
  | "hr_role"
  | "active"
  | "access_profile"
  | "permissions"
>;

export function hasEvaluationAccess(profile: OperationalEvaluator | null) {
  return Boolean(
    profile?.active &&
    (hasAdminPermission(profile as AdminProfile, "hr.evaluate") ||
      hasAdminPermission(profile as AdminProfile, "hr.manage")),
  );
}

export async function getOperationalEvaluator(
  supabase: SupabaseClient,
  evaluatorId: string,
) {
  const [profileResult, candidateResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, role, hr_role, active, access_profile, permissions",
      )
      .eq("id", evaluatorId)
      .maybeSingle(),
    supabase
      .from("candidate_accounts")
      .select("id")
      .eq("id", evaluatorId)
      .maybeSingle(),
  ]);
  const profile = (profileResult.data as OperationalEvaluator | null) ?? null;
  return !candidateResult.data && hasEvaluationAccess(profile) ? profile : null;
}

export async function listOperationalEvaluators(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, hr_role, active, access_profile, permissions")
    .eq("active", true)
    .order("full_name", { ascending: true });
  const profiles = (data as OperationalEvaluator[] | null) ?? [];
  if (!profiles.length) return [];
  const { data: candidates } = await supabase
    .from("candidate_accounts")
    .select("id")
    .in(
      "id",
      profiles.map((profile) => profile.id),
    );
  const candidateIds = new Set((candidates ?? []).map((item) => item.id));
  return profiles.filter(
    (profile) => !candidateIds.has(profile.id) && hasEvaluationAccess(profile),
  );
}
