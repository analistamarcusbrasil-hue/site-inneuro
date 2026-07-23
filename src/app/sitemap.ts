import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { exames, hasIndexableExamContent } from "@/data/exames";
import { clinicalServices } from "@/data/clinical-services";
import { isPreviewDeployment } from "@/lib/deployment";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.url || isPreviewDeployment) return [];
  const routes = [
    "",
    "/exames",
    "/preparos",
    "/convenios",
    "/contato",
    "/politica-de-privacidade",
    "/termos-de-uso",
    "/politica-de-cookies",
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
    ...clinicalServices.map((service) => ({
      url: `${siteConfig.url}/preparos/${service.slug}`,
      changeFrequency: "monthly" as const,
    })),
  ];
}
