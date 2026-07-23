import { Differentials } from "@/components/sections/differentials";
import { Hero } from "@/components/sections/hero";
import { Insurance } from "@/components/sections/insurance";
import { Modalities } from "@/components/sections/modalities";
import { Location } from "@/components/sections/location";
import { NewsAndSocial } from "@/components/sections/news-and-social";
import { QuickActions } from "@/components/sections/quick-actions";
import { StructureAndEquipment } from "@/components/sections/structure-and-equipment";
import { CompanyHighlightsSection } from "@/components/home/company-highlights-section";
import { Scheduling } from "@/components/sections/scheduling";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "INNEURO | Diagnóstico por Imagem em Macapá",
  description:
    "Conheça exames, preparos, convênios e canais oficiais da INNEURO em Macapá, Amapá.",
  path: "/",
});

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Hero />
      <CompanyHighlightsSection />
      <QuickActions />
      <Modalities />
      <Differentials />
      <StructureAndEquipment />
      <NewsAndSocial />
      <Insurance />
      <Scheduling />
      <Location />
    </main>
  );
}
