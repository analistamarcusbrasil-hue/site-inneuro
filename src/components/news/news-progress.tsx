export function NewsProgress({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div
      className="flex items-center gap-3"
      aria-label={`Destaque ${current + 1} de ${total}`}
    >
      <span className="text-sm font-bold tabular-nums">
        {String(current + 1).padStart(2, "0")}
      </span>
      <span
        className="bg-border-light h-px w-16 overflow-hidden"
        aria-hidden="true"
      >
        <span
          className="bg-brand block h-full transition-[width] duration-500"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </span>
      <span className="text-muted text-sm tabular-nums">
        {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}
