"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";

const profilePath = "/carreiras/perfil";

export async function requestCandidateDataDeletionAction() {
  requireCareersPortalEnabled();
  const { supabase, user } = await requireCandidateSession();
  const { data: pending } = await supabase
    .from("candidate_data_deletion_requests")
    .select("id")
    .eq("candidate_id", user.id)
    .in("status", ["requested", "in_review"])
    .maybeSingle();
  if (pending) redirect(`${profilePath}?error=data-deletion-pending`);
  const { error } = await supabase
    .from("candidate_data_deletion_requests")
    .insert({ candidate_id: user.id, status: "requested" });
  if (error) redirect(`${profilePath}?error=data-deletion`);
  revalidatePath(profilePath);
  redirect(`${profilePath}?status=data-deletion-requested`);
}
