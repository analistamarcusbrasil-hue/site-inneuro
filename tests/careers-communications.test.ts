import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCareerCommunicationService } from "../src/lib/careers/communications/service-core";
import {
  CareerMailTransportError,
  deliverCareerMail,
} from "../src/lib/careers/communications/smtp-delivery";
import { renderCareerCommunication } from "../src/lib/careers/communications/templates";
import type {
  CareerCommunicationRecord,
  QueueCareerCommunicationInput,
} from "../src/lib/careers/communications/types";
import { careerCommunicationVariablesSchema } from "../src/lib/careers/communications/validation";

function candidateVariables() {
  return {
    candidateName: "Ana Souza",
    jobTitle: "Recepcionista",
    portalUrl: "https://inneuroap.com.br/carreiras",
  };
}

function memoryStore() {
  const records = new Map<string, CareerCommunicationRecord>();
  const idempotency = new Map<string, string>();
  const events: string[] = [];
  let sequence = 0;
  return {
    records,
    events,
    store: {
      async findByIdempotencyKey(key: string) {
        const id = idempotency.get(key);
        return id ? (records.get(id) ?? null) : null;
      },
      async insert(
        input: QueueCareerCommunicationInput,
        subject: string,
        payload: Record<string, unknown>,
      ) {
        sequence += 1;
        const id = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
        const now = new Date().toISOString();
        const record: CareerCommunicationRecord = {
          id,
          candidate_id: input.candidateId ?? null,
          application_id: input.applicationId ?? null,
          job_id: input.jobId ?? null,
          type: input.template,
          template_key: input.template,
          recipient_kind: input.recipientKind,
          recipient_email: input.recipient,
          subject,
          status: "PENDING",
          payload,
          attempt_count: 0,
          idempotency_key: input.idempotencyKey ?? null,
          last_attempt_at: null,
          sent_at: null,
          failed_at: null,
          last_error_code: null,
          triggered_by: input.triggeredBy,
          created_by: input.createdBy ?? null,
          created_at: now,
          updated_at: now,
        };
        records.set(id, record);
        if (record.idempotency_key) idempotency.set(record.idempotency_key, id);
        return record;
      },
      async getById(id: string) {
        return records.get(id) ?? null;
      },
      async claim(id: string) {
        const current = records.get(id);
        if (
          !current ||
          !["PENDING", "FAILED"].includes(current.status) ||
          current.attempt_count >= 3
        ) {
          return null;
        }
        const claimed = {
          ...current,
          status: "PROCESSING" as const,
          attempt_count: current.attempt_count + 1,
        };
        records.set(id, claimed);
        return claimed;
      },
      async markSent(id: string) {
        const current = records.get(id)!;
        const sent = {
          ...current,
          status: "SENT" as const,
          sent_at: new Date().toISOString(),
          failed_at: null,
          last_error_code: null,
        };
        records.set(id, sent);
        return sent;
      },
      async markFailed(id: string, code: string) {
        const current = records.get(id)!;
        const failed = {
          ...current,
          status: "FAILED" as const,
          sent_at: null,
          failed_at: new Date().toISOString(),
          last_error_code: code,
        };
        records.set(id, failed);
        return failed;
      },
      async addEvent(
        _id: string,
        event: "QUEUED" | "PROCESSING" | "SENT" | "FAILED" | "RETRY",
      ) {
        events.push(event);
      },
    },
  };
}

function communicationInput(): QueueCareerCommunicationInput {
  return {
    candidateId: "00000000-0000-4000-8000-000000000001",
    applicationId: "00000000-0000-4000-8000-000000000002",
    jobId: "00000000-0000-4000-8000-000000000003",
    template: "APPLICATION_RECEIVED",
    recipientKind: "candidate",
    recipient: "ana@example.com",
    variables: candidateVariables(),
    triggeredBy: "candidate",
    idempotencyKey: "application:test:received",
  };
}

test("nova candidatura prepara confirmação e alerta interno na mesma outbox", () => {
  const source = readFileSync(
    new URL(
      "../src/lib/careers/communications/application-service.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /APPLICATION_RECEIVED/);
  assert.match(source, /INTERNAL_NEW_APPLICATION/);
  assert.match(source, /getCareerApplicationRecipient/);
  assert.match(source, /application:\$\{context\.applicationId\}:received/);
  assert.match(source, /application:\$\{context\.applicationId\}:internal-new/);
});

test("templates geram HTML e texto sem prometer contratação", () => {
  const message = renderCareerCommunication(
    "APPLICATION_RECEIVED",
    candidateVariables(),
  );
  assert.equal(message.subject, "Candidatura recebida — INNEURO");
  assert.match(message.text, /não representa garantia de contratação/i);
  assert.match(message.html, /ACESSAR PORTAL DE VAGAS/);
  assert.match(message.html, /INNEURO/);
});

test("entrevista exige data, horário e local informados pelo RH", () => {
  const invalid = careerCommunicationVariablesSchema.safeParse({
    template: "INTERVIEW_INVITE",
    ...candidateVariables(),
  });
  assert.equal(invalid.success, false);
  const valid = careerCommunicationVariablesSchema.safeParse({
    template: "INTERVIEW_INVITE",
    ...candidateVariables(),
    interviewDate: "2026-08-25",
    interviewTime: "14:30",
    location: "INNEURO",
  });
  assert.equal(valid.success, true);
});

test("rejeição é respeitosa e não informa ranking", () => {
  const message = renderCareerCommunication("REJECTED", candidateVariables());
  assert.match(message.text, /seguiremos com outros candidatos/i);
  assert.doesNotMatch(message.text, /ranking|score|nota/i);
});

test("mensagem personalizada escapa HTML livre", () => {
  const message = renderCareerCommunication("CUSTOM_MESSAGE", {
    ...candidateVariables(),
    subject: "Atualização da candidatura",
    message: "Olá <script>alert('x')</script>\nNova orientação.",
  });
  assert.doesNotMatch(message.html, /<script>/);
  assert.match(message.html, /&lt;script&gt;/);
  assert.match(message.text, /<script>/);
});

test("Nodemailer é substituível por mock e não envia e-mail real", async () => {
  const sent: Record<string, unknown>[] = [];
  const message = renderCareerCommunication(
    "APPLICATION_RECEIVED",
    candidateVariables(),
  );
  await deliverCareerMail(
    {
      config: {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "mailer@example.com",
        password: "test-only",
        fromEmail: "mailer@example.com",
        fromName: "INNEURO",
      },
      to: "ana@example.com",
      message,
    },
    () => ({
      async sendMail(payload) {
        sent.push(payload);
        return { accepted: ["ana@example.com"] };
      },
    }),
  );
  assert.equal(sent[0]?.to, "ana@example.com");
  assert.equal(sent[0]?.subject, "Candidatura recebida — INNEURO");
});

test("transporte bloqueia header injection antes do SMTP", async () => {
  const message = renderCareerCommunication(
    "APPLICATION_RECEIVED",
    candidateVariables(),
  );
  await assert.rejects(
    deliverCareerMail(
      {
        config: {
          host: "smtp.example.com",
          port: 587,
          secure: false,
          user: "mailer@example.com",
          password: "test-only",
          fromEmail: "mailer@example.com",
          fromName: "INNEURO",
        },
        to: "ana@example.com\r\nBcc: attacker@example.com",
        message,
      },
      () => ({ async sendMail() {} }),
    ),
    (error: unknown) =>
      error instanceof CareerMailTransportError &&
      error.safeCode === "invalid_recipient",
  );
});

test("SENT só é permitido quando o SMTP aceita o destinatário", async () => {
  const message = renderCareerCommunication(
    "APPLICATION_RECEIVED",
    candidateVariables(),
  );
  await assert.rejects(
    deliverCareerMail(
      {
        config: {
          host: "smtp.example.com",
          port: 587,
          secure: false,
          user: "mailer@example.com",
          password: "test-only",
          fromEmail: "mailer@example.com",
          fromName: "INNEURO",
        },
        to: "ana@example.com",
        message,
      },
      () => ({
        async sendMail() {
          return { accepted: [], rejected: ["ana@example.com"] };
        },
      }),
    ),
    (error: unknown) =>
      error instanceof CareerMailTransportError &&
      error.safeCode === "smtp_rejected",
  );
});

test("idempotência impede confirmação duplicada", async () => {
  const memory = memoryStore();
  let sends = 0;
  const service = createCareerCommunicationService({
    store: memory.store,
    sendMail: async () => {
      sends += 1;
    },
    logger: { info() {}, error() {} },
  });
  const first = await service.send(communicationInput());
  const second = await service.send(communicationInput());
  assert.equal(first.id, second.id);
  assert.equal(sends, 1);
  assert.deepEqual(memory.events, ["QUEUED", "PROCESSING", "SENT"]);
});

test("falha cria FAILED, retry funciona e para em três tentativas", async () => {
  const memory = memoryStore();
  let sends = 0;
  const service = createCareerCommunicationService({
    store: memory.store,
    sendMail: async () => {
      sends += 1;
      throw new CareerMailTransportError("smtp_connection_failed");
    },
    logger: { info() {}, error() {} },
  });
  const first = await service.send(communicationInput());
  assert.equal(first.status, "FAILED");
  await service.process(first.id);
  const third = await service.process(first.id);
  const limited = await service.process(first.id);
  assert.equal(third.attempt_count, 3);
  assert.equal(limited.attempt_count, 3);
  assert.equal(limited.last_error_code, "smtp_connection_failed");
  assert.equal(sends, 3);
  assert.equal(memory.events.filter((event) => event === "RETRY").length, 2);
});

test("API administrativa não aceita destinatário, assunto ou HTML arbitrários", () => {
  const route = readFileSync(
    new URL(
      "../src/app/api/careers/communications/send/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const validation = readFileSync(
    new URL("../src/lib/careers/communications/validation.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /getCareerCommunicationsApiSession/);
  assert.match(route, /consumeCareerAdminMailRateLimit/);
  assert.match(route, /adminSendCommunicationSchema/);
  assert.doesNotMatch(validation, /to:\s*safeEmailSchema|html:/);
});

test("migration preserva legado, aplica RLS e não remove dados", () => {
  const migration = readFileSync(
    new URL(
      "../supabase/migrations/202608150010_career_communications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    migration,
    /create table if not exists public\.career_communications/,
  );
  assert.match(migration, /career_communication_events/);
  assert.match(migration, /idempotency_key/);
  assert.match(migration, /claim_career_communication/);
  assert.match(migration, /public\.can_manage_hr\(\)/);
  assert.match(migration, /career_application_notifications notification/);
  assert.match(migration, /candidate_stage/);
  assert.doesNotMatch(migration, /\bdrop\b|\btruncate\b|delete\s+from/i);
});

test("painel mostra envio e histórico; candidato vê somente a etapa pública", () => {
  const adminPage = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/[applicationId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const candidatePage = readFileSync(
    new URL(
      "../src/app/carreiras/(portal)/candidaturas/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(adminPage, /Comunicação com o candidato/);
  assert.match(adminPage, /Histórico de comunicações/);
  assert.match(adminPage, /Reenviar/);
  assert.match(candidatePage, /candidate_stage/);
  assert.match(candidatePage, /selectionStageNumbers/);
  assert.doesNotMatch(candidatePage, /career_communications|last_error_code/);
});

test("recuperação usa generateLink e SMTP próprio sem template Supabase", () => {
  const actions = readFileSync(
    new URL("../src/app/carreiras/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /auth\.admin\.generateLink/);
  assert.match(actions, /PASSWORD_RECOVERY/);
  assert.doesNotMatch(actions, /resetPasswordForEmail|auth\.resend/);
});

test("mudanças de status e etapa permitem comunicação auditável", () => {
  const applicationAction = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/vagas/[id]/candidaturas/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const processAction = readFileSync(
    new URL(
      "../src/app/admin/(protected)/rh/processos/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(applicationAction, /send_communication/);
  assert.match(applicationAction, /sendApplicationCommunication/);
  assert.match(processAction, /communicationForSelectionStage/);
  assert.match(applicationAction, /INTERVIEW_INVITE/);
  assert.match(applicationAction, /PRACTICAL_TEST_INVITE/);
  assert.match(processAction, /PROCESS_CLOSED/);
});

test("usuário sem permissão recebe 401 ou 403 e secrets ficam no servidor", () => {
  const auth = readFileSync(
    new URL("../src/lib/careers/communications/api-auth.ts", import.meta.url),
    "utf8",
  );
  const clientForm = readFileSync(
    new URL(
      "../src/components/admin/career-communication-form.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const config = readFileSync(
    new URL("../src/lib/careers/communications/config.ts", import.meta.url),
    "utf8",
  );
  assert.match(auth, /status: 401/);
  assert.match(auth, /status: 403/);
  assert.match(auth, /hasHrPermission/);
  assert.doesNotMatch(clientForm, /SMTP_PASSWORD|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(config, /^import "server-only";/);
  assert.match(config, /adm@inneuroap\.com\.br/);
});

test("cadastro segue confirmado no servidor e sem e-mail de ativação", () => {
  const actions = readFileSync(
    new URL("../src/app/carreiras/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /email_confirm: true/);
  assert.match(actions, /signInWithPassword/);
  assert.doesNotMatch(actions, /auth\.signUp|confirmation\.html/);
});
