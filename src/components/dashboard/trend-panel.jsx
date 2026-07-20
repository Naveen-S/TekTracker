import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateUTC } from "@/lib/metrics.mjs";

/**
 * Sprint burndown from daily SprintSnapshot rows (trend-burndown.md (c)) — server-safe like
 * hero-shell.jsx (no hooks, no "use client"): rendered by the /rollup server page AND inside the
 * client Dashboard tree on /. All geometry derives from props (`asOf` comes from the server) so
 * SSR and hydration draw byte-identical SVG. Hand-rolled inline SVG, no charting dependency;
 * colors/typography are Tailwind token classes — the computed geometry attrs are data, not
 * inline styles (ui-port precedent). Hover detail rides native <title> tooltips (interactive
 * tooltips are out of scope).
 */

/* Flat aspect + a capped rendered width (`max-w-3xl` on the <svg>) keep the chart ~190px tall on
 * any screen — `w-full` alone let the uniform viewBox scaling balloon past 500px on wide
 * monitors (Naveen, 2026-07-19: "way too big"). */
const VB_W = 760;
const VB_H = 190;
const MARGIN = { top: 12, right: 88, bottom: 26, left: 48 };
const INNER_W = VB_W - MARGIN.left - MARGIN.right;
const INNER_H = VB_H - MARGIN.top - MARGIN.bottom;

const r2 = (value) => Math.round(value * 100) / 100;
const fmtPts = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/** Clean axis step (1 / 2 / 2.5 / 5 × 10ⁿ) for ~4 horizontal gridlines. */
function niceStep(rawStep) {
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (multiple * pow >= rawStep) return multiple * pow;
  }
  return 10 * pow;
}

function PanelShell({ stats, children }) {
  return (
    <section
      className="relative overflow-hidden rounded-lg border bg-card p-4 pt-4.5"
      aria-label="Sprint burndown trend"
    >
      <span className="absolute inset-x-0 top-0 h-0.75 bg-primary" aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"
            aria-hidden="true"
          >
            <TrendingDown className="size-4" />
          </span>
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Sprint burndown
          </p>
        </div>
        {stats}
      </div>
      {children}
    </section>
  );
}

export function TrendPanel({ series, sprint, asOf, totalTeams }) {
  if (!series) return null;
  const { points, ideal, projection } = series;

  if (points.length === 0) {
    return (
      <PanelShell>
        <p className="mt-3 text-sm text-muted-foreground">
          Trend data accrues daily — the snapshot cron captures one row per team per day for
          active sprints. Check back after the first capture.
        </p>
      </PanelShell>
    );
  }

  const latest = points[points.length - 1];
  const maxY = Math.max(
    ideal?.start.remaining ?? 0,
    ...points.map((point) => point.remainingPoints),
    ...(projection?.line.map((point) => point.remaining) ?? []),
  );

  if (maxY <= 0) {
    return (
      <PanelShell>
        <p className="mt-3 text-sm text-muted-foreground">
          No story points in scope on the captured days yet — the burndown starts once synced
          issues carry points.
        </p>
      </PanelShell>
    );
  }

  // Domain: the sprint window, widened if snapshots fall outside it (edited sprint dates).
  const startMs = Math.min(new Date(sprint.developmentStart).getTime(), points[0].date.getTime());
  const endMs = Math.max(new Date(sprint.developmentEnd).getTime(), latest.date.getTime());
  const spanMs = Math.max(endMs - startMs, 1);

  const step = niceStep(maxY / 4);
  const tickMax = Math.ceil(maxY / step) * step;
  const yTicks = [];
  for (let v = 0; v <= tickMax; v += step) yTicks.push(v);

  const toX = (dateLike) => r2(MARGIN.left + ((new Date(dateLike).getTime() - startMs) / spanMs) * INNER_W);
  const toY = (value) => r2(MARGIN.top + (1 - value / tickMax) * INNER_H);

  const xTicks = [0, 1, 2, 3].map((i) => startMs + (i / 3) * spanMs);
  const actualPoints = points
    .map((point) => `${toX(point.date)},${toY(point.remainingPoints)}`)
    .join(" ");
  const areaPath =
    points.length >= 2
      ? `M ${toX(points[0].date)} ${toY(points[0].remainingPoints)} ` +
        points.slice(1).map((point) => `L ${toX(point.date)} ${toY(point.remainingPoints)}`).join(" ") +
        ` L ${toX(latest.date)} ${toY(0)} L ${toX(points[0].date)} ${toY(0)} Z`
      : null;

  // No client-side clock fallback — without a server-provided asOf the marker is omitted
  // rather than risking an SSR/hydration mismatch.
  const todayMs = asOf ? new Date(asOf).getTime() : null;
  const showToday = todayMs !== null && todayMs >= startMs && todayMs <= endMs;
  const todayX = showToday ? toX(todayMs) : null;
  const todayAnchor =
    todayX !== null && todayX < MARGIN.left + 28
      ? "start"
      : todayX !== null && todayX > VB_W - MARGIN.right - 28
        ? "end"
        : "middle";

  const finishBadge =
    points.length < 2 ? (
      <Badge tone="neutral">needs two daily snapshots</Badge>
    ) : projection === null ? null : projection.projectedFinishDate === null ? (
      <Badge tone="warn">⚠ no burn this week</Badge>
    ) : projection.onTrack ? (
      <Badge tone="success">
        ✓ projected finish ~{formatDateUTC(projection.projectedFinishDate, { year: false })}
      </Badge>
    ) : (
      <Badge tone="warn">
        ⚠ projected ~{formatDateUTC(projection.projectedFinishDate, { year: false })} · past sprint
        end
      </Badge>
    );

  const stats = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-xs text-muted-foreground">
        {latest.avgProgress}% complete · {fmtPts(latest.remainingPoints)} pts left
      </span>
      {projection && (
        <span className="text-xs text-muted-foreground">
          {fmtPts(projection.ptsPerWeek)} pts/wk (7-day)
        </span>
      )}
      {finishBadge}
    </div>
  );

  return (
    <PanelShell stats={stats}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mt-2 w-full max-w-3xl"
        role="img"
        aria-label={`Burndown: ${fmtPts(latest.remainingPoints)} of ${fmtPts(maxY)} story points remaining`}
      >
        {/* Gridlines + y ticks (solid hairlines, recessive) */}
        {yTicks.map((value) => (
          <g key={value}>
            <line
              x1={MARGIN.left}
              x2={VB_W - MARGIN.right}
              y1={toY(value)}
              y2={toY(value)}
              className="stroke-border-subtle"
              strokeWidth="1"
            />
            <text
              x={MARGIN.left - 8}
              y={toY(value) + 3}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {fmtPts(value)}
            </text>
          </g>
        ))}

        {/* X-axis date labels */}
        {xTicks.map((t, i) => (
          <text
            key={t}
            x={toX(t)}
            y={VB_H - 8}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground text-[10px]"
          >
            {formatDateUTC(t, { year: false })}
          </text>
        ))}

        {/* Ideal reference line: latest total → 0 across the sprint window */}
        {ideal && (
          <line
            x1={toX(ideal.start.date)}
            y1={toY(Math.min(ideal.start.remaining, tickMax))}
            x2={toX(ideal.end.date)}
            y2={toY(0)}
            className="stroke-muted-foreground"
            strokeWidth="1.5"
            strokeOpacity="0.55"
            strokeLinecap="round"
          />
        )}

        {/* Actual burndown: wash + 2px line */}
        {areaPath && <path d={areaPath} className="fill-primary" fillOpacity="0.07" />}
        {points.length >= 2 && (
          <polyline
            points={actualPoints}
            fill="none"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Projection: dashed continuation at the trailing 7-day burn rate */}
        {projection && (
          <line
            x1={toX(projection.line[0].date)}
            y1={toY(projection.line[0].remaining)}
            x2={toX(projection.line[1].date)}
            y2={toY(Math.max(projection.line[1].remaining, 0))}
            className="stroke-primary"
            strokeWidth="2"
            strokeOpacity="0.65"
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
        )}

        {/* Today marker */}
        {showToday && (
          <g>
            <line
              x1={todayX}
              x2={todayX}
              y1={MARGIN.top}
              y2={VB_H - MARGIN.bottom}
              className="stroke-border-strong"
              strokeWidth="1"
            />
            <text
              x={todayX}
              y={MARGIN.top - 5}
              textAnchor={todayAnchor}
              className="fill-muted-foreground text-[9px] font-semibold uppercase tracking-wider"
            >
              Today
            </text>
          </g>
        )}

        {/* Data markers with native tooltips (2px surface ring) */}
        {points.map((point) => (
          <circle
            key={point.date.getTime()}
            cx={toX(point.date)}
            cy={toY(point.remainingPoints)}
            r="4"
            className="fill-primary stroke-card"
            strokeWidth="2"
          >
            <title>
              {`${formatDateUTC(point.date, { year: false })} · ${fmtPts(point.remainingPoints)} pts remaining · ${point.avgProgress}% avg progress${
                point.teamCount !== undefined && totalTeams
                  ? ` · ${point.teamCount} of ${totalTeams} teams`
                  : ""
              }`}
            </title>
          </circle>
        ))}

        {/* Direct label at the line end (contrast relief for the 2px teal line) — raised above
            the point so a flat projection line can't strike through the text */}
        <text
          x={toX(latest.date) + 10}
          y={toY(latest.remainingPoints) - 6}
          className="fill-foreground text-[11px] font-semibold"
        >
          {fmtPts(latest.remainingPoints)} pts left
        </text>
      </svg>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-muted-foreground/55" aria-hidden="true" />
          Ideal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" />
          Actual
        </span>
        {projection && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-primary/65" aria-hidden="true" />
            Projected
          </span>
        )}
        {points.length === 1 && (
          <span>One snapshot so far — the line and projection appear from the second daily capture.</span>
        )}
      </div>
    </PanelShell>
  );
}
