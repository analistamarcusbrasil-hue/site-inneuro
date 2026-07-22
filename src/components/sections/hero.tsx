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
      className="hero-shell bg-brand-dark relative min-h-[700px] overflow-hidden pt-20 text-white sm:min-h-[760px] sm:pt-24 lg:min-h-[clamp(560px,68vh,720px)]"
    >
      <div
        className="hero-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <div className="hero-halo" aria-hidden="true" />
      <Container className="relative grid min-h-[620px] items-center gap-8 pt-12 pb-12 sm:min-h-[660px] sm:pt-14 sm:pb-14 lg:min-h-[calc(clamp(560px,68vh,720px)-6rem)] lg:grid-cols-[1.04fr_.96fr] lg:gap-6 lg:py-8 xl:gap-10">
        <div className="hero-content mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
          <Badge className="text-mint border-white/15 bg-white/8">
            Diagnóstico com propósito
          </Badge>
          <h1
            id="hero-title"
            className="hero-title font-heading mt-6 max-w-3xl text-[clamp(3.15rem,6vw,5.5rem)] leading-[0.92] font-semibold tracking-[-0.065em]"
          >
            Tecnologia que <span className="text-tech">enxerga além.</span>
          </h1>
          <p className="hero-copy mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/72 sm:text-xl lg:mx-0">
            Diagnóstico por imagem com precisão, confiança e cuidado em cada
            etapa.
          </p>

          <div className="hero-actions mt-7 flex flex-col justify-center gap-3 min-[440px]:flex-row lg:justify-start">
            <Link
              href="/#agendamento"
              className="bg-tech text-brand-dark hover:bg-mint focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-7 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <CalendarCheck aria-hidden="true" size={19} />
              Agendar meu exame
            </Link>
            {siteConfig.patientPortal.url ? (
              <a
                href={siteConfig.patientPortal.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Acessar exames e resultados — abre em uma nova aba"
                className="focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-white/24 bg-white/4 px-7 text-base font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Acessar exames e resultados{" "}
                <ExternalLink aria-hidden="true" size={17} />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Portal de Exames indisponível no momento"
                className="inline-flex min-h-13 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-white/14 bg-white/3 px-7 text-base font-bold text-white/42"
              >
                Acessar exames e resultados{" "}
                <ExternalLink aria-hidden="true" size={17} />
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
              Acesse seus laudos, imagens e exames anteriores pelo Portal de
              Exames da INNEURO.
            </p>
          </div>
        </div>

        <div className="hero-visual-entry mx-auto flex w-full max-w-[480px] items-center justify-center lg:mr-0 lg:justify-end">
          <ScanVisual />
        </div>
      </Container>
      <div className="hero-edge" aria-hidden="true" />
    </section>
  );
}
