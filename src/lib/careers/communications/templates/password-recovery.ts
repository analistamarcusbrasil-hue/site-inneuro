import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function passwordRecoveryTemplate(data: {
  candidateName: string;
  recoveryUrl: string;
}) {
  const subject = "Redefinição de senha — Carreiras INNEURO";
  const text = `${greeting(data.candidateName)}\n\nRecebemos uma solicitação para redefinir a senha do Portal de Vagas da INNEURO. Use o link abaixo para criar uma nova senha.\n\nSe você não fez essa solicitação, ignore esta mensagem.`;
  return renderCareerBase({
    subject,
    heading: "Redefina sua senha",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Recebemos uma solicitação para redefinir a senha do Portal de Vagas da INNEURO. Use o botão abaixo para criar uma nova senha.</p><p style="color:#65736d;font-size:13px;">Se você não fez essa solicitação, ignore esta mensagem.</p>`,
    cta: { label: "REDEFINIR SENHA", url: data.recoveryUrl },
  });
}
