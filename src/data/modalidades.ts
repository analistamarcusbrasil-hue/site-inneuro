import type { Modality } from "@/types/modality";

export const modalities: Modality[] = [
  {
    slug: "diagnostico-por-imagem",
    name: "Diagnóstico por imagem",
    shortDescription: "Tomografia, ressonância magnética, Raio-X e mamografia.",
    icon: "computed-tomography",
    active: true,
    featured: true,
  },
  {
    slug: "neurofisiologia-exames-funcionais",
    name: "Neurofisiologia / exames funcionais",
    shortDescription: "Teste Ergométrico e eletroencefalograma.",
    icon: "functional-exam",
    active: true,
    featured: true,
  },
  {
    slug: "outros",
    name: "Outros",
    shortDescription: "MAPA.",
    icon: "monitoring",
    active: true,
    featured: true,
  },
  {
    slug: "atendimento-medico",
    name: "Atendimento médico",
    shortDescription: "Consultas.",
    icon: "medical-care",
    active: true,
    featured: true,
  },
];
