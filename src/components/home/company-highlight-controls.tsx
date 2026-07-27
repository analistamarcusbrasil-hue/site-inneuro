import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

type CompanyHighlightControlsProps = {
  active: number;
  total: number;
  paused: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPauseToggle: () => void;
  onSelect: (index: number) => void;
  variant?: "section" | "hero";
};

export function CompanyHighlightControls({
  active,
  total,
  paused,
  onPrevious,
  onNext,
  onPauseToggle,
  onSelect,
  variant = "section",
}: CompanyHighlightControlsProps) {
  const compact = variant === "hero";
  return (
    <div
      className={`flex flex-wrap items-center justify-between ${compact ? "mt-3 gap-2 rounded-2xl bg-white/92 p-2.5 shadow-[0_10px_30px_rgba(3,37,27,.12)] backdrop-blur" : "mt-5 gap-4"}`}
    >
      <p className="text-muted px-1 text-sm font-semibold tabular-nums">
        <span className="sr-only">Slide </span>
        {active + 1} de {total}
      </p>

      <div className="flex items-center gap-2" aria-label="Selecionar slide">
        {Array.from({ length: total }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Ir para o slide ${index + 1}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => onSelect(index)}
            className="group focus-visible:outline-brand grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span
              className={`h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none ${
                index === active
                  ? compact
                    ? "bg-tech w-6"
                    : "bg-brand w-7"
                  : "bg-border-light w-2"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPauseToggle}
          aria-label={
            paused
              ? "Retomar reprodução automática"
              : "Pausar reprodução automática"
          }
          className={`border-border-light text-brand focus-visible:outline-brand grid place-items-center rounded-full border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "size-10" : "size-12"}`}
        >
          {paused ? (
            <Play aria-hidden="true" size={19} />
          ) : (
            <Pause aria-hidden="true" size={19} />
          )}
        </button>
        <button
          type="button"
          onClick={onPrevious}
          aria-label="Imagem anterior"
          className={`border-border-light text-brand focus-visible:outline-brand grid place-items-center rounded-full border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "size-10" : "size-12"}`}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Próxima imagem"
          className={`bg-brand focus-visible:outline-brand grid place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "size-10" : "size-12"}`}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
