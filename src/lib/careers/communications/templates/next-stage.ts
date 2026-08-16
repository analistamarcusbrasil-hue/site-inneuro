import {
  escapeCareerHtml,
  greeting,
  renderCareerBase,
  textToCareerHtml,
} from "./base";

export function nextStageTemplate(data: {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
  nextStage: string;
  instructions?: string;
  eventDate?: string;
}) {
  const subject = "Você avançou para a próxima etapa — INNEURO";
  const details = [
    `Próxima etapa: ${data.nextStage}`,
    data.eventDate ? `Data: ${data.eventDate}` : null,
    data.instructions ? `Orientações: ${data.instructions}` : null,
  ].filter(Boolean);
  const text = `${greeting(data.candidateName)}\n\nVocê avançou no processo seletivo para ${data.jobTitle}.\n\n${details.join("\n")}`;
  return renderCareerBase({
    subject,
    heading: "Próxima etapa",
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p><p>Você avançou no processo seletivo para <strong>${escapeCareerHtml(data.jobTitle)}</strong>.</p><p><strong>Próxima etapa:</strong> ${escapeCareerHtml(data.nextStage)}</p>${data.eventDate ? `<p><strong>Data:</strong> ${escapeCareerHtml(data.eventDate)}</p>` : ""}${data.instructions ? `<p><strong>Orientações:</strong><br>${textToCareerHtml(data.instructions)}</p>` : ""}`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}
