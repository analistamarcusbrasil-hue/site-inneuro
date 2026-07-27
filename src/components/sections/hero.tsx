import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { ScanVisual } from "@/components/brand/scan-visual";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="hero-shell relative min-h-[clamp(540px,66vh,650px)] overflow-hidden bg-[linear-gradient(120deg,#03251b_0%,#043d2d_58%,#0b6847_100%)] pt-20 text-white xl:pt-24"
    >
      <div className="hero-halo opacity-40" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_48%,rgba(33,199,122,.16),transparent_34%),radial-gradient(circle_at_96%_10%,rgba(218,247,232,.12),transparent_30%)]"
      />
      <Container className="relative grid min-h-[calc(clamp(540px,66vh,650px)-5rem)] items-center gap-5 py-8 sm:py-10 md:grid-cols-[1.04fr_.96fr] md:gap-6 md:py-5 xl:min-h-[calc(clamp(540px,66vh,650px)-6rem)] xl:gap-10">
        <div className="hero-content relative z-[1] mx-auto max-w-3xl text-center md:mx-0 md:text-left">
          <Badge className="text-mint border-transparent bg-white/8">
            Diagnóstico com propósito
          </Badge>
          <h1
            id="hero-title"
            className="hero-title font-heading mt-5 max-w-3xl text-[clamp(2.7rem,5.2vw,4.9rem)] leading-[0.94] font-semibold tracking-[-0.06em]"
          >
            Tecnologia que <span className="text-tech">enxerga além.</span>
          </h1>
          <p className="hero-copy mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/74 sm:text-lg md:mx-0 lg:text-xl">
            Diagnóstico por imagem com precisão, confiança e cuidado em cada
            etapa.
          </p>

          <div className="hero-actions mt-6 flex flex-col justify-center gap-3 min-[440px]:flex-row md:justify-start">
            <Link
              href="/#agendamento"
              className="bg-tech text-brand-dark hover:bg-mint focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-7 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <CalendarCheck aria-hidden="true" size={19} />
              Agendar meu exame
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="hero-visual-entry pointer-events-none absolute right-[-28%] bottom-[-18%] w-[min(88vw,430px)] opacity-[0.14] sm:right-[-12%] sm:w-[480px] md:static md:mx-auto md:w-full md:max-w-[480px] md:opacity-75 lg:mr-0 lg:max-w-[520px]"
        >
          <ScanVisual />
        </div>
      </Container>
    </section>
  );
}
