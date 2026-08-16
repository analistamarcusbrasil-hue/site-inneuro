import type { CareerCommunicationStore } from "./repository";
import { renderCareerCommunication } from "./templates";
import type {
  CareerCommunicationRecord,
  QueueCareerCommunicationInput,
  RenderedCareerCommunication,
} from "./types";
import { queueCareerCommunicationSchema } from "./validation";

const MAX_ATTEMPTS = 3;

type CareerMailSender = (input: {
  to: string;
  message: RenderedCareerCommunication;
}) => Promise<void>;

export type CareerCommunicationServiceDependencies = {
  store: CareerCommunicationStore;
  sendMail: CareerMailSender;
  logger?: Pick<Console, "info" | "error">;
};

function persistedVariables(input: QueueCareerCommunicationInput) {
  if (input.template !== "PASSWORD_RECOVERY") return input.variables;
  return { candidateName: input.variables.candidateName };
}

function errorCode(error: unknown) {
  if (
    error instanceof Error &&
    "safeCode" in error &&
    typeof error.safeCode === "string"
  ) {
    return error.safeCode.slice(0, 80);
  }
  return "delivery_failed";
}

export function createCareerCommunicationService({
  store,
  sendMail,
  logger = console,
}: CareerCommunicationServiceDependencies) {
  async function queue(
    rawInput: QueueCareerCommunicationInput,
  ): Promise<CareerCommunicationRecord> {
    const input = queueCareerCommunicationSchema.parse(rawInput);
    const rendered = renderCareerCommunication(input.template, input.variables);
    if (input.idempotencyKey) {
      const existing = await store.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    try {
      const record = await store.insert(
        input,
        rendered.subject,
        persistedVariables(input),
      );
      await store.addEvent(record.id, "QUEUED", null, input.createdBy ?? null);
      logger.info("careers.mail.queued", {
        communicationId: record.id,
        template: record.template_key,
      });
      return record;
    } catch (error) {
      if (input.idempotencyKey) {
        const existing = await store.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async function process(
    communicationId: string,
    variableOverrides: Record<string, unknown> = {},
  ): Promise<CareerCommunicationRecord> {
    const current = await store.getById(communicationId);
    if (!current) throw new Error("career_communication_not_found");
    if (current.status === "SENT" || current.status === "CANCELLED") {
      return current;
    }
    if (current.attempt_count >= MAX_ATTEMPTS) return current;

    const claimed = await store.claim(communicationId);
    if (!claimed) return (await store.getById(communicationId)) ?? current;
    const retry = claimed.attempt_count > 1;
    await store.addEvent(
      claimed.id,
      retry ? "RETRY" : "PROCESSING",
      null,
      claimed.created_by,
    );
    if (retry) {
      logger.info("careers.mail.retry", {
        communicationId: claimed.id,
        attempt: claimed.attempt_count,
      });
    }

    try {
      const message = renderCareerCommunication(claimed.template_key, {
        ...claimed.payload,
        ...variableOverrides,
      });
      await sendMail({ to: claimed.recipient_email, message });
      const sent = await store.markSent(claimed.id);
      await store.addEvent(sent.id, "SENT", null, sent.created_by);
      logger.info("careers.mail.sent", {
        communicationId: sent.id,
        template: sent.template_key,
        smtpAccepted: true,
      });
      return sent;
    } catch (error) {
      const code = errorCode(error);
      const failed = await store.markFailed(claimed.id, code);
      await store.addEvent(failed.id, "FAILED", code, failed.created_by);
      logger.error("careers.mail.failed", {
        communicationId: failed.id,
        template: failed.template_key,
        errorCode: code,
        attempt: failed.attempt_count,
      });
      return failed;
    }
  }

  async function send(
    input: QueueCareerCommunicationInput,
    variableOverrides: Record<string, unknown> = {},
  ) {
    const queued = await queue(input);
    return process(queued.id, variableOverrides);
  }

  return { queue, process, send };
}
