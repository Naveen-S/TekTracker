/**
 * The sprint's delivery scoreboard — the team's story-point throughput, promoted to the app's
 * primary instrument per Naveen (2026-07-28: "extremely important", 2026-07-29: "every detail in
 * it is represented well", then "it's occupying a lot of real estate, reduce it").
 *
 * WHAT IT ANSWERS, in this order: how much have we shipped (the headline pair), and what is that
 * work made of (the rail + its legend). The three breakdown figures sum exactly to the headline —
 * 77+155+24 = 256 delivered, 81+213+25 = 319 planned — so the rail is not a second chart to
 * reconcile: it is the SAME number, cut into its parts.
 *
 * The rail carries two readings at once, which is the whole reason it exists. Segment WIDTH is
 * each type's share of planned scope; the solid FILL inside each segment is what has been
 * delivered. Because the fills are proportional, the total lit area of the rail is literally the
 * headline 80% — composition and completion in one shape.
 *
 * LAYOUT: the headline sits BESIDE the rail, not above it, and the per-type detail is a
 * direct-labelled legend rather than three columns of mini-charts. That is what keeps this near
 * the height of a metric card while still printing every figure — the rail already encodes each
 * type's delivered-vs-planned, so a second per-type track was redundant geometry charging real
 * estate for it.
 *
 * COLOUR: three measured categorical slots on ink — brand (`--on-ink-accent`, so Committed always
 * wears the active theme's own hue) plus the theme-neutral `--on-ink-cat-2`/`--on-ink-cat-3`. The
 * first attempt used two greys for the latter two; at 6.7:1 and 4.2:1 against the ink they read as
 * background rather than as categories. cat-2 is the /bugs Ageing gold, re-pitched for a dark
 * surface. No set of three hues separates cleanly against BOTH themes' brand hue, so this is a
 * TWO-CHANNEL encoding: colour does the work it can, and Unplanned Bugs is additionally hatched to
 * carry the one pair colour cannot (see the token block in globals.css for the measured figures).
 *
 * MOTION: one authored arrival (~0.8s), then still. Scope is drawn, then completion fills in
 * behind it — scope before achievement, so the sequence reads as a sentence. Keyframes and the
 * hover-isolation rules live in globals.css.
 *
 * Server-safe: only the delivered numeral's digits are a client leaf (AnimatedNumber), mirroring
 * how release-countdown.jsx is the only client part behind DaysRemainingPill. The hover layer is
 * pure CSS, and nothing is hover-only — every figure it highlights is also static text in the
 * legend.
 */
import { Sparkles } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

/**
 * Build the scoreboard `breakdown` prop from a `computeSprintMetrics`/`aggregateRollup` result.
 * Prefers the External/Internal split (unplanned-split-and-chart.md); falls back to the merged
 * `unplanned` segment for pre-split FROZEN shares whose captured metrics predate the split — the
 * two branches are mutually exclusive, so the component never double-counts bug scope.
 */
export function compositionBreakdown(m) {
  const hasSplit = m.externalPoints != null || m.internalPoints != null;
  return {
    committed: { points: m.committedPoints, completedPoints: m.committedCompletedPoints },
    techDebt: { points: m.techDebtPoints, completedPoints: m.techDebtCompletedPoints },
    ...(hasSplit
      ? {
          external: {
            points: m.externalPoints ?? 0,
            completedPoints: m.externalCompletedPoints ?? 0,
          },
          internal: {
            points: m.internalPoints ?? 0,
            completedPoints: m.internalCompletedPoints ?? 0,
          },
        }
      : {
          unplanned: {
            points: m.unplannedPoints,
            completedPoints: m.unplannedCompletedPoints,
          },
        }),
  };
}

/**
 * Fixed order and palette. Committed is the only type wearing the brand hue. `zone` is a type's
 * PLANNED scope, `fill` is what has been delivered inside it — the zones have to stay clearly
 * visible against ink or the rail stops reading as one continuous shape and becomes a row of
 * floating blocks.
 */
const TYPES = [
  {
    key: "committed",
    label: "Committed",
    zone: "bg-on-ink-accent/22",
    fill: "bg-on-ink-accent",
    swatch: "bg-on-ink-accent",
    value: "text-on-ink-accent",
  },
  {
    key: "techDebt",
    label: "Tech Debt",
    zone: "bg-on-ink-cat-2/22",
    fill: "bg-on-ink-cat-2",
    swatch: "bg-on-ink-cat-2",
    value: "text-white",
  },
  // Unplanned Bugs bifurcated into External (SUPPORT) + Internal (INTERNAL_BUG),
  // unplanned-split-and-chart.md. TEXTURE encodes planned-vs-reactive: both bugs stay HATCHED (so
  // the hatch keeps meaning "unplanned"); HUE sub-divides them (rose cat-3 ↔ orchid cat-4, ΔE 12.2).
  {
    key: "external",
    label: "External Bugs",
    zone: "bg-on-ink-cat-3/20",
    fill: "sp-stripe",
    swatch: "sp-stripe",
    value: "text-white",
  },
  {
    key: "internal",
    label: "Internal Bugs",
    zone: "bg-on-ink-cat-4/20",
    fill: "sp-stripe-2",
    swatch: "sp-stripe-2",
    value: "text-white",
  },
  // Fallback for pre-split frozen shares: rendered ONLY when a breakdown carries `unplanned` and
  // NOT external/internal (the call sites make these mutually exclusive), so a share captured
  // before the split still shows its bug scope as the old single rose segment.
  {
    key: "unplanned",
    label: "Unplanned Bugs",
    zone: "bg-on-ink-cat-3/20",
    fill: "sp-stripe",
    swatch: "sp-stripe",
    value: "text-white",
  },
];

/* Tooltips anchor inward at the ends: the card clips its overflow, so a centred tooltip on the
   first or last segment would lose its outer half. */
const tipAnchor = (index, count) =>
  index === 0 ? "left-0" : index === count - 1 ? "right-0" : "left-1/2 -translate-x-1/2";

/* Staggered entrances, indexed by position. Written as literal class strings because Tailwind
   scans source text — a template-built class name would never be generated. */
const FILL_IN = [
  "motion-safe:animate-[sp-fill_0.4s_var(--ease-out)_0.28s_backwards]",
  "motion-safe:animate-[sp-fill_0.4s_var(--ease-out)_0.34s_backwards]",
  "motion-safe:animate-[sp-fill_0.4s_var(--ease-out)_0.40s_backwards]",
  "motion-safe:animate-[sp-fill_0.4s_var(--ease-out)_0.46s_backwards]",
];
const LEGEND_IN = [
  "motion-safe:animate-[rise_0.3s_var(--ease-out)_0.30s_backwards]",
  "motion-safe:animate-[rise_0.3s_var(--ease-out)_0.35s_backwards]",
  "motion-safe:animate-[rise_0.3s_var(--ease-out)_0.40s_backwards]",
  "motion-safe:animate-[rise_0.3s_var(--ease-out)_0.45s_backwards]",
];

const COLUMN_IN = [
  "motion-safe:animate-[rise_0.36s_var(--ease-out)_0.30s_backwards]",
  "motion-safe:animate-[rise_0.36s_var(--ease-out)_0.36s_backwards]",
  "motion-safe:animate-[rise_0.36s_var(--ease-out)_0.42s_backwards]",
  "motion-safe:animate-[rise_0.36s_var(--ease-out)_0.48s_backwards]",
];

const pctOf = (part, whole) => (whole > 0 ? (part / whole) * 100 : 0);
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * `relaxed` only. One work type's column: its own delivered-vs-planned track at full scale, so a
 * type worth 8% of the sprint is still legible after the shared rail has squeezed it to a sliver.
 *
 * Committed's track additionally carries the admin-configured capacity as a domain-scaled tick.
 * Here — unlike the rail — the tick is drawn whether or not the target is overrun, because this
 * track's domain is `max(planned, capacity)` and so the marker's position is honest in both
 * directions.
 */
function TypeColumn({ type, planned, delivered, share, capacity, index, className }) {
  const donePct = pctOf(delivered, planned);
  // Capacity can exceed planned scope (headroom left) — the track has to hold whichever is larger,
  // or an over-capacity marker would sit outside its own bar.
  const domain = Math.max(planned, capacity ?? 0, 1);
  const over = capacity != null && planned > capacity;
  const gap = capacity != null ? Math.abs(round1(planned - capacity)) : 0;

  return (
    <div
      data-part={type.key}
      className={cn("sp-part min-w-0", COLUMN_IN[index] ?? COLUMN_IN[0], className)}
    >
      <div className="flex items-center gap-2">
        <span className={cn("size-2 shrink-0 rounded-[2px]", type.swatch)} aria-hidden="true" />
        <span className="truncate text-[11px] font-bold tracking-wider text-white/55 uppercase">
          {type.label}
        </span>
      </div>

      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn("font-display text-2xl leading-none font-extrabold tabular-nums", type.value)}
        >
          {Math.round(delivered)}
        </span>
        <span className="font-display text-base leading-none font-bold text-white/50 tabular-nums">
          / {Math.round(planned)}
        </span>
        <span aria-hidden="true" className="text-white/20">
          ·
        </span>
        <span className="text-xs font-bold text-white/50 tabular-nums">
          {Math.round(donePct)}% done
        </span>
      </p>

      <div className="relative mt-2.5 h-1.5 w-full rounded-full bg-white/10">
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", type.zone)}
          style={{ width: `${pctOf(planned, domain)}%` }}
        />
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", type.fill)}
          style={{ width: `${pctOf(delivered, domain)}%` }}
        />
        {capacity != null && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -inset-y-1 w-0.5 rounded-full motion-safe:animate-[sp-mark_0.3s_var(--ease-out)_0.6s_backwards]",
              over ? "bg-on-ink-alert" : "bg-white/70",
            )}
            style={{ left: `${pctOf(capacity, domain)}%` }}
          />
        )}
      </div>

      <p className="mt-2 text-[11px] text-white/50">{Math.round(share)}% of sprint scope</p>
      {capacity != null && (
        <p className={cn("text-[11px] font-semibold", over ? "text-on-ink-alert" : "text-white/55")}>
          {Math.round(capacity)} capacity
          {gap === 0 ? " · exactly at target" : over ? ` · ${gap} pts over` : ` · ${gap} pts spare`}
        </p>
      )}
    </div>
  );
}

/**
 * Direct labels for every segment (the `condensed` rail's legend) — colour is never the only code,
 * each entry names its type. `stack` lays them one-per-row; the default is the one-line wrap.
 * Committed additionally prints capacity.
 */
function CompositionLegend({ segments, planned, capacityPoints, overCapacity, capacityGap, stack }) {
  return (
    <ul
      className={cn(
        "flex",
        stack ? "flex-col gap-2" : "mt-2.5 flex-wrap items-center gap-x-5 gap-y-1.5",
      )}
    >
      {segments.map((segment, index) => (
        <li
          key={segment.type.key}
          data-part={segment.type.key}
          className={cn(
            "sp-part flex items-center gap-1.5 text-[11px]",
            stack ? "" : "whitespace-nowrap",
            LEGEND_IN[index] ?? LEGEND_IN[0],
          )}
        >
          <span
            className={cn("size-2 shrink-0 rounded-[2px]", segment.type.swatch)}
            aria-hidden="true"
          />
          <span className="font-bold tracking-wide text-white/55 uppercase">
            {segment.type.label}
          </span>
          <span className={cn("font-display font-bold tabular-nums", segment.type.value)}>
            {Math.round(segment.delivered)}
          </span>
          <span className="text-white/50 tabular-nums">
            / {Math.round(segment.planned)} · {Math.round(pctOf(segment.planned, planned))}% of scope
          </span>
          {segment.type.key === "committed" && capacityPoints != null && (
            <span
              className={cn(
                "font-semibold tabular-nums",
                overCapacity ? "text-on-ink-alert" : "text-white/50",
              )}
            >
              · {Math.round(capacityPoints)} cap
              {capacityGap === 0
                ? " (on target)"
                : overCapacity
                  ? ` (${capacityGap} over)`
                  : ` (${capacityGap} spare)`}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {object} props
 * @param {"condensed"|"relaxed"} [props.variant] `condensed` (default — `/`, `/share`) puts the
 *   headline beside the rail and prints the per-type detail as a legend. `relaxed` (`/rollup`,
 *   where the portfolio breakdown is the point of the page and there is no Delivery Matrix
 *   competing for the fold) stacks them and gives each type its own full-scale track.
 * @param {import("react").ReactNode} [props.action] Optional control rendered in the header,
 *   left of the completion chip — the roll-up's view toggle.
 */
export function StoryPointsHighlight({
  completedPoints,
  totalPoints,
  scope = "this sprint",
  breakdown,
  capacity,
  variant = "condensed",
  action,
}) {
  const relaxed = variant === "relaxed";
  const delivered = Math.round(completedPoints);
  const planned = Math.round(totalPoints);
  const remaining = Math.max(0, planned - delivered);
  const pct = planned > 0 ? Math.min(100, Math.round((delivered / planned) * 100)) : 0;
  const capacityPoints = capacity?.committedPoints ?? null;
  const committedPlanned = breakdown?.committed?.points ?? 0;
  const overCapacity = capacityPoints != null && committedPlanned > capacityPoints;
  const capacityGap =
    capacityPoints != null ? Math.abs(round1(committedPlanned - capacityPoints)) : 0;

  // Types with no scope at all are dropped rather than drawn as zero-width slivers with a legend
  // entry — a sprint with no tech debt should say nothing about tech debt.
  const segments = breakdown
    ? TYPES.map((type) => ({
        type,
        planned: breakdown[type.key]?.points ?? 0,
        delivered: breakdown[type.key]?.completedPoints ?? 0,
      })).filter((segment) => segment.planned > 0 || segment.delivered > 0)
    : [];

  const spoken = segments
    .map((s) => `${s.type.label} ${Math.round(s.delivered)} of ${Math.round(s.planned)}`)
    .join(", ");

  return (
    <section
      aria-label={
        `Story points delivered: ${delivered} of ${planned} planned ${scope}, ${pct}%.` +
        (spoken ? ` Breakdown: ${spoken}.` : "") +
        (capacityPoints != null
          ? ` Committed capacity ${Math.round(capacityPoints)}, ${capacityGap} points ${
              overCapacity ? "over" : "spare"
            }.`
          : "")
      }
      className={cn(
        "sp-board relative overflow-hidden rounded-xl border border-white/10 bg-ink shadow-lg",
        relaxed ? "p-5 md:p-6" : "p-4 sm:p-5",
      )}
    >
      {/* A single soft accent glow — deliberately not `hero-panel`'s dual wash, so the two ink
          surfaces on this page stay legibly different objects. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full bg-[radial-gradient(circle,var(--color-on-ink-accent),transparent_70%)] opacity-[0.13] blur-2xl"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-on-ink-accent" aria-hidden="true">
            <Sparkles className="size-4" />
          </span>
          <p className="text-[11px] font-bold tracking-wider text-white/70 uppercase">
            Story points delivered{" "}
            <span className="font-medium tracking-normal text-white/50 normal-case">· {scope}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {action}
          <span className="rounded-full border border-white/12 bg-white/6 px-2.5 py-0.5 text-[11px] font-bold text-white/70 tabular-nums">
            {pct}% of planned scope
          </span>
        </div>
      </div>

      {/* Headline BESIDE the rail rather than above it — the single biggest saving, and it pairs
          the total with its own composition instead of stacking two full-width bands. */}
      <div
        className={cn(
          "relative flex flex-col",
          relaxed ? "mt-4 gap-4" : "mt-3.5 gap-3.5 lg:flex-row lg:items-center lg:gap-7",
        )}
      >
        {/* Cap heights align because all three glyphs share a top edge and `leading-none` — an
            `items-end` row would align the LABELS' bottoms and leave the slash floating. */}
        <div className="flex shrink-0 items-start gap-3 motion-safe:animate-[rise_0.36s_var(--ease-out)_0.04s_backwards]">
          <div>
            <AnimatedNumber
              value={delivered}
              countOnMount
              className={cn(
                "font-display block leading-none font-extrabold tracking-tight text-on-ink-accent tabular-nums",
                relaxed ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl",
              )}
            />
            <p className="mt-1 text-[10px] font-bold tracking-wider text-white/50 uppercase">
              Delivered
            </p>
          </div>
          <span
            aria-hidden="true"
            className={cn(
              "font-display leading-none font-extrabold text-white/15",
              relaxed ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl",
            )}
          >
            /
          </span>
          <div>
            <p
              className={cn(
                "font-display leading-none font-extrabold tracking-tight text-white/75 tabular-nums",
                relaxed ? "text-5xl sm:text-6xl" : "text-4xl sm:text-5xl",
              )}
            >
              {planned}
            </p>
            <p className="mt-1 text-[10px] font-bold tracking-wider text-white/50 uppercase">
              Planned
            </p>
          </div>
        </div>

        {segments.length > 0 && planned > 0 ? (
          <div className="min-w-0 flex-1">
            {/* The rail needs naming — unlabelled it is just a decorative bar. "Remaining" sits at
                the right because that is spatially where the unfilled scope actually is. */}
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[10px] font-bold tracking-wider text-white/50 uppercase">
                Scope by work type
              </p>
              <p className="text-[11px] text-white/50">
                {remaining > 0 ? (
                  <>
                    <span className="font-display font-bold text-white/85 tabular-nums">
                      {remaining}
                    </span>{" "}
                    points remaining
                  </>
                ) : (
                  <span className="font-semibold text-on-ink-success">
                    All planned work delivered
                  </span>
                )}
              </p>
            </div>

            <div
              className={cn(
                "mt-1.5 flex w-full gap-1.5 motion-safe:animate-[sp-draw_0.34s_var(--ease-out)_0.05s_backwards]",
                relaxed ? "h-7" : "h-5",
              )}
            >
              {segments.map((segment, index) => (
                <span
                  key={segment.type.key}
                  data-part={segment.type.key}
                  className={cn(
                    "sp-part group/seg relative block h-full min-w-[3px] rounded-[4px]",
                    segment.type.zone,
                  )}
                  style={{ width: `${pctOf(segment.planned, planned)}%` }}
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 origin-left overflow-hidden rounded-[4px] transition-[width] duration-700 ease-out",
                      segment.type.fill,
                      FILL_IN[index] ?? FILL_IN[0],
                    )}
                    style={{ width: `${pctOf(segment.delivered, segment.planned)}%` }}
                  />
                  {/* The capacity marker is drawn ONLY when committed scope has overrun it: the
                      tick sits at the target and the overflow to its right becomes the visible
                      problem. Under target there is nothing to point at — a tick pinned to the
                      segment's edge would imply capacity equals scope, which is a lie — so the
                      legend states the headroom in words instead. */}
                  {segment.type.key === "committed" && overCapacity && (
                    <span
                      aria-hidden="true"
                      className="absolute -inset-y-1 w-0.5 rounded-full bg-on-ink-alert motion-safe:animate-[sp-mark_0.3s_var(--ease-out)_0.6s_backwards]"
                      style={{ left: `${pctOf(capacityPoints, segment.planned)}%` }}
                    />
                  )}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-2 rounded-md border border-white/15 bg-ink px-2.5 py-1.5 text-[11px] whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/seg:opacity-100",
                      tipAnchor(index, segments.length),
                    )}
                  >
                    <span className="font-bold tracking-wide text-white uppercase">
                      {segment.type.label}
                    </span>
                    <span className="text-white/60">
                      {" · "}
                      <span className="tabular-nums">
                        {Math.round(segment.delivered)} of {Math.round(segment.planned)} pts
                      </span>
                      {" · "}
                      <span className="tabular-nums">
                        {Math.round(pctOf(segment.planned, planned))}% of scope
                      </span>
                    </span>
                  </span>
                </span>
              ))}
            </div>

            {/* Direct labels. Every figure the rail encodes is also printed — as a one-line legend
                when condensed, or as full per-type columns when relaxed — so the rail is never the
                only home for a number and the hover layer stays pure emphasis. */}
            {relaxed ? (
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-white/10 pt-4 lg:grid-cols-4">
                {segments.map((segment, index) => (
                  <TypeColumn
                    key={segment.type.key}
                    type={segment.type}
                    planned={segment.planned}
                    delivered={segment.delivered}
                    share={pctOf(segment.planned, planned)}
                    capacity={segment.type.key === "committed" ? capacityPoints : null}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <CompositionLegend
                segments={segments}
                planned={planned}
                capacityPoints={capacityPoints}
                overCapacity={overCapacity}
                capacityGap={capacityGap}
              />
            )}

            {/* Portfolio caveat: on /rollup the capacity total is only as complete as the teams an
                admin has actually configured, so the figure never pretends to be the whole org. */}
            {capacity?.configuredTeamCount != null &&
              capacity.configuredTeamCount < capacity.totalTeamCount && (
                <p className="mt-1.5 text-[11px] text-white/50">
                  Capacity covers {capacity.configuredTeamCount} of {capacity.totalTeamCount} teams.
                </p>
              )}
          </div>
        ) : (
          <p className="text-[11px] text-white/50 lg:ml-auto">
            {remaining > 0 ? `${remaining} points remaining` : "All planned work delivered"}
          </p>
        )}
      </div>
    </section>
  );
}
