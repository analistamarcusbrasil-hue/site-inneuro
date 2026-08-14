import type { MetadataRoute } from "next";
import { hasIndexableExamContent } from "@/data/exames";
import { isPreviewDeployment } from "@/lib/deployment";
import {
  getPublicExams,
  getPublicInstitutionalContent,
  getPublicNews,
} from "@/lib/cms/public-content";
import { createExamGroups } from "@/lib/exams/groups";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [news, examContent, institutional] = await Promise.all([
    getPublicNews(500),
    getPublicExams(),
    getPublicInstitutionalContent(),
  ]);
  const siteUrl = institutional.config.url;
  if (!siteUrl || isPreviewDeployment) return [];
  const routes = [
    "",
    "/exames",
    "/preparos",
    "/convenios",
    "/sobre",
    "/equipe-medica",
    "/contato",
    "/politica-de-privacidade",
    "/termos-de-uso",
    "/politica-de-cookies",
    ...(news.length ? ["/noticias"] : []),
  ];
  return [
    ...routes.map((route) => ({
      url: `${siteUrl}${route}`,
      changeFrequency: "monthly" as const,
    })),
    ...examContent.exams
      .filter((exam) => exam.active && hasIndexableExamContent(exam))
      .map((exam) => ({
        url: `${siteUrl}/exames/${exam.slug}`,
        changeFrequency: "monthly" as const,
      })),
    ...createExamGroups(examContent.exams, examContent.modalities).map(
      (group) => ({
        url: `${siteUrl}/exames/${group.slug}`,
        changeFrequency: "monthly" as const,
      }),
    ),
    ...news.map((item) => ({
      url: `${siteUrl}/noticias/${item.slug}`,
      lastModified: item.publishedAt ?? undefined,
      changeFrequency: "monthly" as const,
    })),
  ];
}
