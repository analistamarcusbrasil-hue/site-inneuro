import "server-only";

import { siteConfig } from "@/config/site";
import { safeEmailSchema } from "./validation";

const DEFAULT_CAREERS_RECIPIENT = "adm@inneuroap.com.br";

export class CareerMailConfigurationError extends Error {
  constructor() {
    super("CAREERS_EMAIL_NOT_CONFIGURED");
    this.name = "CareerMailConfigurationError";
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getCareerSiteUrl() {
  return env("NEXT_PUBLIC_SITE_URL") || siteConfig.url;
}

export function getCareerPortalUrl() {
  return new URL("/carreiras", getCareerSiteUrl()).toString();
}

export function getCareerApplicationRecipient() {
  const recipient =
    env("CAREERS_APPLICATION_RECIPIENT_EMAIL") || DEFAULT_CAREERS_RECIPIENT;
  const parsed = safeEmailSchema.safeParse(recipient);
  if (!parsed.success) throw new CareerMailConfigurationError();
  return parsed.data;
}

export function getCareerMailConfig() {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT"));
  const user = env("SMTP_USER");
  const password = process.env.SMTP_PASSWORD ?? "";
  const fromEmail =
    env("CAREERS_MAIL_FROM_EMAIL") || env("CONTACT_FROM_EMAIL") || user;
  const fromName = env("CAREERS_MAIL_FROM_NAME") || "INNEURO";
  const replyToValue = env("CAREERS_MAIL_REPLY_TO");
  const secureValue = env("SMTP_SECURE").toLowerCase();
  const secure = secureValue ? secureValue === "true" : port === 465;

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !password ||
    !safeEmailSchema.safeParse(fromEmail).success ||
    fromName.length > 120 ||
    /[\r\n]/.test(fromName) ||
    (replyToValue && !safeEmailSchema.safeParse(replyToValue).success) ||
    (secureValue && !["true", "false"].includes(secureValue))
  ) {
    throw new CareerMailConfigurationError();
  }

  return {
    host,
    port,
    secure,
    user,
    password,
    fromEmail,
    fromName,
    replyTo: replyToValue || undefined,
  };
}
