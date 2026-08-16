import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function talentPoolTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
}) {
  const subject = "Banco de talentos — INNEURO";
  const text = `${greeting(data.candidateName)}\n\nAgradecemos sua participação no processo seletivo para ${data.jobTitle}.\n\nSeu perfil poderá permanecer no Banco de Talentos da INNEURO, conforme o consentimento registrado e a Política de Privacidade. Você pode gerenciar essa participação no Portal de Vagas.`;
  return renderCareerBase({
    subject,
    heading: "Banco de talentos",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Agradecemos sua participação no processo seletivo para <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p>Seu perfil poderá permanecer no Banco de Talentos da INNEURO, conforme o consentimento registrado e a Política de Privacidade. Você pode gerenciar essa participação no Portal de Vagas.</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
