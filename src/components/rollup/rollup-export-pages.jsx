/**
 * Print pages for the roll-up export (rollup-export.md).
 *
 * Re-authored static print components, never the live roll-up panels — those are dark-hero,
 * interactive and theme-tokened, and do not survive an html2canvas capture (bug-report-pdf-export.md
 * decision 4). Every colour here is a literal hex from print-theme.mjs, and every SVG is painted
 * with presentation ATTRIBUTES rather than Tailwind classes or `currentColor`: token-driven paint
 * silently drops out of the capture. `PrintTrend` in the bugs export is the reference.
 *
 * Pure presentational — no hooks, no browser APIs — so the same tree renders in the scaled dialog
 * preview and in the offscreen capture container.
 *
 * HEIGHT CONTRACT: the detail page's rows are budgeted by `packSections` (team section 84px, track
 * row 24px, issue row 34px, body 620px). The literal `h-[...]` values below must stay in step with
 * `lib/export/page-packer.mjs` or packed pages will overflow.
 */
import {
  ExecutiveReadout,
  KeyLink,
  KpiBox,
  PrintFooter,
  PrintHeader,
  ReportPanel,
} from "@/components/export/print-kit.jsx";
import { smoothAreaPath, smoothLinePath } from "@/lib/chart-path.mjs";
import { BLUE, ORANGE, WORK_TYPE_PRINT } from "@/lib/export/print-theme.mjs";
import { formatDateUTC, formatPoints, formatSprintWindow } from "@/lib/metrics.mjs";
import { effortCells } from "@/lib/rollup/pdf-layout.mjs";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { cn } from "@/lib/utils";

/** How many teams ride on page 1 under the KPI/burndown block before the table spills over. */
/**
 * Teams that ride on page 1 before the table spills to a continuation page. MEASURED, not guessed:
 * page 1 fits these many rows beneath the KPI row and composition band. Re-measured 2026-08-29
 * after the type-weight pass; the wider composition-legend gap costs the executive table one row.
 */
export const INLINE_SCORECARD_ROWS = 11;
export const SCORECARD_ROWS_PER_PAGE = 16;
export const RISK_ROWS_PER_PAGE = 18;
export const INLINE_VELOCITY_ROWS = 8;
export const VELOCITY_ROWS_PER_PAGE = 12;

const TYPE_BY_KEY = Object.fromEntries(WORK_TYPE_PRINT.map((type) => [type.key, type]));

/* Bordered health pills tuned to the print palette (keyed by issue.health.tone) — same map the
   sprint export uses, so an issue reads identically in both reports. */
const HEALTH_BADGE = {
  danger: "border-[#fecdd3] bg-[#fff1f2] text-[#e11d48]",
  warn: "border-[#fed7aa] bg-[#fff7ed] text-[#c2410c]",
  info: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb]",
  success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a]",
  neutral: "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]",
};

const PCT_BADGE = {
  complete: "bg-[#f0fdf4] text-[#16a34a]",
  inProgress: "bg-[#eff6ff] text-[#2563eb]",
  notStarted: "bg-[#f1f5f9] text-[#64748b]",
};

const ISSUE_COLS = "grid-cols-[92px_minmax(0,1fr)_60px_56px_104px]";

export function formatDateTime(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ─────────────────────────── shared visuals ─────────────────────────── */

/**
 * The composition bar — the report's primary pictorial device, used at three scales (portfolio
 * band, scorecard row, team detail header).
 *
 * In `both` mode each segment is drawn as a PLANNED ZONE (soft tint) carrying a DELIVERED FILL
 * (solid) — the on-screen scoreboard's own zone/fill grammar. In `delivered` / `planned` mode there
 * is only one measure, so segments are solid. A non-zero segment never renders thinner than
 * `minPct` so a 1-point track stays visible.
 */
export function PrintCompositionBar({ segments = [], mode = "both", height = 14, minPct = 1.2 }) {
  const cells = segments.map((segment) => ({
    ...segment,
    type: TYPE_BY_KEY[segment.key],
    ...effortCells(segment, mode),
  }));
  const total = cells.reduce((sum, cell) => sum + cell.measure, 0);

  if (total <= 0) {
    return (
      <div
        className="w-full overflow-hidden rounded-full bg-[#eef2f7]"
        style={{ height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="flex w-full overflow-hidden rounded-full bg-[#eef2f7]" style={{ height }}>
      {cells.map((cell) =>
        cell.measure > 0 ? (
          <div
            key={cell.key}
            className="h-full"
            style={{
              width: `${Math.max((cell.measure / total) * 100, minPct)}%`,
              backgroundColor: mode === "both" ? cell.type.soft : cell.type.color,
            }}
          >
            {mode === "both" ? (
              <div
                className="h-full"
                style={{
                  width: `${Math.min((cell.fill / cell.measure) * 100, 100)}%`,
                  backgroundColor: cell.type.color,
                }}
              />
            ) : null}
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Names every segment in words + figures — colour is never the only code. */
export function CompositionLegend({ segments = [], mode = "both", className }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-5 gap-y-1.5", className)}>
      {segments.map((segment) => {
        const type = TYPE_BY_KEY[segment.key];
        const { label, detail } = effortCells(segment, mode);
        return (
          <li key={segment.key} className="flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="inline-block size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: type.color }}
              aria-hidden="true"
            />
            <span className="text-[8px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
              {type.label}
            </span>
            <span className="text-[10px] font-bold tabular-nums text-[#0f172a]">{label}</span>
            {detail ? <span className="text-[8px] text-[#94a3b8]">{detail}</span> : null}
          </li>
        );
      })}
    </ul>
  );
}

/* Burndown geometry — mirrors trend-panel.jsx's scales, re-painted with literal hex. */
const VB_W = 1000;
const VB_H = 360;
const MARGIN = { top: 18, right: 92, bottom: 40, left: 52 };
const INNER_W = VB_W - MARGIN.left - MARGIN.right;
const INNER_H = VB_H - MARGIN.top - MARGIN.bottom;
const r2 = (value) => Math.round(value * 100) / 100;

function niceStep(rawStep) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(rawStep, 1)));
  for (const multiple of [1, 2, 2.5, 5, 10]) {
    if (multiple * pow >= rawStep) return multiple * pow;
  }
  return 10 * pow;
}

/** Sprint burndown: ideal vs actual vs projection. Projection is absent past the dev cycle. */
export function PrintBurndown({ series, sprint }) {
  const points = series?.points ?? [];
  if (points.length === 0) {
    return (
      <div className="mt-2 flex h-[372px] items-center justify-center rounded-md border border-dashed border-[#cbd5e1] px-4 text-center text-[9px] text-[#475569]">
        Burndown accrues from the daily snapshot job — at least one capture is needed before a trend
        can be drawn.
      </div>
    );
  }

  const { ideal, projection } = series;
  const latest = points[points.length - 1];
  const maxY = Math.max(
    ideal?.start.remaining ?? 0,
    ...points.map((point) => point.remainingPoints),
    ...(projection?.line.map((point) => point.remaining) ?? []),
  );
  if (maxY <= 0) {
    return (
      <div className="mt-2 flex h-[372px] items-center justify-center rounded-md border border-dashed border-[#cbd5e1] px-4 text-center text-[9px] text-[#475569]">
        No story points in scope on the captured days yet.
      </div>
    );
  }

  const startMs = Math.min(new Date(sprint.developmentStart).getTime(), points[0].date.getTime());
  const endMs = Math.max(new Date(sprint.developmentEnd).getTime(), latest.date.getTime());
  const spanMs = Math.max(endMs - startMs, 1);
  const step = niceStep(maxY / 4);
  const tickMax = Math.ceil(maxY / step) * step;
  const yTicks = [];
  for (let value = 0; value <= tickMax; value += step) yTicks.push(value);

  const toX = (dateLike) =>
    r2(MARGIN.left + ((new Date(dateLike).getTime() - startMs) / spanMs) * INNER_W);
  const toY = (value) => r2(MARGIN.top + (1 - value / tickMax) * INNER_H);

  const linePts = points.map((point) => ({ x: toX(point.date), y: toY(point.remainingPoints) }));
  const linePath = points.length >= 2 ? smoothLinePath(linePts) : null;
  const areaPath = points.length >= 2 ? smoothAreaPath(linePts, toY(0)) : null;
  const xTicks = [0, 1, 2, 3].map((index) => startMs + (index / 3) * spanMs);

  return (
    <>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="mt-1.5 h-[372px] w-full"
        role="img"
        aria-label={`Sprint burndown. ${Math.round(latest.remainingPoints)} points remaining of ${Math.round(latest.totalPoints)}.`}
      >
        {yTicks.map((value) => (
          <g key={value}>
            <line
              x1={MARGIN.left}
              x2={VB_W - MARGIN.right}
              y1={toY(value)}
              y2={toY(value)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <text x={MARGIN.left - 7} y={toY(value) + 3} textAnchor="end" fill="#94a3b8" fontSize="9">
              {value}
            </text>
          </g>
        ))}

        {ideal ? (
          <line
            x1={toX(ideal.start.date)}
            y1={toY(ideal.start.remaining)}
            x2={toX(ideal.end.date)}
            y2={toY(ideal.end.remaining)}
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeDasharray="5 4"
          />
        ) : null}

        {areaPath ? <path d={areaPath} fill="#eff6ff" /> : null}
        {linePath ? (
          <path d={linePath} fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" />
        ) : null}

        {projection?.line ? (
          <path
            d={`M ${toX(projection.line[0].date)} ${toY(projection.line[0].remaining)} L ${toX(projection.line[1].date)} ${toY(projection.line[1].remaining)}`}
            fill="none"
            stroke={ORANGE}
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
          />
        ) : null}

        {linePts.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="2.5"
            fill={BLUE}
            stroke="#ffffff"
            strokeWidth="1.25"
          />
        ))}

        <text
          x={VB_W - MARGIN.right + 8}
          y={toY(latest.remainingPoints) + 3}
          fill="#0f172a"
          fontSize="11"
          fontWeight="700"
        >
          {Math.round(latest.remainingPoints)}
        </text>

        {xTicks.map((ms, index) => (
          <text
            key={ms}
            x={toX(ms)}
            y={VB_H - 8}
            textAnchor={index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"}
            fill="#94a3b8"
            fontSize="9"
          >
            {formatDateUTC(new Date(ms), { year: false })}
          </text>
        ))}
      </svg>

      <p className="mt-0.5 flex h-3 items-center gap-3 text-[8px] leading-3 text-[#475569]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-[#2563eb]" aria-hidden="true" /> Actual
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-[#94a3b8]" aria-hidden="true" /> Ideal
        </span>
        {projection?.line ? (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-[#f97316]" aria-hidden="true" /> Projected
          </span>
        ) : null}
      </p>
    </>
  );
}

/** Worst-first delivery band summary (mirrors metric-grid.jsx's DELIVERY_BANDS vocabulary). */
function deliveryBands(combined) {
  return (
    [
      ["blocked", "blocked"],
      ["behind", "behind"],
      ["atRisk", "at risk"],
      ["onTrack", "on track"],
      ["ahead", "ahead"],
      ["done", "done"],
    ]
      .filter(([key]) => combined.deliveryHealthCounts[key] > 0)
      .map(([key, label]) => `${combined.deliveryHealthCounts[key]} ${label}`)
      .join(" · ") || "no delivery issues"
  );
}

/* ─────────────────────────── page 1: executive summary ─────────────────────────── */

export function ExecutiveSummaryPage({
  combined,
  perTeam,
  sprint,
  scopeLabel,
  velocity,
  composition,
  effortMode,
  riskEmphasis,
  scorecardRows = [],
  portfolio,
  showPortfolio,
  meta,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  const healthStatus = combined.sprintHealth.status;
  const completionPct =
    combined.deliveryPoints > 0
      ? Math.round((combined.deliveryCompletedPoints / combined.deliveryPoints) * 100)
      : 0;
  const overallPct =
    combined.points > 0 ? Math.round((combined.completedPoints / combined.points) * 100) : 0;
  const atRisk = combined.deliveryHealthCounts.atRisk + combined.deliveryHealthCounts.behind;
  const teamsComplete = perTeam.filter(
    (entry) => entry.metrics.sprintHealth.status === "Complete",
  ).length;

  const deliveryBreakdown = deliveryBands(combined);

  const healthKpiTone =
    healthStatus === "Critical" ? "danger" : healthStatus === "At Risk" ? "warn" : "positive";

  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <PrintHeader
        eyebrow="Portfolio delivery"
        pill="Internal"
        title={scopeLabel}
        subtitle={`${sprint.name} · ${formatSprintWindow(sprint)}`}
        meta={meta}
      />

      <div className="mt-3 grid grid-cols-5 gap-2.5">
        <KpiBox
          label="Sprint health"
          value={healthStatus}
          detail={deliveryBreakdown}
          tone={healthKpiTone}
        />
        <KpiBox
          label="Completion"
          value={`${completionPct}%`}
          detail={`${Math.round(combined.deliveryCompletedPoints)} / ${Math.round(combined.deliveryPoints)} delivery pts`}
          tone="info"
        />
        <KpiBox
          label="Weekly velocity"
          value={`${velocity.velocity} pts`}
          detail={`per week · ${perTeam.length} ${perTeam.length === 1 ? "team" : "teams"}`}
          tone="ink"
        />
        {riskEmphasis ? (
          <KpiBox
            label="At risk"
            value={atRisk}
            detail={`${combined.blockedCount} blocked`}
            tone={atRisk > 0 ? "warn" : "positive"}
          />
        ) : (
          <KpiBox
            label="Teams complete"
            value={`${teamsComplete} of ${perTeam.length}`}
            detail="finished their delivery scope"
            tone="positive"
          />
        )}
        <KpiBox
          label="Story points"
          value={`${Math.round(combined.completedPoints)} / ${Math.round(combined.points)}`}
          detail={`${overallPct}% delivered · all work`}
          tone="positive"
        />
      </div>

      <ReportPanel
        title="Where the effort went"
        subtitle={`Portfolio composition · ${EFFORT_SUBTITLE[effortMode]}`}
        className="mt-3"
      >
        <div className="mt-2">
          <PrintCompositionBar segments={composition} mode={effortMode} height={16} />
          <CompositionLegend segments={composition} mode={effortMode} className="mt-3" />
        </div>
      </ReportPanel>

      {scorecardRows.length > 0 ? (
        <ReportPanel
          title="Effort by scrum team"
          subtitle={`${EFFORT_SUBTITLE[effortMode]} · ${riskEmphasis ? "worst health first" : "most delivered first"}`}
          className="mt-3 flex min-h-0 flex-1 flex-col"
        >
          <ScorecardTable
            rows={scorecardRows}
            portfolio={portfolio}
            effortMode={effortMode}
            showPortfolio={showPortfolio}
          />
        </ReportPanel>
      ) : null}

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

/* ─────────────────────────── velocity report ─────────────────────────── */

/** `12.4` — a RATE, so it keeps one decimal where aggregate point totals are whole numbers. */
const rate = (value) => (value === null || value === undefined ? "—" : value.toFixed(1));

/**
 * Velocity report page 1 (rollup-export.md).
 *
 * Only offered for a finished sprint, so it drops everything that asks "are we on track": no health
 * band, no completion %, no teams-complete, no risk call-outs. What remains is what leadership asked
 * for — how much each scrum team delivered, and **where each developer-equivalent's output went**
 * across roadmap / tech debt / bugs.
 */
export function VelocitySummaryPage({
  rows,
  totals,
  sprint,
  scopeLabel,
  velocity,
  meta,
  showTotals,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  // The band reads the apportioned figures too, so the legend agrees with the table below it.
  const displaySegments = totals.segments.map((segment) => ({
    ...segment,
    delivered: segment.deliveredDisplay,
  }));
  const sprintEnd = sprint.releaseDate
    ? `Released ${formatDateUTC(sprint.releaseDate)}`
    : `Dev cycle ended ${formatDateUTC(sprint.developmentEnd)}`;

  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <PrintHeader
        eyebrow="Portfolio velocity"
        pill="Internal"
        title={scopeLabel}
        subtitle={`${sprint.name} · ${formatSprintWindow(sprint)}`}
        meta={meta}
      />

      <div className="mt-3 grid grid-cols-5 gap-2.5">
        <KpiBox label="Sprint" value="Completed" detail={sprintEnd} tone="positive" />
        <KpiBox
          label="Delivered"
          value={`${Math.round(totals.delivered)} pts`}
          detail={`all work · ${totals.issueCount} issues`}
          tone="info"
        />
        <KpiBox
          label="Per developer"
          value={totals.perDev === null ? "—" : `${rate(totals.perDev)} SP`}
          detail={
            totals.perDev === null
              ? "no team size set"
              : `across ${totals.developers} developer${totals.developers === 1 ? "" : "s"}`
          }
          tone="ink"
        />
        <KpiBox
          label="Developers"
          value={totals.developers || "—"}
          detail={`${totals.sizedTeamCount} of ${totals.teamCount} team${totals.teamCount === 1 ? "" : "s"} sized`}
          tone={totals.sizedTeamCount === totals.teamCount ? "positive" : "warn"}
        />
        <KpiBox
          label="Weekly velocity"
          value={`${velocity.velocity} pts`}
          detail={`per week · ${totals.teamCount} ${totals.teamCount === 1 ? "team" : "teams"}`}
          tone="ink"
        />
      </div>

      <ReportPanel
        title="Where the effort went"
        subtitle="Portfolio composition · delivered points"
        className="mt-3"
      >
        <div className="mt-2">
          <PrintCompositionBar segments={displaySegments} mode="delivered" height={16} />
          <CompositionLegend segments={displaySegments} mode="delivered" className="mt-3" />
        </div>
      </ReportPanel>

      <ReportPanel
        title="Velocity by scrum team"
        subtitle="Story points per developer · fastest first"
        className="mt-3 flex min-h-0 flex-1 flex-col"
      >
        <VelocityScorecardTable rows={rows} totals={totals} showTotals={showTotals} />
        {showTotals ? <VelocityCaveat totals={totals} /> : null}
      </ReportPanel>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

/** Overflow sheet for portfolios with more teams than page 1 holds. */
export function VelocityScorecardPage({
  rows,
  totals,
  showTotals,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Velocity by scrum team (continued)
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">
          Story points per developer · fastest first
        </p>
      </div>
      <div className="mt-3">
        <VelocityScorecardTable rows={rows} totals={totals} showTotals={showTotals} />
        {showTotals ? <VelocityCaveat totals={totals} /> : null}
      </div>
      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

/**
 * Two numbers per cell: the per-developer RATE on top (the thing leadership is asking about) and the
 * raw delivered points beneath it, so the same table answers "what is our rate" and "what did we
 * actually ship". A team with no size set shows dashes for the rates and keeps its totals.
 */
function VelocityScorecardTable({ rows, totals, showTotals }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col style={{ width: "19%" }} />
        <col style={{ width: "7%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "12%" }} />
        <col style={{ width: "18%" }} />
      </colgroup>
      <thead>
        <tr className="border-b border-[#cbd5e1]">
          <th className="h-5 px-2 text-left text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            Scrum team
          </th>
          <th className="h-5 px-2 text-right text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            Devs
          </th>
          {WORK_TYPE_PRINT.map((type) => (
            <th
              key={type.key}
              className="h-5 px-2 text-right text-[7px] font-extrabold tracking-[0.08em] uppercase"
              style={{ color: type.color }}
            >
              {type.label}
            </th>
          ))}
          <th className="h-5 px-2 text-right text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#0f172a]">
            Total / dev
          </th>
          <th className="h-5 px-2 text-left text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            Composition
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={row.teamId ?? row.key}
            className="border-b border-[#eef2f7]"
            style={{ backgroundColor: index % 2 === 1 ? "#f8fafc" : "#ffffff" }}
          >
            <td className="h-[34px] px-2">
              <span className="block truncate text-[10px] font-extrabold">{row.key}</span>
              <span className="block truncate text-[8px] text-[#64748b]">{row.name}</span>
            </td>
            <td className="px-2 text-right tabular-nums">
              <span className={cn("text-[10px] font-bold", row.developers === null && "text-[#cbd5e1]")}>
                {row.developers ?? "—"}
              </span>
            </td>
            {row.segments.map((segment) => (
              <td key={segment.key} className="px-2 text-right tabular-nums">
                <span
                  className={cn("block text-[11px] font-bold", segment.perDev === null && "text-[#cbd5e1]")}
                >
                  {rate(segment.perDevDisplay)}
                </span>
                <span className="block text-[7px] text-[#94a3b8]">
                  {segment.deliveredDisplay} pts
                </span>
              </td>
            ))}
            <td className="px-2 text-right tabular-nums">
              <span className={cn("block text-[13px] font-black", row.perDev === null && "text-[#cbd5e1]")}>
                {rate(row.perDev)}
              </span>
              <span className="block text-[7px] text-[#64748b]">
                {Math.round(row.delivered)} pts
              </span>
            </td>
            <td className="px-2">
              <PrintCompositionBar segments={row.segments} mode="delivered" height={10} />
            </td>
          </tr>
        ))}
      </tbody>
      {showTotals ? (
        <tfoot>
          <tr className="border-t-2 border-[#0f172a] bg-[#f5f7fb]">
            <td className="h-[34px] px-2 text-[9px] font-black tracking-[0.06em] uppercase">
              Overall
            </td>
            <td className="px-2 text-right text-[10px] font-black tabular-nums">
              {totals.developers || "—"}
            </td>
            {totals.segments.map((segment) => (
              <td key={segment.key} className="px-2 text-right tabular-nums">
                <span className="block text-[11px] font-black">{rate(segment.perDevDisplay)}</span>
                <span className="block text-[7px] text-[#64748b]">
                  {segment.deliveredDisplay} pts
                </span>
              </td>
            ))}
            <td className="px-2 text-right tabular-nums">
              <span className="block text-[13px] font-black">{rate(totals.perDev)}</span>
              <span className="block text-[7px] text-[#64748b]">
                {Math.round(totals.delivered)} pts
              </span>
            </td>
            <td className="px-2">
              <PrintCompositionBar segments={totals.segments} mode="delivered" height={10} />
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

/** Names the teams excluded from the per-developer rates, so the headline can't be misread. */
function VelocityCaveat({ totals }) {
  if (totals.unsizedTeams.length === 0) return null;
  return (
    <p className="mt-1.5 text-[8px] text-[#94a3b8]">
      Per-developer rates cover the {totals.sizedTeamCount} team
      {totals.sizedTeamCount === 1 ? "" : "s"} with a size set. {totals.unsizedTeams.join(", ")}{" "}
      {totals.unsizedTeams.length === 1 ? "has" : "have"} none, so {totals.unsizedTeams.length === 1 ? "its" : "their"}{" "}
      points are excluded from every rate above — including the overall.
    </p>
  );
}

/* ─────────────────────────── trend & delivery readout ─────────────────────────── */

/**
 * Burndown + delivery readout on their own sheet. Page 1 is the executive answer (KPIs, composition,
 * per-team effort); this is the supporting trend, and giving it a full page means the chart is
 * actually legible rather than squeezed under the scorecard.
 */
export function TrendPage({
  combined,
  perTeam,
  sprint,
  series,
  velocity,
  capacity,
  riskEmphasis,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  const overallPct =
    combined.points > 0 ? Math.round((combined.completedPoints / combined.points) * 100) : 0;
  const healthStatus = combined.sprintHealth.status;
  const deliveryBreakdown = deliveryBands(combined);

  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Trend and delivery readout
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">
          Burndown is all work · the readout is roadmap + tech debt against the dev cycle
        </p>
      </div>

      <ReportPanel
        title="Sprint burndown"
        subtitle="All work · ideal vs actual, from the daily snapshot job"
        className="mt-3"
      >
        <PrintBurndown series={series} sprint={sprint} />
      </ReportPanel>

      <div className="mt-3 grid min-h-0 flex-1 grid-cols-4 gap-3">
        <ExecutiveReadout
          label="Sprint health"
          value={healthStatus}
          detail={deliveryBreakdown}
          tone={healthStatus === "Critical" ? "danger" : healthStatus === "At Risk" ? "warn" : "neutral"}
        />
        <ExecutiveReadout
          label="Committed vs capacity"
          value={`${Math.round(combined.committedCompletedPoints)} / ${Math.round(combined.committedPoints)} pts`}
          detail={
            capacity?.committedPoints != null
              ? `against ${Math.round(capacity.committedPoints)} pt capacity · ${capacity.configuredTeamCount} of ${capacity.totalTeamCount} teams configured`
              : "No capacity target configured"
          }
          tone="info"
        />
        <ExecutiveReadout
          label="Throughput"
          value={`${velocity.velocity} pts per week`}
          detail={`${combined.totalIssues} issues · ${perTeam.length} ${perTeam.length === 1 ? "team" : "teams"} · all work`}
          tone="neutral"
        />
        <ExecutiveReadout
          label={riskEmphasis ? "Projected finish" : "Delivered this sprint"}
          value={
            riskEmphasis
              ? `${Math.round(velocity.projectedPoints ?? 0)} pts by sprint end`
              : `${Math.round(combined.completedPoints)} pts delivered`
          }
          detail={
            riskEmphasis
              ? `${velocity.onTrack ? "On pace" : "Behind pace"} · week ${velocity.weeksElapsed} of ${velocity.totalWeeks}`
              : `${overallPct}% of all scoped work`
          }
          tone={riskEmphasis ? (velocity.onTrack ? "neutral" : "warn") : "positive"}
        />
      </div>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

const EFFORT_SUBTITLE = {
  both: "delivered against planned",
  delivered: "delivered points",
  planned: "planned scope",
};

/* ─────────────────────────── page 2: team scorecard ─────────────────────────── */

/**
 * The high-level ask: one row per scrum team, effort split across the four work types plus a total.
 * Every row carries a mini composition bar so the table reads pictorially rather than as a wall of
 * numbers, and a portfolio total row closes it.
 */
/**
 * Overflow pages for portfolios with more teams than page 1 can hold. Page 1 carries the first
 * `INLINE_SCORECARD_ROWS`; anything beyond continues here with the same table.
 */
export function TeamScorecardPage({
  rows,
  portfolio,
  effortMode,
  riskEmphasis,
  showPortfolio,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Effort by scrum team (continued)
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">
          {EFFORT_SUBTITLE[effortMode]} ·{" "}
          {riskEmphasis ? "worst health first" : "most delivered first"}
        </p>
      </div>

      <div className="mt-3">
        <ScorecardTable
          rows={rows}
          portfolio={portfolio}
          effortMode={effortMode}
          showPortfolio={showPortfolio}
        />
      </div>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

/**
 * The high-level ask: one row per scrum team, effort split across the four work types plus a total.
 * Every row carries a mini composition bar so the table reads pictorially rather than as a wall of
 * numbers, and a portfolio total row closes it. Shared by page 1 and any overflow page.
 */
function ScorecardTable({ rows, portfolio, effortMode, showPortfolio }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col style={{ width: "17%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "10%" }} />
        <col style={{ width: "11%" }} />
        <col style={{ width: "20%" }} />
        <col style={{ width: "12%" }} />
      </colgroup>
      <thead>
        <tr className="border-b border-[#cbd5e1]">
          <th className="h-5 px-2 text-left text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            Scrum team
          </th>
          {WORK_TYPE_PRINT.map((type) => (
            <th
              key={type.key}
              className="h-5 px-2 text-right text-[7px] font-extrabold tracking-[0.08em] uppercase"
              style={{ color: type.color }}
            >
              {type.label}
            </th>
          ))}
          <th className="h-5 px-2 text-right text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#0f172a]">
            Total
          </th>
          <th className="h-5 px-2 text-left text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            Composition
          </th>
          <th className="h-5 px-2 text-left text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
            Health
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <ScorecardRow
            key={row.composition.teamId ?? row.composition.key}
            row={row}
            effortMode={effortMode}
            zebra={index % 2 === 1}
          />
        ))}
      </tbody>
      {showPortfolio ? (
        <tfoot>
          <tr className="border-t-2 border-[#0f172a] bg-[#f5f7fb]">
            <td className="h-[28px] px-2 text-[9px] font-black tracking-[0.06em] uppercase">
              Portfolio
            </td>
            {portfolio.segments.map((segment) => {
              const { label, detail } = effortCells(segment, effortMode);
              return (
                <td key={segment.key} className="px-2 text-right tabular-nums">
                  <span className="block text-[10px] font-black">{label}</span>
                  {detail ? <span className="block text-[7px] text-[#64748b]">{detail}</span> : null}
                </td>
              );
            })}
            <td className="px-2 text-right tabular-nums">
              <span className="block text-[11px] font-black">
                {effortCells(portfolio, effortMode).label}
              </span>
              <span className="block text-[7px] text-[#64748b]">{portfolio.pct}%</span>
            </td>
            <td className="px-2" colSpan={2}>
              <PrintCompositionBar segments={portfolio.segments} mode={effortMode} height={10} />
            </td>
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

function ScorecardRow({ row, effortMode, zebra }) {
  const { composition, metrics } = row;
  const total = effortCells(composition, effortMode);
  return (
    <tr
      className="border-b border-[#eef2f7]"
      style={{ backgroundColor: zebra ? "#f8fafc" : "#ffffff" }}
    >
      <td className="h-[26px] px-2">
        <span className="block truncate text-[10px] font-extrabold">{composition.key}</span>
        <span className="block truncate text-[8px] text-[#64748b]">{composition.name}</span>
      </td>
      {composition.segments.map((segment) => {
        const { label, detail } = effortCells(segment, effortMode);
        const muted = segment.planned === 0 && segment.delivered === 0;
        return (
          <td key={segment.key} className="px-2 text-right tabular-nums">
            <span
              className={cn("block text-[10px] font-bold", muted && "text-[#cbd5e1]")}
            >
              {label}
            </span>
            {detail && !muted ? (
              <span className="block text-[7px] text-[#94a3b8]">{detail}</span>
            ) : null}
          </td>
        );
      })}
      <td className="px-2 text-right tabular-nums">
        <span className="block text-[11px] font-black">{total.label}</span>
        {total.detail ? (
          <span className="block text-[7px] text-[#64748b]">{total.detail}</span>
        ) : null}
      </td>
      <td className="px-2">
        <PrintCompositionBar segments={composition.segments} mode={effortMode} height={10} />
      </td>
      <td className="px-2">
        <span
          className={cn(
            "inline-block rounded-sm border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap",
            HEALTH_BADGE[metrics.sprintHealth.tone] ?? HEALTH_BADGE.neutral,
          )}
        >
          {metrics.sprintHealth.icon} {metrics.sprintHealth.status}
        </span>
      </td>
    </tr>
  );
}

/* ─────────────────────────── page 3: risk register ─────────────────────────── */

/** Only rendered when risk emphasis is on — a finished sprint drops this page entirely. */
export function RiskRegisterPage({
  issues,
  browseHref,
  continued,
  totalRisky,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Risk register{continued ? " (continued)" : ""}
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">
          {totalRisky} blocked, behind or at-risk item{totalRisky === 1 ? "" : "s"} · worst first
        </p>
      </div>

      <div className="mt-3 grid h-6 grid-cols-[92px_58px_minmax(0,1fr)_56px_104px] items-center border-b border-[#cbd5e1] px-2 text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#64748b]">
        <span>Jira key</span>
        <span>Team</span>
        <span>Issue · why it is flagged</span>
        <span className="text-right">Points</span>
        <span className="text-right">Health</span>
      </div>

      <div className="flex flex-col">
        {issues.map((issue, index) => (
          <div
            key={`${issue.teamKey}-${issue.jiraKey}`}
            className="grid h-[36px] grid-cols-[92px_58px_minmax(0,1fr)_56px_104px] items-center border-b border-[#eef2f7] px-2 text-[9px]"
            style={{ backgroundColor: index % 2 === 1 ? "#f8fafc" : "#ffffff" }}
          >
            <span>
              <KeyLink jiraKey={issue.jiraKey} href={browseHref(issue.jiraKey)} />
            </span>
            <span className="truncate text-[8px] font-bold text-[#64748b]">{issue.teamKey}</span>
            <span className="min-w-0 pr-3">
              <span className="block truncate leading-[11px] text-[#334155]">{issue.title}</span>
              {issue.blockedReason || issue.riskComment ? (
                <span className="block truncate text-[8px] leading-[11px] text-[#94a3b8] italic">
                  {issue.blocked && issue.blockedReason
                    ? `Blocked: ${issue.blockedReason}`
                    : `Known risk: ${issue.riskComment}`}
                </span>
              ) : null}
            </span>
            <span className="text-right tabular-nums text-[#64748b]">
              {formatPoints(issue.storyPoints)}
            </span>
            <span className="text-right">
              <span
                className={cn(
                  "inline-block rounded-sm border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap",
                  HEALTH_BADGE[issue.health.tone] ?? HEALTH_BADGE.neutral,
                )}
              >
                {issue.health.status}
              </span>
            </span>
          </div>
        ))}
      </div>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

/* ─────────────────────────── detail pages ─────────────────────────── */

/** One packed page of team → track → issue detail. Heights are budgeted by `packSections`. */
export function TeamDetailPage({
  sections,
  effortMode,
  browseHref,
  footerLeft,
  pageNumber,
  totalPages,
}) {
  return (
    <div className="flex flex-1 flex-col text-[#0f172a]">
      <div className="flex h-[18px] items-center justify-between">
        <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase text-[#7c3aed]">
          Work breakdown
        </p>
        <p className="text-[8px] font-semibold text-[#64748b]">By team and track · Jira-linked</p>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {sections.map((section) => (
          <TeamDetailSection
            key={`${section.team.key}-${section.continued ? "continued" : "start"}`}
            section={section}
            effortMode={effortMode}
            browseHref={browseHref}
          />
        ))}
      </div>

      <PrintFooter left={footerLeft} pageNumber={pageNumber} totalPages={totalPages} />
    </div>
  );
}

function TeamDetailSection({ section, effortMode, browseHref }) {
  const { team, continued } = section;
  const health = team.metrics.sprintHealth;
  return (
    <section>
      <div className="flex h-[52px] items-center justify-between gap-4 rounded-lg border border-[#e2e8f0] border-t-[3px] border-t-[#7c3aed] bg-[#f5f7fb] px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0">
            <h4 className="truncate text-[13px] font-extrabold">
              <span className="text-[#64748b]">{team.teamKey}</span> · {team.teamName}
            </h4>
            <span className="block truncate text-[8px] text-[#64748b]">
              {team.metrics.totalIssues} issue{team.metrics.totalIssues === 1 ? "" : "s"} ·{" "}
              {effortCells(team.composition, effortMode).label} pts
            </span>
          </div>
          {continued ? (
            <span className="shrink-0 rounded-full bg-[#e2e8f0] px-2 py-0.5 text-[7px] font-extrabold tracking-[0.1em] uppercase text-[#475569]">
              Continued
            </span>
          ) : null}
        </div>
        <div className="flex w-[42%] shrink-0 items-center gap-3">
          <PrintCompositionBar
            segments={team.composition.segments}
            mode={effortMode}
            height={10}
          />
          <span
            className={cn(
              "shrink-0 rounded-sm border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap",
              HEALTH_BADGE[health.tone] ?? HEALTH_BADGE.neutral,
            )}
          >
            {health.icon} {health.status}
          </span>
        </div>
      </div>

      {section.developers.map((group) => (
        <div key={`${group.developer.filterId}-${group.continued ? "c" : "s"}`}>
          <div className="mt-1.5 flex h-[24px] items-center justify-between gap-3 rounded-md bg-[#f8fafc] px-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: group.developer.accentColor ?? "#2563eb" }}
                aria-hidden="true"
              />
              <span className="truncate text-[9px] font-extrabold">{group.developer.name}</span>
              <span className="truncate text-[8px] text-[#64748b]">
                {WORKFLOWS[group.developer.workflowType]?.name ?? group.developer.workflowType}
                {group.continued ? " · continued" : ""}
              </span>
            </div>
            <span className="shrink-0 text-[8px] tabular-nums text-[#64748b]">
              {Math.round(group.developer.completedPoints)} / {Math.round(group.developer.points)} pts ·{" "}
              <span className="text-[10px] font-black text-[#0f172a]">{group.developer.pct}%</span>
            </span>
          </div>

          <div className={cn("grid h-5 items-center px-2 text-[7px] font-extrabold tracking-[0.08em] uppercase text-[#94a3b8]", ISSUE_COLS)}>
            <span>Jira key</span>
            <span>Issue summary</span>
            <span className="text-center">Progress</span>
            <span className="text-center">Stages</span>
            <span className="text-right">Health</span>
          </div>

          {group.issues.map((issue, index) => (
            <DetailIssueRow
              key={issue.jiraKey}
              issue={issue}
              href={browseHref(issue.jiraKey)}
              zebra={index % 2 === 1}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

function DetailIssueRow({ issue, href, zebra }) {
  const totalStages = WORKFLOWS[issue.workflowType]?.stages.length ?? 0;
  const pctTone =
    issue.percent === 100 ? "complete" : issue.percent > 0 ? "inProgress" : "notStarted";
  return (
    <div
      className={cn("grid h-[34px] items-center border-b border-[#eef2f7] px-2 text-[9px]", ISSUE_COLS)}
      style={{ backgroundColor: zebra ? "#f8fafc" : "#ffffff" }}
    >
      <span>
        <KeyLink jiraKey={issue.jiraKey} href={href} />
      </span>
      <span className="line-clamp-2 pr-3 leading-[12px] text-[#334155]">{issue.title}</span>
      <span className="text-center">
        <span
          className={cn(
            "inline-block rounded-full px-1.5 py-0.5 text-[8px] font-bold tabular-nums",
            PCT_BADGE[pctTone],
          )}
        >
          {issue.percent}%
        </span>
      </span>
      <span className="text-center tabular-nums text-[#64748b]">
        {totalStages > 0 ? `${issue.completedStages} / ${totalStages}` : "—"}
      </span>
      <span className="text-right">
        <span
          className={cn(
            "inline-block rounded-sm border px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap",
            HEALTH_BADGE[issue.health.tone] ?? HEALTH_BADGE.neutral,
          )}
        >
          {issue.health.status}
        </span>
      </span>
    </div>
  );
}
