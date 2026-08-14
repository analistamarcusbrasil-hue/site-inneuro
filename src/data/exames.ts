import type { Exame } from "@/types/exame";
import { hasExamDetails } from "@/lib/exams/groups";

const magneticResonanceDescription =
  "Modalidade de diagnóstico por imagem realizada conforme indicação e solicitação médica.";

export const exames: Exame[] = [
  {
    slug: "consultas",
    name: "Consultas",
    modality: "Atendimento médico",
    modalitySlug: "atendimento-medico",
    shortDescription: "",
    active: true,
  },
  {
    slug: "tomografia-computadorizada",
    name: "Tomografia",
    modality: "Diagnóstico por imagem",
    modalitySlug: "diagnostico-por-imagem",
    shortDescription:
      "Exame de imagem realizado para diferentes regiões do corpo, conforme solicitação médica.",
    preparationSlug: "tomografia-computadorizada",
    active: true,
  },
  {
    slug: "ressonancia-magnetica",
    name: "Ressonância Magnética",
    modality: "Diagnóstico por imagem",
    modalitySlug: "diagnostico-por-imagem",
    shortDescription: magneticResonanceDescription,
    preparationSlug: "ressonancia-magnetica",
    active: true,
  },
  {
    slug: "teste-ergometrico",
    name: "Teste Ergométrico",
    modality: "Neurofisiologia / exames funcionais",
    modalitySlug: "neurofisiologia-exames-funcionais",
    shortDescription: "",
    active: true,
  },
  {
    slug: "eletroencefalograma",
    name: "Eletroencefalograma",
    modality: "Neurofisiologia / exames funcionais",
    modalitySlug: "neurofisiologia-exames-funcionais",
    shortDescription: "",
    active: true,
  },
  {
    slug: "mapa",
    name: "MAPA",
    modality: "Outros",
    modalitySlug: "outros",
    shortDescription: "",
    active: true,
  },
  {
    slug: "raios-x",
    name: "Raio-X",
    modality: "Diagnóstico por imagem",
    modalitySlug: "diagnostico-por-imagem",
    shortDescription:
      "Exame radiográfico para diferentes regiões, realizado de acordo com a solicitação médica.",
    preparationSlug: "raios-x",
    active: true,
  },
  {
    slug: "mamografia",
    name: "Mamografia",
    modality: "Diagnóstico por imagem",
    modalitySlug: "diagnostico-por-imagem",
    shortDescription: "",
    active: true,
  },
  {
    slug: "ressonancia-magnetica-multiparametrica-da-prostata",
    name: "Ressonância Magnética Multiparamétrica da Próstata",
    modality: "Diagnóstico por imagem",
    modalitySlug: "diagnostico-por-imagem",
    shortDescription: magneticResonanceDescription,
    active: true,
  },
  {
    slug: "ressonancia-do-coracao",
    name: "Ressonância do Coração",
    modality: "Diagnóstico por imagem",
    modalitySlug: "diagnostico-por-imagem",
    shortDescription: magneticResonanceDescription,
    badge: "Exclusivo",
    active: true,
  },
];

export function hasIndexableExamContent(exam: Exame) {
  return hasExamDetails(exam);
}
