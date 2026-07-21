import { PartnerLogoCard } from "./partner-logo-card";
import { activeHealthPartners } from "@/data/health-partners";

export function PartnersShowcase() {
  const convenios = activeHealthPartners.filter(
    (item) => item.category === "convenio",
  );
  const parcerias = activeHealthPartners.filter(
    (item) => item.category === "parceria",
  );
  return (
    <div className="space-y-10">
      <div>
        <h3 className="font-heading text-ink text-xl font-semibold">
          Convênios
        </h3>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {convenios.map((item) => (
            <PartnerLogoCard key={item.id} partner={item} />
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-heading text-ink text-xl font-semibold">
          Parcerias
        </h3>
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {parcerias.map((item) => (
            <PartnerLogoCard key={item.id} partner={item} />
          ))}
        </ul>
      </div>
    </div>
  );
}
