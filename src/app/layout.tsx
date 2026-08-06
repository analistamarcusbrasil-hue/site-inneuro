import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { SiteChrome } from "@/components/layout/site-chrome";
import { siteConfig } from "@/config/site";
import { isPreviewDeployment } from "@/lib/deployment";
import { getPublicInstitutionalContent } from "@/lib/cms/public-content";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "INNEURO | Diagnóstico por Imagem em Macapá",
    template: "%s",
  },
  description:
    "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
  applicationName: "INNEURO",
  manifest: "/manifest.webmanifest",
  robots: {
    index: !isPreviewDeployment,
    follow: !isPreviewDeployment,
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "INNEURO",
    title: "INNEURO | Diagnóstico por Imagem em Macapá",
    description:
      "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
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
    title: "INNEURO | Diagnóstico por Imagem em Macapá",
    description:
      "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
    images: ["/twitter-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#03251B",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { config } = await getPublicInstitutionalContent();
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${jakarta.variable}`}>
      <body>
        <SiteChrome config={config}>{children}</SiteChrome>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "MedicalClinic",
              name: config.fullName,
              description: config.description,
              ...(config.url ? { url: config.url } : {}),
              ...(config.phone ? { telephone: config.phone } : {}),
              ...(config.url
                ? {
                    logo: new URL(
                      "/apple-touch-icon.png",
                      config.url,
                    ).toString(),
                  }
                : {}),
              address: {
                "@type": "PostalAddress",
                streetAddress: `${config.address.street}, ${config.address.number}`,
                addressLocality: config.address.city,
                addressRegion: config.address.state,
                addressCountry: "BR",
              },
              hasMap: config.mapsUrl,
              sameAs: [config.instagram.url],
              contactPoint: Object.values(config.whatsapp).map((channel) => ({
                "@type": "ContactPoint",
                telephone: `+${channel.number}`,
                contactType: "customer service",
              })),
              knowsAbout: [
                "Ressonância Magnética",
                "Tomografia Computadorizada",
                "Raios X",
                "Medicina Nuclear",
                "Cintilografia",
                "Mapeamento Cerebral",
              ],
            }).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
