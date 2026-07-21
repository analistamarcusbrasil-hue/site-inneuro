import Image from "next/image";
import Link from "next/link";
import type { HealthPartner } from "@/data/health-partners";

export function PartnerLogoCard({ partner }: { partner: HealthPartner }) {
  return (
    <li className="border-border-light group hover:border-brand/30 flex min-h-36 flex-col items-center justify-center rounded-3xl border bg-white p-5 text-center transition-colors">
      <Link
        href="/#agendamento"
        aria-label={`Consultar atendimento para ${partner.name}`}
        className="flex min-h-24 w-full flex-col items-center justify-center gap-3 rounded-2xl"
      >
        {partner.logo && partner.logoStatus === "official" ? (
          <Image
            src={partner.logo}
            alt={`Logo ${partner.name}`}
            width={180}
            height={76}
            sizes="180px"
            className="max-h-16 max-w-[85%] object-contain"
          />
        ) : (
          <span className="font-heading text-brand-dark text-lg font-bold">
            {partner.name}
          </span>
        )}
        <span className="text-muted text-[.68rem] font-bold tracking-[.12em] uppercase">
          {partner.category === "parceria" ? "Parceria" : "Convênio"}
        </span>
      </Link>
    </li>
  );
}
