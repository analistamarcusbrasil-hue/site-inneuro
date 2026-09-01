import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildNewSchedulingRequestTelegramNotification } from "../src/lib/telegram/notifications";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("mensagem do Telegram é compacta, privada e usa deep link administrativo", () => {
  const notification = buildNewSchedulingRequestTelegramNotification({
    requestId: "00000000-0000-4000-8000-000000000123",
    protocol: "INN-TESTE123",
    patientName: "Paciente Controlado",
    phone: "96999999999",
    email: "teste-controlado@example.com",
    serviceType: "INSURANCE",
    insuranceName: "Convênio Teste",
    exams: ["Exame Controlado A", "Exame Controlado B"],
    preferredDates: ["2026-08-25"],
    preferredPeriods: ["MORNING"],
    documents: [
      { kind: "medicalOrder" },
      { kind: "photoId" },
      { kind: "insuranceCardFront" },
    ],
    siteUrl: "https://inneuroap.com.br/",
  });

  assert.match(notification.text, /NOVA SOLICITAÇÃO DE AGENDAMENTO/);
  assert.match(notification.text, /• Exame Controlado A/);
  assert.match(notification.text, /• Exame Controlado B/);
  assert.match(notification.text, /⚠️ Guia não anexada/);
  assert.doesNotMatch(
    notification.text,
    /CPF|Nascimento|accessToken|signed|observaç/i,
  );
  assert.equal(
    notification.adminDeepLink,
    "https://inneuroap.com.br/admin/solicitacoes?solicitacao=00000000-0000-4000-8000-000000000123",
  );
});

test("envio usa fetch nativo, timeout curto e botão inline sem callback", async () => {
  const helper = await read("../src/lib/telegram/notifications.ts");
  assert.match(helper, /TELEGRAM_BOT_TOKEN/);
  assert.match(helper, /TELEGRAM_ADMIN_CHAT_ID/);
  assert.match(helper, /AbortSignal\.timeout\(4_500\)/);
  assert.match(helper, /inline_keyboard/);
  assert.match(helper, /📋 ABRIR SOLICITAÇÃO/);
  assert.doesNotMatch(helper, /callback_data|telegram\/webhook|new Telegram/i);
});

test("notificação ocorre após banco e manifesto e nunca bloqueia o paciente", async () => {
  const route = await read("../src/app/api/pre-agendamento/finalizar/route.ts");
  const saveRecord = route.indexOf("saveSchedulingRequestRecord(");
  const saveManifest = route.indexOf("saveSchedulingManifest(", saveRecord);
  const sendTelegram = route.indexOf(
    "sendNewSchedulingRequestTelegramNotification(",
    saveManifest,
  );
  assert.ok(saveRecord >= 0 && saveManifest > saveRecord);
  assert.ok(sendTelegram > saveManifest);
  assert.match(route, /TELEGRAM_NEW_REQUEST_NOTIFIED/);
  assert.match(
    route,
    /try \{[\s\S]*sendNewSchedulingRequestTelegramNotification[\s\S]*\} catch \{/,
  );
  assert.doesNotMatch(route, /TELEGRAM_WEBHOOK_SECRET/);
});

test("deep link, retorno seguro e conferência preservam autorização e vínculo", async () => {
  const [page, component, actionRoute, loginAction, proxy] = await Promise.all([
    read("../src/app/admin/(protected)/solicitacoes/page.tsx"),
    read("../src/components/admin/reception-center.tsx"),
    read("../src/app/api/admin/solicitacoes/acoes/route.ts"),
    read("../src/app/admin/actions.ts"),
    read("../src/lib/supabase/proxy.ts"),
  ]);
  assert.match(page, /uuidPattern/);
  assert.match(page, /initialSelectedId/);
  assert.match(component, /initialSelectionMissing/);
  assert.match(component, /isAttendedRequest/);
  assert.match(component, /Confirmar documento/);
  assert.match(component, /checkedDocumentCount/);
  assert.match(actionRoute, /action === "check_document"/);
  assert.match(actionRoute, /eq\("appointment_request_id", requestId\)/);
  assert.match(actionRoute, /APPOINTMENT_DOCUMENT_CHECKED/);
  assert.match(actionRoute, /canOverrideSchedulingAssignment/);
  assert.match(loginAction, /safeAdminReturnPath/);
  assert.match(proxy, /request\.nextUrl\.pathname === "\/admin\/solicitacoes"/);
  assert.doesNotMatch(loginAction, /redirect\(parsed\.data\.next/);
});
