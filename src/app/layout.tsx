import type { Metadata, Viewport } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";
import { siteConfig } from "@/config/site";
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
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: "INNEURO | Diagnóstico por Imagem em Macapá",
    template: "%s",
  },
  description:
    "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
  applicationName: "INNEURO",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "INNEURO",
    title: "INNEURO | Diagnóstico por Imagem em Macapá",
    description:
      "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
  },
  twitter: {
    card: "summary_large_image",
    title: "INNEURO | Diagnóstico por Imagem em Macapá",
    description:
      "Diagnóstico por imagem, neurologia e medicina nuclear com tecnologia, precisão e cuidado.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#03251B",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${jakarta.variable}`}>
      <body>
        <SkipLink />
        <Header />
        {children}
        <Footer />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "MedicalClinic",
              name: siteConfig.fullName,
              description: siteConfig.description,
              ...(siteConfig.url ? { url: siteConfig.url } : {}),
              ...(siteConfig.phone ? { telephone: siteConfig.phone } : {}),
              address: {
                "@type": "PostalAddress",
                streetAddress: `${siteConfig.address.street}, ${siteConfig.address.number}`,
                addressLocality: siteConfig.address.city,
                addressRegion: siteConfig.address.state,
                addressCountry: "BR",
              },
              hasMap: siteConfig.mapsUrl,
              sameAs: [siteConfig.instagram.url],
              contactPoint: Object.values(siteConfig.whatsapp).map(
                (channel) => ({
                  "@type": "ContactPoint",
                  telephone: `+${channel.number}`,
                  contactType: "customer service",
                }),
              ),
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
