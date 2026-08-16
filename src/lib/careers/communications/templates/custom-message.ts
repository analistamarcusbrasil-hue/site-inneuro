import {
  escapeCareerHtml,
  greeting,
  renderCareerBase,
  textToCareerHtml,
} from "./base";

export function customMessageTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
  subject: string;
  message: string;
}) {
  const text = `${greeting(data.candidateName)}\n\n${data.message}`;
  return renderCareerBase({
    subject: data.subject,
    heading: data.subject,
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>${textToCareerHtml(data.message)}</p><p style="color:#65736d;font-size:13px;">Referente à vaga: ${escapeCareerHtml(data.jobTitle)}</p>`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
