import { escapeCareerHtml, renderCareerBase } from "./base";

export function internalNewApplicationTemplate(data: {
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  jobTitle: string;
  submittedAt: string;
  applicationId: string;
  adminUrl: string;
}) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Belem",
  }).format(new Date(data.submittedAt));
  const subject = `[CARREIRAS] Nova candidatura — ${data.jobTitle}`;
  const fields = [
    `Vaga: ${data.jobTitle}`,
    `Candidato(a): ${data.candidateName}`,
    `E-mail: ${data.candidateEmail}`,
    data.candidatePhone ? `Telefone: ${data.candidatePhone}` : null,
    `Recebida em: ${date}`,
    `Identificador: ${data.applicationId}`,
  ].filter(Boolean);
  return renderCareerBase({
    subject,
    heading: "Nova candidatura recebida",
    text: `Uma nova candidatura foi registrada no portal.\n\n${fields.join("\n")}`,
    bodyHtml: `<p>Uma nova candidatura foi registrada no portal.</p><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;"><tr><th style="padding:8px;text-align:left;border-bottom:1px solid #dde9e2;">Vaga</th><td style="padding:8px;border-bottom:1px solid #dde9e2;">${escapeCareerHtml(data.jobTitle)}</td></tr><tr><th style="padding:8px;text-align:left;border-bottom:1px solid #dde9e2;">Candidato(a)</th><td style="padding:8px;border-bottom:1px solid #dde9e2;">${escapeCareerHtml(data.candidateName)}</td></tr><tr><th style="padding:8px;text-align:left;border-bottom:1px solid #dde9e2;">E-mail</th><td style="padding:8px;border-bottom:1px solid #dde9e2;">${escapeCareerHtml(data.candidateEmail)}</td></tr>${data.candidatePhone ? `<tr><th style="padding:8px;text-align:left;border-bottom:1px solid #dde9e2;">Telefone</th><td style="padding:8px;border-bottom:1px solid #dde9e2;">${escapeCareerHtml(data.candidatePhone)}</td></tr>` : ""}<tr><th style="padding:8px;text-align:left;">Recebida em</th><td style="padding:8px;">${escapeCareerHtml(date)}</td></tr></table><p style="color:#65736d;font-size:12px;">O currículo permanece protegido no painel e não é anexado ao e-mail.</p>`,
    cta: { label: "ABRIR CANDIDATURA NO PAINEL", url: data.adminUrl },
    replyTo: data.candidateEmail,
  });
}
