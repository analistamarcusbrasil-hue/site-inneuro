import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { isPreviewDeployment } from "@/lib/deployment";

type PageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
};

export function createPageMetadata({
  title,
  description,
  path,
  index = true,
  image,
}: PageMetadataOptions): Metadata {
  const canonical = new URL(path, siteConfig.url).toString();
  const socialImage = image ?? {
    url: "/opengraph-image.png",
    width: 1200,
    height: 630,
    alt: "INNEURO — Instituto de Neurologia do Amapá",
  };
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
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage.url],
    },
  };
}
