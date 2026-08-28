/**
 * Pure layout + shaping helpers for the roll-up PDF export (rollup-export.md).
 *
 * Everything here is a pure function of already-computed metrics — it never re-derives a §12 number,
 * it only re-shapes and formats what `computeSprintMetrics` / `aggregateRollup` already returned.
 * Kept as a plain `.mjs` with RELATIVE imports (the house convention for pure modules) so the
 * verification fixtures can load it under plain Node with no bundler.
 *
 * Height contract: the detail pages reuse the shared `packSections` budget, whose row heights are
 * module constants (team section 84px, track row 24px, issue row 34px, body 620px). The print
 * components in `rollup-export-pages.jsx` are built to those exact heights — change one and the
 * other must follow, or pages will overflow.
 */

import { getSprintPhase, teamVelocityPerDeveloper } from "../metrics.mjs";
import { packSections, TEAM_PAGE_BODY_HEIGHT } from "../export/page-packer.mjs";

export { TEAM_PAGE_BODY_HEIGHT };

/**
 * The four composition work types, mapped to the metrics fields they read. Mirrors
 * `rollup-composition-chart.jsx`'s WORK_TYPES (the on-screen twin) — same fields, same order, so the
 * PDF and the board can't disagree about what "Tech Debt" counts. Colour lives in print-theme.mjs;
 * this module stays presentation-free.
 */
export const WORK_TYPES = [
  { key: "committed", label: "Roadmap", plannedField: "committedPoints", deliveredField: "committedCompletedPoints", countField: "committedIssueCount" },
  { key: "techDebt", label: "Tech Debt", plannedField: "techDebtPoints", deliveredField: "techDebtCompletedPoints", countField: "techDebtIssueCount" },
  { key: "external", label: "External Bugs", plannedField: "externalPoints", deliveredField: "externalCompletedPoints", countField: "externalIssueCount" },
  { key: "internal", label: "Internal Bugs", plannedField: "internalPoints", deliveredField: "internalCompletedPoints", countField: "internalIssueCount" },
];

/** Worst-health-first, mirroring `team-summary-table.jsx` so the PDF and the page rank teams alike. */
const TONE_RANK = { danger: 0, warn: 1, info: 2, success: 3, neutral: 4 };

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Has this sprint finished? Either an admin closed it, or the clock has passed its release date
 * (`released`) / its dev end when it has no release date (`ended`).
 *
 * ONE predicate, two consumers: it picks the risk-emphasis default below, and it gates the Velocity
 * report — which is only meaningful once a sprint is done (rollup-export.md). Keeping them a single
 * function is deliberate: two copies would drift, and "the sprint is over" must mean the same thing
 * to both.
 */
export function isSprintComplete(sprint, asOf) {
  if (!sprint) return false;
  if (sprint.state === "CLOSED") return true;
  const { phase } = getSprintPhase(sprint, asOf);
  return phase === "released" || phase === "ended";
}

/**
 * Risk emphasis default (Naveen, 2026-08-27: "for completed sprint there is no point in
 * highlighting the risk"). A finished sprint reframes toward what landed; anything still running
 * keeps its risk call-outs. Always overridable in the dialog — this only picks the initial value.
 */
export function defaultRiskEmphasis(sprint, asOf) {
  return !isSprintComplete(sprint, asOf);
}

/** One team's four-way composition, plus its planned/delivered totals. Pure read of `metrics`. */
export function teamCompositionRow(entry) {
  const m = entry?.metrics ?? {};
  const segments = WORK_TYPES.map((type) => ({
    key: type.key,
    label: type.label,
    planned: m[type.plannedField] ?? 0,
    delivered: m[type.deliveredField] ?? 0,
    issueCount: m[type.countField] ?? 0,
  }));
  const planned = segments.reduce((sum, s) => sum + s.planned, 0);
  const delivered = segments.reduce((sum, s) => sum + s.delivered, 0);
  return {
    teamId: entry?.team?.id ?? null,
    key: entry?.team?.key ?? "—",
    name: entry?.team?.name ?? "—",
    segments,
    planned,
    delivered,
    pct: pct(delivered, planned),
  };
}

/**
 * Round `values` so they still sum to `total` at the given precision — largest-remainder
 * apportionment.
 *
 * Rounding each column independently is what makes a leadership table fail to add up: the August
 * portfolio's four work types are 310.25 + 412.55 + 132.56 + 171.83, which round to
 * 310 + 413 + 133 + 172 = 1028 beside a TOTAL of 1027. Every column is individually correct and the
 * table is still wrong — exactly the kind of thing that costs a report its credibility.
 *
 * This floors every value, then hands the leftover units to the largest fractional parts (or claws
 * them back from the smallest when the values overshoot). Each figure stays within one unit of its
 * true value AND the row reconciles.
 */
export function apportionRounded(values, total, decimals = 0) {
  const scale = 10 ** decimals;
  const target = Math.round(total * scale);
  const scaled = values.map((value) => (Number.isFinite(value) ? value * scale : 0));
  const out = scaled.map((value) => Math.floor(value));
  let remainder = target - out.reduce((sum, value) => sum + value, 0);

  // Most-deserving first when handing out units; least-deserving first when taking them back.
  const byFraction = scaled
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; remainder > 0 && byFraction.length > 0; i++, remainder--) {
    out[byFraction[i % byFraction.length].index] += 1;
  }
  for (let i = 0; remainder < 0 && byFraction.length > 0; i++, remainder++) {
    out[byFraction[byFraction.length - 1 - (i % byFraction.length)].index] -= 1;
  }
  return out.map((value) => value / scale);
}

/** Parse a dialog-entered team size. Blank / zero / junk all mean "not provided". */
export function parseTeamSize(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Per-team velocity rows for the Velocity report (rollup-export.md).
 *
 * DELIVERED only, ALL WORK — the throughput lens §12 and leaderboard.md decision 2 both use for
 * velocity ("bugs consume real capacity"), and the lens the leadership ask is framed in (12 SP/dev
 * total, split into deliveries + tech debt). The per-type `perDev` values are what answer *"where
 * is that 6 SP/dev going"*: the same four-way composition, divided by team size.
 *
 * `developers` is null when no size was supplied for that team — then every `perDev` is null too
 * and the report falls back to showing that team's raw totals, matching `teamVelocityPerDeveloper`'s
 * existing null-means-unconfigured convention.
 *
 * Size resolution: an ABSENT key in `sizeByTeamId` falls back to the admin `Team.developerCount`; an
 * EXPLICIT blank does NOT. The dialog prefills each field from the admin value, so clearing one is
 * the only way to say "report this team without a per-dev rate" — a fallback there would make that
 * impossible.
 *
 * TOTAL is the team's true all-work `completedPoints`, not the sum of the four columns. They are
 * equal today (no CUSTOM-workflow filter exists, and NEEDS_ATTENTION is already excluded upstream);
 * keeping `completedPoints` means the total stays honest if a CUSTOM track ever appears.
 */
export function velocityRows(perTeam = [], sizeByTeamId = {}) {
  return perTeam.map((entry) => {
    const composition = teamCompositionRow(entry);
    const developers = parseTeamSize(
      sizeByTeamId?.[entry.team.id] ?? entry.team.developerCount ?? null,
    );
    const delivered = entry.metrics?.completedPoints ?? 0;
    return {
      teamId: entry.team.id,
      key: composition.key,
      name: composition.name,
      developers,
      delivered,
      perDev: teamVelocityPerDeveloper(delivered, developers),
      issueCount: entry.metrics?.totalIssues ?? 0,
      segments: reconciledSegments(composition.segments, delivered, developers),
    };
  });
}

/**
 * The four work-type cells for one row, carrying both exact and DISPLAY values.
 *
 * `delivered`/`perDev` stay exact so nothing downstream ever computes off a rounded figure;
 * `deliveredDisplay`/`perDevDisplay` are apportioned so the printed columns sum to the printed row
 * total at both precisions (whole points, and one-decimal rates).
 */
function reconciledSegments(segments, delivered, developers) {
  const perDevTotal = teamVelocityPerDeveloper(delivered, developers);
  const pointsDisplay = apportionRounded(segments.map((s) => s.delivered), delivered, 0);
  const rateDisplay =
    perDevTotal === null
      ? segments.map(() => null)
      : apportionRounded(segments.map((s) => s.delivered / developers), perDevTotal, 1);

  return segments.map((segment, index) => ({
    key: segment.key,
    label: segment.label,
    delivered: segment.delivered,
    perDev: teamVelocityPerDeveloper(segment.delivered, developers),
    deliveredDisplay: pointsDisplay[index],
    perDevDisplay: rateDisplay[index],
  }));
}

/**
 * Portfolio totals for the Velocity report.
 *
 * The overall rate divides SIZED teams' points by SIZED teams' developers — on both sides. Folding
 * an unsized team's points into the numerator while its people are missing from the denominator
 * would inflate the one number leadership quotes. `unsizedTeams` drives the page's caveat line.
 */
export function velocityTotals(rows = []) {
  const sized = rows.filter((row) => row.developers !== null);
  const developers = sized.reduce((sum, row) => sum + row.developers, 0);
  const sizedDelivered = sized.reduce((sum, row) => sum + row.delivered, 0);

  const totalDelivered = rows.reduce((sum, row) => sum + row.delivered, 0);
  const overallPerDev = teamVelocityPerDeveloper(sizedDelivered, developers);

  const exact = WORK_TYPES.map((type, index) => ({
    key: type.key,
    label: type.label,
    delivered: rows.reduce((sum, row) => sum + (row.segments[index]?.delivered ?? 0), 0),
    sizedDelivered: sized.reduce((sum, row) => sum + (row.segments[index]?.delivered ?? 0), 0),
  }));
  const pointsDisplay = apportionRounded(exact.map((e) => e.delivered), totalDelivered, 0);
  const rateDisplay =
    overallPerDev === null
      ? exact.map(() => null)
      : apportionRounded(exact.map((e) => e.sizedDelivered / developers), overallPerDev, 1);

  const segments = exact.map((entry, index) => ({
    key: entry.key,
    label: entry.label,
    delivered: entry.delivered,
    perDev: teamVelocityPerDeveloper(entry.sizedDelivered, developers),
    deliveredDisplay: pointsDisplay[index],
    perDevDisplay: rateDisplay[index],
  }));

  return {
    delivered: totalDelivered,
    issueCount: rows.reduce((sum, row) => sum + row.issueCount, 0),
    developers,
    perDev: overallPerDev,
    sizedTeamCount: sized.length,
    teamCount: rows.length,
    unsizedTeams: rows.filter((row) => row.developers === null).map((row) => row.key),
    segments,
  };
}

/** Velocity order: fastest rate first, then unsized teams by raw delivered. Non-mutating. */
export function orderTeamsByVelocity(rows = []) {
  return [...rows].sort((a, b) => {
    if (a.perDev === null && b.perDev === null) {
      return b.delivered - a.delivered || a.name.localeCompare(b.name);
    }
    if (a.perDev === null) return 1;
    if (b.perDev === null) return -1;
    return b.perDev - a.perDev || a.name.localeCompare(b.name);
  });
}

/**
 * Report order. With risk emphasis ON the reader wants problems first (same ranking the roll-up
 * page itself uses). With it OFF the sprint is done, so the table reads as an achievement ranking —
 * most delivered first. Non-mutating.
 */
export function orderTeamsForReport(perTeam = [], riskEmphasis = true) {
  const rows = [...perTeam];
  if (riskEmphasis) {
    return rows.sort((a, b) => {
      const byHealth =
        (TONE_RANK[a.metrics?.sprintHealth?.tone] ?? 5) - (TONE_RANK[b.metrics?.sprintHealth?.tone] ?? 5);
      return byHealth !== 0 ? byHealth : a.team.name.localeCompare(b.team.name);
    });
  }
  return rows.sort((a, b) => {
    const byDelivered = (b.metrics?.completedPoints ?? 0) - (a.metrics?.completedPoints ?? 0);
    return byDelivered !== 0 ? byDelivered : a.team.name.localeCompare(b.team.name);
  });
}

/**
 * How one composition segment reads under the chosen effort mode. `label` is the cell text;
 * `measure` is the value that drives the segment's width; `fill` is the delivered portion drawn
 * INSIDE that width (only in `both`, which uses the scoreboard's planned-lane / delivered-fill
 * grammar).
 *
 * AGGREGATE points are rounded to whole numbers, matching every other aggregate readout in the app
 * (the sprint export's KPI tiles and `team-summary-table.jsx` both `Math.round`). Weighted
 * completion makes these sums fractional — an unrounded portfolio total reads as "1027.19 / 1117.54"
 * on a leadership sheet, which is noise, not precision. Rounding also disposes of the IEEE-754
 * artifacts `formatPoints` guards elsewhere. Per-ISSUE points keep `formatPoints`, since a single
 * story genuinely can be half a point.
 */
export function effortCells(segment, mode = "both") {
  const planned = segment?.planned ?? 0;
  const delivered = segment?.delivered ?? 0;
  if (mode === "delivered") {
    return { label: String(Math.round(delivered)), detail: null, measure: delivered, fill: delivered };
  }
  if (mode === "planned") {
    return { label: String(Math.round(planned)), detail: null, measure: planned, fill: planned };
  }
  return {
    label: `${Math.round(delivered)} / ${Math.round(planned)}`,
    detail: `${pct(delivered, planned)}%`,
    measure: planned,
    fill: delivered,
  };
}

/** Group one team's already-resolved issues into its tracks, preserving filter order. */
export function tracksForTeam(entry) {
  const issues = entry?.metrics?.issues ?? [];
  const byFilter = new Map();
  for (const issue of issues) {
    if (!byFilter.has(issue.filterId)) {
      byFilter.set(issue.filterId, {
        filterId: issue.filterId,
        name: issue.filterName,
        workflowType: issue.workflowType,
        accentColor: issue.accentColor ?? null,
        issues: [],
      });
    }
    byFilter.get(issue.filterId).issues.push(issue);
  }
  return [...byFilter.values()].map((track) => {
    const points = track.issues.reduce((sum, i) => sum + i.storyPoints, 0);
    const completedPoints = track.issues.reduce((sum, i) => sum + (i.storyPoints * i.percent) / 100, 0);
    return { ...track, points, completedPoints, pct: pct(completedPoints, points) };
  });
}

/**
 * Detail pages: team → track → issue, packed into landscape A4 bodies by the shared packer.
 *
 * Shaped onto the packer's `developers`/`issues` keys (a track reads as a "developer") — the same
 * reuse trick `paginateOwnershipAppendix` uses for buckets → sprints. Teams with no issues are
 * dropped; ORDER is respected as given, so the caller's `orderTeamsForReport` decision survives.
 */
export function paginateRollupDetail(perTeam = [], bodyHeight = TEAM_PAGE_BODY_HEIGHT) {
  const sections = perTeam
    .map((entry) => ({
      key: entry.team.id,
      teamName: entry.team.name,
      teamKey: entry.team.key,
      metrics: entry.metrics,
      capacity: entry.capacity ?? null,
      lastSyncedAt: entry.lastSyncedAt ?? null,
      composition: teamCompositionRow(entry),
      developers: tracksForTeam(entry).map((track) => ({ ...track, name: track.name })),
    }))
    .filter((section) => section.developers.some((track) => track.issues.length > 0));
  return packSections(sections, bodyHeight, "rollupTeams");
}
