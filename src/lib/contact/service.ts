import type { ContactMessageInput } from "./shared";

export type StoredContactMessage = {
  id: string;
  protocol: string;
  duplicate: boolean;
  createdAt: Date;
};

export type ContactServiceDependencies = {
  consumeRateLimit: () => Promise<boolean>;
  save: (input: ContactMessageInput) => Promise<StoredContactMessage>;
  sendEmail: (
    input: ContactMessageInput,
    stored: StoredContactMessage,
  ) => Promise<void>;
  markEmailSent: (id: string, sentAt: Date) => Promise<void>;
  markEmailFailed: (id: string, attemptedAt: Date) => Promise<void>;
};

export class ContactRateLimitError extends Error {
  constructor() {
    super("CONTACT_RATE_LIMIT");
  }
}

export async function processContactMessage(
  input: ContactMessageInput,
  dependencies: ContactServiceDependencies,
) {
  if (!(await dependencies.consumeRateLimit())) {
    throw new ContactRateLimitError();
  }

  const stored = await dependencies.save(input);
  if (stored.duplicate) {
    return { protocol: stored.protocol, emailSent: false, duplicate: true };
  }

  const attemptedAt = new Date();
  try {
    await dependencies.sendEmail(input, stored);
  } catch {
    await dependencies.markEmailFailed(stored.id, attemptedAt).catch(() => {});
    return { protocol: stored.protocol, emailSent: false, duplicate: false };
  }
  await dependencies.markEmailSent(stored.id, attemptedAt).catch(() => {});
  return { protocol: stored.protocol, emailSent: true, duplicate: false };
}
