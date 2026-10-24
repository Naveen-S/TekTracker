"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { jqlUrl } from "@/lib/security/jql.mjs";

/**
 * Open + in progress by vulnerability as a donut + linked legend (Naveen 2026-10-20: "donut or better
 * visual representation"). The artifact drew a doughnut too. One label usually dominates, which a
 * share chart shows at a glance; the legend carries the exact count + % so nothing is read off an
 * angle. Hover a slice or a legend row to link the two (the centre then names it); click either to
 * open exactly those issues in Jira.
 *
 * Colours: the artifact's own doughnut palette in RANK order (the list is already sorted by count),
 * with "Others" always neutral. Slices are separated by a small angular gap (dataviz spacer rule).
 */
const FILLS = [
  { fill: "fill-sec-blue", bg: "bg-sec-blue" },
  { fill: "fill-sec-purple", bg: "bg-sec-purple" },
  { fill: "fill-sec-pink", bg: "bg-sec-pink" },
  { fill: "fill-sec-orange", bg: "bg-sec-orange" },
  { fill: "fill-sec-amber", bg: "bg-sec-amber" },
  { fill: "fill-sec-blue-light", bg: "bg-sec-blue-light" },
  { fill: "fill-sec-purple-light", bg: "bg-sec-purple-light" },
  { fill: "fill-sec-pink-light", bg: "bg-sec-pink-light" },
  { fill: "fill-sec-orange-light", bg: "bg-sec-orange-light" },
  { fill: "fill-sec-amber-light", bg: "bg-sec-amber-light" },
];
const OTHERS = { fill: "fill-sec-others", bg: "bg-sec-others" };

const SIZE = 220;
const R_OUTER = 104;
const R_INNER = 66;
const GAP = 0.012; // radians between slices

/**
 * Rounded to 2 dp: Math.sin/cos can differ in the last ulp between Node (server render) and the
 * browser, and an unrounded path `d` then fails hydration.
 */
const round2 = (value) => Math.round(value * 100) / 100;

function point(radius, angle) {
  return [round2(SIZE / 2 + radius * Math.sin(angle)), round2(SIZE / 2 - radius * Math.cos(angle))];
}

/** An annular sector from angle a0 to a1 (clockwise from 12 o'clock). */
function arcPath(a0, a1, grow = 0) {
  const outer = R_OUTER + grow;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = point(outer, a0);
  const [x1, y1] = point(outer, a1);
  const [x2, y2] = point(R_INNER, a1);
  const [x3, y3] = point(R_INNER, a0);
  return `M ${x0} ${y0} A ${outer} ${outer} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x3} ${y3} Z`;
}

export function VulnDonut({ entries, total, jiraBaseUrl }) {
  const [active, setActive] = useState(null);
  const palette = entries.map((entry, index) => (entry.others ? OTHERS : FILLS[index % FILLS.length]));
  const slices = [];
  let start = 0;
  for (const [index, entry] of entries.entries()) {
    const sweep = total ? (entry.count / total) * Math.PI * 2 : 0;
    const single = entries.length === 1;
    slices.push({ index, a0: start + (single ? 0 : GAP / 2), a1: start + sweep - (single ? 0.0001 : GAP / 2) });
    start += sweep;
  }
  const pct = (count) => (total ? Math.round((count * 1000) / total) / 10 : 0);
  const focus = active === null ? null : entries[active];

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div className="relative shrink-0">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${total} open + in progress items by vulnerability label`}>
          {slices.map(({ index, a0, a1 }) => {
            const entry = entries[index];
            const href = jqlUrl(jiraBaseUrl, entry.jql);
            const path = (
              <path
                d={arcPath(a0, a1, active === index ? 6 : 0)}
                className={cn(palette[index].fill, "transition-opacity duration-150", active !== null && active !== index && "opacity-35")}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${entry.label}: ${entry.count} (${pct(entry.count)}%)`}</title>
              </path>
            );
            return href ? (
              <a key={entry.label} href={href} target="_blank" rel="noopener noreferrer" onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
                {path}
              </a>
            ) : (
              <g key={entry.label}>{path}</g>
            );
          })}
        </svg>
        {/* Centre label: the total, or the hovered slice. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
          {focus ? (
            <>
              <span className="text-2xl leading-none font-extrabold text-sec-ink tabular-nums">{focus.count}</span>
              <span className="mt-1 text-xs font-bold text-sec-accent">{pct(focus.count)}%</span>
              <span className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-sec-muted">{focus.label}</span>
            </>
          ) : (
            <>
              <span className="text-3xl leading-none font-extrabold text-sec-ink tabular-nums">{total}</span>
              <span className="mt-1 text-[11px] leading-tight text-sec-muted">open + in progress</span>
            </>
          )}
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-col gap-0.5">
        {entries.map((entry, index) => {
          const href = jqlUrl(jiraBaseUrl, entry.jql);
          const row = (
            <>
              <span className={cn("size-3 shrink-0 rounded-[3px]", palette[index].bg)} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate" title={entry.label}>{entry.label}</span>
              <span className="font-bold text-sec-ink tabular-nums">{entry.count}</span>
              <span className="w-11 text-right text-sec-muted tabular-nums">{pct(entry.count)}%</span>
            </>
          );
          const rowClass = cn(
            "flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-sec-body transition-colors",
            active === index ? "bg-sec-lavender" : "hover:bg-sec-lavender-soft",
          );
          return (
            <li key={entry.label} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}>
              {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" title="Open these issues in Jira" className={rowClass} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
                  {row}
                </a>
              ) : (
                <span className={rowClass}>{row}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
