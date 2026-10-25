"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A sliding "selected" pill for segmented toggles (Segmented, the roll-up scoreboard view toggle, the
 * /bugs scope toggle): instead of the highlight jumping between options it glides to the new one in
 * 200ms. The container is the `group/slide`; the active option carries `data-active="true"`.
 *
 * Positioned imperatively from a layout effect (no state, so no extra render and no
 * `set-state-in-effect`). Until the first measurement — SSR and the first paint — the active option
 * keeps its own background (`SLIDE_ACTIVE_FALLBACK`), so nothing flashes before hydration; once
 * placed, the container gets `data-slide` and the indicator takes over. The transition is switched
 * on one frame AFTER the first placement, so the pill never slides in from the left edge on load,
 * and it is `motion-safe` only — with reduced motion the pill moves instantly.
 */
export function useSlidingIndicator(activeKey) {
  const containerRef = useRef(null);
  const indicatorRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    if (!container || !indicator) return undefined;

    const place = () => {
      const active = container.querySelector('[data-active="true"]');
      if (!active) {
        delete container.dataset.slide;
        return;
      }
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.height = `${active.offsetHeight}px`;
      indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      if (!container.dataset.slide) {
        container.dataset.slide = "placed";
        requestAnimationFrame(() => {
          if (container.dataset.slide) container.dataset.slide = "ready";
        });
      }
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeKey]);

  return { containerRef, indicatorRef };
}

/** The active option's own look before the indicator is placed; dropped once it is. */
export const SLIDE_ACTIVE_FALLBACK =
  "group-data-[slide]/slide:bg-transparent group-data-[slide]/slide:shadow-none group-data-[slide]/slide:ring-0";

/** The pill itself — pass the active option's look (background, shadow, radius) as `className`. */
export function SlidingIndicator({ indicatorRef, className }) {
  return (
    <span
      ref={indicatorRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 left-0 opacity-0 group-data-[slide]/slide:opacity-100",
        "motion-safe:group-data-[slide=ready]/slide:transition-[transform,width] motion-safe:group-data-[slide=ready]/slide:duration-200 motion-safe:group-data-[slide=ready]/slide:ease-out",
        className,
      )}
    />
  );
}
