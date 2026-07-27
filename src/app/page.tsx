import { CompanyHighlightsSection } from "@/components/home/company-highlights-section";
import { Hero } from "@/components/sections/hero";
import { NewsAndSocial } from "@/components/sections/news-and-social";
import {
  getPublicCarousel,
  getPublicNewsAndSocial,
} from "@/lib/cms/public-content";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "INNEURO | Diagnóstico por Imagem em Macapá",
  description:
    "Conheça exames, preparos, convênios e canais oficiais da INNEURO em Macapá, Amapá.",
  path: "/",
});

export default async function Home() {
  const [highlights, newsAndSocial] = await Promise.all([
    getPublicCarousel(),
    getPublicNewsAndSocial(),
  ]);
  return (
    <main id="main-content" tabIndex={-1}>
      <Hero />
      <CompanyHighlightsSection items={highlights} />
      <NewsAndSocial {...newsAndSocial} />
    </main>
  );
}
