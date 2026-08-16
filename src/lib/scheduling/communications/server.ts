import "server-only";

import { createHash, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SchedulingMessage } from "./templates";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isPatientTokenActive(expiresAt: string, usedAt: string | null) {
  return !usedAt && Date.parse(expiresAt) > Date.now();
}

function mailConfig() {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT"));
  const user = env("SMTP_USER");
  const password = process.env.SMTP_PASSWORD ?? "";
  const fromEmail =
    env("SCHEDULING_MAIL_FROM_EMAIL") || env("CONTACT_FROM_EMAIL") || user;
  const fromName = env("SCHEDULING_MAIL_FROM_NAME") || "INNEURO";
  const replyTo = env("SCHEDULING_MAIL_REPLY_TO") || undefined;
  const secureValue = env("SMTP_SECURE").toLowerCase();
  const secure = secureValue ? secureValue === "true" : port === 465;
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !password ||
    !emailPattern.test(fromEmail) ||
    /[\r\n]/.test(fromName) ||
    (replyTo && !emailPattern.test(replyTo))
  ) {
    throw new Error("email_not_configured");
  }
  return { host, port, user, password, fromEmail, fromName, replyTo, secure };
}

function safeMailError(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (error instanceof Error && error.message === "email_not_configured")
    return "email_not_configured";
  if (code === "EAUTH") return "smtp_auth_failed";
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(code))
    return "smtp_connection_failed";
  if (["EMESSAGE", "EENVELOPE"].includes(code)) return "smtp_rejected";
  return "delivery_failed";
}

async function deliver(to: string, message: SchedulingMessage) {
  if (!emailPattern.test(to) || /[\r\n]/.test(message.subject))
    throw new Error("invalid_recipient");
  const config = mailConfig();
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({
    from: { name: config.fromName, address: config.fromEmail },
    to,
    replyTo: config.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

export async function createCorrectionToken(
  admin: SupabaseClient,
  requestId: string,
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error } = await admin
    .from("appointment_request_patient_tokens")
    .insert({
      appointment_request_id: requestId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
  if (error) throw new Error("token_create_failed");
  return token;
}

export async function queueAndSendSchedulingCommunication(input: {
  admin: SupabaseClient;
  requestId: string;
  actorId: string;
  type: string;
  recipient: string;
  message: SchedulingMessage;
  idempotencyKey: string;
}) {
  const row = {
    appointment_request_id: input.requestId,
    communication_type: input.type,
    recipient_email: input.recipient,
    subject: input.message.subject,
    text_body: input.message.text,
    html_body: input.message.html,
    idempotency_key: input.idempotencyKey,
    created_by: input.actorId,
  };
  const inserted = await input.admin
    .from("appointment_request_communications")
    .insert(row)
    .select("id,status,attempt_count")
    .single();
  let communication = inserted.data;
  if (inserted.error?.code === "23505") {
    const existing = await input.admin
      .from("appointment_request_communications")
      .select("id,status,attempt_count")
      .eq("idempotency_key", input.idempotencyKey)
      .single();
    communication = existing.data;
  } else if (inserted.error) {
    throw new Error("communication_save_failed");
  }
  if (
    !communication ||
    communication.status === "SENT" ||
    communication.status === "SENDING"
  )
    return communication;
  const attemptedAt = new Date().toISOString();
  const claimed = await input.admin
    .from("appointment_request_communications")
    .update({
      status: "SENDING",
      attempt_count: Number(communication.attempt_count) + 1,
      last_attempt_at: attemptedAt,
    })
    .eq("id", communication.id)
    .in("status", ["PENDING", "FAILED"])
    .select("id")
    .maybeSingle();
  if (!claimed.data) return communication;
  try {
    await deliver(input.recipient, input.message);
    await input.admin
      .from("appointment_request_communications")
      .update({
        status: "SENT",
        sent_at: new Date().toISOString(),
        failed_at: null,
        last_error_code: null,
      })
      .eq("id", communication.id);
    return { ...communication, status: "SENT" };
  } catch (error) {
    await input.admin
      .from("appointment_request_communications")
      .update({
        status: "FAILED",
        failed_at: new Date().toISOString(),
        last_error_code: safeMailError(error),
      })
      .eq("id", communication.id);
    return { ...communication, status: "FAILED" };
  }
}

export async function retrySchedulingCommunication(id: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("email_not_configured");
  const { data } = await admin
    .from("appointment_request_communications")
    .select("*")
    .eq("id", id)
    .single();
  if (!data || data.status !== "FAILED") return data;
  const attemptedAt = new Date().toISOString();
  const { data: claimed } = await admin
    .from("appointment_request_communications")
    .update({
      status: "SENDING",
      attempt_count: Number(data.attempt_count) + 1,
      last_attempt_at: attemptedAt,
    })
    .eq("id", id)
    .eq("status", "FAILED")
    .select("id")
    .maybeSingle();
  if (!claimed) return data;
  try {
    await deliver(data.recipient_email, {
      subject: data.subject,
      text: data.text_body,
      html: data.html_body,
    });
    await admin
      .from("appointment_request_communications")
      .update({
        status: "SENT",
        sent_at: new Date().toISOString(),
        failed_at: null,
        last_error_code: null,
      })
      .eq("id", id);
    return { ...data, status: "SENT" };
  } catch (error) {
    await admin
      .from("appointment_request_communications")
      .update({
        status: "FAILED",
        failed_at: new Date().toISOString(),
        last_error_code: safeMailError(error),
      })
      .eq("id", id);
    return { ...data, status: "FAILED" };
  }
}
