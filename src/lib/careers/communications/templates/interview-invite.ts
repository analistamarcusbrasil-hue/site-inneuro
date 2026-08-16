import {
  escapeCareerHtml,
  greeting,
  renderCareerBase,
  textToCareerHtml,
} from "./base";

export function formatCareerDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00-03:00`),
  );
}

export function interviewInviteTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
  interviewDate: string;
  interviewTime: string;
  location: string;
  instructions?: string;
}) {
  const subject = "Convite para entrevista — INNEURO";
  const date = formatCareerDate(data.interviewDate);
  const text = `${greeting(data.candidateName)}\n\nGostaríamos de convidar você para uma entrevista referente à vaga de ${data.jobTitle}.\n\nData: ${date}\nHorário: ${data.interviewTime}\nLocal: ${data.location}${data.instructions ? `\nOrientações: ${data.instructions}` : ""}`;
  return renderCareerBase({
    subject,
    heading: "Convite para entrevista",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Gostaríamos de convidar você para uma entrevista referente à vaga de <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p><strong>Data:</strong> ${escapeCareerHtml(date)}<br><strong>Horário:</strong> ${escapeCareerHtml(data.interviewTime)}<br><strong>Local:</strong> ${escapeCareerHtml(data.location)}</p>${data.instructions ? `<p><strong>Orientações:</strong><br>${textToCareerHtml(data.instructions)}</p>` : ""}`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
