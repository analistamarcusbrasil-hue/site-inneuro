import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { isPreviewDeployment } from "@/lib/deployment";

export default function robots(): MetadataRoute.Robots {
  if (isPreviewDeployment) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/admin/" },
    sitemap: siteConfig.url ? `${siteConfig.url}/sitemap.xml` : undefined,
  };
}
