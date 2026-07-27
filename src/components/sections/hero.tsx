import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { ScanVisual } from "@/components/brand/scan-visual";
import { CompanyHighlightsCarousel } from "@/components/home/company-highlights-carousel";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import type { CompanyHighlight } from "@/types/company-highlight";

export function Hero({ highlights }: { highlights: CompanyHighlight[] }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="hero-shell relative overflow-hidden bg-[linear-gradient(155deg,#03251b_0%,#064b36_62%,#16805a_100%)] pt-20 text-white md:min-h-[clamp(560px,68vh,660px)] md:bg-[linear-gradient(105deg,#03251b_0%,#043d2d_44%,#0b6847_72%,#72ba9b_115%)] xl:pt-24"
    >
      <div className="hero-halo opacity-45" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_58%_50%,rgba(33,199,122,.16),transparent_28%),radial-gradient(circle_at_94%_18%,rgba(218,247,232,.3),transparent_34%)]"
      />
      <Container className="relative grid items-center gap-8 py-10 sm:py-12 md:min-h-[calc(clamp(560px,68vh,660px)-5rem)] md:grid-cols-2 md:gap-3 md:py-5 lg:grid-cols-[.96fr_1.04fr] lg:gap-2 xl:min-h-[calc(clamp(560px,68vh,660px)-6rem)] xl:grid-cols-[.94fr_1.06fr] xl:gap-0">
        <div className="hero-content relative mx-auto max-w-3xl text-center md:mx-0 md:text-left">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 z-0 w-[min(88vw,430px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.07] sm:w-[460px] md:left-[48%] md:w-[520px] md:opacity-[0.08] lg:w-[570px]"
          >
            <ScanVisual />
          </div>
          <div className="relative z-[1]">
            <Badge className="text-mint border-white/15 bg-white/8">
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
        </div>

        <div className="hero-visual-entry relative z-[1] mx-auto w-full max-w-[590px] md:-ml-4 md:w-[calc(100%+1rem)] md:max-w-none lg:-ml-8 lg:w-[calc(100%+2rem)]">
          <CompanyHighlightsCarousel items={highlights} variant="hero" />
        </div>
      </Container>
    </section>
  );
}
