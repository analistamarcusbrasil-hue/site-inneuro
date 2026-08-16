import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

export function applicationUnderReviewTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
}) {
  const subject = "Atualização do seu processo seletivo — INNEURO";
  const text = `${greeting(data.candidateName)}\n\nSua candidatura para ${data.jobTitle} está sendo analisada pela nossa equipe.\n\nCaso seja necessário, entraremos em contato para as próximas etapas.`;
  return renderCareerBase({
    subject,
    heading: "Candidatura em análise",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Sua candidatura para <strong>${escapeCareerHtml(data.jobTitle)}</strong> está sendo analisada pela nossa equipe.</p><p>Caso seja necessário, entraremos em contato para as próximas etapas.</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
