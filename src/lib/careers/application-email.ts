export type CareerApplicationEmailData = {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  submittedAt: Date;
  siteUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSubmittedAt(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

export function buildCareerApplicationEmail(data: CareerApplicationEmailData) {
  const submittedAt = formatSubmittedAt(data.submittedAt);
  const adminUrl = new URL(
    `/admin/rh/vagas/${data.jobId}/candidaturas/${data.applicationId}`,
    data.siteUrl,
  ).toString();
  const subject = `[CARREIRAS] Nova candidatura — ${data.jobTitle}`;
  const text = [
    "NOVA CANDIDATURA — INNEURO",
    "",
    `Vaga: ${data.jobTitle}`,
    `Candidato(a): ${data.candidateName}`,
    `E-mail: ${data.candidateEmail}`,
    `Recebida em: ${submittedAt}`,
    `Identificador: ${data.applicationId}`,
    "",
    `Abrir candidatura no painel: ${adminUrl}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f7faf8;font-family:Arial,sans-serif;color:#10231b;">
    <div style="max-width:680px;margin:0 auto;padding:28px 16px;">
      <div style="background:#03251b;color:#fff;padding:24px;border-radius:18px 18px 0 0;">
        <p style="margin:0 0 6px;color:#dff8ec;font-size:12px;font-weight:700;letter-spacing:.12em;">INNEURO CARREIRAS</p>
        <h1 style="margin:0;font-size:22px;line-height:1.25;">Nova candidatura recebida</h1>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #dde9e2;border-top:0;border-radius:0 0 18px 18px;">
        <p style="margin:0 0 18px;font-size:14px;color:#65736d;">Uma nova candidatura foi registrada no portal.</p>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><th style="padding:8px 12px;text-align:left;color:#65736d;border-bottom:1px solid #dde9e2;">Vaga</th><td style="padding:8px 12px;border-bottom:1px solid #dde9e2;">${escapeHtml(data.jobTitle)}</td></tr>
          <tr><th style="padding:8px 12px;text-align:left;color:#65736d;border-bottom:1px solid #dde9e2;">Candidato(a)</th><td style="padding:8px 12px;border-bottom:1px solid #dde9e2;">${escapeHtml(data.candidateName)}</td></tr>
          <tr><th style="padding:8px 12px;text-align:left;color:#65736d;border-bottom:1px solid #dde9e2;">E-mail</th><td style="padding:8px 12px;border-bottom:1px solid #dde9e2;">${escapeHtml(data.candidateEmail)}</td></tr>
          <tr><th style="padding:8px 12px;text-align:left;color:#65736d;">Recebida em</th><td style="padding:8px 12px;">${escapeHtml(submittedAt)}</td></tr>
        </table>
        <p style="margin:22px 0 0;">
          <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#087a4d;color:#fff;text-decoration:none;font-weight:700;">Abrir candidatura no painel</a>
        </p>
        <p style="margin:18px 0 0;color:#65736d;font-size:12px;line-height:1.5;">O currículo permanece protegido no painel administrativo e não é anexado a este e-mail.</p>
      </div>
    </div>
  </body>
</html>`;

  return { subject, text, html, replyTo: data.candidateEmail, adminUrl };
}
