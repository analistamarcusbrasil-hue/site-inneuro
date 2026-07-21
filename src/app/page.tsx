import { Differentials } from "@/components/sections/differentials";
import { Faq } from "@/components/sections/faq";
import { Hero } from "@/components/sections/hero";
import { Insurance } from "@/components/sections/insurance";
import { Modalities } from "@/components/sections/modalities";
import { Location } from "@/components/sections/location";
import { PatientJourney } from "@/components/sections/patient-journey";
import { PatientPortal } from "@/components/sections/patient-portal";
import { QuickActions } from "@/components/sections/quick-actions";
import { Scheduling } from "@/components/sections/scheduling";
import { ServiceOverview } from "@/components/sections/service-overview";

export default function Home() {
  return (
    <main id="main-content" tabIndex={-1}>
      <Hero />
      <QuickActions />
      <Modalities />
      <PatientJourney />
      <PatientPortal />
      <Differentials />
      <Insurance />
      <ServiceOverview />
      <Location />
      <Faq />
      <Scheduling />
    </main>
  );
}
