import type { NewsHighlight } from "@/types/news";

// Exemplos editoriais para orientar o cadastro. Permanecem invisíveis até que
// fotografias reais, textos e autorizações sejam fornecidos pela INNEURO.
export const news: NewsHighlight[] = [
  {
    id: "fachada-institucional",
    slug: "fachada-institucional",
    title: "Apresentação institucional da INNEURO",
    excerpt: "Conteúdo aguardando texto e fotografia aprovados pela INNEURO.",
    category: "Institucional",
    image: "/images/noticias/inneuro-fachada-01.webp",
    imageAlt: "Fachada da INNEURO em Macapá",
    publishedAt: "2026-07-21",
    featured: true,
    published: false,
  },
  {
    id: "ressonancia-institucional",
    slug: "ressonancia-institucional",
    title: "Informações sobre ressonância magnética",
    excerpt: "Conteúdo aguardando validação editorial e fotografia autorizada.",
    category: "Exames",
    image: "/images/noticias/inneuro-ressonancia-01.webp",
    imageAlt: "Sala de ressonância magnética da INNEURO",
    publishedAt: "2026-07-20",
    featured: false,
    published: false,
  },
];

export const publishedNews = news
  .filter((item) => item.published)
  .sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

export function getPublishedNews(slug: string) {
  return publishedNews.find((item) => item.slug === slug);
}
