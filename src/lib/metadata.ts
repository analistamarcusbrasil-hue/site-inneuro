import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { isPreviewDeployment } from "@/lib/deployment";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  index = true,
}: PageMetadataOptions): Metadata {
  const canonical = new URL(path, siteConfig.url).toString();
  return {
    title,
    description,
    alternates: { canonical },
    robots: {
      index: index && !isPreviewDeployment,
      follow: !isPreviewDeployment,
    },
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: "INNEURO",
      title,
      description,
      url: canonical,
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: "INNEURO — Instituto de Neurologia do Amapá",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image.png"],
    },
  };
}
