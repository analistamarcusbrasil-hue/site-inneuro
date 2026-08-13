import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Convenio } from "@/types/convenio";

export function PartnerLogoCard({
  partner,
  variant = "compact",
}: {
  partner: Convenio;
  variant?: "compact" | "detailed";
}) {
  const hasLogo = partner.logo && partner.logoStatus !== "pending";
  const isDetailed = variant === "detailed";

  return (
    <li
      className={cn(
        "border-brand/10 group hover:border-brand/30 flex flex-col items-center justify-center rounded-3xl border p-5 text-center shadow-[0_12px_35px_rgba(3,37,27,0.04)] transition-colors",
        isDetailed ? "min-h-44 bg-white" : "min-h-36 bg-white/75",
      )}
    >
      <Link
        href="/contato#pre-agendamento"
        aria-label={`Consultar atendimento para ${partner.name}`}
        className={cn(
          "focus-visible:ring-brand flex w-full flex-col items-center justify-center gap-3 rounded-2xl focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none",
          isDetailed ? "min-h-32" : "min-h-24",
        )}
      >
        {hasLogo ? (
          <Image
            src={partner.logo!}
            alt={partner.logoAlt ?? `Logo ${partner.name}`}
            width={isDetailed ? 240 : 180}
            height={isDetailed ? 120 : 76}
            sizes={
              isDetailed
                ? "(max-width: 379px) 240px, (max-width: 767px) 42vw, (max-width: 1279px) 28vw, 240px"
                : "180px"
            }
            className={cn(
              "object-contain",
              isDetailed
                ? "h-auto max-h-24 w-full max-w-60"
                : "max-h-16 max-w-[82%]",
            )}
          />
        ) : !isDetailed ? (
          <span className="font-heading text-brand-dark text-lg font-bold">
            {partner.name}
          </span>
        ) : null}
        {isDetailed ? (
          <span className="text-brand-dark text-sm font-bold sm:text-base">
            {partner.name}
          </span>
        ) : (
          <span className="text-muted text-[0.68rem] font-bold tracking-[0.12em] uppercase">
            {partner.category === "parceria" ? "Parceria" : "Convênio"}
          </span>
        )}
      </Link>
    </li>
  );
}
