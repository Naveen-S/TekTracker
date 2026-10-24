"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { smoothLinePath } from "@/lib/chart-path.mjs";

/**
 * Month-wise remediation chart (the artifact's `monthlyChart`, Naveen 2026-10-20): fixed vs new bars
 * per month plus the cumulative open backlog as a line, on ONE count axis (all three are issue
 * counts, so they share a scale honestly — no second axis). Hover or focus a month for its numbers.
 *
 * Colours are fixed by meaning, never cycled: fixed = blue, new = soft pink, backlog = orange.
 *
 * Drawn at the container’s REAL pixel width (ResizeObserver) with a fixed height, not a scaled
 * viewBox: a scaled viewBox blew text and height up ~2× on wide screens. Below MIN_W it scrolls.
 */
const H = 300;
const MIN_W = 460;
const PAD = { top: 18, right: 16, bottom: 34, left: 46 };
const INNER_H = H - PAD.top - PAD.bottom;

/** Clean axis step (1 / 2 / 2.5 / 5 × 10ⁿ). */
function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const multiple of [1, 2, 2.5, 5, 10]) if (multiple * pow >= raw) return multiple * pow;
  return 10 * pow;
}

export function ProgressChart({ monthly }) {
  const [active, setActive] = useState(null);
  const wrapRef = useRef(null);
  const [W, setW] = useState(1000); // server render + first paint; corrected on mount
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(MIN_W, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const INNER_W = W - PAD.left - PAD.right;
  const { labels, fixed, inflow, backlog } = monthly;
  const n = labels.length;

  const peak = Math.max(1, ...fixed, ...inflow, ...backlog);
  const floor = Math.min(0, ...backlog);
  const step = niceStep((peak - floor) / 5);
  const top = Math.ceil(peak / step) * step;
  const bottom = Math.floor(floor / step) * step;
  const ticks = [];
  for (let value = bottom; value <= top; value += step) ticks.push(value);

  const slot = INNER_W / n;
  const barW = Math.min(28, slot * 0.3);
  const cx = (i) => PAD.left + slot * i + slot / 2;
  const y = (value) => PAD.top + INNER_H - ((value - bottom) / (top - bottom)) * INNER_H;
  const zero = y(0);
  const linePts = backlog.map((value, i) => ({ x: cx(i), y: y(value) }));

  const tip = active === null ? null : { i: active, x: cx(active) };

  return (
    <div ref={wrapRef} className="relative">
      <div className="overflow-x-auto">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block"
          role="img"
          aria-label={`Fixed vs new vulnerabilities per month, ${labels[0]} to ${labels[n - 1]}; open backlog now ${backlog[n - 1]}`}
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((value) => (
            <g key={value}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(value)} y2={y(value)} className="stroke-sec-line" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" className="fill-sec-muted text-[12px]">
                {value}
              </text>
            </g>
          ))}

          {active !== null && (
            <rect x={PAD.left + slot * active} y={PAD.top} width={slot} height={INNER_H} rx="6" className="fill-sec-lavender-soft" />
          )}

          {labels.map((label, i) => {
            const fixedTop = y(fixed[i]);
            const newTop = y(inflow[i]);
            return (
              <g key={label}>
                <rect x={cx(i) - barW - 1.5} y={Math.min(fixedTop, zero)} width={barW} height={Math.abs(zero - fixedTop)} rx="3" className="fill-sec-blue" />
                <rect x={cx(i) + 1.5} y={Math.min(newTop, zero)} width={barW} height={Math.abs(zero - newTop)} rx="3" className="fill-sec-pink-soft" />
                {/* Narrow (half-width) charts thin the month labels so they never collide. */}
                {(slot >= 56 || i % 2 === 0 || i === n - 1 || active === i) && (
                  <text x={cx(i)} y={H - 10} textAnchor="middle" className={cn("text-[12px]", active === i ? "fill-sec-ink font-semibold" : "fill-sec-muted")}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}

          <path d={smoothLinePath(linePts)} fill="none" className="stroke-sec-orange" strokeWidth="2.5" strokeLinecap="round" />
          {linePts.map((point, i) => (
            <circle key={labels[i]} cx={point.x} cy={point.y} r={active === i ? 6 : 4} className="fill-sec-orange stroke-white" strokeWidth="2" />
          ))}

          {/* Hit targets: a whole month column, bigger than any mark; focusable for keyboard users. */}
          {labels.map((label, i) => (
            <rect
              key={label}
              x={PAD.left + slot * i}
              y={PAD.top}
              width={slot}
              height={INNER_H + PAD.bottom}
              fill="transparent"
              tabIndex={0}
              aria-label={`${label}: ${fixed[i]} fixed, ${inflow[i]} new, open backlog ${backlog[i]}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="cursor-crosshair outline-none"
            />
          ))}
        </svg>
      </div>

      {tip && (
        <div
          role="status"
          className="pointer-events-none absolute top-6 z-10 w-44 rounded-xl border border-sec-line bg-white/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm"
          // Position is data (the hovered month): beside its column, never on top of it, so the
          // bars and the backlog point being described stay visible. The one inline style.
          style={tip.x > W * 0.55 ? { right: W - tip.x + slot * 0.6 } : { left: tip.x + slot * 0.6 }}
        >
          <p className="mb-1.5 font-bold text-sec-ink">{labels[tip.i] === "earlier" ? "Before the window" : labels[tip.i]}</p>
          {[
            ["Fixed (resolved)", fixed[tip.i], "bg-sec-blue"],
            ["New (triaged in)", inflow[tip.i], "bg-sec-pink-soft"],
            ["Open backlog", backlog[tip.i], "bg-sec-orange"],
          ].map(([label, value, swatch]) => (
            <p key={label} className="flex items-center justify-between gap-3 py-0.5 text-sec-body">
              <span className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-[3px]", swatch)} aria-hidden="true" />
                {label}
              </span>
              <span className="font-bold tabular-nums">{value}</span>
            </p>
          ))}
        </div>
      )}

      <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-sec-body">
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-sec-blue" aria-hidden="true" />Fixed (resolved)</li>
        <li className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] bg-sec-pink-soft" aria-hidden="true" />New (triaged in)</li>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-sec-orange" aria-hidden="true" />Open backlog (cumulative)</li>
      </ul>
    </div>
  );
}
