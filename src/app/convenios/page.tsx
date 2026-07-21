import type { Metadata } from "next";
import Image from "next/image";
import { Container } from "@/components/layout/container";
import { InternalHero } from "@/components/layout/internal-hero";
import { convenios } from "@/data/convenios";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Convênios | INNEURO",
  description: "Convênios confirmados pela INNEURO.",
  alternates: siteConfig.url
    ? { canonical: `${siteConfig.url}/convenios` }
    : undefined,
};
export default function InsurancePage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Convênios"
        title="Convênios confirmados pela INNEURO."
        description="Consulte as condições do seu plano antes do exame."
      />
      <section className="bg-surface py-16 sm:py-20 lg:py-24">
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {convenios
              .filter((item) => item.active)
              .map((item) => (
                <li
                  key={item.id}
                  className="border-border-light grid min-h-32 place-items-center rounded-3xl border bg-white p-6"
                >
                  {item.logo ? (
                    <Image
                      src={item.logo}
                      alt={`Logo ${item.name}`}
                      width={160}
                      height={70}
                      className="max-h-16 w-auto object-contain"
                    />
                  ) : (
                    <span className="font-heading text-brand-dark text-center text-lg font-bold">
                      {item.name}
                    </span>
                  )}
                </li>
              ))}
          </ul>
          <div className="border-warning/25 mt-8 rounded-3xl border bg-white p-6 text-sm leading-relaxed">
            A cobertura e a necessidade de autorização podem variar conforme o
            plano e o exame. Confirme as condições com nossa equipe.
          </div>
        </Container>
      </section>
    </main>
  );
}
