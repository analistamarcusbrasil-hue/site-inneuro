import { ArrowRight, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { modalities } from "@/data/modalidades";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Sobre a INNEURO | Instituto de Neurologia do Amapá",
  description: "Conheça as modalidades apresentadas pela INNEURO em Macapá.",
  path: "/sobre",
  index: false,
});

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Sobre a INNEURO"
        title="Tecnologia, precisão e cuidado."
        description="Conheça a estrutura preparada para apresentar a identidade institucional da INNEURO."
      />
      <section className="bg-surface py-16 sm:py-20 lg:py-28">
        <Container>
          <section className="bg-brand-dark rounded-[2rem] p-8 text-white sm:p-10">
            <h2 className="font-heading text-3xl font-semibold">
              Modalidades oferecidas
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {modalities
                .filter((item) => item.active)
                .map((item) => (
                  <li
                    key={item.slug}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/72"
                  >
                    {item.name}
                  </li>
                ))}
            </ul>
          </section>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/contato"
              className="border-brand/25 text-brand-dark inline-flex min-h-12 items-center gap-2 rounded-full border px-6 text-sm font-bold"
            >
              Entrar em contato <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link
              href="/#agendamento"
              className="bg-brand inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-white"
            >
              <CalendarPlus aria-hidden="true" size={17} /> Agendar exame
            </Link>
          </div>
        </Container>
      </section>
    </main>
  );
}
