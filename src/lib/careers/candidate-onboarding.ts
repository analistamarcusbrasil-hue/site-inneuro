import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getCandidateIdentityFromAuthUser } from "@/lib/careers/candidate-identity";
import { calculateCandidateProfileCompletion } from "@/lib/careers/profile";

export const CANDIDATE_PROFILE_SUFFICIENT_PERCENT = 70;

export async function ensureCandidateOnboarding(
  supabase: SupabaseClient,
  user: User,
) {
  const identity = getCandidateIdentityFromAuthUser(user);
  const { data: existingAccount, error: accountReadError } = await supabase
    .from("candidate_accounts")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (accountReadError) throw accountReadError;

  const { error: accountError } = await supabase
    .from("candidate_accounts")
    .upsert(
      { id: user.id, full_name: identity.fullName },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (accountError) throw accountError;

  const { error: profileCreateError } = await supabase
    .from("candidate_profiles")
    .upsert(
      { candidate_id: user.id },
      { onConflict: "candidate_id", ignoreDuplicates: true },
    );
  if (profileCreateError) throw profileCreateError;

  const [
    accountResult,
    profileResult,
    experiencesResult,
    educationResult,
    skillsResult,
    resumesResult,
  ] = await Promise.all([
    supabase
      .from("candidate_accounts")
      .select("full_name")
      .eq("id", user.id)
      .single(),
    supabase
      .from("candidate_profiles")
      .select(
        "whatsapp, city, state, professional_objective, about, availability",
      )
      .eq("candidate_id", user.id)
      .maybeSingle(),
    supabase
      .from("candidate_experiences")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id),
    supabase
      .from("candidate_education")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id),
    supabase
      .from("candidate_skills")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id),
    supabase
      .from("candidate_resumes")
      .select("id", { count: "exact", head: true })
      .eq("candidate_id", user.id),
  ]);

  const queryError = [
    accountResult,
    profileResult,
    experiencesResult,
    educationResult,
    skillsResult,
    resumesResult,
  ].find((result) => result.error)?.error;
  if (queryError) throw queryError;

  const completion = calculateCandidateProfileCompletion({
    fullName: accountResult.data?.full_name,
    email: identity.email,
    profile: profileResult.data,
    experienceCount: experiencesResult.count ?? 0,
    educationCount: educationResult.count ?? 0,
    skillCount: skillsResult.count ?? 0,
    resumeCount: resumesResult.count ?? 0,
  });

  return {
    accountCreated: !existingAccount,
    completion,
    profileSufficient: completion >= CANDIDATE_PROFILE_SUFFICIENT_PERCENT,
  };
}
