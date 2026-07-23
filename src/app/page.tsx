import { Differentials } from "@/components/sections/differentials";
import { Hero } from "@/components/sections/hero";
import { Insurance } from "@/components/sections/insurance";
import { Modalities } from "@/components/sections/modalities";
import { Location } from "@/components/sections/location";
import { QuickActions } from "@/components/sections/quick-actions";
import { CompanyHighlightsSection } from "@/components/home/company-highlights-section";

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Hero />
      <CompanyHighlightsSection />
      <QuickActions />
      <Modalities />
      <Differentials />
      <Insurance />
      <Location />
    </main>
  );
}
