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
      className={`flex flex-wrap items-center justify-between ${compact ? "mt-2 gap-2 px-1 py-1.5" : "mt-5 gap-4"}`}
    >
      <p
        className={`px-1 text-sm font-semibold tabular-nums ${compact ? "text-white/75" : "text-muted"}`}
      >
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
                  : compact
                    ? "w-2 bg-white/28"
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
          className={`focus-visible:outline-brand grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "size-10 bg-white/12 text-white" : "border-border-light text-brand size-12 border bg-white"}`}
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
          className={`focus-visible:outline-brand grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "size-10 bg-white/12 text-white" : "border-border-light text-brand size-12 border bg-white"}`}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Próxima imagem"
          className={`focus-visible:outline-brand grid place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 ${compact ? "bg-tech text-brand-dark size-10" : "bg-brand size-12 text-white"}`}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
