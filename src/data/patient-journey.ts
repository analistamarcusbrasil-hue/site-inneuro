import type { JourneyStep } from "@/types/patient-journey";

export const patientJourney: JourneyStep[] = [
  {
    number: 1,
    title: "Envie seu pedido",
    description: "Compartilhe o pedido médico com nossa equipe de atendimento.",
    icon: "send",
  },
  {
    number: 2,
    title: "Confirme o agendamento",
    description:
      "Nossa equipe orientará sobre disponibilidade, autorização e preparo.",
    icon: "schedule",
  },
  {
    number: 3,
    title: "Realize seu exame",
    description: "Compareça com os documentos e orientações informados.",
    icon: "exam",
  },
  {
    number: 4,
    title: "Acesse seu resultado",
    description:
      "Consulte laudos, imagens e exames anteriores pelo Portal de Exames da INNEURO.",
    icon: "result",
  },
];
