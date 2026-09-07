import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function read(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("CTAs públicos de agendamento abrem o Portal", async () => {
  const [hero, header, examPage, examCard, modalityCard, preparationPage] =
    await Promise.all([
      read("../src/components/sections/hero.tsx"),
      read("../src/components/layout/header.tsx"),
      read("../src/app/exames/[slug]/page.tsx"),
      read("../src/components/exams/exam-card.tsx"),
      read("../src/components/ui/modality-card.tsx"),
      read("../src/app/preparos/[slug]/page.tsx"),
    ]);

  assert.match(hero, /href="\/contato#pre-agendamento"/);
  assert.equal(
    header.match(/href="\/contato#pre-agendamento"/g)?.length,
    2,
    "Header desktop e navegação móvel devem abrir o Portal",
  );
  for (const source of [examPage, examCard, modalityCard, preparationPage]) {
    assert.match(source, /\/contato\?exame=.*#pre-agendamento/);
  }
});

test("finalização persiste a solicitação e não cria desvio para WhatsApp", async () => {
  const [component, route, shared] = await Promise.all([
    read("../src/components/sections/scheduling.tsx"),
    read("../src/app/api/pre-agendamento/finalizar/route.ts"),
    read("../src/lib/scheduling/shared.ts"),
  ]);

  assert.match(route, /saveSchedulingRequestRecord\(/);
  assert.match(
    route,
    /return json\(\{ protocol: session\.protocol, protectedUrl \}\)/,
  );
  assert.match(component, /href=\{success\.protectedUrl\}/);
  assert.match(component, /Acompanhar\s+solicitação/);
  assert.match(component, /Solicitação enviada com sucesso\./);
  assert.match(
    component,
    /Não é necessário enviar seus dados novamente pelo WhatsApp\./,
  );

  for (const source of [component, route, shared]) {
    assert.doesNotMatch(source, /whatsappUrl/);
  }
  assert.doesNotMatch(component, /channel:\s*"primary"/);
  assert.doesNotMatch(
    route,
    /createWhatsAppUrl|NOVA SOLICITAÇÃO DE AGENDAMENTO/,
  );
  assert.doesNotMatch(route, /Selecione um canal de WhatsApp válido/);
});

test("WhatsApp institucional permanece contato secundário, sem nova fila", async () => {
  const [footer, contact, finalCta, adminPage, faq, flow] = await Promise.all([
    read("../src/components/layout/footer.tsx"),
    read("../src/app/contato/page.tsx"),
    read("../src/components/sections/final-scheduling-cta.tsx"),
    read("../src/app/admin/(protected)/solicitacoes/page.tsx"),
    read("../src/data/faq.ts"),
    read("../docs/product-flows/scheduling.md"),
  ]);

  assert.match(footer, /createWhatsAppUrl/);
  assert.match(contact, /Telefone e WhatsApp/);
  assert.match(finalCta, /Falar pelo WhatsApp/);
  assert.match(finalCta, /href="\/contato#pre-agendamento"/);
  assert.match(adminPage, /appointment_requests/);
  assert.match(
    faq,
    /agendamentos são solicitados exclusivamente pelo nosso Portal/,
  );
  assert.match(flow, /SCHEDULING SINGLE ENTRY POINT/);
  assert.match(flow, /WhatsApp não é canal de\s+entrada operacional/);
});
