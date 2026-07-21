"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import type { NewsHighlight } from "@/types/news";
import { NewsProgress } from "./news-progress";
import { NewsSlide } from "./news-slide";
import { NewsThumbnail } from "./news-thumbnail";

export function NewsCarousel({ items }: { items: NewsHighlight[] }) {
  const [active, setActive] = useState(0);
  const startX = useRef<number | null>(null);
  const select = (index: number) =>
    setActive((index + items.length) % items.length);
  if (!items.length) return null;
  return (
    <div
      role="region"
      aria-label="Carrossel de destaques da INNEURO"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") select(active - 1);
        if (event.key === "ArrowRight") select(active + 1);
      }}
      onTouchStart={(event) => {
        startX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (startX.current === null) return;
        const delta =
          (event.changedTouches[0]?.clientX ?? startX.current) - startX.current;
        if (Math.abs(delta) > 45) select(active + (delta < 0 ? 1 : -1));
        startX.current = null;
      }}
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <NewsSlide
          item={items[active]}
          position={active + 1}
          total={items.length}
          priority={active === 0}
        />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2">
            <NewsProgress current={active} total={items.length} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => select(active - 1)}
                aria-label="Destaque anterior"
                className="border-border-light grid size-12 place-items-center rounded-full border bg-white"
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => select(active + 1)}
                aria-label="Próximo destaque"
                className="bg-brand grid size-12 place-items-center rounded-full text-white"
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {items.map((item, index) => (
              <NewsThumbnail
                key={item.id}
                item={item}
                index={index}
                active={index === active}
                onSelect={() => select(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
