import { BarChart3, Clock, Layers, TrendingUp } from "lucide-react";
import { SCOPE_TOTAL_BAND_KEY, TOTAL_ROW_KEY } from "@/lib/bug-report/matrix.mjs";
import { smoothAreaPath, smoothLinePath } from "@/lib/chart-path.mjs";
import { Panel } from "@/components/bugs/panel";

/**
 * The chart panels (gm-bug-report.md (g)4–7): trend, priority mix, category mix, ageing.
 * Hand-rolled inline SVG + CSS bars — NO charting dependency (decision 18), so every panel stays
 * a server component and the html2canvas-pro export path keeps working (the TrendPanel precedent).
 *
 * COLOUR (dataviz skill — the palette is computed in globals.css, never picked here):
 *   `--chart-cat-1/2`  categorical, series identity. Slot 1 IS the active theme's hue, so these
 *                      panels stop being Tekion-teal islands on a blue Modern page.
 *   `--age-1..4`       ordinal ramp for the age buckets — one hue, monotone lightness.
 *   `--danger`         status, reserved for SLA breach and never spent on "series 3". Age used to
 *                      wear it too, which made "old" and "past SLA" indistinguishable.
 * Every series is directly labelled and the matrix above is the table view, which is what
 * discharges the one sub-3:1 contrast WARN the validator raises on teal.
 *
 * As-built deviation from the spec's file list: (g)5–7 are three small bar panels sharing one
 * `<Bar>` primitive, so they live together here rather than in three near-identical files.
 */

/** Ordinal age ramp, oldest darkest. Literal classes so Tailwind can see them. */
const AGE_FILL = ["bg-age-1", "bg-age-2", "bg-age-3", "bg-age-4"];
const SCOPE_FILL = ["bg-chart-cat-1", "bg-chart-cat-2"];

/** Label-column widths for the shared `<Bar>` track — literal classes, no computed grid template. */
const TRACK = {
  wide: "grid-cols-[minmax(6.5rem,auto)_1fr_auto]",
  band: "grid-cols-[2.5rem_1fr_auto]",
  bucket: "grid-cols-[5rem_1fr_auto]",
};

function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={`size-2.5 rounded-[2px] ${item.fill}`} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * One horizontal bar built from ordered segments, with its value directly labelled.
 *
 * Segments are solid — the previous fill faded each bar toward white across its own length, which
 * drained density exactly where the eye lands (the value end) and is most of why these panels read
 * as washed out. Adjacent fills are separated by the 2px surface gap the mark spec asks for
 * (`gap-0.5` on the track) rather than by a border.
 */
function Bar({ label, segments, total, max, caption, under, track = TRACK.wide }) {
  return (
    <li className={`grid items-center gap-3 ${track}`}>
      <span className="truncate text-xs font-medium" title={label}>
        {label}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted">
          {segments.map((segment) =>
            segment.value <= 0 ? null : (
              <span
                key={segment.key}
                title={`${segment.title ?? segment.key}: ${segment.value}`}
                // Minimum 1.5% so a count of 1 is still a visible mark rather than a hairline.
                style={{ width: `${Math.max((segment.value / max) * 100, 1.5)}%` }}
                className={`block h-full first:rounded-l-full last:rounded-r-full ${segment.fill}`}
              />
            ),
          )}
        </span>
        {under && (
          <span className="flex h-1 overflow-hidden rounded-full bg-muted">
            {under.value > 0 && (
              <span
                title={`${under.title}: ${under.value}`}
                style={{ width: `${Math.max((under.value / max) * 100, 1.5)}%` }}
                className="block h-full rounded-full bg-danger"
              />
            )}
          </span>
        )}
      </span>
      <span className="text-xs font-bold tabular-nums">
        {total}
        {caption && <span className="ml-1 font-normal text-muted-foreground">{caption}</span>}
      </span>
    </li>
  );
}

/* ── Trend ─────────────────────────────────────────────────────────────────── */

/* Taller than the old 1000×190: this card sits beside the SLA-breach list, which runs ~2.5× its
 * height, so the chart was a thin ribbon floating in an otherwise empty card. */
const W = 1000;
const H = 250;
const PAD = { top: 26, right: 76, bottom: 30, left: 42 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

/** Clean axis step (1 / 2 / 2.5 / 5 × 10ⁿ) so ticks land on readable numbers. */
function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (multiple * pow >= raw) return multiple * pow;
  }
  return 10 * pow;
}

/**
 * Open bugs over time with the breached subset beneath.
 *
 * Drawn as two stacked BANDS rather than two free lines: the filled gap between them is
 * "open and still within SLA", which is the number nobody could read off the old pair of lines.
 * One y-scale (bug counts) — never a dual axis. Fewer than 2 captures renders the "accrues daily"
 * state rather than a misleading single dot.
 */
export function BugTrendPanel({ trend }) {
  if (trend.length < 2) {
    return (
      <Panel title="Trend" subtitle="Open bugs over time" icon={TrendingUp} tone="brand">
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-10 text-center">
          <p className="max-w-70 text-xs text-muted-foreground">
            Trend data accrues daily — {trend.length === 0 ? "no captures yet" : "one capture so far"}.
            A point is written each time the report refreshes.
          </p>
        </div>
      </Panel>
    );
  }

  const peak = Math.max(...trend.map((point) => point.count), 1);
  const step = niceStep(peak / 4);
  const tickMax = Math.ceil(peak / step) * step;
  const ticks = [];
  for (let value = 0; value <= tickMax; value += step) ticks.push(value);

  const x = (i) => PAD.left + (i / (trend.length - 1)) * INNER_W;
  const y = (value) => PAD.top + INNER_H - (value / tickMax) * INNER_H;
  const countPts = trend.map((point, i) => ({ x: x(i), y: y(point.count) }));
  const breachPts = trend.map((point, i) => ({ x: x(i), y: y(point.breachedCount) }));

  const first = trend[0];
  const last = trend.at(-1);
  const change = last.count - first.count;
  const fmt = (date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  // Hover column width: each capture owns the strip around it, so the pointer never has to find a
  // 3px dot. Edge captures own a half-strip.
  const strip = INNER_W / (trend.length - 1);

  return (
    <Panel
      title="Trend"
      subtitle={`${trend.length} captures · ${fmt(first.capturedOn)} → ${fmt(last.capturedOn)}`}
      icon={TrendingUp}
      tone="brand"
      aside={
        <Legend
          items={[
            { label: "Open", fill: SCOPE_FILL[0] },
            { label: "Past SLA", fill: "bg-danger" },
          ]}
        />
      }
    >
      {/* The row's other card (the SLA-breach list) is ~2.5× taller, so the grid stretches this one
          and a `w-full` chart pinned to the top left a hole beneath it. Centring in the leftover
          space turns that into breathing room instead. */}
      <div className="flex flex-1 items-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Open bugs: ${last.count} at the latest capture, ${change >= 0 ? "up" : "down"} ${Math.abs(change)} since ${fmt(first.capturedOn)}; ${last.breachedCount} of them past SLA`}
        >
          <defs>
            <linearGradient id="bugTrendOpen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="[stop-color:var(--color-chart-cat-1)]" stopOpacity="0.28" />
              <stop offset="100%" className="[stop-color:var(--color-chart-cat-1)]" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="bugTrendBreach" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="[stop-color:var(--color-danger)]" stopOpacity="0.26" />
              <stop offset="100%" className="[stop-color:var(--color-danger)]" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Grid + y ticks — solid hairlines, one shade off the surface */}
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(value)}
                y2={y(value)}
                className="stroke-border-subtle"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={y(value) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {value}
              </text>
            </g>
          ))}

          {/* Open band, then the breached band on top of it: the visible gap between the two fills
              is the within-SLA population. */}
          <path d={smoothAreaPath(countPts, y(0))} fill="url(#bugTrendOpen)" />
          <path d={smoothAreaPath(breachPts, y(0))} fill="url(#bugTrendBreach)" />
          <path
            d={smoothLinePath(countPts)}
            fill="none"
            className="stroke-chart-cat-1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={smoothLinePath(breachPts)}
            fill="none"
            className="stroke-danger"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Markers get a 2px surface ring rather than a stroke-as-separator */}
          {trend.map((point, i) => (
            <g key={`m-${point.capturedOn.toISOString()}`}>
              <circle cx={x(i)} cy={y(point.count)} r="3.5" className="fill-chart-cat-1 stroke-card" strokeWidth="2" />
              {point.breachedCount > 0 && (
                <circle cx={x(i)} cy={y(point.breachedCount)} r="3.5" className="fill-danger stroke-card" strokeWidth="2" />
              )}
            </g>
          ))}

          {/* Endpoint direct labels, outside the plot so nothing can strike through them */}
          <text
            x={W - PAD.right + 10}
            y={y(last.count) + 4}
            className="fill-foreground text-[12px] font-bold tabular-nums"
          >
            {last.count}
          </text>
          <text
            x={W - PAD.right + 10}
            y={y(last.breachedCount) + 4}
            className="fill-danger-strong text-[12px] font-bold tabular-nums"
          >
            {last.breachedCount}
          </text>

          <text x={PAD.left} y={H - 8} className="fill-muted-foreground text-[10px]">
            {fmt(first.capturedOn)}
          </text>
          <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {fmt(last.capturedOn)}
          </text>

          {/* Hover layer: CSS-only so the panel stays a server component and the PDF export path is
              untouched (the tooltip renders at opacity 0). Each strip reveals a crosshair + readout;
              the box flips to the left of the crosshair on the right half so it can't clip. */}
          {trend.map((point, i) => {
            const cx = x(i);
            const flip = cx > PAD.left + INNER_W * 0.55;
            const boxW = 152;
            const boxX = flip ? cx - boxW - 10 : cx + 10;
            return (
              <g key={`h-${point.capturedOn.toISOString()}`} className="group/pt">
                <rect
                  x={cx - strip / 2}
                  y={PAD.top}
                  width={strip}
                  height={INNER_H}
                  fill="transparent"
                />
                <g
                  className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover/pt:opacity-100"
                  aria-hidden="true"
                >
                  <line
                    x1={cx}
                    x2={cx}
                    y1={PAD.top}
                    y2={PAD.top + INNER_H}
                    className="stroke-border-strong"
                    strokeWidth="1"
                  />
                  <circle cx={cx} cy={y(point.count)} r="5.5" className="fill-chart-cat-1 stroke-card" strokeWidth="2" />
                  <circle cx={cx} cy={y(point.breachedCount)} r="5.5" className="fill-danger stroke-card" strokeWidth="2" />
                  <rect
                    x={boxX}
                    y={PAD.top + 6}
                    width={boxW}
                    height="52"
                    rx="8"
                    className="fill-ink"
                    fillOpacity="0.95"
                  />
                  <text x={boxX + 12} y={PAD.top + 25} className="fill-white text-[12px] font-semibold">
                    {fmt(point.capturedOn)}
                  </text>
                  <text x={boxX + 12} y={PAD.top + 44} className="fill-white/75 text-[11px] tabular-nums">
                    {point.count} open · {point.breachedCount} past SLA
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {change === 0
          ? "No net change since the first capture."
          : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} since ${fmt(first.capturedOn)}.`}{" "}
        The band between the lines is open work still inside its SLA.
      </p>
    </Panel>
  );
}

/* ── Priority mix ──────────────────────────────────────────────────────────── */

/** Open bugs per band, split by scope. One bar per band, one segment per scope. */
export function BugPriorityPanel({ matrix }) {
  const total = matrix.totalRow;
  if (!total) return null;

  const bands = matrix.scopes[0]?.bands ?? [];
  const rows = bands.map((band) => ({
    label: band.label,
    segments: matrix.scopes.map((scope, i) => ({
      key: scope.id,
      title: scope.name,
      value: total.cells[scope.id]?.[band.key]?.count ?? 0,
      fill: SCOPE_FILL[i % SCOPE_FILL.length],
    })),
  }));
  const max = Math.max(...rows.map((row) => row.segments.reduce((sum, seg) => sum + seg.value, 0)), 1);

  return (
    <Panel
      title="Priority mix"
      subtitle="Open bugs by priority, split by scope"
      icon={BarChart3}
      tone="info"
      aside={
        <Legend
          items={matrix.scopes.map((scope, i) => ({
            label: scope.name,
            fill: SCOPE_FILL[i % SCOPE_FILL.length],
          }))}
        />
      }
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <Bar
            key={row.label}
            label={row.label}
            track={TRACK.band}
            segments={row.segments}
            total={row.segments.reduce((sum, seg) => sum + seg.value, 0)}
            max={max}
          />
        ))}
      </ul>
    </Panel>
  );
}

/* ── Category mix ──────────────────────────────────────────────────────────── */

/**
 * Open bugs per category. Horizontal bars, not a donut: at 6–7 near-equal categories arcs are
 * unreadable and worse again in a PDF export (spec (g)6).
 *
 * Nominal categories, so every bar takes the SAME slot-1 hue — colouring them by value would
 * re-encode length in hue and spend the identity channel on nothing. The breached share rides as a
 * second tier UNDER each bar (the hero pressure rail's grammar), which makes `(n)` legible as
 * length instead of only as a number.
 *
 * The tier is deliberately not an inline segment: this panel sits directly beside "Priority mix",
 * where slot 1 already means a SCOPE. Splitting a bar there and here would put the same hue on
 * "External" and on "within SLA" two inches apart — one colour, two meanings, side by side.
 */
export function BugCategoryPanel({ matrix }) {
  const rows = matrix.rows
    .filter((row) => row.rowKey !== TOTAL_ROW_KEY)
    .map((row) => ({
      label: row.rowLabel,
      value: row.grandTotal.count,
      breached: row.grandTotal.breachedCount,
    }))
    .sort((a, b) => b.value - a.value);

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <Panel
      title="Category mix"
      subtitle="Open bugs by category, worst first"
      icon={Layers}
      tone="neutral"
      aside={
        <Legend
          items={[
            { label: "Open", fill: SCOPE_FILL[0] },
            { label: "Past SLA", fill: "bg-danger" },
          ]}
        />
      }
    >
      <ul className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <Bar
            key={row.label}
            label={row.label}
            segments={[{ key: "open", title: "Open", value: row.value, fill: SCOPE_FILL[0] }]}
            under={{ title: "Past SLA", value: row.breached }}
            total={row.value}
            max={max}
            caption={row.breached > 0 ? `(${row.breached})` : null}
          />
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        The thin rail under each bar is the SLA-breached share —{" "}
        <span className="font-bold text-danger-strong">(n)</span> in the count.
      </p>
    </Panel>
  );
}

/* ── Ageing ────────────────────────────────────────────────────────────────── */

/**
 * Age buckets are ORDINAL — swapping their order would change the meaning — so they take a
 * one-hue ramp that darkens with age. The previous green/green/red/red split was a status palette
 * on ordinal data: it invented a cliff at 31 days that no rule in the product defines, and it
 * spent the SLA-breach red on something that is not a breach.
 */
export function BugAgingPanel({ aging }) {
  const max = Math.max(...aging.buckets.map((bucket) => bucket.count), 1);
  const total = aging.buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <Panel title="Ageing" subtitle="How long open bugs have been open" icon={Clock} tone="warn">
      <ul className="flex flex-col gap-2">
        {aging.buckets.map((bucket, i) => (
          <Bar
            key={bucket.key}
            label={bucket.label}
            track={TRACK.bucket}
            segments={[
              {
                key: bucket.key,
                title: bucket.label,
                value: bucket.count,
                fill: AGE_FILL[Math.min(i, AGE_FILL.length - 1)],
              },
            ]}
            total={bucket.count}
            max={max}
            caption={total > 0 ? `${Math.round((bucket.count / total) * 100)}%` : null}
          />
        ))}
      </ul>
      {aging.oldest && (
        <p className="mt-3 text-xs text-muted-foreground">
          Oldest open: <span className="font-mono font-semibold">{aging.oldest.jiraKey}</span> —{" "}
          {aging.oldest.ageDays} days.
        </p>
      )}
    </Panel>
  );
}
