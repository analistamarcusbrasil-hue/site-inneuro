import type { ContactCategory } from "./shared";
import { getContactCategoryLabel } from "./shared";

export type ContactEmailData = {
  protocol: string;
  name: string;
  email: string;
  phone: string;
  category: ContactCategory;
  subject: string;
  message: string;
  receivedAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatReceivedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export function buildContactEmail(data: ContactEmailData) {
  const category = getContactCategoryLabel(data.category);
  const receivedAt = formatReceivedAt(data.receivedAt);
  const phone = data.phone || "Não informado";
  const subject = `[FALE CONOSCO] ${category} — ${data.protocol}`;
  const text = [
    "NOVA MENSAGEM — FALE CONOSCO INNEURO",
    "",
    `Protocolo: ${data.protocol}`,
    `Categoria: ${category}`,
    `Nome: ${data.name}`,
    `E-mail: ${data.email}`,
    `Telefone: ${phone}`,
    `Assunto: ${data.subject}`,
    "",
    "Mensagem:",
    data.message,
    "",
    `Recebido em: ${receivedAt}`,
  ].join("\n");

  const rows = [
    ["Protocolo", data.protocol],
    ["Categoria", category],
    ["Nome", data.name],
    ["E-mail", data.email],
    ["Telefone", phone],
    ["Assunto", data.subject],
    ["Recebido em", receivedAt],
  ];
  const htmlRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <th style="padding:8px 12px;text-align:left;vertical-align:top;color:#65736d;font-size:12px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #dde9e2;">${escapeHtml(label)}</th>
          <td style="padding:8px 12px;color:#10231b;border-bottom:1px solid #dde9e2;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");
  const htmlMessage = escapeHtml(data.message).replaceAll("\n", "<br>");
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f7faf8;font-family:Arial,sans-serif;color:#10231b;">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#03251b;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
        <p style="margin:0 0 6px;color:#dff8ec;font-size:12px;font-weight:700;letter-spacing:.12em;">INNEURO</p>
        <h1 style="margin:0;font-size:22px;line-height:1.25;">Nova mensagem — Fale Conosco</h1>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde9e2;border-top:0;border-radius:0 0 18px 18px;">
        <p style="margin:0 0 18px;font-size:14px;color:#65736d;">Uma nova mensagem institucional foi registrada pelo site.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">${htmlRows}</table>
        <div style="margin-top:20px;padding:18px;background:#f7faf8;border-radius:14px;">
          <p style="margin:0 0 8px;color:#087a4d;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Mensagem</p>
          <p style="margin:0;font-size:14px;line-height:1.65;">${htmlMessage}</p>
        </div>
        <p style="margin:20px 0 0;color:#65736d;font-size:12px;line-height:1.5;">Responda a este e-mail para falar diretamente com a pessoa que enviou a mensagem.</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html, replyTo: data.email };
}
