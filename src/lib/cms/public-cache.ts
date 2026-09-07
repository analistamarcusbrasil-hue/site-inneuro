import type { CmsModuleKey } from "@/lib/cms/modules";

export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 15 * 60;

export const publicContentCacheTags = {
  institutional: "inneuro:public:institutional",
  scheduling: "inneuro:public:scheduling",
  carousel: "inneuro:public:carousel",
  exams: "inneuro:public:exams",
  partners: "inneuro:public:partners",
  news: "inneuro:public:news",
  preparations: "inneuro:public:preparations",
  social: "inneuro:public:social",
  equipment: "inneuro:public:equipment",
} as const;

export function publicContentTagsForModule(
  moduleKey: CmsModuleKey,
): readonly string[] {
  switch (moduleKey) {
    case "carrossel":
      return [publicContentCacheTags.carousel];
    case "noticias":
      return [publicContentCacheTags.news, publicContentCacheTags.carousel];
    case "exames":
      return [publicContentCacheTags.exams, publicContentCacheTags.scheduling];
    case "preparos":
      return [publicContentCacheTags.preparations];
    case "convenios":
      return [publicContentCacheTags.partners];
    case "redes-sociais":
      return [publicContentCacheTags.social];
    case "equipamentos":
      return [publicContentCacheTags.equipment];
  }
}
