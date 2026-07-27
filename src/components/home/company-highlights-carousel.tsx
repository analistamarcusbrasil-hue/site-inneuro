"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CompanyHighlight } from "@/types/company-highlight";
import { CompanyHighlightControls } from "./company-highlight-controls";
import { CompanyHighlightSlide } from "./company-highlight-slide";

const AUTOPLAY_INTERVAL = 7000;
const SWIPE_THRESHOLD = 45;

export function CompanyHighlightsCarousel({
  items,
}: {
  items: CompanyHighlight[];
}) {
  const [active, setActive] = useState(0);
  const [manualPause, setManualPause] = useState(false);
  const [interactionPause, setInteractionPause] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(true);
  const pointerStartX = useRef<number | null>(null);

  const select = useCallback(
    (index: number) => {
      if (!items.length) return;
      setActive((index + items.length) % items.length);
    },
    [items.length],
  );

  const interact = useCallback(
    (index: number) => {
      setManualPause(true);
      select(index);
    },
    [select],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  const paused =
    manualPause ||
    interactionPause ||
    pageHidden ||
    reducedMotion ||
    items.length < 2;

  useEffect(() => {
    if (paused) return;
    const interval = window.setInterval(() => {
      setActive((current) => (current + 1) % items.length);
    }, AUTOPLAY_INTERVAL);
    return () => window.clearInterval(interval);
  }, [items.length, paused]);

  if (!items.length) return null;

  return (
    <div
      role="region"
      aria-roledescription="carrossel"
      aria-label="Destaques da INNEURO"
      tabIndex={0}
      onMouseEnter={() => setInteractionPause(true)}
      onMouseLeave={() => setInteractionPause(false)}
      onFocusCapture={() => setInteractionPause(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setInteractionPause(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          interact(active - 1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          interact(active + 1);
        }
      }}
      onPointerDown={(event) => {
        pointerStartX.current = event.clientX;
        setInteractionPause(true);
      }}
      onPointerUp={(event) => {
        if (pointerStartX.current !== null) {
          const delta = event.clientX - pointerStartX.current;
          if (Math.abs(delta) >= SWIPE_THRESHOLD) {
            interact(active + (delta < 0 ? 1 : -1));
          }
        }
        pointerStartX.current = null;
        setInteractionPause(false);
      }}
      onPointerCancel={() => {
        pointerStartX.current = null;
        setInteractionPause(false);
      }}
      className="focus-visible:outline-brand touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <CompanyHighlightSlide
        item={items[active]}
        position={active + 1}
        total={items.length}
        priority={active === 0}
      />
      {items.length > 1 ? (
        <CompanyHighlightControls
          active={active}
          total={items.length}
          paused={manualPause || reducedMotion}
          onPrevious={() => interact(active - 1)}
          onNext={() => interact(active + 1)}
          onPauseToggle={() => setManualPause((current) => !current)}
          onSelect={interact}
        />
      ) : null}
    </div>
  );
}
