import { CalendarCheck, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { ScanVisual } from "@/components/brand/scan-visual";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="hero-shell bg-brand-dark relative min-h-[760px] overflow-hidden pt-24 text-white sm:min-h-[820px] lg:min-h-[800px]"
    >
      <div
        className="hero-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <div className="hero-halo" aria-hidden="true" />
      <Container className="relative grid min-h-[680px] items-center gap-10 pt-16 pb-14 sm:pt-20 sm:pb-16 lg:grid-cols-[1.04fr_.96fr] lg:gap-4 lg:pt-14 lg:pb-12 xl:min-h-[720px] xl:gap-12">
        <div className="hero-content mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
          <Badge className="text-mint border-white/15 bg-white/8">
            Diagnóstico com propósito
          </Badge>
          <h1
            id="hero-title"
            className="hero-title font-heading mt-7 max-w-3xl text-[clamp(3.15rem,7vw,7rem)] leading-[0.92] font-semibold tracking-[-0.065em]"
          >
            Tecnologia que <span className="text-tech">enxerga além.</span>
          </h1>
          <p className="hero-copy mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/72 sm:text-xl lg:mx-0">
            Diagnóstico por imagem com precisão, confiança e cuidado em cada
            etapa.
          </p>

          <div className="hero-actions mt-9 flex flex-col justify-center gap-3 min-[440px]:flex-row lg:justify-start">
            <Link
              href="/#agendamento"
              className="bg-tech text-brand-dark hover:bg-mint focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-7 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <CalendarCheck aria-hidden="true" size={19} />
              Agendar meu exame
            </Link>
            {siteConfig.patientPortalUrl ? (
              <a
                href={siteConfig.patientPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-white/24 bg-white/4 px-7 text-base font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Acessar resultados <ExternalLink aria-hidden="true" size={17} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Portal do Paciente indisponível no momento"
                className="inline-flex min-h-13 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-white/14 bg-white/3 px-7 text-base font-bold text-white/42"
              >
                Acessar resultados <ExternalLink aria-hidden="true" size={17} />
              </button>
            )}
          </div>

          <div className="hero-note mx-auto mt-6 flex max-w-md items-start justify-center gap-3 text-left text-sm leading-relaxed text-white/56 lg:mx-0 lg:justify-start">
            <FileText
              className="text-tech mt-0.5 shrink-0"
              aria-hidden="true"
              size={17}
            />
            <p>
              Laudos, imagens e histórico de exames disponíveis no Portal do
              Paciente.
            </p>
          </div>
        </div>

        <div className="hero-visual-entry flex items-center justify-center lg:justify-end">
          <ScanVisual />
        </div>
      </Container>
      <div className="hero-edge" aria-hidden="true" />
    </section>
  );
}
