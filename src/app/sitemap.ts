import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { exames, hasIndexableExamContent } from "@/data/exames";
import { modalities } from "@/data/modalidades";
import { isPreviewDeployment } from "@/lib/deployment";
import { getPublicNews } from "@/lib/cms/public-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!siteConfig.url || isPreviewDeployment) return [];
  const news = await getPublicNews(500);
  const routes = [
    "",
    "/exames",
    "/preparos",
    "/convenios",
    "/sobre",
    "/contato",
    "/politica-de-privacidade",
    "/termos-de-uso",
    "/politica-de-cookies",
    ...(news.length ? ["/noticias"] : []),
  ];
  return [
    ...routes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      changeFrequency: "monthly" as const,
    })),
    ...exames
      .filter((exam) => exam.active && hasIndexableExamContent(exam))
      .map((exam) => ({
        url: `${siteConfig.url}/exames/${exam.slug}`,
        changeFrequency: "monthly" as const,
      })),
    ...modalities
      .filter((item) => item.active)
      .map((modality) => ({
        url: `${siteConfig.url}/preparos/${modality.slug}`,
        changeFrequency: "monthly" as const,
      })),
    ...news.map((item) => ({
      url: `${siteConfig.url}/noticias/${item.slug}`,
      lastModified: item.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
    })),
  ];
}
