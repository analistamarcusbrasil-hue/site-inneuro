"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCandidateSession } from "@/lib/careers/auth";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";
import { talentPoolAreaSelectionSchema } from "@/lib/careers/talent-pool-validation";

const profilePath = "/carreiras/perfil";

export async function saveTalentPoolMembershipAction(formData: FormData) {
  requireCareersPortalEnabled();
  const parsed = talentPoolAreaSelectionSchema.safeParse(
    formData.getAll("area_id").map(String),
  );
  if (!parsed.success) redirect(`${profilePath}?error=talent-areas`);

  const { supabase, user } = await requireCandidateSession();
  const { data: resume } = await supabase
    .from("candidate_resumes")
    .select("id")
    .eq("candidate_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!resume) redirect(`${profilePath}?error=talent-resume-required`);
  const { error } = await supabase.rpc("set_talent_pool_membership", {
    p_area_ids: parsed.data,
  });
  if (error) {
    const reason = error.message.includes("resume_required")
      ? "talent-resume-required"
      : error.message.includes("deletion_pending")
        ? "talent-deletion-pending"
        : "talent-save";
    redirect(`${profilePath}?error=${reason}`);
  }
  await supabase.from("candidate_consents").insert({
    candidate_id: user.id,
    consent_type: "talent_pool",
    purpose:
      "Participação voluntária no Banco de Talentos para buscas por critérios profissionais.",
    text_version: "2026-08-v1",
    granted: true,
  });
  revalidatePath(profilePath);
  redirect(`${profilePath}?status=talent-saved`);
}

export async function leaveTalentPoolAction() {
  requireCareersPortalEnabled();
  const { supabase, user } = await requireCandidateSession();
  const { error } = await supabase.rpc("leave_talent_pool");
  if (error) redirect(`${profilePath}?error=talent-leave`);
  await supabase.from("candidate_consents").insert({
    candidate_id: user.id,
    consent_type: "talent_pool",
    purpose:
      "Saída voluntária do Banco de Talentos e encerramento da autorização para novas buscas.",
    text_version: "2026-08-v1",
    granted: false,
  });
  revalidatePath(profilePath);
  redirect(`${profilePath}?status=talent-left`);
}

export async function requestTalentPoolDeletionAction() {
  requireCareersPortalEnabled();
  const { supabase } = await requireCandidateSession();
  const { error } = await supabase.rpc("request_talent_pool_deletion");
  if (error) redirect(`${profilePath}?error=talent-deletion`);
  revalidatePath(profilePath);
  redirect(`${profilePath}?status=talent-deletion-requested`);
}
