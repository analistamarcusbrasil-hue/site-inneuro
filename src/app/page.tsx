import { CompanyHighlightsSection } from "@/components/home/company-highlights-section";
import { Differentials } from "@/components/sections/differentials";
import { FinalSchedulingCta } from "@/components/sections/final-scheduling-cta";
import { Hero } from "@/components/sections/hero";
import { Insurance } from "@/components/sections/insurance";
import { Location } from "@/components/sections/location";
import { Modalities } from "@/components/sections/modalities";
import { QuickActions } from "@/components/sections/quick-actions";
import {
  getPublicCarousel,
  getPublicExams,
  getPublicInstitutionalContent,
  getPublicPartners,
  getPublicSchedulingSettings,
} from "@/lib/cms/public-content";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "INNEURO | Diagnóstico por Imagem em Macapá",
  description:
    "Conheça exames, preparos, convênios e canais oficiais da INNEURO em Macapá, Amapá.",
  path: "/",
});

export default async function Home() {
  const [highlights, partners, examContent, scheduling, institutional] =
    await Promise.all([
      getPublicCarousel(),
      getPublicPartners(),
      getPublicExams(),
      getPublicSchedulingSettings(),
      getPublicInstitutionalContent(),
    ]);
  return (
    <main id="main-content" tabIndex={-1}>
      <Hero patientPortalUrl={institutional.config.patientPortal.url} />
      {highlights.length ? (
        <CompanyHighlightsSection items={highlights} />
      ) : null}
      <QuickActions />
      <Modalities items={examContent.modalities} showAllLink />
      <Insurance
        partners={partners}
        whatsappNumber={institutional.config.whatsapp.primary.number}
      />
      <Differentials />
      <Location config={institutional.config} scheduling={scheduling} />
      <FinalSchedulingCta
        whatsappNumber={institutional.config.whatsapp.primary.number}
      />
    </main>
  );
}
