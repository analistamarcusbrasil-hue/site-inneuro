import "server-only";

type SupabaseAuthSettings = {
  external?: { google?: boolean };
};

export async function isCandidateGoogleAuthEnabled() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey) return false;

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/auth/v1/settings`,
      {
        headers: { apikey: publishableKey },
        cache: "no-store",
      },
    );
    if (!response.ok) return false;
    const settings = (await response.json()) as SupabaseAuthSettings;
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
