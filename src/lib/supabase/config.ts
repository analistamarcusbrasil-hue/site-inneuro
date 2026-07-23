export type SupabasePublicConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

function isValidSupabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (url.hostname === "localhost" || url.hostname === "127.0.0.1"))
    );
  } catch {
    return false;
  }
}

function isValidPublishableKey(value: string) {
  return value.length >= 16 && !/\s/.test(value);
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  if (!isValidSupabaseUrl(url) || !isValidPublishableKey(publishableKey)) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return getSupabasePublicConfig() !== null;
}
