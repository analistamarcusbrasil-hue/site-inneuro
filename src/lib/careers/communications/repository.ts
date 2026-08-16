import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CareerCommunicationRecord,
  QueueCareerCommunicationInput,
} from "./types";

export type CareerCommunicationEventType =
  "QUEUED" | "PROCESSING" | "SENT" | "FAILED" | "RETRY" | "CANCELLED";

export interface CareerCommunicationStore {
  findByIdempotencyKey(key: string): Promise<CareerCommunicationRecord | null>;
  insert(
    input: QueueCareerCommunicationInput,
    subject: string,
    persistedVariables: Record<string, unknown>,
  ): Promise<CareerCommunicationRecord>;
  getById(id: string): Promise<CareerCommunicationRecord | null>;
  claim(id: string): Promise<CareerCommunicationRecord | null>;
  markSent(id: string): Promise<CareerCommunicationRecord>;
  markFailed(id: string, errorCode: string): Promise<CareerCommunicationRecord>;
  addEvent(
    communicationId: string,
    eventType: CareerCommunicationEventType,
    errorCode?: string | null,
    actorId?: string | null,
  ): Promise<void>;
}

function asRecord(value: unknown) {
  return value as CareerCommunicationRecord;
}

export function createSupabaseCareerCommunicationStore(
  supabase: SupabaseClient,
): CareerCommunicationStore {
  return {
    async findByIdempotencyKey(key) {
      const { data, error } = await supabase
        .from("career_communications")
        .select("*")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw error;
      return data ? asRecord(data) : null;
    },

    async insert(input, subject, persistedVariables) {
      const { data, error } = await supabase
        .from("career_communications")
        .insert({
          candidate_id: input.candidateId ?? null,
          application_id: input.applicationId ?? null,
          job_id: input.jobId ?? null,
          type: input.template,
          template_key: input.template,
          recipient_kind: input.recipientKind,
          recipient_email: input.recipient,
          subject,
          status: "PENDING",
          payload: persistedVariables,
          idempotency_key: input.idempotencyKey ?? null,
          triggered_by: input.triggeredBy,
          created_by: input.createdBy ?? null,
        })
        .select("*")
        .single();
      if (error) throw error;
      return asRecord(data);
    },

    async getById(id) {
      const { data, error } = await supabase
        .from("career_communications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? asRecord(data) : null;
    },

    async claim(id) {
      const { data, error } = await supabase.rpc("claim_career_communication", {
        p_communication_id: id,
      });
      if (error) throw error;
      const record = Array.isArray(data) ? data[0] : data;
      return record ? asRecord(record) : null;
    },

    async markSent(id) {
      const { data, error } = await supabase
        .from("career_communications")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          failed_at: null,
          last_error_code: null,
        })
        .eq("id", id)
        .eq("status", "PROCESSING")
        .select("*")
        .single();
      if (error) throw error;
      return asRecord(data);
    },

    async markFailed(id, errorCode) {
      const { data, error } = await supabase
        .from("career_communications")
        .update({
          status: "FAILED",
          sent_at: null,
          failed_at: new Date().toISOString(),
          last_error_code: errorCode,
        })
        .eq("id", id)
        .eq("status", "PROCESSING")
        .select("*")
        .single();
      if (error) throw error;
      return asRecord(data);
    },

    async addEvent(communicationId, eventType, errorCode, actorId) {
      const { error } = await supabase
        .from("career_communication_events")
        .insert({
          communication_id: communicationId,
          event_type: eventType,
          error_code: errorCode ?? null,
          actor_id: actorId ?? null,
        });
      if (error) throw error;
    },
  };
}
