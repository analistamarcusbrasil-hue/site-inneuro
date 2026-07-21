import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { exames } from "@/data/exames";
import { clinicalServices } from "@/data/clinical-services";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!siteConfig.url) return [];
  const routes = [
    "",
    "/exames",
    "/preparos",
    "/convenios",
    "/sobre",
    "/contato",
  ];
  return [
    ...routes.map((route) => ({
      url: `${siteConfig.url}${route}`,
      changeFrequency: "monthly" as const,
    })),
    ...exames
      .filter((exam) => exam.active)
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
