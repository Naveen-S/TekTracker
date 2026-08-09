/**
 * Roll-up "By team" view — the one thing the portfolio totals and the aggregate rail can't show:
 * WHICH TEAMS carry which kind of work (unplanned-split-and-chart.md, 2026-08-09, replacing the
 * redundant donut). One horizontal bar per team in a shared full-width lane (length ∝ that team's
 * committed+tech-debt+bug load against the heaviest team), segments = the four work types, sorted
 * heaviest-first — so "Team A is all committed scope, Team B is drowning in bugs" reads at a glance.
 *
 * Representation borrows the `/bugs` "Bugs by scrum team" grammar (a track lane + a partial fill +
 * a right-hand total, generous row padding with a row-hover highlight) and the scoreboard's own
 * hover-isolation: the section is a `.sp-board` and every segment/legend chip is a `.sp-part` tagged
 * `data-part={type}`, so hovering one work type (or its legend chip) keeps it lit across every team
 * while the rest dim — "where is the bug load?" in one gesture. Pure CSS (globals.css), zero new
 * rules. Same categorical system as the scoreboard (solid = planned work, hatch = reactive bug).
 *
 * Presentational + server-safe (bundled client-side via the `RollupStoryPoints` toggle leaf).
 * Colour is never the only code: the legend names every type and each bar carries tooltips + an
 * aria-label.
 */
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** The four composition categories, mapped to their metrics fields + the shared on-ink tokens. */
const WORK_TYPES = [
  { key: "committed", label: "Committed", plannedField: "committedPoints", deliveredField: "committedCompletedPoints", fill: "bg-on-ink-accent", swatch: "bg-on-ink-accent" },
  { key: "techDebt", label: "Tech Debt", plannedField: "techDebtPoints", deliveredField: "techDebtCompletedPoints", fill: "bg-on-ink-cat-2", swatch: "bg-on-ink-cat-2" },
  { key: "external", label: "External", plannedField: "externalPoints", deliveredField: "externalCompletedPoints", fill: "sp-stripe", swatch: "sp-stripe" },
  { key: "internal", label: "Internal", plannedField: "internalPoints", deliveredField: "internalCompletedPoints", fill: "sp-stripe-2", swatch: "sp-stripe-2" },
];

const round = (n) => Math.round(n ?? 0);

export function RollupCompositionChart({ teams = [], scope = "this sprint", action }) {
  // One row per team: its per-type planned/delivered points and totals. Empty teams are dropped so
  // the chart shows only teams that actually carry scope, sorted heaviest-load first.
  const rows = teams
    .map((entry) => {
      const m = entry.metrics ?? {};
      const segments = WORK_TYPES.map((type) => ({
        type,
        planned: m[type.plannedField] ?? 0,
        delivered: m[type.deliveredField] ?? 0,
      }));
      const planned = segments.reduce((sum, s) => sum + s.planned, 0);
      const delivered = segments.reduce((sum, s) => sum + s.delivered, 0);
      return { key: entry.team.key, name: entry.team.name, segments, planned, delivered };
    })
    .filter((row) => row.planned > 0)
    .sort((a, b) => b.planned - a.planned);

  const maxPlanned = rows.reduce((max, row) => Math.max(max, row.planned), 0) || 1;

  return (
    <section
      aria-label={`Story points by team, ${scope}. ${rows
        .map((r) => `${r.name}: ${round(r.delivered)} of ${round(r.planned)}`)
        .join("; ")}.`}
      className="sp-board relative overflow-hidden rounded-xl border border-white/10 bg-ink p-5 shadow-lg md:p-6"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 size-80 rounded-full bg-[radial-gradient(circle,var(--color-on-ink-accent),transparent_70%)] opacity-[0.13] blur-2xl"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-on-ink-accent" aria-hidden="true">
            <Sparkles className="size-4" />
          </span>
          <p className="text-[11px] font-bold tracking-wider text-white/70 uppercase">
            Story points by team{" "}
            <span className="font-medium tracking-normal text-white/50 normal-case">· {scope}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">{action}</div>
      </div>

      {/* Legend — the non-colour code for the segments, and a hover handle: hovering a chip isolates
          that work type across every team's bar (shares the scoreboard's .sp-part rule). */}
      <ul className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/10 pb-4">
        {WORK_TYPES.map((type) => (
          <li
            key={type.key}
            data-part={type.key}
            className="sp-part flex cursor-default items-center gap-1.5 text-[11px] whitespace-nowrap"
          >
            <span className={cn("size-2.5 shrink-0 rounded-[3px]", type.swatch)} aria-hidden="true" />
            <span className="font-bold tracking-wide text-white/60 uppercase">{type.label}</span>
          </li>
        ))}
      </ul>

      {rows.length > 0 ? (
        <div className="relative mt-2 flex flex-col gap-1">
          {rows.map((row, index) => {
            const pct = row.planned > 0 ? Math.round((row.delivered / row.planned) * 100) : 0;
            return (
              <div
                key={row.key}
                className="grid grid-cols-[minmax(6rem,8rem)_1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04] sm:grid-cols-[minmax(9rem,11rem)_1fr_auto] sm:gap-x-4"
              >
                <p className="min-w-0 truncate text-xs" title={`${row.key} · ${row.name}`}>
                  <span className="font-bold text-white/85">{row.key}</span>
                  <span className="text-white/45"> · {row.name}</span>
                </p>

                {/* Full-width lane: the fill is this team's share of the heaviest team's load, so a
                    light team still reads as a short bar inside a visible lane rather than a stub. */}
                <div className="relative h-3.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="flex h-full origin-left motion-safe:animate-[sp-grow_0.5s_var(--ease-out)_backwards]"
                    style={{ animationDelay: `${0.06 + Math.min(index, 10) * 0.04}s` }}
                  >
                    {row.segments.map(
                      (segment) =>
                        segment.planned > 0 && (
                          <span
                            key={segment.type.key}
                            data-part={segment.type.key}
                            title={`${row.key} · ${segment.type.label}: ${round(segment.planned)} pts`}
                            className={cn("sp-part block h-full", segment.type.fill)}
                            style={{ width: `${Math.max((segment.planned / maxPlanned) * 100, 0.8)}%` }}
                          />
                        ),
                    )}
                  </div>
                </div>

                <p className="text-right text-[11px] whitespace-nowrap tabular-nums">
                  <span className="font-display text-sm font-bold text-white/90">
                    {round(row.delivered)}
                  </span>
                  <span className="text-white/45"> / {round(row.planned)}</span>
                  <span className="ml-1 text-white/35">· {pct}%</span>
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="relative mt-4 text-[11px] text-white/50">No story points in scope this sprint.</p>
      )}
    </section>
  );
}
