import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function approvedTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
}) {
  const subject = "Atualização do processo seletivo — INNEURO";
  const text = `${greeting(data.candidateName)}\n\nTemos uma atualização positiva sobre sua participação no processo seletivo para ${data.jobTitle}.\n\nVocê foi aprovado(a) nesta etapa do processo. O RH da INNEURO entrará em contato para orientar os próximos passos.\n\nEsta comunicação não constitui contrato de trabalho.`;
  return renderCareerBase({
    subject,
    heading: "Atualização do processo seletivo",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Temos uma atualização positiva sobre sua participação no processo seletivo para <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p>Você foi aprovado(a) nesta etapa do processo. O RH da INNEURO entrará em contato para orientar os próximos passos.</p><p style="color:#65736d;font-size:13px;">Esta comunicação não constitui contrato de trabalho.</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
