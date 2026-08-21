import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  buildConfirmationMessage,
  buildNotSchedulableMessage,
  buildPendingMessage,
} from "../src/lib/scheduling/communications/templates";
import {
  buildAppointmentWhatsAppUrl,
  defaultDocumentsToBring,
  formatReceptionDate,
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
import {
  normalizeSchedulingEmail,
  normalizeSchedulingPhone,
  resolveSchedulingMimeType,
} from "../src/lib/scheduling/shared";
import {
  buildSchedulingFormPdf,
  sanitizeDownloadName,
  schedulingFormFileName,
} from "../src/lib/scheduling/form-pdf";

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
    "NAO_AGENDAVEL",
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

test("data e horário da recepção renderizam sem opção inválida", () => {
  assert.equal(formatReceptionDate(null), "—");
  assert.match(formatReceptionDate("2026-08-16"), /16\/08\/2026/);
  assert.match(
    formatReceptionDate("2026-08-16T15:30:00-03:00"),
    /16\/08\/2026/,
  );
  const component = read("../src/components/admin/reception-center.tsx");
  assert.doesNotMatch(component, /toLocaleDateString[\s\S]{0,160}timeStyle/);
});

test("WhatsApp normaliza telefones brasileiros e monta mensagem segura", () => {
  assert.equal(normalizeWhatsAppPhone("(96) 99999-9999"), "5596999999999");
  assert.equal(normalizeWhatsAppPhone("+55 96 99999-9999"), "5596999999999");
  assert.equal(normalizeWhatsAppPhone("96999999999"), "5596999999999");
  assert.equal(normalizeWhatsAppPhone("123"), null);
  assert.equal(normalizeWhatsAppPhone(null), null);
  assert.equal(normalizeSchedulingPhone("(96) 99999-9999"), "96999999999");
  assert.equal(normalizeSchedulingPhone("+55 96 99999-9999"), "96999999999");
  assert.equal(normalizeSchedulingPhone("00000000000"), null);
  assert.equal(normalizeSchedulingPhone("11111111111"), null);
  assert.equal(normalizeSchedulingPhone("99999999999"), null);
  assert.equal(
    normalizeSchedulingEmail("  MARIA@EXAMPLE.COM  "),
    "maria@example.com",
  );
  assert.equal(normalizeSchedulingEmail("sem-email"), null);
  assert.equal(
    resolveSchedulingMimeType("foto-rg.jpeg", "application/octet-stream"),
    "image/jpeg",
  );
  assert.equal(resolveSchedulingMimeType("arquivo.exe", ""), null);
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
  assert.equal(isActiveRequest("NAO_AGENDAVEL", "FAILED"), true);
  assert.equal(isAttendedRequest("NAO_AGENDAVEL", "SENT"), true);
  assert.equal(isActiveRequest("NAO_AGENDAVEL", "SENT"), false);
  assert.equal(hasValidSchedulingEmail("paciente@example.com"), true);
  assert.equal(hasValidSchedulingEmail("sem-email"), false);
});

test("não agendável comunica motivo sem expor conteúdo sensível", () => {
  const message = buildNotSchedulableMessage({
    name: "Maria Silva",
    protocol: "INN-20260816-ABC234",
    exams: ["Ressonância de Crânio"],
    reason: "O convênio não possui cobertura para este exame",
    guidance: "Consulte a operadora sobre os prestadores disponíveis.",
    partial: true,
  });
  assert.match(message.text, /não foi possível realizar esta parte/);
  assert.match(message.text, /demais exames[\s\S]*continuam em análise/);
  assert.match(message.text, /INN-20260816-ABC234/);
  assert.doesNotMatch(message.text, /diagnóstico|laudo|CPF/i);
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
  assert.match(route, /canOverrideSchedulingAssignment/);
  assert.match(route, /APPOINTMENT_ADMIN_OVERRIDE_ACTION/);
  assert.match(route, /mark_appointment_not_schedulable/);
  assert.match(route, /APPOINTMENT_MARKED_NOT_SCHEDULABLE/);
  assert.match(route, /APPOINTMENT_CONTACT_UPDATED/);
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
  assert.match(component, /ENCERRADOS/);
  assert.match(component, /Confirmar data e horário/);
  assert.match(component, /PRÓXIMO/);
  assert.match(component, /event\.key === "\/"/);
  assert.match(component, /event\.key\.toLowerCase\(\) === "w"/);
  assert.match(component, /WhatsApp/);
  assert.match(component, /Corrigir contato/);
  assert.match(component, /Confirmação pendente/);
  assert.match(component, /DOCUMENTO RECEBIDO/);
  assert.match(component, /Registrar e avisar paciente/);
  assert.match(component, /Não é possível agendar/);
  assert.match(component, /Administrador intervindo/);
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

test("migration adiciona override, fechamento parcial, preview e contato novo", () => {
  const migration = read(
    "../supabase/migrations/20260821194557_scheduling_admin_override_documents_and_closure.sql",
  );
  assert.match(migration, /preview_storage_path/);
  assert.match(migration, /NOT_SCHEDULABLE/);
  assert.match(migration, /NAO_AGENDAVEL/);
  assert.match(migration, /mark_appointment_not_schedulable/);
  assert.match(migration, /can_override_scheduling_assignment/);
  assert.match(migration, /appointment_requests_require_new_contact/);
  assert.match(migration, /before insert on public\.appointment_requests/);
  assert.match(migration, /status <> 'NOT_SCHEDULABLE'/);
  assert.match(migration, /grant execute[\s\S]*to service_role/);
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
});

test("upload preserva original, otimiza imagem e mede progresso real", () => {
  const scheduling = read("../src/components/sections/scheduling.tsx");
  const optimizer = read("../src/lib/scheduling/image-optimization.ts");
  const server = read("../src/lib/scheduling/server.ts");
  assert.match(optimizer, /PREVIEW_MAX_DIMENSION = 2200/);
  assert.match(optimizer, /image\/webp/);
  assert.match(optimizer, /PREVIEW_QUALITY = 0\.84/);
  assert.match(scheduling, /request\.upload\.addEventListener\("progress"/);
  assert.match(scheduling, /loadedByTransfer/);
  assert.match(server, /previewPath/);
  assert.match(server, /detectSchedulingMimeType/);
  assert.match(server, /preview_storage_path/);
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

test("PDF completo contém múltiplas páginas válidas e nome sanitizado", async () => {
  assert.equal(
    schedulingFormFileName("PA-20260816-ÁBC123", "Maria da Silva"),
    "INNEURO_PreAgendamento_PA-20260816-ABC123_Maria-da-Silva.pdf",
  );
  assert.equal(
    sanitizeDownloadName("../../pedido médico.pdf"),
    "pedido-medico.pdf",
  );
  const pdf = await buildSchedulingFormPdf({
    protocol: "PA-20260816-ABC123",
    patient_name: "Maria da Silva",
    cpf: "000.000.000-00",
    birth_date: "1990-01-20",
    phone: "(96) 99999-9999",
    email: "maria@example.com",
    service_type: "INSURANCE",
    insurance_name: "Convênio Exemplo",
    insurance_card_number: "123456",
    insurance_card_expiry: "2027-08-01",
    insurer_reference: "REF-1",
    authorization_number: "AUT-1",
    authorization_valid_until: "2026-09-01",
    preferred_dates: ["2026-08-20", "2026-08-21"],
    preferred_periods: ["Manhã", "Tarde"],
    notes: "Observação originalmente enviada pela paciente. ".repeat(150),
    workflow_status: "CONCLUIDO",
    claimed_at: "2026-08-16T13:00:00-03:00",
    completed_at: "2026-08-16T14:00:00-03:00",
    created_at: "2026-08-16T12:00:00-03:00",
    unit_name: "INNEURO — Santa Rita",
    assigned: { full_name: "Recepcionista" },
    completed: { full_name: "Recepcionista" },
    appointment_request_exams: [
      {
        exam_name: "Ressonância Magnética de Crânio",
        modality: "Ressonância",
        scheduled_date: "2026-08-20",
        scheduled_time: "14:00:00",
        preparation_text: "Seguir o preparo informado.",
        documents_to_bring: ["Pedido médico", "Documento com foto"],
      },
      {
        exam_name: "Tomografia de Tórax",
        modality: "Tomografia",
        scheduled_date: "2026-08-20",
        scheduled_time: "15:00:00",
        preparation_text: null,
        documents_to_bring: [],
      },
    ],
    appointment_request_documents: [
      { document_type: "medical_request", file_name: "pedido.pdf" },
      { document_type: "insurance_card_front", file_name: "carteirinha.jpg" },
    ],
  });
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
  assert.ok(pdf.length > 1_000);
  const loadedPdf = await PDFDocument.load(pdf);
  assert.ok(loadedPdf.getPageCount() > 1);
});

test("downloads administrativos validam permissão, vínculo, privacidade e auditoria", () => {
  const formRoute = read(
    "../src/app/api/admin/solicitacoes/[id]/formulario/route.ts",
  );
  const documentServer = read(
    "../src/lib/scheduling/admin-document-response.ts",
  );
  const legacyDocumentRoute = read(
    "../src/app/api/admin/solicitacoes/documentos/[id]/route.ts",
  );
  const component = read("../src/components/admin/reception-center.tsx");
  assert.match(
    formRoute,
    /hasAdminPermission\(session\.profile, "scheduling\.view"\)/,
  );
  assert.match(formRoute, /APPOINTMENT_FORM_DOWNLOADED/);
  assert.match(formRoute, /Content-Type": "application\/pdf"/);
  assert.match(formRoute, /Cache-Control": "private, no-store/);
  assert.doesNotMatch(formRoute, /storage_path|service_role/i);
  assert.match(
    documentServer,
    /hasAdminPermission\(session\.profile, "scheduling\.view"\)/,
  );
  assert.match(documentServer, /eq\("appointment_request_id", requestId\)/);
  assert.match(documentServer, /\.download\(document\.storage_path\)/);
  assert.match(documentServer, /APPOINTMENT_DOCUMENT_DOWNLOADED/);
  assert.match(documentServer, /APPOINTMENT_DOCUMENT_VIEWED/);
  assert.match(documentServer, /detectSchedulingMimeType/);
  assert.match(documentServer, /preview_storage_path/);
  assert.match(documentServer, /Content-Disposition/);
  assert.match(documentServer, /Cache-Control": "private, no-store/);
  assert.doesNotMatch(documentServer, /createSignedUrl|getPublicUrl/);
  assert.doesNotMatch(
    legacyDocumentRoute,
    /storage_path|createSignedUrl|getPublicUrl/,
  );
  assert.match(component, /Formulário completo/);
  assert.match(component, /Visualizar/);
  assert.match(component, /Baixar documento/);
});
