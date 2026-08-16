import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function applicationReceivedTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
}) {
  const subject = "Candidatura recebida — INNEURO";
  const text = `${greeting(data.candidateName)}\n\nRecebemos sua candidatura para a vaga de ${data.jobTitle}.\n\nSua participação foi registrada com sucesso.\n\nVocê pode acompanhar o processo pelo Portal de Vagas da INNEURO.\n\nA participação no processo seletivo não representa garantia de contratação.`;
  return renderCareerBase({
    subject,
    heading: "Candidatura recebida",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Recebemos sua candidatura para a vaga de <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p>Sua participação foi registrada com sucesso.</p><p>Você pode acompanhar o processo pelo Portal de Vagas da INNEURO.</p><p style="color:#65736d;font-size:13px;">A participação no processo seletivo não representa garantia de contratação.</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
