import { SCOPE_TOTAL_BAND_KEY, TOTAL_ROW_KEY } from "@/lib/bug-report/matrix.mjs";

/**
 * The chart panels (gm-bug-report.md (g)4–7): trend, priority mix, category mix, ageing.
 * Hand-rolled inline SVG + CSS bars — NO charting dependency (decision 18), so every panel stays
 * a server component and the html2canvas-pro export path keeps working (the TrendPanel precedent).
 *
 * Palette (dataviz skill, validated with scripts/validate_palette.js — light surface):
 *   categorical  #00a892 teal · #3b82f6 blue   CVD ΔE 19.9 protan / 20.9 normal — PASS
 *   status       #ef4444 danger, reserved for SLA breach and never reused as "series 3"
 * The validator's one WARN (teal 2.92:1 vs surface, below 3:1) is discharged the way it requires:
 * every series is directly labelled and the matrix above is the table view.
 *
 * As-built deviation from the spec's file list: (g)5–7 are three small bar panels sharing one
 * `<Bar>` primitive, so they live together here rather than in three near-identical files.
 */
const SCOPE_COLORS = ["#00a892", "#3b82f6"];
const BREACH_COLOR = "#ef4444";

function scopeColor(index) {
  return SCOPE_COLORS[index % SCOPE_COLORS.length];
}

function Panel({ title, subtitle, children, aside }) {
  return (
    <section className="flex flex-col rounded-xl border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className="size-2.5 rounded-[2px]"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** One horizontal bar with its value directly labelled — never a bare colored rectangle. */
function Bar({ label, value, max, color, caption }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <li className="grid grid-cols-[minmax(6.5rem,auto)_1fr_auto] items-center gap-3">
      <span className="truncate text-xs font-medium" title={label}>
        {label}
      </span>
      <span className="h-4 overflow-hidden rounded-sm bg-muted">
        <span
          className="block h-full rounded-sm"
          style={{ width: `${pct}%`, backgroundColor: color }}
          aria-hidden="true"
        />
      </span>
      <span className="text-xs font-bold tabular-nums">
        {value}
        {caption && <span className="ml-1 font-normal text-muted-foreground">{caption}</span>}
      </span>
    </li>
  );
}

/* ── Trend ─────────────────────────────────────────────────────────────────── */

// Wide aspect so the chart fills its card at any width without growing tall: at ~1200px it
// renders ~200px high, at half-width ~115px. `top` leaves room for the endpoint label, which sits
// ABOVE the last point and would otherwise be clipped when that point is the series max.
const W = 1000;
const H = 190;
const PAD = { top: 24, right: 18, bottom: 26, left: 36 };

/**
 * Open-bug count over time with the breached subset beneath it. Two series, one y-scale (bug
 * counts) — never a dual axis. Fewer than 2 captures renders the "accrues daily" state rather
 * than a misleading single dot.
 */
export function BugTrendPanel({ trend }) {
  if (trend.length < 2) {
    return (
      <Panel title="Trend" subtitle="Open bugs over time">
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-10 text-center">
          <p className="max-w-70 text-xs text-muted-foreground">
            Trend data accrues daily — {trend.length === 0 ? "no captures yet" : "one capture so far"}.
            A point is written each time the report refreshes.
          </p>
        </div>
      </Panel>
    );
  }

  const maxY = Math.max(...trend.map((point) => point.count), 1);
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW);
  const y = (value) => PAD.top + innerH - (value / maxY) * innerH;
  const line = (pick) => trend.map((point, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(pick(point))}`).join(" ");

  const first = trend[0];
  const last = trend.at(-1);
  const change = last.count - first.count;
  const fmt = (date) =>
    new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <Panel
      title="Trend"
      subtitle={`${trend.length} captures · ${fmt(first.capturedOn)} → ${fmt(last.capturedOn)}`}
      aside={<Legend items={[
        { label: "Open", color: SCOPE_COLORS[0] },
        { label: "SLA breached", color: BREACH_COLOR },
      ]} />}
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label={`Open bugs from ${last.count} at the latest capture, ${change >= 0 ? "up" : "down"} ${Math.abs(change)} since the first`}>
        {[0, 0.5, 1].map((frac) => (
          <line key={frac} x1={PAD.left} x2={W - PAD.right} y1={y(maxY * frac)} y2={y(maxY * frac)}
            stroke="currentColor" className="text-border-subtle" strokeWidth="1" />
        ))}
        {[0, 0.5, 1].map((frac) => (
          <text key={frac} x={PAD.left - 6} y={y(maxY * frac) + 3} textAnchor="end"
            className="fill-muted-foreground text-[9px]">
            {Math.round(maxY * frac)}
          </text>
        ))}

        <path d={line((p) => p.count)} fill="none" stroke={SCOPE_COLORS[0]} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        <path d={line((p) => p.breachedCount)} fill="none" stroke={BREACH_COLOR} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />

        {trend.map((point, i) => (
          <g key={point.capturedOn.toISOString()}>
            <circle cx={x(i)} cy={y(point.count)} r="3" fill={SCOPE_COLORS[0]} stroke="#fff" strokeWidth="2" />
            {point.breachedCount > 0 && (
              <circle cx={x(i)} cy={y(point.breachedCount)} r="3" fill={BREACH_COLOR} stroke="#fff" strokeWidth="2" />
            )}
            <title>{`${fmt(point.capturedOn)} — ${point.count} open, ${point.breachedCount} breached`}</title>
          </g>
        ))}

        {/* Clamped inside the plot: when the last point IS the series max its label would sit at
            y ≈ PAD.top − 9 and have its glyph tops sheared off by the viewBox. */}
        <text x={x(trend.length - 1)} y={Math.max(y(last.count) - 10, 12)} textAnchor="end"
          className="fill-secondary-foreground text-[11px] font-bold">
          {last.count}
        </text>
        <text x={PAD.left} y={H - 6} className="fill-muted-foreground text-[9px]">{fmt(first.capturedOn)}</text>
        <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[9px]">
          {fmt(last.capturedOn)}
        </text>
      </svg>

      <p className="mt-2 text-xs text-muted-foreground">
        {change === 0
          ? "No net change since the first capture."
          : `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} since ${fmt(first.capturedOn)}.`}
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
      name: scope.name,
      value: total.cells[scope.id]?.[band.key]?.count ?? 0,
      color: scopeColor(i),
    })),
  }));
  const max = Math.max(...rows.map((row) => row.segments.reduce((s, seg) => s + seg.value, 0)), 1);

  return (
    <Panel
      title="Priority mix"
      subtitle="Open bugs by priority, split by scope"
      aside={<Legend items={matrix.scopes.map((scope, i) => ({ label: scope.name, color: scopeColor(i) }))} />}
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const rowTotal = row.segments.reduce((sum, seg) => sum + seg.value, 0);
          return (
            <li key={row.label} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
              <span className="text-xs font-semibold">{row.label}</span>
              <span className="flex h-4 gap-0.5 overflow-hidden rounded-sm bg-muted">
                {row.segments.map((seg) =>
                  seg.value === 0 ? null : (
                    <span
                      key={seg.name}
                      title={`${seg.name}: ${seg.value}`}
                      style={{ width: `${(seg.value / max) * 100}%`, backgroundColor: seg.color }}
                      className="block h-full first:rounded-l-sm last:rounded-r-sm"
                    />
                  ),
                )}
              </span>
              <span className="text-xs font-bold tabular-nums">{rowTotal}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ── Category mix ──────────────────────────────────────────────────────────── */

/**
 * Open bugs per category. Horizontal bars, not a donut: at 6–7 near-equal categories arcs are
 * unreadable and worse again in a PDF export (spec (g)6).
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
    <Panel title="Category mix" subtitle="Open bugs by category, worst first">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <Bar
            key={row.label}
            label={row.label}
            value={row.value}
            max={max}
            color={SCOPE_COLORS[0]}
            caption={row.breached > 0 ? `(${row.breached})` : null}
          />
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        <span className="font-bold text-danger">(n)</span> = SLA-breached within that category.
      </p>
    </Panel>
  );
}

/* ── Ageing ────────────────────────────────────────────────────────────────── */

export function BugAgingPanel({ aging }) {
  const max = Math.max(...aging.buckets.map((bucket) => bucket.count), 1);
  const total = aging.buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <Panel title="Ageing" subtitle="How long open bugs have been open">
      <ul className="flex flex-col gap-2">
        {aging.buckets.map((bucket, i) => (
          <Bar
            key={bucket.key}
            label={bucket.label}
            value={bucket.count}
            max={max}
            color={i >= 2 ? BREACH_COLOR : SCOPE_COLORS[0]}
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
