import { escapeCareerHtml, greeting, renderCareerBase } from "./base";

type ApprovalData = {
  candidateName: string;
  jobTitle: string;
  portalUrl: string;
};

function approvalTemplate(
  data: ApprovalData,
  subject: string,
  heading: string,
  paragraphs: string[],
) {
  const text = `${greeting(data.candidateName)}\n\n${paragraphs.join("\n\n")}`;
  return renderCareerBase({
    subject,
    heading,
    text,
    bodyHtml: `<p>${escapeCareerHtml(greeting(data.candidateName))}</p>${paragraphs.map((paragraph) => `<p>${escapeCareerHtml(paragraph)}</p>`).join("")}`,
    cta: { label: "ACESSAR PORTAL DE VAGAS", url: data.portalUrl },
  });
}

export function stageOneApprovedTemplate(data: ApprovalData) {
  return approvalTemplate(
    data,
    "Você avançou no processo seletivo — INNEURO",
    "Aprovado para entrevista",
    [
      "Seu perfil foi aprovado na etapa: 1 de 4 — Currículo.",
      "Parabéns! Você avançou para: 2 de 4 — Entrevista.",
      "A equipe da INNEURO entrará em contato com as informações necessárias para esta etapa.",
      "Você pode acompanhar o andamento pelo Portal do Candidato.",
    ],
  );
}

export function stageTwoApprovedTemplate(data: ApprovalData) {
  return approvalTemplate(
    data,
    "Você avançou no processo seletivo — INNEURO",
    "Aprovado para teste prático",
    [
      "Você foi aprovado na etapa: 2 de 4 — Entrevista.",
      "Você avançou para: 3 de 4 — Teste Prático.",
      "Em breve você receberá as orientações para a próxima etapa.",
    ],
  );
}

export function stageThreeApprovedTemplate(data: ApprovalData) {
  return approvalTemplate(
    data,
    "Você avançou no processo seletivo — INNEURO",
    "Aprovado para contratação",
    [
      "Você foi aprovado na etapa: 3 de 4 — Teste Prático.",
      "Você avançou para a etapa final: 4 de 4 — Contratação.",
      "Nossa equipe entrará em contato para orientar os próximos passos.",
    ],
  );
}

export function finalApprovedTemplate(data: ApprovalData) {
  return approvalTemplate(
    data,
    "Processo seletivo concluído — INNEURO",
    "Contratação aprovada",
    [
      "Parabéns!",
      `Você concluiu as 4 etapas do processo seletivo para a oportunidade de ${data.jobTitle}.`,
      "Nossa equipe entrará em contato para dar continuidade aos procedimentos de contratação.",
      "Agradecemos seu interesse em fazer parte da INNEURO.",
    ],
  );
}
