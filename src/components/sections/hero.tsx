import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { ScanVisual } from "@/components/brand/scan-visual";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="hero-shell relative overflow-hidden bg-[linear-gradient(120deg,#03251b_0%,#043d2d_58%,#0b6847_100%)] pt-20 text-white md:min-h-[clamp(340px,42vh,460px)] xl:pt-24"
    >
      <div className="hero-halo opacity-25" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_48%,rgba(33,199,122,.1),transparent_32%),radial-gradient(circle_at_96%_10%,rgba(218,247,232,.08),transparent_28%)]"
      />
      <Container className="relative grid items-center gap-4 py-7 sm:py-8 md:min-h-[calc(clamp(340px,42vh,460px)-5rem)] md:grid-cols-[1.08fr_.92fr] md:gap-5 md:py-3 xl:min-h-[calc(clamp(340px,42vh,460px)-6rem)] xl:gap-8 xl:py-2">
        <div className="hero-content relative z-[1] mx-auto max-w-3xl text-center md:mx-0 md:text-left">
          <Badge className="text-mint border-transparent bg-white/8">
            Diagnóstico com propósito
          </Badge>
          <h1
            id="hero-title"
            className="hero-title font-heading mt-3 max-w-3xl text-[clamp(2.35rem,4.2vw,3.65rem)] leading-[0.96] font-semibold tracking-[-0.055em]"
          >
            Tecnologia que <span className="text-tech">enxerga além.</span>
          </h1>
          <p className="hero-copy mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/74 sm:text-lg md:mx-0">
            Diagnóstico por imagem com precisão, confiança e cuidado em cada
            etapa.
          </p>

          <div className="hero-actions mt-4 flex flex-col justify-center gap-3 min-[440px]:flex-row md:justify-start">
            <Link
              href="/contato#agendamento"
              className="bg-tech text-brand-dark hover:bg-mint focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <CalendarCheck aria-hidden="true" size={19} />
              Agendar meu exame
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="hero-visual-entry pointer-events-none absolute right-[-18%] bottom-[-42%] w-[min(72vw,280px)] opacity-[0.1] sm:right-[-8%] sm:bottom-[-32%] sm:w-[300px] md:static md:mx-auto md:w-full md:max-w-[240px] md:opacity-45 lg:mr-0 lg:max-w-[270px] xl:max-w-[290px]"
        >
          <ScanVisual />
        </div>
      </Container>
    </section>
  );
}
