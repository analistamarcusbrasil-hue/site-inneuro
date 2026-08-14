import assert from "node:assert/strict";
import test from "node:test";
import nodemailer from "nodemailer";
import { buildContactEmail } from "../src/lib/contact/email";
import { createContactProtocol } from "../src/lib/contact/protocol";
import {
  ContactRateLimitError,
  processContactMessage,
  type ContactServiceDependencies,
} from "../src/lib/contact/service";
import {
  contactCategories,
  contactMessageSchema,
  formatBrazilianPhone,
  type ContactMessageInput,
} from "../src/lib/contact/shared";

const validInput: ContactMessageInput = contactMessageSchema.parse({
  submissionId: "55e4c5d4-18c0-4c20-9528-a8b3953fb45d",
  name: "Maria da Silva",
  email: "maria@example.com",
  phone: "(96) 99999-9999",
  category: "SUGGESTION",
  subject: "Atendimento da recepção",
  message: "Gostaria de deixar uma sugestão para a equipe.",
  consent: true,
});

function createDependencies(
  overrides: Partial<ContactServiceDependencies> = {},
) {
  const events: string[] = [];
  const dependencies: ContactServiceDependencies = {
    consumeRateLimit: async () => {
      events.push("rate-limit");
      return true;
    },
    save: async () => {
      events.push("save");
      return {
        id: "contact-id",
        protocol: "FC-20260813-ABC234",
        duplicate: false,
        createdAt: new Date("2026-08-13T21:42:00.000Z"),
      };
    },
    sendEmail: async () => {
      events.push("email");
    },
    markEmailSent: async () => {
      events.push("mark-sent");
    },
    markEmailFailed: async () => {
      events.push("mark-failed");
    },
    ...overrides,
  };
  return { dependencies, events };
}

test("aceita todas as oito categorias institucionais", () => {
  assert.equal(contactCategories.length, 8);
  for (const category of contactCategories) {
    const parsed = contactMessageSchema.safeParse({
      ...validInput,
      category: category.value,
    });
    assert.equal(parsed.success, true, category.label);
  }
});

test("rejeita campos obrigatórios e formatos inválidos", () => {
  const parsed = contactMessageSchema.safeParse({
    ...validInput,
    name: "",
    email: "email-invalido",
    category: "",
    message: "",
    consent: false,
  });
  assert.equal(parsed.success, false);
  if (parsed.success) return;
  const fields = parsed.error.flatten().fieldErrors;
  assert.ok(fields.name);
  assert.ok(fields.email);
  assert.ok(fields.category);
  assert.ok(fields.message);
  assert.ok(fields.consent);
});

test("rejeita mensagem acima de 3000 caracteres", () => {
  const parsed = contactMessageSchema.safeParse({
    ...validInput,
    message: "a".repeat(3001),
  });
  assert.equal(parsed.success, false);
});

test("formata telefone brasileiro sem aceitar dígitos excedentes", () => {
  assert.equal(formatBrazilianPhone("96999999999"), "(96) 99999-9999");
  assert.equal(formatBrazilianPhone("96999999999123"), "(96) 99999-9999");
});

test("gera protocolo criptográfico no padrão esperado", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");
  const first = createContactProtocol(now);
  const second = createContactProtocol(now);
  assert.match(first, /^FC-20260813-[A-HJ-NP-Z2-9]{6}$/);
  assert.notEqual(first, second);
});

test("escapa HTML e mantém Reply-To validado", () => {
  const email = buildContactEmail({
    protocol: "FC-20260813-ABC234",
    name: "<script>alert(1)</script>",
    email: "maria@example.com",
    phone: "",
    category: "COMPLAINT",
    subject: "Observação",
    message: "Linha 1\n<img src=x onerror=alert(1)>",
    receivedAt: new Date("2026-08-13T21:42:00.000Z"),
  });
  assert.equal(email.replyTo, "maria@example.com");
  assert.match(email.subject, /Reclamação/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.match(email.text, /FC-20260813-ABC234/);
});

test("Nodemailer serializa destinatário fixo e Reply-To", async () => {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const email = buildContactEmail({
    protocol: "FC-20260813-ABC234",
    name: validInput.name,
    email: validInput.email,
    phone: validInput.phone,
    category: validInput.category,
    subject: validInput.subject,
    message: validInput.message,
    receivedAt: new Date("2026-08-13T21:42:00.000Z"),
  });
  const info = await transport.sendMail({
    from: "INNEURO <site@inneuroap.com.br>",
    to: "faleconosco@inneuroap.com.br",
    replyTo: email.replyTo,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  const raw = String(info.message);
  assert.match(raw, /To: faleconosco@inneuroap.com.br/);
  assert.match(raw, /Reply-To: maria@example.com/);
});

test("processa na ordem rate limit, banco, e-mail e confirmação", async () => {
  const { dependencies, events } = createDependencies();
  const result = await processContactMessage(validInput, dependencies);
  assert.deepEqual(events, ["rate-limit", "save", "email", "mark-sent"]);
  assert.equal(result.emailSent, true);
  assert.equal(result.protocol, "FC-20260813-ABC234");
});

test("preserva o registro quando o SMTP falha", async () => {
  const setup = createDependencies();
  setup.dependencies.sendEmail = async () => {
    setup.events.push("email");
    throw new Error("SMTP indisponível");
  };
  const result = await processContactMessage(validInput, setup.dependencies);
  assert.deepEqual(setup.events, [
    "rate-limit",
    "save",
    "email",
    "mark-failed",
  ]);
  assert.equal(result.emailSent, false);
  assert.equal(result.protocol, "FC-20260813-ABC234");
});

test("não envia e-mail quando o banco falha", async () => {
  const setup = createDependencies();
  setup.dependencies.save = async () => {
    setup.events.push("save");
    throw new Error("Banco indisponível");
  };
  await assert.rejects(() =>
    processContactMessage(validInput, setup.dependencies),
  );
  assert.deepEqual(setup.events, ["rate-limit", "save"]);
});

test("interrompe antes do banco quando o rate limit é excedido", async () => {
  const setup = createDependencies();
  setup.dependencies.consumeRateLimit = async () => {
    setup.events.push("rate-limit");
    return false;
  };
  await assert.rejects(
    () => processContactMessage(validInput, setup.dependencies),
    ContactRateLimitError,
  );
  assert.deepEqual(setup.events, ["rate-limit"]);
});

test("idempotência impede novo e-mail no segundo envio", async () => {
  let saved = false;
  let emails = 0;
  const { dependencies } = createDependencies({
    save: async () => {
      const duplicate = saved;
      saved = true;
      return {
        id: "contact-id",
        protocol: "FC-20260813-ABC234",
        duplicate,
        createdAt: new Date("2026-08-13T21:42:00.000Z"),
      };
    },
    sendEmail: async () => {
      emails += 1;
    },
  });
  const first = await processContactMessage(validInput, dependencies);
  const second = await processContactMessage(validInput, dependencies);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(emails, 1);
  assert.equal(first.protocol, second.protocol);
});
