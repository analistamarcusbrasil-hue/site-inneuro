import {
  BrainCircuit,
  CircleUserRound,
  ClipboardCheck,
  FolderHeart,
  type LucideIcon,
} from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeader } from "@/components/sections/section-header";
import { differentials } from "@/data/differentials";
import type { DifferentialIcon } from "@/types/differential";

const icons: Record<DifferentialIcon, LucideIcon> = {
  technology: BrainCircuit,
  "humanized-care": CircleUserRound,
  "patient-portal": FolderHeart,
  preparations: ClipboardCheck,
};

export function Differentials() {
  return (
    <section
      aria-label="Diferenciais da INNEURO"
      className="bg-mint/45 py-16 sm:py-20 lg:py-28"
    >
      <Container>
        <SectionHeader
          eyebrow="Diferenciais"
          title="Tecnologia e cuidado organizados ao redor do paciente."
          description="Uma experiência institucional construída com informação clara, acesso digital e comunicação responsável."
        />
        <div className="mt-12 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {differentials.map((differential, index) => {
            const Icon = icons[differential.icon];
            return (
              <article
                key={differential.id}
                className="group border-brand/12 hover:border-brand/45 flex min-h-48 flex-col border-t py-7 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-brand grid h-11 w-11 place-items-center rounded-2xl bg-white">
                    <Icon aria-hidden="true" size={21} strokeWidth={1.7} />
                  </span>
                  <span className="font-heading text-brand/45 text-xs font-bold tracking-[0.12em]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-heading text-ink mt-6 text-lg font-semibold tracking-[-0.025em]">
                  {differential.title}
                </h3>
                <p className="text-muted mt-2 text-sm leading-relaxed">
                  {differential.description}
                </p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
