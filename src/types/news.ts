export type NewsCategory =
  | "Institucional"
  | "Exames"
  | "Prevenção"
  | "Tecnologia"
  | "Campanhas"
  | "Comunicados";

export type NewsContentBlock = {
  type: "paragraph" | "heading" | "image";
  content: string;
  alt?: string;
};

export type NewsHighlight = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: NewsCategory;
  image: string;
  imageAlt: string;
  publishedAt: string;
  featured: boolean;
  published: boolean;
  externalUrl?: string;
  body?: NewsContentBlock[];
};
