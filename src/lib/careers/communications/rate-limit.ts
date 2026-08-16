import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function consumeCareerAdminMailRateLimit(
  admin: SupabaseClient,
  adminUserId: string,
) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return false;
  const key = createHmac("sha256", secret)
    .update(`career-admin-mail:${adminUserId}`)
    .digest("hex");
  const { data, error } = await admin.rpc("consume_contact_rate_limit", {
    p_key: key,
    p_limit: 20,
    p_window_seconds: 900,
  });
  if (error) return false;
  return data === true;
}
