import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const PENDING_CANDIDATE_EMAIL_COOKIE = "inneuro_careers_pending_email";
export const CANDIDATE_RESEND_COOLDOWN_COOKIE = "inneuro_careers_resend_after";

const PENDING_EMAIL_MAX_AGE_SECONDS = 60 * 60;

function signingSecret() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
}

function sign(value: string) {
  const secret = signingSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function seal(payload: object) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(value);
  return signature ? `${value}.${signature}` : null;
}

function unseal<T>(value: string | undefined) {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = sign(payload);
  if (!expected) return null;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge = PENDING_EMAIL_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/carreiras",
    maxAge,
  };
}

export async function rememberPendingCandidateEmail(email: string) {
  const expiresAt = Date.now() + PENDING_EMAIL_MAX_AGE_SECONDS * 1000;
  const sealed = seal({ email, expiresAt });
  if (!sealed) return false;
  const store = await cookies();
  store.set(PENDING_CANDIDATE_EMAIL_COOKIE, sealed, cookieOptions());
  return true;
}

export async function getPendingCandidateEmail() {
  const store = await cookies();
  const pending = unseal<{ email?: string; expiresAt?: number }>(
    store.get(PENDING_CANDIDATE_EMAIL_COOKIE)?.value,
  );
  if (
    !pending?.email ||
    !pending.expiresAt ||
    pending.expiresAt <= Date.now()
  ) {
    return null;
  }
  return pending.email;
}

export async function setCandidateResendCooldown(seconds = 60) {
  const availableAt = Date.now() + seconds * 1000;
  const sealed = seal({ availableAt });
  if (!sealed) return null;
  const store = await cookies();
  store.set(CANDIDATE_RESEND_COOLDOWN_COOKIE, sealed, cookieOptions(seconds));
  return availableAt;
}

export async function getCandidateResendAvailableAt() {
  const store = await cookies();
  const cooldown = unseal<{ availableAt?: number }>(
    store.get(CANDIDATE_RESEND_COOLDOWN_COOKIE)?.value,
  );
  return cooldown?.availableAt && cooldown.availableAt > Date.now()
    ? cooldown.availableAt
    : 0;
}
