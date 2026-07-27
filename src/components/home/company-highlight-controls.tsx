import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";

type CompanyHighlightControlsProps = {
  active: number;
  total: number;
  paused: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPauseToggle: () => void;
  onSelect: (index: number) => void;
};

export function CompanyHighlightControls({
  active,
  total,
  paused,
  onPrevious,
  onNext,
  onPauseToggle,
  onSelect,
}: CompanyHighlightControlsProps) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
      <p className="text-muted text-sm font-semibold tabular-nums">
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
                index === active ? "bg-brand w-7" : "bg-border-light w-2"
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
          className="border-border-light text-brand focus-visible:outline-brand grid size-12 place-items-center rounded-full border bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
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
          className="border-border-light text-brand focus-visible:outline-brand grid size-12 place-items-center rounded-full border bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Próxima imagem"
          className="bg-brand focus-visible:outline-brand grid size-12 place-items-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
