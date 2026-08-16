import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildConfirmationMessage,
  buildPendingMessage,
} from "../src/lib/scheduling/communications/templates";
import {
  defaultDocumentsToBring,
  formatWaitingTime,
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
  assert.match(
    route,
    /requireAdmin\(\[[\s\S]*"reception"[\s\S]*"admin"[\s\S]*"super_admin"[\s\S]*\]\)/,
  );
  assert.match(route, /operation_id: operationId/);
  assert.match(route, /queueAndSendSchedulingCommunication/);
  assert.match(route, /O e-mail precisa ser reenviado/);
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
  assert.match(component, /Meus atendimentos/);
  assert.match(component, /Assumir atendimento/);
  assert.match(component, /Concluir agendamento/);
  assert.match(component, /Próximo atendimento/);
  assert.match(component, /event\.key === "\/"/);
  assert.match(component, /DOCUMENTO RECEBIDO/);
  assert.match(component, /Registrar e avisar paciente/);
  assert.match(component, /Confirmar agendamento e enviar/);
  assert.match(layout, /"reception"/);
});
