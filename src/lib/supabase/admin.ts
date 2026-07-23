import { createClient } from "@supabase/supabase-js";
import { isCmsAdminConfigured } from "@/lib/cms/config";

export function createSupabaseAdminClient() {
  if (!isCmsAdminConfigured) return null;

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
