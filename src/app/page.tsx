import { Differentials } from "@/components/sections/differentials";
import { FinalSchedulingCta } from "@/components/sections/final-scheduling-cta";
import { Hero } from "@/components/sections/hero";
import { Insurance } from "@/components/sections/insurance";
import { Location } from "@/components/sections/location";
import { Modalities } from "@/components/sections/modalities";
import { QuickActions } from "@/components/sections/quick-actions";
import { getPublicPartners } from "@/lib/cms/public-content";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "INNEURO | Diagnóstico por Imagem em Macapá",
  description:
    "Conheça exames, preparos, convênios e canais oficiais da INNEURO em Macapá, Amapá.",
  path: "/",
});

export default async function Home() {
  const partners = await getPublicPartners();
  return (
    <main id="main-content" tabIndex={-1}>
      <Hero />
      <QuickActions />
      <Modalities />
      <Insurance partners={partners} />
      <Differentials />
      <Location />
      <FinalSchedulingCta />
    </main>
  );
}
