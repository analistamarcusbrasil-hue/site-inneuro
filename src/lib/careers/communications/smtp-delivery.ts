import type { RenderedCareerCommunication } from "./types";
import { safeEmailSchema } from "./validation";

type MailTransport = {
  sendMail(message: Record<string, unknown>): Promise<unknown>;
};

export type CareerSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
};

export type CareerTransportFactory = (config: {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}) => MailTransport;

export class CareerMailTransportError extends Error {
  readonly safeCode: string;

  constructor(safeCode: string) {
    super(safeCode);
    this.name = "CareerMailTransportError";
    this.safeCode = safeCode;
  }
}

function safeTransportError(error: unknown) {
  if (
    error instanceof Error &&
    error.message === "CAREERS_EMAIL_NOT_CONFIGURED"
  ) {
    return "email_not_configured";
  }
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (code === "EAUTH") return "smtp_auth_failed";
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET"].includes(code)) {
    return "smtp_connection_failed";
  }
  if (["EMESSAGE", "EENVELOPE"].includes(code)) return "smtp_rejected";
  return "delivery_failed";
}

export async function deliverCareerMail(
  input: {
    config: CareerSmtpConfig;
    to: string;
    message: RenderedCareerCommunication;
  },
  transportFactory: CareerTransportFactory,
) {
  const recipient = safeEmailSchema.safeParse(input.to);
  const fromEmail = safeEmailSchema.safeParse(input.config.fromEmail);
  const replyToValue = input.message.replyTo ?? input.config.replyTo;
  const replyTo = replyToValue ? safeEmailSchema.safeParse(replyToValue) : null;
  if (
    !recipient.success ||
    !fromEmail.success ||
    /[\r\n]/.test(input.config.fromName) ||
    (replyTo && !replyTo.success)
  ) {
    throw new CareerMailTransportError("invalid_recipient");
  }

  try {
    const transport = transportFactory({
      host: input.config.host,
      port: input.config.port,
      secure: input.config.secure,
      auth: { user: input.config.user, pass: input.config.password },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const result = await transport.sendMail({
      from: {
        name: input.config.fromName,
        address: fromEmail.data,
      },
      to: recipient.data,
      replyTo: replyTo?.data,
      subject: input.message.subject,
      text: input.message.text,
      html: input.message.html,
    });
    if (
      typeof result === "object" &&
      result &&
      "accepted" in result &&
      Array.isArray(result.accepted) &&
      result.accepted.length === 0
    ) {
      throw new CareerMailTransportError("smtp_rejected");
    }
  } catch (error) {
    if (error instanceof CareerMailTransportError) throw error;
    throw new CareerMailTransportError(safeTransportError(error));
  }
}
