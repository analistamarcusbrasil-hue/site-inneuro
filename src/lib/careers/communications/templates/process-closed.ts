import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function processClosedTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
}) {
  const subject = "Processo seletivo encerrado — INNEURO";
  const text = `${greeting(data.candidateName)}\n\nO processo seletivo referente à vaga de ${data.jobTitle} foi encerrado.\n\nAgradecemos seu interesse e sua participação.`;
  return renderCareerBase({
    subject,
    heading: "Processo seletivo encerrado",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>O processo seletivo referente à vaga de <strong>${escapeCareerHtml(data.jobTitle)}</strong> foi encerrado.</p><p>Agradecemos seu interesse e sua participação.</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
