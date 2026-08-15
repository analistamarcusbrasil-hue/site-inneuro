import type { User } from "@supabase/supabase-js";
import { normalizeCandidateName } from "@/lib/careers/auth-validation";

export type CandidateAuthIdentity = {
  fullName: string;
  email: string | null;
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function metadataName(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return "";
  const directName = cleanText(metadata.full_name) || cleanText(metadata.name);
  if (directName) return directName;

  return [cleanText(metadata.given_name), cleanText(metadata.family_name)]
    .filter(Boolean)
    .join(" ");
}

export function getCandidateIdentityFromAuthUser(
  user: Pick<User, "email" | "user_metadata" | "identities">,
): CandidateAuthIdentity {
  const googleIdentity = user.identities?.find(
    (identity) => identity.provider === "google",
  );
  const identityData = googleIdentity?.identity_data as
    Record<string, unknown> | undefined;
  const fullName = normalizeCandidateName(
    metadataName(user.user_metadata) || metadataName(identityData),
  );
  const email = cleanText(user.email) || cleanText(identityData?.email) || null;

  return { fullName, email };
}
