export type SchedulingMessage = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlFromText(text: string, actionUrl?: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(
      (part) =>
        `<p style="margin:0 0 18px;white-space:pre-line">${escapeHtml(part)}</p>`,
    )
    .join("");
  const action = actionUrl
    ? `<p style="margin:26px 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:999px;background:#0b6655;color:#fff;padding:13px 22px;text-decoration:none;font-weight:700">Corrigir pendência</a></p>`
    : "";
  return `<div style="font-family:Arial,sans-serif;max-width:640px;color:#17342f;line-height:1.6">${paragraphs}${action}</div>`;
}

export function buildPendingMessage(input: {
  name: string;
  protocol: string;
  exams: string;
  insurance: string;
  reason: string;
  correction: string;
  guidance: string;
  correctionUrl: string;
  rejected?: boolean;
}): SchedulingMessage {
  const subject = input.rejected
    ? "Retorno do convênio sobre seu pré-agendamento — INNEURO"
    : "Pendência no seu pré-agendamento — INNEURO";
  const text = `Olá, ${input.name}.

Identificamos uma pendência no seu pré-agendamento.

PROTOCOLO
${input.protocol}

EXAME
${input.exams}

CONVÊNIO
${input.insurance}

PENDÊNCIA
${input.reason}

O QUE PRECISA SER CORRIGIDO
${input.correction}

COMO PROCEDER
${input.guidance}

Assim que a pendência for corrigida, envie a documentação solicitada para continuarmos seu atendimento.

INNEURO
Macapá - AP`;
  return { subject, text, html: htmlFromText(text, input.correctionUrl) };
}

export type ScheduledExamMessage = {
  name: string;
  date: string;
  time: string;
  preparation: string;
};

export function buildConfirmationMessage(input: {
  name: string;
  protocol: string;
  unit: string;
  exams: ScheduledExamMessage[];
  documents: string[];
}): SchedulingMessage {
  const examSections = input.exams
    .map(
      (
        exam,
        index,
      ) => `${input.exams.length > 1 ? `EXAME ${index + 1}\n` : "EXAME\n"}${exam.name}

DATA
${exam.date}

HORÁRIO
${exam.time}

PREPARO
${exam.preparation || "Sem preparo cadastrado. Confirme as orientações com a INNEURO."}`,
    )
    .join("\n\n");
  const text = `Olá, ${input.name}.

Seu exame está agendado na INNEURO.

${examSections}

UNIDADE
${input.unit}

O QUE LEVAR
${input.documents.join("\n")}

PROTOCOLO
${input.protocol}

Confira atentamente as orientações acima.

Caso não possa comparecer ou tenha alguma dúvida, entre em contato com a INNEURO.

INNEURO
Macapá - AP
https://inneuroap.com.br`;
  return {
    subject: "Agendamento confirmado — INNEURO",
    text,
    html: htmlFromText(text),
  };
}

export function buildManualMessage(input: {
  subject: string;
  body: string;
}): SchedulingMessage {
  return {
    subject: input.subject,
    text: input.body,
    html: htmlFromText(input.body),
  };
}
