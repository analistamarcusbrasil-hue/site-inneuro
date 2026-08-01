import {
  ArrowRight,
  BrainCircuit,
  CalendarPlus,
  MapPin,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import { InternalHero } from "@/components/layout/internal-hero";
import { Container } from "@/components/layout/container";
import { siteConfig } from "@/config/site";
import { modalities } from "@/data/modalidades";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Sobre a INNEURO | Instituto de Neurologia do Amapá",
  description:
    "Conheça a INNEURO, suas modalidades de exames e os canais de atendimento em Macapá.",
  path: "/sobre",
});

export default function AboutPage() {
  return (
    <main id="main-content" tabIndex={-1}>
      <InternalHero
        eyebrow="Sobre a INNEURO"
        title="Tecnologia, precisão e cuidado."
        description="O Instituto de Neurologia do Amapá reúne diagnóstico por imagem, neurologia e medicina nuclear em Macapá."
      />
      <section className="bg-surface pt-10 pb-16 sm:pt-12 sm:pb-20 lg:pt-14 lg:pb-28">
        <Container>
          <div className="grid gap-5 lg:grid-cols-3">
            <article className="border-border-light rounded-3xl border bg-white p-7">
              <ScanLine aria-hidden="true" className="text-brand" />
              <h2 className="font-heading text-ink mt-5 text-2xl font-semibold">
                Propósito
              </h2>
              <p className="text-muted mt-3 leading-relaxed">
                Facilitar o acesso a informações sobre exames, preparos,
                convênios e canais oficiais da INNEURO.
              </p>
            </article>
            <article className="border-border-light rounded-3xl border bg-white p-7">
              <BrainCircuit aria-hidden="true" className="text-brand" />
              <h2 className="font-heading text-ink mt-5 text-2xl font-semibold">
                Atendimento e tecnologia
              </h2>
              <p className="text-muted mt-3 leading-relaxed">
                Tecnologia, comunicação clara e acesso digital aos resultados
                apoiam a jornada de atendimento.
              </p>
            </article>
            <article className="border-border-light rounded-3xl border bg-white p-7">
              <MapPin aria-hidden="true" className="text-brand" />
              <h2 className="font-heading text-ink mt-5 text-2xl font-semibold">
                Localização
              </h2>
              <p className="text-muted mt-3 leading-relaxed">
                {siteConfig.address.formatted}
                <br />
                Referência: {siteConfig.address.reference}
              </p>
              <a
                href={siteConfig.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand mt-4 inline-flex min-h-11 items-center text-sm font-bold"
              >
                Como chegar
              </a>
            </article>
          </div>
          <section className="bg-brand-dark mt-8 rounded-[2rem] p-8 text-white sm:p-10">
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
              href="/contato#pre-agendamento"
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
