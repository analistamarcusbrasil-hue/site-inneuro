import {
  escapeCareerHtml,
  greeting,
  renderCareerBase,
  textToCareerHtml,
} from "./base";
import { formatCareerDate } from "./interview-invite";

export function practicalTestInviteTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
  interviewDate: string;
  interviewTime: string;
  location: string;
  instructions?: string;
}) {
  const subject = "Convite para teste prático — INNEURO";
  const date = formatCareerDate(data.interviewDate);
  const text = `${greeting(data.candidateName)}\n\nGostaríamos de convidar você para o teste prático referente à vaga de ${data.jobTitle}.\n\nData: ${date}\nHorário: ${data.interviewTime}\nLocal: ${data.location}${data.instructions ? `\nInstruções: ${data.instructions}` : ""}`;
  return renderCareerBase({
    subject,
    heading: "Convite para teste prático",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Gostaríamos de convidar você para o teste prático referente à vaga de <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p><strong>Data:</strong> ${escapeCareerHtml(date)}<br><strong>Horário:</strong> ${escapeCareerHtml(data.interviewTime)}<br><strong>Local:</strong> ${escapeCareerHtml(data.location)}</p>${data.instructions ? `<p><strong>Instruções:</strong><br>${textToCareerHtml(data.instructions)}</p>` : ""}`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
