"use client";

import {
  CalendarCheck,
  ExternalLink,
  FileCheck2,
  ScanLine,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";
import { patientJourney } from "@/data/patient-journey";
import type { JourneyIcon } from "@/types/patient-journey";

const icons: Record<JourneyIcon, LucideIcon> = {
  send: Send,
  schedule: CalendarCheck,
  exam: ScanLine,
  result: FileCheck2,
};

export function PatientJourney() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="journey-title"
      className="bg-brand-dark overflow-hidden py-18 text-white sm:py-22 lg:py-28"
    >
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Badge className="text-mint border-white/14 bg-white/8">
            Sua jornada
          </Badge>
          <h2
            id="journey-title"
            className="font-heading mt-5 text-3xl leading-tight font-semibold tracking-[-0.045em] sm:text-4xl lg:text-5xl"
          >
            Um caminho claro em cada etapa.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/65">
            Do envio do pedido ao acesso aos resultados, acompanhe a jornada
            básica do paciente.
          </p>
        </div>

        <div className="relative mt-14">
          <span
            className="from-tech/20 via-tech/65 to-tech/20 absolute top-7 right-[12.5%] left-[12.5%] hidden h-px bg-gradient-to-r lg:block"
            aria-hidden="true"
          />
          <span
            className="from-tech/60 via-tech/35 absolute top-7 bottom-7 left-7 w-px bg-gradient-to-b to-transparent lg:hidden"
            aria-hidden="true"
          />
          <ol
            className="relative grid gap-8 lg:grid-cols-4 lg:gap-5"
            data-visible={isVisible}
          >
            {patientJourney.map((step, index) => {
              const Icon = icons[step.icon];
              return (
                <li
                  key={step.number}
                  className="journey-step relative flex gap-5 lg:block"
                  style={
                    { "--journey-delay": `${index * 90}ms` } as CSSProperties
                  }
                >
                  <span className="border-tech/45 bg-brand-dark font-heading text-tech relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border text-lg font-bold shadow-[0_0_0_7px_#03251B]">
                    <span className="sr-only">Etapa </span>
                    {step.number}
                  </span>
                  <div className="min-w-0 flex-1 rounded-3xl border border-white/10 bg-white/5 p-6 lg:mt-8 lg:min-h-64">
                    <Icon
                      aria-hidden="true"
                      className="text-tech"
                      size={21}
                      strokeWidth={1.7}
                    />
                    <h3 className="font-heading mt-5 text-xl font-semibold tracking-[-0.025em]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/62">
                      {step.description}
                    </p>
                    {step.number === 4 && (
                      <div className="mt-6">
                        {siteConfig.patientPortal.url ? (
                          <a
                            href={siteConfig.patientPortal.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Acessar exames e resultados — abre em uma nova aba"
                            className="bg-tech text-brand-dark hover:bg-mint focus-visible:ring-tech focus-visible:ring-offset-brand-dark inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                          >
                            Acessar exames e resultados
                            <ExternalLink aria-hidden="true" size={15} />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            title="Portal de Exames indisponível no momento"
                            className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-2 rounded-full border border-white/12 px-5 text-sm font-bold text-white/40"
                          >
                            Acessar exames e resultados
                            <ExternalLink aria-hidden="true" size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </Container>
    </section>
  );
}
