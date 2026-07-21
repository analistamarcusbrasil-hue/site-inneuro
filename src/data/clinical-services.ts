import type { ClinicalService } from "@/types/clinical-service";

const reviewed = {
  validatedByClinic: true,
  lastReviewedAt: "2026-07-21",
} as const;

export const clinicalServices: ClinicalService[] = [
  {
    ...reviewed,
    slug: "tomografia-computadorizada",
    name: "Tomografia Computadorizada",
    searchTerms: ["tomografia", "contraste", "abdome"],
    attendanceMode: "walk-in",
    attendanceLabel: "Ordem de chegada",
    schedules: [
      {
        label: "Sem contraste",
        days: "Segunda a sexta-feira",
        periods: [{ start: "07h", end: "23h" }],
      },
      {
        label: "Sem contraste",
        days: "Sábado",
        periods: [{ start: "08h", end: "22h" }],
      },
      {
        label: "Com contraste",
        days: "Segunda a sexta-feira",
        periods: [
          { start: "08h", end: "12h" },
          { start: "13h", end: "18h" },
        ],
      },
    ],
    preparationGroups: [
      {
        title: "Exames com contraste ou de abdome",
        appliesTo: ["Tomografia com contraste", "Tomografia de abdome"],
        instructions: [
          "Jejum de 4 horas.",
          "Usar roupas leves.",
          "Não usar roupas ou acessórios com metais.",
          "Pacientes com 60 anos ou mais devem comparecer acompanhados.",
          "Pacientes com 60 anos ou mais devem trazer exames recentes de ureia e creatinina.",
        ],
        warning:
          "Em caso de dúvida sobre contraste ou preparo, confirme com a equipe da INNEURO.",
      },
    ],
  },
  {
    ...reviewed,
    slug: "raios-x",
    name: "Raios X",
    searchTerms: ["raios x", "bacia", "coluna lombar", "quadril"],
    attendanceMode: "walk-in",
    attendanceLabel: "Ordem de chegada",
    schedules: [
      {
        label: "Atendimento",
        days: "Segunda a sexta-feira",
        periods: [
          { start: "08h", end: "12h" },
          { start: "13h", end: "23h" },
        ],
      },
      {
        label: "Atendimento",
        days: "Sábado",
        periods: [{ start: "08h", end: "22h" }],
      },
    ],
    preparationGroups: [
      {
        title: "Preparo informado pela INNEURO para esses exames específicos",
        appliesTo: [
          "Raios X de bacia",
          "Raios X de coluna lombar",
          "Raios X de quadril",
        ],
        instructions: [
          "Jejum de 4 horas.",
          "No dia anterior, a partir das 07h, tomar 20 gotas de Luftal a cada 6 horas.",
          "Fazer jantar leve até às 20h.",
          "Após o jantar, tomar 2 comprimidos de Lactopurga ou Ducolax.",
          "Trazer exames anteriores, caso possua.",
          "Comparecer com roupas leves.",
          "Não usar metais, joias ou piercing.",
        ],
        warning:
          "Em caso de contraindicação, dúvida, gestação ou uso contínuo de medicamentos, confirme com a equipe da INNEURO.",
      },
    ],
    previousExamsRecommended: true,
  },
  {
    ...reviewed,
    slug: "mapeamento-cerebral",
    name: "Mapeamento Cerebral",
    searchTerms: ["mapeamento cerebral", "cabelo", "menores de 6 anos", "sono"],
    attendanceMode: "appointment",
    attendanceLabel: "Consulte a equipe",
    schedules: [
      {
        label: "Atendimento",
        days: "Segunda a sexta-feira",
        periods: [
          { start: "08h", end: "11h30" },
          { start: "13h", end: "18h30" },
        ],
      },
      {
        label: "Atendimento",
        days: "Sábado",
        periods: [{ start: "08h", end: "11h30" }],
      },
    ],
    preparationGroups: [
      {
        title: "Preparo",
        appliesTo: ["Mapeamento Cerebral"],
        instructions: [
          "Lavar o cabelo com sabão neutro no dia anterior.",
          "Não usar creme.",
          "Não usar gel.",
          "Não usar óleo.",
          "Não utilizar outros produtos no cabelo.",
          "Comparecer com o cabelo seco.",
        ],
      },
      {
        title: "Menores de 6 anos",
        appliesTo: ["Somente menores de 6 anos"],
        instructions: [
          "No dia anterior, dormir por volta de 00h.",
          "Acordar até 03h.",
          "A orientação tem como objetivo que a criança consiga dormir novamente durante o exame na clínica.",
          "Trazer toalha de rosto.",
        ],
        warning:
          "Em caso de dúvida, confirme as orientações com a equipe da INNEURO.",
      },
    ],
    documents: ["Carteira do convênio.", "RG.", "Pedido médico original."],
  },
  {
    ...reviewed,
    slug: "ressonancia-magnetica",
    name: "Ressonância Magnética",
    searchTerms: [
      "ressonância magnética",
      "contraste",
      "metais",
      "claustrofobia",
    ],
    attendanceMode: "appointment",
    attendanceLabel: "Necessita agendamento",
    schedules: [
      {
        label: "Atendimento",
        days: "Segunda a sexta-feira",
        periods: [{ start: "07h", end: "23h" }],
      },
      {
        label: "Atendimento",
        days: "Sábado",
        periods: [{ start: "07h", end: "22h" }],
      },
      {
        label: "Atendimento",
        days: "Domingo",
        periods: [{ start: "07h", end: "19h" }],
      },
    ],
    preparationGroups: [
      {
        title: "Exames com contraste",
        appliesTo: ["Ressonância Magnética com contraste"],
        instructions: [
          "Jejum de 2 horas.",
          "Comparecer com roupas leves.",
          "Não usar roupas ou acessórios com metais.",
          "Não usar joias.",
          "Não usar piercing.",
          "Pacientes com 60 anos ou mais devem comparecer acompanhados.",
          "Pacientes com 60 anos ou mais devem trazer ureia e creatinina recentes.",
        ],
      },
    ],
    safetyQuestions: [
      "use aparelho ortodôntico;",
      "possua clipes metálicos;",
      "use marca-passo;",
      "use cílios metálicos;",
      "possua próteses ou metais no corpo;",
      "tenha claustrofobia.",
    ],
  },
];

// Confirmar com a INNEURO a grafia comercial “Ducolax” antes da publicação definitiva.
export function getClinicalService(slug: string) {
  return clinicalServices.find((service) => service.slug === slug);
}
