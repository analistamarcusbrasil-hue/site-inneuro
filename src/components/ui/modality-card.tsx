import {
  ArrowRight,
  Atom,
  BrainCircuit,
  CalendarPlus,
  Magnet,
  Orbit,
  Radiation,
  ScanLine,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Modality, ModalityIcon } from "@/types/modality";

const icons: Record<ModalityIcon, LucideIcon> = {
  "magnetic-resonance": Magnet,
  "computed-tomography": ScanLine,
  "x-ray": Radiation,
  "nuclear-medicine": Atom,
  scintigraphy: Orbit,
  "brain-mapping": BrainCircuit,
};

type ModalityCardProps = {
  modality: Modality;
};

export function ModalityCard({ modality }: ModalityCardProps) {
  const Icon = icons[modality.icon];

  return (
    <article className="group border-border-light hover:border-brand/35 flex min-h-[430px] flex-col overflow-hidden rounded-3xl border bg-white transition-[border-color,transform] duration-300 hover:-translate-y-1 min-[440px]:min-h-[386px] md:min-h-[366px] lg:min-h-[350px]">
      <div className="border-border-light bg-brand-dark relative h-32 overflow-hidden border-b">
        <div className="modality-scan-field" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-tech grid h-14 w-14 place-items-center rounded-2xl border border-white/14 bg-white/8 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
            <Icon aria-hidden="true" size={26} strokeWidth={1.65} />
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <h3 className="font-heading text-ink text-xl font-semibold tracking-[-0.03em]">
          {modality.name}
        </h3>
        <p className="text-muted mt-3 text-sm leading-relaxed">
          {modality.shortDescription}
        </p>
        <div className="mt-auto flex flex-col gap-2 pt-7 min-[440px]:flex-row min-[440px]:flex-wrap">
          <Link
            href={`/exames?modalidade=${modality.slug}`}
            className="bg-brand hover:bg-brand-dark focus-visible:ring-tech inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Conhecer exames <ArrowRight aria-hidden="true" size={16} />
          </Link>
          <Link
            href="/#agendamento"
            aria-label={`Agendar ${modality.name}`}
            className="border-brand/22 text-brand-dark hover:bg-mint focus-visible:ring-tech inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <CalendarPlus aria-hidden="true" size={16} /> Agendar
          </Link>
        </div>
      </div>
    </article>
  );
}
