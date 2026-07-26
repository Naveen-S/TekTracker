import { Check, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCOPE_TOTAL_BAND_KEY, TOTAL_ROW_KEY } from "@/lib/bug-report/matrix.mjs";

/**
 * The hero instrument for /bugs — the direct counterpart of the sprint board's `SprintPhaseBar`
 * (sprint-phases-delivery-lens.md). The board's hero answers "where is the sprint on the
 * dev → QA/UAT → release path"; this one answers the equivalent bug-backlog question at a glance:
 * **how big is it, how severe is its mix, how much of it is past SLA, and which way is it moving.**
 *
 * Structure mirrors the phase bar deliberately (same grammar, different subject):
 *   row 1 — macro status chips (left) + the headline readout (right, where the board hosts the
 *           release countdown, i.e. the timeline's destination)
 *   row 2 — a composition rail over the priority bands + a labelled legend beneath
 *
 * COLOR: no new palette. Severity is encoded by **opacity of the single on-ink accent hue**
 * (P0 brightest → P4 dimmest) and SLA breach by `--on-ink-danger` — the two tokens the ink hero
 * already owns. That keeps the instrument monochrome-safe, and it re-hues to blue under the Modern
 * theme for free (both tokens are theme-scoped), exactly like the hero's own radial glows.
 *
 * Server-safe: pure props in, no client hooks.
 */

/**
 * Severity ramp: brightest at the highest-severity band, never below a legible floor.
 * Mixed toward `--color-ink` rather than `transparent` — over a near-black hero a low-alpha
 * mix to transparent collapses to "invisible", which kills the ramp the instrument depends on.
 */
const bandFill = (index, count) => {
  // Floor at 68%: below that a segment stops reading as "filled" against the ink track, and since
  // the widest band is often a LOW-severity one (P2 here) the rail would look mostly empty — the
  // biggest group rendered as the faintest. Width already carries magnitude; the ramp only has to
  // be a legible ordering cue, not a wide contrast sweep.
  const pct = count <= 1 ? 100 : Math.round(100 - index * (32 / (count - 1)));
  return `color-mix(in oklab, var(--color-on-ink-accent) ${pct}%, var(--color-ink))`;
};

const CHIP_TONE = {
  clear: "border-[#35c07a]/35 bg-[#35c07a]/12 text-[#7ee0a6]",
  alert: "border-[#f0883e]/40 bg-[#f0883e]/14 text-[#f5b07a]",
  quiet: "border-white/12 bg-white/5 text-white/55",
};

/** A macro status chip — the `CycleChip` grammar from the sprint timeline. */
function StatusChip({ label, value, tone, icon: Icon, pulse }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
        CHIP_TONE[tone],
      )}
    >
      {Icon ? (
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full bg-current",
            pulse && "motion-safe:animate-pulse",
          )}
        />
      )}
      <span className="tracking-wide uppercase">{label}</span>
      <span className="font-semibold opacity-70">· {value}</span>
    </span>
  );
}

const fmtDay = (date) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function BugPressureBar({ matrix, diff, report }) {
  const total = matrix.totalRow;
  if (!total) return null;

  const bands = matrix.scopes[0]?.bands ?? [];
  const sumAcrossScopes = (bandKey, field) =>
    matrix.scopes.reduce((sum, scope) => sum + (total.cells[scope.id]?.[bandKey]?.[field] ?? 0), 0);

  const segments = bands
    .map((band, index) => ({
      key: band.key,
      label: band.label,
      count: sumAcrossScopes(band.key, "count"),
      breached: sumAcrossScopes(band.key, "breachedCount"),
      fill: bandFill(index, bands.length),
    }))
    .filter((segment) => segment.count > 0);

  const open = total.grandTotal.count;
  const breached = total.grandTotal.breachedCount;

  // Direction of travel comes from the previous CAPTURE, not "yesterday" — snapshot gaps are
  // never zero-filled, so the chip names the date it is actually comparing against.
  const netDelta = matrix.scopes.reduce((sum, scope) => {
    const d = diff.delta(TOTAL_ROW_KEY, scope.id, SCOPE_TOTAL_BAND_KEY);
    return d ? sum + d.count : sum;
  }, 0);

  const trendChip = !diff.priorDate
    ? { label: "Trend", value: "First capture", tone: "quiet", icon: Minus }
    : netDelta === 0
      ? { label: "Trend", value: `Flat since ${fmtDay(diff.priorDate)}`, tone: "quiet", icon: Minus }
      : netDelta > 0
        ? {
            label: "Trend",
            value: `Up ${netDelta} since ${fmtDay(diff.priorDate)}`,
            tone: "alert",
            icon: TrendingUp,
          }
        : {
            label: "Trend",
            value: `Down ${Math.abs(netDelta)} since ${fmtDay(diff.priorDate)}`,
            tone: "clear",
            icon: TrendingDown,
          };

  const breachPct = open > 0 ? Math.round((breached / open) * 100) : 0;

  return (
    <div
      role="img"
      aria-label={`${open} open bugs, ${breached} past SLA${
        segments.length ? `; severity mix ${segments.map((s) => `${s.label} ${s.count}`).join(", ")}` : ""
      }`}
      className="flex flex-col gap-3.5"
    >
      {/* Headline: status chips (left) + the destination readout (right). */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {breached > 0 ? (
            <StatusChip label="SLA" value={`${breached} past due · ${breachPct}%`} tone="alert" pulse />
          ) : (
            <StatusChip label="SLA" value="All within target" tone="clear" icon={Check} />
          )}
          <span aria-hidden="true" className="text-white/25">
            →
          </span>
          <StatusChip {...trendChip} />
          {report.targetLabel && (
            <StatusChip
              label={report.targetLabel}
              value={report.targetDate ? fmtDay(report.targetDate) : "—"}
              tone="quiet"
            />
          )}
        </div>

        <p className="flex items-baseline gap-2 whitespace-nowrap">
          <span className="font-display text-3xl leading-none font-extrabold tracking-tight text-white tabular-nums">
            {open}
          </span>
          <span className="text-[11px] font-bold tracking-wider uppercase text-white/55">
            open bugs
          </span>
        </p>
      </div>

      {/*
        Composition rail: width ∝ count per band. Two tiers inside one rail rather than one
        overlaid fill — at ~46% breached a full-height danger overlay swallows the severity ramp
        and the whole bar just reads "red". Splitting it lets both readings survive: the upper
        tier is the severity mix, the lower tier is how much of each band is past SLA.
      */}
      <div className="flex flex-col gap-2.5">
        <span className="flex h-4.5 w-full gap-0.5 overflow-hidden rounded-md bg-white/10">
          {segments.map((segment) => (
            <span
              key={segment.key}
              className="relative block h-full"
              title={`${segment.label}: ${segment.count} open, ${segment.breached} past SLA`}
              style={{ width: `${(segment.count / Math.max(open, 1)) * 100}%` }}
            >
              <span
                className="absolute inset-x-0 top-0 bottom-1.5"
                style={{ backgroundColor: segment.fill }}
              />
              <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/10" />
              {segment.breached > 0 && (
                <span
                  className="absolute bottom-0 left-0 h-1.5 bg-on-ink-danger"
                  style={{ width: `${(segment.breached / segment.count) * 100}%` }}
                />
              )}
            </span>
          ))}
        </span>

        {/* Legend: every segment directly labelled — a rail alone would be a decorative rectangle. */}
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: segment.fill }}
                aria-hidden="true"
              />
              <span className="text-white/55">{segment.label}</span>
              <span className="font-bold text-white/85 tabular-nums">{segment.count}</span>
              {segment.breached > 0 && (
                <span className="font-bold text-on-ink-danger tabular-nums">
                  ({segment.breached})
                </span>
              )}
            </li>
          ))}
          <li className="text-[11px] text-white/40">
            <span className="text-on-ink-danger">(n)</span> past SLA
          </li>
        </ul>
      </div>
    </div>
  );
}
