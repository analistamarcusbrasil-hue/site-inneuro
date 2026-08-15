import "server-only";

import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

const REGISTRATION_RATE_LIMIT = 5;
const REGISTRATION_RATE_WINDOW_SECONDS = 15 * 60;

function registrationFingerprint(requestHeaders: Headers) {
  const ip =
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 300) ?? "";
  return `${ip}:${userAgent}`;
}

export async function consumeCandidateRegistrationRateLimit(
  admin: SupabaseClient,
) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("CANDIDATE_REGISTRATION_NOT_CONFIGURED");

  const requestHeaders = await headers();
  const key = createHmac("sha256", secret)
    .update(`candidate-registration:${registrationFingerprint(requestHeaders)}`)
    .digest("hex");
  const { data, error } = await admin.rpc("consume_contact_rate_limit", {
    p_key: key,
    p_limit: REGISTRATION_RATE_LIMIT,
    p_window_seconds: REGISTRATION_RATE_WINDOW_SECONDS,
  });
  if (error || typeof data !== "boolean") {
    throw new Error("CANDIDATE_REGISTRATION_RATE_LIMIT_UNAVAILABLE");
  }
  return data;
}
