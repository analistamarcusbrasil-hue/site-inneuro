import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildConfirmationMessage,
  buildPendingMessage,
} from "../src/lib/scheduling/communications/templates";
import {
  buildAppointmentWhatsAppUrl,
  defaultDocumentsToBring,
  formatWaitingTime,
  hasValidSchedulingEmail,
  isActiveRequest,
  isAttendedRequest,
  isConfirmationPending,
  normalizeWhatsAppPhone,
  pendingSuggestions,
  quickPendingReasons,
  workflowStatuses,
} from "../src/lib/scheduling/operations";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("fluxo operacional contém os estados simples da recepção", () => {
  assert.deepEqual(workflowStatuses, [
    "NOVO",
    "EM_ANALISE",
    "AGUARDANDO_CONVENIO",
    "PENDENCIA",
    "RECUSADO",
    "AUTORIZADO",
    "CONCLUIDO",
    "CANCELADO",
  ]);
  assert.equal(quickPendingReasons.length, 10);
  for (const reason of quickPendingReasons) {
    assert.ok(pendingSuggestions[reason]?.correction);
    assert.ok(pendingSuggestions[reason]?.guidance);
  }
});

test("documentos automáticos respeitam convênio, SUS e particular", () => {
  assert.deepEqual(defaultDocumentsToBring("PARTICULAR"), [
    "Documento oficial com foto",
    "Pedido médico",
    "Exames anteriores, quando aplicável",
  ]);
  assert.match(
    defaultDocumentsToBring("INSURANCE").join(" "),
    /Carteirinha do convênio/,
  );
  assert.match(defaultDocumentsToBring("INSURANCE").join(" "), /Autorização/);
  assert.doesNotMatch(
    defaultDocumentsToBring("PARTICULAR").join(" "),
    /Carteirinha|Autorização/,
  );
  assert.match(defaultDocumentsToBring("SUS").join(" "), /Cartão SUS/);
});

test("tempo de espera é legível para minutos, horas e dias", () => {
  const now = Date.parse("2026-08-16T15:00:00Z");
  assert.equal(formatWaitingTime("2026-08-16T14:42:00Z", now), "há 18 min");
  assert.equal(formatWaitingTime("2026-08-16T12:00:00Z", now), "há 3 h");
  assert.equal(formatWaitingTime("2026-08-14T12:00:00Z", now), "há 2 dias");
});

test("WhatsApp normaliza telefones brasileiros e monta mensagem segura", () => {
  assert.equal(normalizeWhatsAppPhone("(96) 99999-9999"), "5596999999999");
  assert.equal(normalizeWhatsAppPhone("+55 96 99999-9999"), "5596999999999");
  assert.equal(normalizeWhatsAppPhone("96999999999"), "5596999999999");
  assert.equal(normalizeWhatsAppPhone("123"), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
  const url = buildAppointmentWhatsAppUrl({
    phone: "+55 (96) 99999-9999",
    patientName: "Maria Silva",
    protocol: "INN-20260816-ABC234",
  });
  assert.match(url ?? "", /^https:\/\/wa\.me\/5596999999999\?text=/);
  assert.match(decodeURIComponent(url ?? ""), /Olá, Maria\./);
  assert.match(decodeURIComponent(url ?? ""), /INN-20260816-ABC234/);
});

test("fila distingue atendidos de confirmações pendentes", () => {
  assert.equal(isActiveRequest("NOVO", "NOT_REQUIRED"), true);
  assert.equal(isConfirmationPending("CONCLUIDO", "FAILED"), true);
  assert.equal(isActiveRequest("CONCLUIDO", "FAILED"), true);
  assert.equal(isAttendedRequest("CONCLUIDO", "SENT"), true);
  assert.equal(isAttendedRequest("CONCLUIDO", "NOT_REQUIRED"), true);
  assert.equal(isActiveRequest("CONCLUIDO", "SENT"), false);
  assert.equal(hasValidSchedulingEmail("paciente@example.com"), true);
  assert.equal(hasValidSchedulingEmail("sem-email"), false);
});

test("e-mail de pendência inclui protocolo, contexto e link seguro", () => {
  const message = buildPendingMessage({
    name: "Maria Silva",
    protocol: "INN-20260816-ABC234",
    exams: "RM Crânio",
    insurance: "Unimed",
    reason: "Carteirinha ilegível",
    correction: "Enviar nova imagem.",
    guidance: "Fotografe sem reflexos.",
    correctionUrl: "https://inneuroap.com.br/solicitacao/corrigir/token-seguro",
  });
  assert.equal(message.subject, "Pendência no seu pré-agendamento — INNEURO");
  assert.match(message.text, /PROTOCOLO\nINN-20260816-ABC234/);
  assert.match(message.text, /O QUE PRECISA SER CORRIGIDO/);
  assert.match(message.html, /Corrigir pendência/);
  assert.match(message.html, /token-seguro/);
});

test("confirmação mantém data, horário e preparo separados por exame", () => {
  const message = buildConfirmationMessage({
    name: "Maria Silva",
    protocol: "INN-20260816-ABC234",
    unit: "INNEURO — Santa Rita",
    documents: ["Documento oficial com foto", "Pedido médico"],
    exams: [
      {
        name: "Ressonância de Crânio",
        date: "20/08/2026",
        time: "14:00",
        preparation: "Preparo cadastrado A",
      },
      {
        name: "Tomografia de Tórax",
        date: "20/08/2026",
        time: "15:30",
        preparation: "Preparo cadastrado B",
      },
    ],
  });
  assert.equal(message.subject, "Agendamento confirmado — INNEURO");
  assert.match(message.text, /EXAME 1[\s\S]*14:00[\s\S]*Preparo cadastrado A/);
  assert.match(message.text, /EXAME 2[\s\S]*15:30[\s\S]*Preparo cadastrado B/);
  assert.match(message.text, /INNEURO — Santa Rita/);
});

test("migration preserva tabelas e limita RECEPCAO ao agendamento", () => {
  const migration = read(
    "../supabase/migrations/202608160002_reception_scheduling_center.sql",
  );
  assert.match(migration, /add value if not exists 'reception'/);
  assert.match(migration, /active boolean not null default true/);
  assert.match(migration, /is_scheduling_staff/);
  assert.match(
    migration,
    /role::text in \('super_admin', 'admin', 'reception'\)/,
  );
  assert.match(migration, /appointment_request_communications/);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /appointment_request_patient_tokens/);
  assert.match(migration, /scheduled_time time/);
  assert.doesNotMatch(
    migration,
    /\bdrop\s+(table|column|constraint|policy)\b/i,
  );
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
});

test("endpoint administrativo registra autoria, idempotência e falha de e-mail", () => {
  const route = read("../src/app/api/admin/solicitacoes/acoes/route.ts");
  assert.match(route, /hasAdminPermission\(profile, "scheduling\.manage"\)/);
  assert.match(
    route,
    /status: 401|response\("Autenticação necessária\.", 401\)/,
  );
  assert.match(route, /response\("Acesso negado\.", 403\)/);
  assert.match(route, /operation_id: operationId/);
  assert.match(route, /queueAndSendSchedulingCommunication/);
  assert.match(route, /prepare_appointment_completion/);
  assert.match(route, /confirmation_status/);
  assert.match(route, /retry_confirmation/);
  assert.match(route, /schedule-confirmation/);
  assert.match(route, /removeFromActive/);
  assert.match(route, /eq\("appointment_request_id", requestId\)/);
  assert.match(route, /appointment_request_history/);
  assert.match(route, /assigned_to[\s\S]*user\.id/);
});

test("correção do paciente usa token hash, armazenamento privado e destaca a fila", () => {
  const route = read("../src/app/api/solicitacao/correcao/[token]/route.ts");
  const page = read("../src/app/solicitacao/corrigir/[token]/page.tsx");
  assert.match(route, /createHash\("sha256"\)/);
  assert.match(route, /PATIENT_CORRECTION/);
  assert.match(route, /documents_received_at/);
  assert.match(
    route,
    /Paciente enviou documentação para correção da pendência/,
  );
  assert.match(page, /Acesso seguro e temporário/);
  assert.doesNotMatch(
    page,
    /\?id=|name="request_id"|value=\{access\.appointment_request_id\}/,
  );
});

test("tela única oferece fila, atalhos e ações conforme status", () => {
  const component = read("../src/components/admin/reception-center.tsx");
  const layout = read("../src/app/admin/(protected)/layout.tsx");
  assert.match(component, /\["mine", "Meus"\]/);
  assert.match(component, /Assumir atendimento/);
  assert.match(component, /FILA ATIVA/);
  assert.match(component, /ATENDIDOS/);
  assert.match(component, /Confirmar data e horário/);
  assert.match(component, /PRÓXIMO/);
  assert.match(component, /event\.key === "\/"/);
  assert.match(component, /event\.key\.toLowerCase\(\) === "w"/);
  assert.match(component, /WhatsApp/);
  assert.match(component, /Corrigir contato/);
  assert.match(component, /Confirmação pendente/);
  assert.match(component, /DOCUMENTO RECEBIDO/);
  assert.match(component, /Registrar e avisar paciente/);
  assert.match(component, /Confirmar agendamento e avisar paciente/);
  assert.match(layout, /requireAdmin\(\)/);
  const page = read("../src/app/admin/(protected)/solicitacoes/page.tsx");
  assert.match(page, /requireAdminPermission\([\s\S]*"scheduling\.view"/);
  assert.match(page, /createSupabaseAdminClient\(\) \?\? supabase/);
  assert.match(
    page,
    /appointment_request_communications!appointment_request_communications_appointment_request_id_fkey/,
  );
  assert.ok(
    page.indexOf('requireAdminPermission("scheduling.view")') <
      page.indexOf("createSupabaseAdminClient()"),
  );
});

test("migration da bancada conclui de forma atômica e preserva dados", () => {
  const migration = read(
    "../supabase/migrations/202608160005_reception_queue_workbench.sql",
  );
  assert.match(migration, /completed_by uuid/);
  assert.match(migration, /confirmation_status text/);
  assert.match(migration, /completion_operation_id uuid/);
  assert.match(migration, /prepare_appointment_completion/);
  assert.match(migration, /for update/);
  assert.match(migration, /'Agendamento definido'/);
  assert.match(migration, /grant execute[\s\S]*service_role/);
  assert.doesNotMatch(
    migration,
    /\bdrop\s+(table|column|constraint|policy)\b/i,
  );
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  const typeFix = read(
    "../supabase/migrations/202608160006_fix_reception_completion_types.sql",
  );
  assert.match(typeFix, /seen_exams uuid\[\] := '\{\}'::uuid\[\]/);
  assert.match(typeFix, /'\{\}'::text\[\]/);
  assert.doesNotMatch(typeFix, /\bdrop\s+(table|column|constraint|policy)\b/i);
});

test("reenvio aceita pendente ou falho e mantém trava de concorrência", () => {
  const server = read("../src/lib/scheduling/communications/server.ts");
  assert.match(server, /\["PENDING", "FAILED"\]\.includes\(data\.status\)/);
  assert.match(server, /\.in\("status", \["PENDING", "FAILED"\]\)/);
  assert.match(server, /status: "SENDING"/);
});
