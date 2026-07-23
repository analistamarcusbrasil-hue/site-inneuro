import type { CompanyHighlight } from "@/types/company-highlight";

export const companyHighlights: CompanyHighlight[] = [
  {
    id: "inneuro-institucional",
    title: "Conheça a INNEURO",
    description:
      "Tecnologia, cuidado e acolhimento em cada etapa do seu atendimento.",
    category: "Institucional",
    imageAlt: "Composição visual institucional da INNEURO",
    href: "/sobre",
    ctaLabel: "Conhecer a INNEURO",
    published: true,
  },
  {
    id: "ressonancia-magnetica",
    title: "Ressonância Magnética",
    description:
      "Imagens detalhadas para auxiliar seu médico com precisão e segurança.",
    category: "Exames",
    image: "/images/carrossel/ressonancia-magnetica-ilustrativa.webp",
    imageAlt: "Imagem ilustrativa de equipamento de ressonância magnética",
    focalPosition: "center",
    href: "/exames/ressonancia-magnetica",
    ctaLabel: "Conhecer o exame",
    creditLabel: "Imagem ilustrativa · KasugaHuang · CC BY-SA 3.0",
    creditUrl: "https://commons.wikimedia.org/wiki/File:Modern_3T_MRI.JPG",
    published: true,
  },
  {
    id: "tomografia-computadorizada",
    title: "Tomografia Computadorizada",
    description:
      "Tecnologia e agilidade com atendimento cuidadoso em cada etapa.",
    category: "Exames",
    image: "/images/carrossel/tomografia-ilustrativa.webp",
    imageAlt: "Imagem ilustrativa de equipamento de tomografia computadorizada",
    focalPosition: "center",
    href: "/exames/tomografia-computadorizada",
    ctaLabel: "Ver informações",
    creditLabel: "Imagem ilustrativa · MART PRODUCTION · Pexels",
    creditUrl:
      "https://www.pexels.com/photo/technology-hospital-medicine-indoors-7089625/",
    published: true,
  },
  {
    id: "raios-x",
    title: "Raios X",
    description:
      "Atendimento prático para diferentes necessidades de diagnóstico por imagem.",
    category: "Exames",
    image: "/images/carrossel/raios-x-ilustrativa.webp",
    imageAlt: "Imagem ilustrativa de sala e equipamento de Raios X",
    focalPosition: "center",
    href: "/exames/raios-x",
    ctaLabel: "Saiba mais",
    creditLabel: "Imagem ilustrativa · PURPLE24 · Pexels",
    creditUrl:
      "https://www.pexels.com/photo/medical-equipments-in-the-room-7617601/",
    published: true,
  },
];

export const publishedCompanyHighlights = companyHighlights.filter(
  (highlight) => highlight.published,
);
