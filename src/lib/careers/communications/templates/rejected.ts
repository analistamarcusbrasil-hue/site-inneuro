import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function rejectedTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
  talentPoolAuthorized?: boolean;
}) {
  const subject = "Atualização do processo seletivo — INNEURO";
  const talentPoolText = data.talentPoolAuthorized
    ? "\n\nComo você autorizou previamente sua participação no Banco de Talentos, seu perfil poderá ser considerado em futuras oportunidades enquanto essa autorização estiver ativa."
    : "";
  const talentPoolHtml = data.talentPoolAuthorized
    ? "<p>Como você autorizou previamente sua participação no Banco de Talentos, seu perfil poderá ser considerado em futuras oportunidades enquanto essa autorização estiver ativa.</p>"
    : "";
  const text = `${greeting(data.candidateName)}\n\nAgradecemos seu interesse em fazer parte da INNEURO e sua participação no processo seletivo para ${data.jobTitle}.\n\nNeste momento, seguiremos com outros candidatos para esta oportunidade.\n\nAgradecemos pelo tempo dedicado ao processo e desejamos sucesso em sua trajetória profissional.${talentPoolText}`;
  return renderCareerBase({
    subject,
    heading: "Atualização do processo seletivo",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Agradecemos seu interesse em fazer parte da INNEURO e sua participação no processo seletivo para <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p>Neste momento, seguiremos com outros candidatos para esta oportunidade.</p><p>Agradecemos pelo tempo dedicado ao processo e desejamos sucesso em sua trajetória profissional.</p>${talentPoolHtml}`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
