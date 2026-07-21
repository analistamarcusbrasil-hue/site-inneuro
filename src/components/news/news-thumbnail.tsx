import type { NewsHighlight } from "@/types/news";

export function NewsThumbnail({
  item,
  active,
  onSelect,
  index,
}: {
  item: NewsHighlight;
  active: boolean;
  onSelect: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className="border-border-light hover:border-brand/40 data-[active=true]:border-brand data-[active=true]:bg-mint/35 min-h-24 w-full rounded-2xl border bg-white p-4 text-left transition-colors"
      data-active={active}
    >
      <span className="text-brand text-[.68rem] font-bold tracking-[.12em] uppercase">
        {String(index + 1).padStart(2, "0")} · {item.category}
      </span>
      <span className="font-heading text-ink mt-2 line-clamp-2 block font-semibold">
        {item.title}
      </span>
    </button>
  );
}
