import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCareerCommunicationStore } from "./repository";
import { createCareerCommunicationService } from "./service-core";
import { sendCareerMail } from "./transport";
import type { QueueCareerCommunicationInput } from "./types";

export { createCareerCommunicationService } from "./service-core";

export function getCareerCommunicationService() {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("career_communications_not_configured");
  return createCareerCommunicationService({
    store: createSupabaseCareerCommunicationStore(admin),
    sendMail: sendCareerMail,
  });
}

export async function sendCareerCommunication(
  input: QueueCareerCommunicationInput,
  variableOverrides: Record<string, unknown> = {},
) {
  return getCareerCommunicationService().send(input, variableOverrides);
}
