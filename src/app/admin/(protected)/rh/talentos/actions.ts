"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrAccess } from "@/lib/careers/hr-auth";
import { talentPoolCandidateIdSchema } from "@/lib/careers/talent-pool-validation";

const talentPoolPath = "/admin/rh/talentos";

export async function fulfillTalentPoolDeletionAction(formData: FormData) {
  const { supabase, user } = await requireHrAccess("talent-bank:manage");
  const parsed = talentPoolCandidateIdSchema.safeParse(
    String(formData.get("candidate_id") ?? ""),
  );
  if (!parsed.success) redirect(`${talentPoolPath}?error=deletion`);

  const { data: membership } = await supabase
    .from("career_talent_pool_memberships")
    .select("candidate_id, status, deletion_requested_at")
    .eq("candidate_id", parsed.data)
    .maybeSingle();
  if (!membership || membership.status !== "deletion_requested") {
    redirect(`${talentPoolPath}?error=deletion`);
  }

  const { error } = await supabase
    .from("career_talent_pool_memberships")
    .delete()
    .eq("candidate_id", parsed.data)
    .eq("status", "deletion_requested");
  if (error) redirect(`${talentPoolPath}?error=deletion`);

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "talent_pool_deletion_completed",
    entity_type: "candidate_talent_pool_membership",
    entity_id: parsed.data,
    before_data: {
      status: membership.status,
      deletion_requested_at: membership.deletion_requested_at,
    },
    after_data: { deleted: true },
  });

  revalidatePath(talentPoolPath);
  revalidatePath("/admin/rh");
  revalidatePath(`/admin/rh/talentos/${parsed.data}`);
  redirect(`${talentPoolPath}?status=deletion-completed`);
}
