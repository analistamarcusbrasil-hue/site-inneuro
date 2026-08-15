import "server-only";

import nodemailer from "nodemailer";
import { siteConfig } from "@/config/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildCareerApplicationEmail } from "./application-email";

const CAREERS_APPLICATION_RECIPIENT = "adm@inneuroap.com.br";

type CareerApplicationNotificationInput = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: Date;
};

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
    process.env.CAREERS_APPLICATION_RECIPIENT_EMAIL?.trim() ||
    CAREERS_APPLICATION_RECIPIENT;
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
    throw new Error("CAREERS_EMAIL_NOT_CONFIGURED");
  }
  return { host, port, secure, user, password, from, recipient };
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || siteConfig.url;
}

async function setDeliveryStatus(
  applicationId: string,
  values: Record<string, string | number | null>,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { error } = await admin
    .from("career_application_notifications")
    .update(values)
    .eq("application_id", applicationId);
  return !error;
}

export async function notifyNewCareerApplication(
  input: CareerApplicationNotificationInput,
) {
  const admin = createSupabaseAdminClient();
  if (!admin) return { status: "failed" as const };

  const recipient =
    process.env.CAREERS_APPLICATION_RECIPIENT_EMAIL?.trim() ||
    CAREERS_APPLICATION_RECIPIENT;
  const { data: existing } = await admin
    .from("career_application_notifications")
    .select("status, attempt_count")
    .eq("application_id", input.applicationId)
    .maybeSingle();
  if (existing?.status === "sent") return { status: "sent" as const };

  const now = new Date();
  const { error: queueError } = await admin
    .from("career_application_notifications")
    .upsert(
      {
        application_id: input.applicationId,
        recipient_email: recipient,
        status: "pending",
        last_attempt_at: now.toISOString(),
      },
      { onConflict: "application_id" },
    );
  if (queueError) return { status: "failed" as const };

  try {
    const config = getSmtpConfig();
    const message = buildCareerApplicationEmail({
      ...input,
      siteUrl: siteUrl(),
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
      from: { name: "INNEURO — Carreiras", address: config.from },
      to: config.recipient,
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    await setDeliveryStatus(input.applicationId, {
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error_code: null,
      attempt_count: Number(existing?.attempt_count ?? 0) + 1,
    });
    return { status: "sent" as const };
  } catch (error) {
    const code =
      error instanceof Error && error.message === "CAREERS_EMAIL_NOT_CONFIGURED"
        ? "email_not_configured"
        : "delivery_failed";
    await setDeliveryStatus(input.applicationId, {
      status: "failed",
      last_error_code: code,
      attempt_count: Number(existing?.attempt_count ?? 0) + 1,
    });
    return { status: "failed" as const };
  }
}
