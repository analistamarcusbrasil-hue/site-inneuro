import { ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { clinicalServices } from "@/data/clinical-services";

const summaries: Record<string, string> = {
  "tomografia-computadorizada": "Sem contraste: ordem de chegada.",
  "ressonancia-magnetica": "Atendimento por agendamento.",
  "raios-x": "Ordem de chegada.",
  "mapeamento-cerebral": "Consulte horários e preparo.",
};
export function ServiceOverview() {
  return (
    <section
      className="bg-surface py-16 sm:py-20 lg:py-24"
      aria-labelledby="service-overview-title"
    >
      <Container>
        <p className="text-brand text-xs font-bold tracking-[.14em] uppercase">
          Atendimento por modalidade
        </p>
        <h2
          id="service-overview-title"
          className="font-heading text-ink mt-4 max-w-2xl text-3xl font-semibold sm:text-4xl"
        >
          Horários e formas de atendimento em um resumo claro.
        </h2>
        <div className="mt-9 grid gap-5 md:grid-cols-2">
          {clinicalServices.map((service) => (
            <article
              key={service.slug}
              className="border-border-light rounded-3xl border bg-white p-7"
            >
              <CalendarClock aria-hidden="true" className="text-brand" />
              <h3 className="font-heading text-ink mt-5 text-xl font-semibold">
                {service.name}
              </h3>
              <p className="text-muted mt-3">{summaries[service.slug]}</p>
              <div className="mt-6 flex flex-wrap gap-4">
                <Link
                  href={`/preparos/${service.slug}`}
                  className="text-brand inline-flex min-h-11 items-center gap-2 text-sm font-bold"
                >
                  Horários e preparo <ArrowRight aria-hidden="true" size={16} />
                </Link>
                {service.slug === "ressonancia-magnetica" && (
                  <Link
                    href="/#agendamento"
                    className="text-brand inline-flex min-h-11 items-center text-sm font-bold"
                  >
                    Solicitar agendamento
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
