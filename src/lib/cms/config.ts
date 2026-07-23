import { isSupabaseConfigured } from "@/lib/supabase/config";

export const isCmsConfigured = isSupabaseConfigured();

export const isCmsAdminConfigured = Boolean(
  isCmsConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
