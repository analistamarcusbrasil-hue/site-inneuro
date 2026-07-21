import type { Modality } from "@/types/modality";

export const modalities: Modality[] = [
  {
    slug: "ressonancia-magnetica",
    name: "Ressonância Magnética",
    shortDescription:
      "Modalidade de diagnóstico por imagem realizada conforme indicação e solicitação médica.",
    icon: "magnetic-resonance",
    active: true,
  },
  {
    slug: "tomografia-computadorizada",
    name: "Tomografia Computadorizada",
    shortDescription:
      "Exame de imagem realizado para diferentes regiões do corpo, conforme solicitação médica.",
    icon: "computed-tomography",
    active: true,
  },
  {
    slug: "raios-x",
    name: "Raios X",
    shortDescription:
      "Exames radiográficos para diferentes regiões, realizados de acordo com a solicitação médica.",
    icon: "x-ray",
    active: true,
  },
  {
    slug: "medicina-nuclear",
    name: "Medicina Nuclear",
    shortDescription:
      "Área dedicada a procedimentos de medicina nuclear indicados pelo médico responsável.",
    icon: "nuclear-medicine",
    active: true,
  },
  {
    slug: "cintilografia",
    name: "Cintilografia",
    shortDescription:
      "Exames realizados conforme indicação médica e orientações específicas para cada procedimento.",
    icon: "scintigraphy",
    active: true,
  },
  {
    slug: "mapeamento-cerebral",
    name: "Mapeamento Cerebral",
    shortDescription:
      "Exame para registro da atividade elétrica cerebral, realizado conforme solicitação médica.",
    icon: "brain-mapping",
    active: true,
  },
];
