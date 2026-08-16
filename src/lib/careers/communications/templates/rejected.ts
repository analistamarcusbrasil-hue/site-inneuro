import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function rejectedTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
}) {
  const subject = "Atualização do processo seletivo — INNEURO";
  const text = `${greeting(data.candidateName)}\n\nAgradecemos seu interesse em fazer parte da INNEURO e sua participação no processo seletivo para ${data.jobTitle}.\n\nNeste momento, seguiremos com outros candidatos para esta oportunidade.\n\nDesejamos sucesso em sua trajetória profissional.`;
  return renderCareerBase({
    subject,
    heading: "Atualização do processo seletivo",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Agradecemos seu interesse em fazer parte da INNEURO e sua participação no processo seletivo para <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p>Neste momento, seguiremos com outros candidatos para esta oportunidade.</p><p>Desejamos sucesso em sua trajetória profissional.</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
