import "server-only";

import { createHmac } from "node:crypto";
import nodemailer from "nodemailer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_EMAIL } from "@/config/contact";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildContactEmail } from "./email";
import { createContactProtocol } from "./protocol";
import type {
  ContactServiceDependencies,
  StoredContactMessage,
} from "./service";
import type { ContactMessageInput } from "./shared";

const CONTACT_RATE_LIMIT = 5;
const CONTACT_RATE_WINDOW_SECONDS = 15 * 60;

function getServerSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("CONTACT_NOT_CONFIGURED");
  return secret;
}

function getContactAdminClient() {
  const client = createSupabaseAdminClient();
  if (!client) throw new Error("CONTACT_NOT_CONFIGURED");
  return client;
}

function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

async function consumeContactRateLimit(
  admin: SupabaseClient,
  request: Request,
) {
  const key = createHmac("sha256", getServerSecret())
    .update(`contact:${getRequestIp(request)}`)
    .digest("hex");
  const { data, error } = await admin.rpc("consume_contact_rate_limit", {
    p_key: key,
    p_limit: CONTACT_RATE_LIMIT,
    p_window_seconds: CONTACT_RATE_WINDOW_SECONDS,
  });
  if (error || typeof data !== "boolean") {
    throw new Error("CONTACT_RATE_LIMIT_UNAVAILABLE");
  }
  return data;
}

async function findExistingSubmission(
  admin: SupabaseClient,
  submissionId: string,
) {
  const { data, error } = await admin
    .from("contact_messages")
    .select("id,protocol,created_at")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (error) throw new Error("CONTACT_DATABASE_UNAVAILABLE");
  if (!data) return null;
  return {
    id: String(data.id),
    protocol: String(data.protocol),
    duplicate: true,
    createdAt: new Date(String(data.created_at)),
  } satisfies StoredContactMessage;
}

async function saveContactMessage(
  admin: SupabaseClient,
  input: ContactMessageInput,
) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const protocol = createContactProtocol();
    const { data, error } = await admin
      .from("contact_messages")
      .insert({
        submission_id: input.submissionId,
        protocol,
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        category: input.category,
        subject: input.subject,
        message: input.message,
        status: "NEW",
        consent_given_at: new Date().toISOString(),
        email_delivery_status: "PENDING",
      })
      .select("id,protocol,created_at")
      .single();

    if (!error && data) {
      return {
        id: String(data.id),
        protocol: String(data.protocol),
        duplicate: false,
        createdAt: new Date(String(data.created_at)),
      } satisfies StoredContactMessage;
    }
    if (error?.code === "23505") {
      const existing = await findExistingSubmission(admin, input.submissionId);
      if (existing) return existing;
      continue;
    }
    throw new Error("CONTACT_DATABASE_UNAVAILABLE");
  }
  throw new Error("CONTACT_PROTOCOL_UNAVAILABLE");
}

function isEmailAddress(value: string) {
  return (
    value.length <= 254 &&
    !/[\r\n]/.test(value) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim() ?? "";
  const port = Number(process.env.SMTP_PORT ?? "");
  const user = process.env.SMTP_USER?.trim() ?? "";
  const password = process.env.SMTP_PASSWORD ?? "";
  const from = process.env.CONTACT_FROM_EMAIL?.trim() || user;
  const recipient =
    process.env.CONTACT_RECIPIENT_EMAIL?.trim() || CONTACT_EMAIL;
  const secureValue = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureValue ? secureValue === "true" : port === 465;

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !password ||
    !isEmailAddress(from) ||
    !isEmailAddress(recipient) ||
    (secureValue && !["true", "false"].includes(secureValue))
  ) {
    throw new Error("CONTACT_EMAIL_NOT_CONFIGURED");
  }
  return { host, port, secure, user, password, from, recipient };
}

async function sendContactEmail(
  input: ContactMessageInput,
  stored: StoredContactMessage,
) {
  const config = getSmtpConfig();
  const message = buildContactEmail({
    protocol: stored.protocol,
    name: input.name,
    email: input.email,
    phone: input.phone,
    category: input.category,
    subject: input.subject,
    message: input.message,
    receivedAt: stored.createdAt,
  });
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
    from: { name: "INNEURO — Fale Conosco", address: config.from },
    to: config.recipient,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

async function updateEmailDelivery(
  admin: SupabaseClient,
  id: string,
  status: "SENT" | "FAILED",
  attemptedAt: Date,
) {
  const { error } = await admin
    .from("contact_messages")
    .update({
      email_delivery_status: status,
      email_attempted_at: attemptedAt.toISOString(),
      email_sent_at: status === "SENT" ? attemptedAt.toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error("CONTACT_DATABASE_UNAVAILABLE");
}

export function createContactServiceDependencies(request: Request) {
  const admin = getContactAdminClient();
  return {
    consumeRateLimit: () => consumeContactRateLimit(admin, request),
    save: (input) => saveContactMessage(admin, input),
    sendEmail: (input, stored) => sendContactEmail(input, stored),
    markEmailSent: (id, sentAt) =>
      updateEmailDelivery(admin, id, "SENT", sentAt),
    markEmailFailed: (id, attemptedAt) =>
      updateEmailDelivery(admin, id, "FAILED", attemptedAt),
  } satisfies ContactServiceDependencies;
}

export function isSecureContactRequest(request: Request) {
  const url = new URL(request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
  return (
    (request.headers.get("x-forwarded-proto") ??
      url.protocol.replace(":", "")) === "https"
  );
}

export function isSameOriginContactRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
