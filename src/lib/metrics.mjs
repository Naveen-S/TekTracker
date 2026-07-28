/**
 * Pure sprint metrics (§12) — port of the prototype's `sprintMetricsCompute.js` +
 * `workflows.js` health/velocity helpers onto the server data shapes (ui-port.md decision 4):
 *
 *   filters:       [{ id, name, workflowType, accentColor, jql, issues: IssueCacheRow[] }]
 *   progressByKey: { [jiraKey]: { workflowType, stageCompletion: boolean[], blocked } }
 *   sprint:        { developmentStart, developmentEnd } (Date or ISO string)
 *
 * Per-issue percent/health always use the OWNING workflow's weights (the progress row's
 * `workflowType`, §9) — stricter than the prototype, which fell back to count-based percent on a
 * length mismatch. Colors are semantic `tone` keys (danger/warn/info/success/neutral) mapped to
 * Tailwind classes in the UI — no hex here (coding-standards: no inline styles).
 *
 * Storage-free and plain-Node loadable (`.mjs`, relative imports) — §17 "metrics are pure
 * functions"; fixture-checked against the prototype's outputs (see ui-port.md acceptance).
 */
import { WORKFLOWS } from "./workflows.mjs";

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Workflow types that count toward sprint DELIVERY health (roadmap + tech debt). Support and
 * internal bugs are reactive work — mostly surfaced during QA — so they never move the "is the
 * committed sprint on track" signal (sprint-phases-delivery-lens.md two-lens model); they still
 * render as matrix rows with their own per-issue health, and they DO count toward
 * velocity/throughput (which measures real team capacity).
 */
const DELIVERY_TYPES = new Set(["FEATURE", "TECH_DEBT"]);

const averagePercent = (list) =>
  list.length > 0 ? Math.round(list.reduce((sum, i) => sum + i.percent, 0) / list.length) : 0;
const weightedCompleted = (list) =>
  list.reduce((sum, i) => sum + i.storyPoints * (i.percent / 100), 0);

/** Weighted completion % for one issue's checklist (§12). */
export function calculateWeightedCompletion(stageCompletion, weights) {
  if (!weights || weights.length !== stageCompletion.length) {
    if (stageCompletion.length === 0) return 0;
    return Math.round((stageCompletion.filter(Boolean).length / stageCompletion.length) * 100);
  }
  let totalWeight = 0;
  let completedWeight = 0;
  stageCompletion.forEach((completed, index) => {
    const weight = weights[index] || 0;
    totalWeight += weight;
    if (completed) completedWeight += weight;
  });
  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
}

/**
 * Per-issue health vs the time-elapsed expectation (§12 bands). `asOf` (Date or ISO string,
 * default: now) is the explicit clock — frozen shared views pass their `capturedAt` so health
 * doesn't drift after capture (share-view-export.md decision 6).
 *
 * Once `asOf` is past the dev cycle's `developmentEnd`, the committed delivery deadline has
 * already passed — an incomplete issue can never read as "On Track"/"Ahead" again (that language
 * implies pacing toward a deadline that still lies ahead). This is what let a 93%-complete issue
 * read "On Track" — and the sprint overall read "Excellent" — well after its dev cycle had ended.
 */
export function getHealthStatus(completionPercent, isBlocked, sprint, asOf) {
  if (isBlocked) return { status: "Blocked", tone: "danger", icon: "⊗" };
  if (completionPercent === 100) return { status: "Done", tone: "success", icon: "✓" };

  const today = asOf ? new Date(asOf) : new Date();
  const startDate = new Date(sprint.developmentStart);
  const endDate = new Date(sprint.developmentEnd);
  const totalDays = (endDate - startDate) / DAY_MS;
  const elapsedDays = (today - startDate) / DAY_MS;
  const isPastDeadline = today > endDate;
  const expectedProgress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const progressDelta = completionPercent - expectedProgress;

  if (completionPercent === 0 && expectedProgress < 5)
    return { status: "Not Started", tone: "neutral", icon: "○" };

  if (isPastDeadline) {
    if (completionPercent >= 90) return { status: "At Risk", tone: "warn", icon: "⚠" };
    return { status: "Behind", tone: "danger", icon: "↓" };
  }

  if (progressDelta >= 10) return { status: "Ahead", tone: "success", icon: "↗" };
  if (progressDelta >= -10) return { status: "On Track", tone: "info", icon: "→" };
  if (progressDelta >= -25) return { status: "At Risk", tone: "warn", icon: "⚠" };
  return { status: "Behind", tone: "danger", icon: "↓" };
}

/**
 * The owning workflow + checklist for an issue: its progress row, else all-false in the filter's
 * workflow. `blockedReason`/`riskComment` (risk-comments-rollup-digest.md) are display-only
 * annotations passed through here — never inputs to `calculateWeightedCompletion`/health scoring
 * below — so they ride the same per-team resolution and never require merging progress maps
 * across teams (§9): each caller resolves them from its OWN team's `progressByKey`.
 */
export function resolveProgress(jiraKey, filterWorkflowType, progressByKey) {
  const progress = progressByKey[jiraKey];
  const workflowType = progress?.workflowType ?? filterWorkflowType;
  const stageCompletion =
    progress?.stageCompletion ?? new Array(WORKFLOWS[workflowType].stages.length).fill(false);
  return {
    workflowType,
    stageCompletion,
    blocked: progress?.blocked ?? false,
    blockedReason: progress?.blockedReason ?? null,
    riskComment: progress?.riskComment ?? null,
  };
}

/**
 * Aggregate sprint metrics over a set of filters (§12) — same return shape as the prototype's
 * `computeSprintMetrics`, minus hex colors. Issues appearing in several filters are counted per
 * appearance (prototype parity). Optional `asOf` is the health clock (frozen shares).
 */
export function computeSprintMetrics(filters, progressByKey, sprint, asOf) {
  const issues = filters.flatMap((filter) =>
    (filter.issues ?? []).map((issue) => {
      const { workflowType, stageCompletion, blocked, blockedReason, riskComment } =
        resolveProgress(issue.jiraKey, filter.workflowType, progressByKey);
      const percent = calculateWeightedCompletion(stageCompletion, WORKFLOWS[workflowType].weights);
      return {
        ...issue,
        filterId: filter.id,
        filterName: filter.name,
        accentColor: filter.accentColor,
        workflowType,
        percent,
        completedStages: stageCompletion.filter(Boolean).length,
        blocked,
        blockedReason,
        riskComment,
        health: getHealthStatus(percent, blocked, sprint, asOf),
      };
    }),
  );

  const points = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const avgProgress = averagePercent(issues);
  const completedPoints = weightedCompleted(issues);

  // Throughput lens (sprint-phases-delivery-lens.md): velocity/capacity counts ALL work — support
  // + internal bugs consume real team capacity — so it tracks the all-work points (was
  // FEATURE + TECH_DEBT only, which wrongly dropped support).
  const velocityPoints = points;
  const velocityCompletedPoints = completedPoints;

  const countStatuses = (list) => ({
    blocked: list.filter((i) => i.health.status === "Blocked").length,
    behind: list.filter((i) => i.health.status === "Behind").length,
    atRisk: list.filter((i) => i.health.status === "At Risk").length,
    onTrack: list.filter((i) => i.health.status === "On Track").length,
    ahead: list.filter((i) => i.health.status === "Ahead").length,
    done: list.filter((i) => i.health.status === "Done").length,
  });

  // Delivery lens: sprint health / completion / at-risk track only the committed deliverables
  // (roadmap + tech debt) against the dev cycle. Support/regression bugs stay out of these signals
  // (two-lens model) but keep their own matrix rows + per-issue health, and feed velocity above.
  const deliveryIssues = issues.filter((issue) => DELIVERY_TYPES.has(issue.workflowType));
  const totalDeliveryIssues = deliveryIssues.length;
  const deliveryPoints = deliveryIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const deliveryCompletedPoints = weightedCompleted(deliveryIssues);
  const deliveryAvgProgress = averagePercent(deliveryIssues);
  const deliveryHealthCounts = countStatuses(deliveryIssues);
  const healthCounts = countStatuses(issues);

  return {
    issues,
    deliveryIssues,
    totalIssues: issues.length,
    totalDeliveryIssues,
    points,
    avgProgress,
    completedPoints,
    deliveryPoints,
    deliveryCompletedPoints,
    deliveryAvgProgress,
    velocityPoints,
    velocityCompletedPoints,
    sprintHealth: bandSprintHealth(deliveryHealthCounts, totalDeliveryIssues, deliveryAvgProgress),
    healthCounts,
    deliveryHealthCounts,
    blockedCount: deliveryHealthCounts.blocked,
    behindCount: deliveryHealthCounts.behind,
    atRiskCount: deliveryHealthCounts.atRisk,
    riskCount:
      deliveryHealthCounts.blocked + deliveryHealthCounts.behind + deliveryHealthCounts.atRisk,
  };
}

/**
 * §12 sprint-health banding over DELIVERY health counts (roadmap + tech debt — the two-lens
 * model, sprint-phases-delivery-lens.md; was FEATURE-only pre-2026-07-24). Shared by
 * `computeSprintMetrics` (one team) and `aggregateRollup` (portfolio, 6b) so `/` and `/rollup`
 * can never drift.
 */
function bandSprintHealth(deliveryHealthCounts, totalDeliveryIssues, avgProgress) {
  if (totalDeliveryIssues === 0) return { status: "No Data", tone: "neutral", icon: "○" };
  if (deliveryHealthCounts.blocked > 0 || deliveryHealthCounts.behind > totalDeliveryIssues * 0.3)
    return { status: "Critical", tone: "danger", icon: "⚠" };
  if (deliveryHealthCounts.atRisk + deliveryHealthCounts.behind > totalDeliveryIssues * 0.2)
    return { status: "At Risk", tone: "warn", icon: "⚠" };
  if (deliveryHealthCounts.done === totalDeliveryIssues)
    return { status: "Complete", tone: "success", icon: "✓" };
  if (avgProgress >= 90) return { status: "Excellent", tone: "success", icon: "🎯" };
  if (deliveryHealthCounts.ahead + deliveryHealthCounts.onTrack > totalDeliveryIssues * 0.7)
    return { status: "Healthy", tone: "info", icon: "✓" };
  return { status: "Fair", tone: "info", icon: "→" };
}

const HEALTH_COUNT_KEYS = ["blocked", "behind", "atRisk", "onTrack", "ahead", "done"];

/**
 * Portfolio roll-up over per-team `computeSprintMetrics` results (ed-rollup.md decisions 4–5).
 * Progress rows are keyed PER TEAM (§9) so per-team metrics are computed first and summed here —
 * never recomputed over merged progress maps. Sums for counts/points/velocity inputs,
 * issue-weighted `avgProgress`, and portfolio health = the same §12 bands re-applied to the
 * summed DELIVERY health counts (one blocked roadmap/tech-debt item anywhere → Critical; teams
 * with no delivery issues contribute nothing; all-empty → No Data). Velocity stays additive: feed the summed
 * `velocityCompletedPoints`/`velocityPoints` to `getWeeklyVelocity` — with the org-wide sprint
 * cadence that equals the sum of per-team weekly velocities. Mirrors the per-team →
 * org-totals shape the step-7 `SprintSnapshot` job will write.
 */
export function aggregateRollup(perTeamMetrics) {
  const sumOf = (pick) => perTeamMetrics.reduce((sum, metrics) => sum + pick(metrics), 0);
  const sumCounts = (pick) =>
    Object.fromEntries(HEALTH_COUNT_KEYS.map((key) => [key, sumOf((m) => pick(m)[key])]));

  const totalIssues = sumOf((m) => m.totalIssues);
  const totalDeliveryIssues = sumOf((m) => m.totalDeliveryIssues);
  const healthCounts = sumCounts((m) => m.healthCounts);
  const deliveryHealthCounts = sumCounts((m) => m.deliveryHealthCounts);
  const avgProgress =
    totalIssues > 0 ? Math.round(sumOf((m) => m.avgProgress * m.totalIssues) / totalIssues) : 0;
  const deliveryAvgProgress =
    totalDeliveryIssues > 0
      ? Math.round(
          sumOf((m) => m.deliveryAvgProgress * m.totalDeliveryIssues) / totalDeliveryIssues,
        )
      : 0;

  return {
    teamCount: perTeamMetrics.length,
    totalIssues,
    totalDeliveryIssues,
    points: sumOf((m) => m.points),
    deliveryPoints: sumOf((m) => m.deliveryPoints),
    avgProgress,
    deliveryAvgProgress,
    completedPoints: sumOf((m) => m.completedPoints),
    deliveryCompletedPoints: sumOf((m) => m.deliveryCompletedPoints),
    velocityPoints: sumOf((m) => m.velocityPoints),
    velocityCompletedPoints: sumOf((m) => m.velocityCompletedPoints),
    sprintHealth: bandSprintHealth(deliveryHealthCounts, totalDeliveryIssues, deliveryAvgProgress),
    healthCounts,
    deliveryHealthCounts,
    blockedCount: deliveryHealthCounts.blocked,
    behindCount: deliveryHealthCounts.behind,
    atRiskCount: deliveryHealthCounts.atRisk,
    riskCount:
      deliveryHealthCounts.blocked + deliveryHealthCounts.behind + deliveryHealthCounts.atRisk,
  };
}

/**
 * Per-developer weighted-point aggregation over one team+sprint's ALREADY-RESOLVED issues (the
 * `issues` array `computeSprintMetrics` returns — same ALL-WORK throughput scope as
 * `velocityPoints`/`velocityCompletedPoints`, leaderboard.md decision 2 "everything counts").
 * Reuses the per-issue `percent`/`storyPoints` `computeSprintMetrics` already resolved — no
 * re-derivation of the delivery/throughput lens split, no re-running `calculateWeightedCompletion`.
 * Unassigned issues (`assigneeAccountId` null/undefined) are SKIPPED (decision 8) — they already
 * count toward the team total via `computeSprintMetrics.completedPoints`, which this function does
 * not touch.
 *
 * @param {Array} issues — `computeSprintMetrics(...).issues`
 * @returns {Array<{ assigneeAccountId: string, assigneeName: string, totalPoints: number,
 *   completedPoints: number, issueCount: number }>} unsorted, one row per distinct account id.
 */
export function aggregateByDeveloper(issues) {
  const byDeveloper = new Map();
  for (const issue of issues) {
    if (!issue.assigneeAccountId) continue;
    const entry = byDeveloper.get(issue.assigneeAccountId) ?? {
      assigneeAccountId: issue.assigneeAccountId,
      assigneeName: issue.assigneeName ?? "Unknown",
      totalPoints: 0,
      completedPoints: 0,
      issueCount: 0,
    };
    entry.totalPoints += issue.storyPoints;
    entry.completedPoints += issue.storyPoints * (issue.percent / 100);
    entry.issueCount += 1;
    byDeveloper.set(issue.assigneeAccountId, entry);
  }
  return [...byDeveloper.values()];
}

/**
 * Team-velocity-per-developer — `completedPoints ÷ developerCount` (leaderboard.md decisions 1 + 3:
 * numerator is the SAME weighted-completion metric as everywhere else, denominator is the
 * admin-entered `Team.developerCount`). `null` when `developerCount` is unset/≤0 — the caller
 * excludes the team from the ranked board but still shows its developers individually.
 *
 * @param {number} completedPoints
 * @param {number|null|undefined} developerCount
 * @returns {number|null}
 */
export function teamVelocityPerDeveloper(completedPoints, developerCount) {
  if (!developerCount || developerCount <= 0) return null;
  return completedPoints / developerCount;
}

/**
 * All-time cross-sprint TEAM totals — sums the all-work throughput fields
 * (`velocityPoints`/`velocityCompletedPoints`) over every (team, sprint) `computeSprintMetrics`
 * result the caller ran (one row per team+sprint pair that had ≥1 filter).
 *
 * @param {Array<{ teamId: string, metrics: object }>} historyRows
 * @returns {Array<{ teamId: string, totalPoints: number, completedPoints: number,
 *   sprintsCounted: number }>}
 */
export function aggregateTeamAllTime(historyRows) {
  const byTeam = new Map();
  for (const { teamId, metrics } of historyRows) {
    const entry = byTeam.get(teamId) ?? {
      teamId,
      totalPoints: 0,
      completedPoints: 0,
      sprintsCounted: 0,
    };
    entry.totalPoints += metrics.velocityPoints;
    entry.completedPoints += metrics.velocityCompletedPoints;
    entry.sprintsCounted += 1;
    byTeam.set(teamId, entry);
  }
  return [...byTeam.values()];
}

/**
 * All-time cross-sprint DEVELOPER totals — sums `aggregateByDeveloper` over the same
 * `historyRows`, across every team (the developer board is ORG-WIDE regardless of the viewer's own
 * teams, decision 5). A developer who appears under more than one team (a loaned engineer, Open
 * Risk 3) has their points summed correctly; the `teamId` tag reflects whichever row was LAST
 * encountered for that developer, so callers should pass `historyRows` in a stable, meaningful
 * order (e.g. sprint ascending, so the tag reads as "most recent team") — this is a display
 * simplification, not a scoring one.
 *
 * @param {Array<{ teamId: string, metrics: object }>} historyRows
 * @returns {Array<{ assigneeAccountId: string, assigneeName: string, teamId: string,
 *   totalPoints: number, completedPoints: number, issueCount: number }>}
 */
export function aggregateDeveloperAllTime(historyRows) {
  const byDeveloper = new Map();
  for (const { teamId, metrics } of historyRows) {
    for (const row of aggregateByDeveloper(metrics.issues)) {
      const entry = byDeveloper.get(row.assigneeAccountId) ?? {
        assigneeAccountId: row.assigneeAccountId,
        assigneeName: row.assigneeName,
        teamId,
        totalPoints: 0,
        completedPoints: 0,
        issueCount: 0,
      };
      entry.totalPoints += row.totalPoints;
      entry.completedPoints += row.completedPoints;
      entry.issueCount += row.issueCount;
      entry.teamId = teamId;
      byDeveloper.set(row.assigneeAccountId, entry);
    }
  }
  return [...byDeveloper.values()];
}

/**
 * Attach 1-based competition rank to `rows` sorted DESC by `metricKey` — ties share a rank, the
 * next distinct value skips (1, 2, 2, 4). Pure; keeps full float precision, rounds only at render
 * time (the MetricGrid convention).
 *
 * @param {Array<object>} rows
 * @param {{ metricKey: string }} opts
 * @returns {Array<object & { rank: number }>}
 */
export function rankBy(rows, { metricKey }) {
  const sorted = [...rows].sort((a, b) => b[metricKey] - a[metricKey]);
  let rank = 0;
  let lastValue = null;
  return sorted.map((row, index) => {
    if (lastValue === null || row[metricKey] !== lastValue) {
      rank = index + 1;
      lastValue = row[metricKey];
    }
    return { ...row, rank };
  });
}

/**
 * §9 `SprintSnapshot` column values off one team's `computeSprintMetrics` result
 * (background-sync-snapshots.md (a), step 7). Trivial by design — it pins the metrics→row
 * contract so the cron job never re-derives it: `totalPoints ← points`; `healthCounts` passes
 * through (already the §9 JSON comment shape since 6b). Summed over team rows these equal
 * `aggregateRollup`'s org totals (§9 "org totals = sum over teams").
 */
export function snapshotValues(metrics) {
  return {
    totalPoints: metrics.points,
    completedPoints: metrics.completedPoints,
    avgProgress: metrics.avgProgress,
    totalIssues: metrics.totalIssues,
    healthCounts: metrics.healthCounts,
  };
}

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Combine per-team `SprintSnapshot` rows into one per-day series for the roll-up burndown
 * (trend-burndown.md decisions 6–7). Days with partial team coverage are summed AS-IS and
 * tagged with `teamCount` — dropping incomplete days would blank the whole chart the moment one
 * team never syncs. Sums for points/issues, issue-weighted `avgProgress` (the `aggregateRollup`
 * convention); `capturedOn` stays a UTC-midnight Date. Sorted ascending.
 */
export function combineSnapshotsByDay(snapshotRows) {
  const byDay = new Map();
  for (const row of snapshotRows) {
    const key = new Date(row.capturedOn).toISOString().slice(0, 10);
    const day = byDay.get(key) ?? {
      capturedOn: new Date(`${key}T00:00:00.000Z`),
      totalPoints: 0,
      completedPoints: 0,
      totalIssues: 0,
      weightedProgress: 0,
      teamCount: 0,
    };
    day.totalPoints += row.totalPoints;
    day.completedPoints += row.completedPoints;
    day.totalIssues += row.totalIssues;
    day.weightedProgress += row.avgProgress * row.totalIssues;
    day.teamCount += 1;
    byDay.set(key, day);
  }
  return [...byDay.values()]
    .sort((a, b) => a.capturedOn - b.capturedOn)
    .map(({ weightedProgress, ...day }) => ({
      ...day,
      avgProgress: day.totalIssues > 0 ? Math.round(weightedProgress / day.totalIssues) : 0,
    }));
}

/**
 * The trailing burn rate over the last 7 days of snapshot points (whole series when the window
 * holds fewer than 2 points) — the shared basis for the chart projection and the snapshot
 * velocity (trend-burndown.md decision 4). Returns null when a rate can't be derived.
 */
function trailingBurn(points) {
  if (points.length < 2) return null;
  const last = points[points.length - 1];
  const windowStart = last.date.getTime() - 7 * DAY_MS;
  let window = points.filter((point) => point.date.getTime() >= windowStart);
  if (window.length < 2) window = points;
  const first = window[0];
  const basisDays = (last.date - first.date) / DAY_MS;
  if (basisDays <= 0) return null;
  return {
    ratePerDay: (last.completedPoints - first.completedPoints) / basisDays,
    basisDays,
    last,
  };
}

/**
 * Burndown series off one team's (or the roll-up's combined) `SprintSnapshot` rows
 * (trend-burndown.md (a)): `points` (remaining-points actuals, ascending), `ideal` (latest
 * total → 0 across the sprint window — the latest total because scope grows mid-sprint), and
 * `projection` (trailing-7-day linear burn, decision 4). No projection with < 2 snapshots or
 * once `asOf` is past `developmentEnd` (CLOSED/overrun sprints — the window is over).
 * `projection.line` is the drawable dashed segment: to the zero-crossing when finishing inside
 * the window, clamped at `developmentEnd` (or flat, when there is no burn) otherwise.
 * Storage-free; Date-or-ISO tolerant like the rest of this module.
 */
export function buildTrendSeries(snapshots, sprint, asOf) {
  const points = (snapshots ?? [])
    .map((row) => ({
      date: new Date(row.capturedOn),
      totalPoints: row.totalPoints,
      completedPoints: row.completedPoints,
      remainingPoints: Math.max(0, round1(row.totalPoints - row.completedPoints)),
      avgProgress: row.avgProgress,
      totalIssues: row.totalIssues,
      ...(row.teamCount !== undefined ? { teamCount: row.teamCount } : {}),
    }))
    .sort((a, b) => a.date - b.date);

  if (points.length === 0) return { points, ideal: null, projection: null };

  const startDate = new Date(sprint.developmentStart);
  const endDate = new Date(sprint.developmentEnd);
  const latestTotal = points[points.length - 1].totalPoints;
  const ideal = {
    start: { date: startDate, remaining: latestTotal },
    end: { date: endDate, remaining: 0 },
  };

  const today = asOf ? new Date(asOf) : new Date();
  const burn = today > endDate ? null : trailingBurn(points);
  if (!burn) return { points, ideal, projection: null };

  const { ratePerDay, basisDays, last } = burn;
  const remaining = last.remainingPoints;
  let projectedFinishDate = null;
  let line;
  if (ratePerDay > 0) {
    projectedFinishDate = new Date(last.date.getTime() + (remaining / ratePerDay) * DAY_MS);
    const lineEndDate = projectedFinishDate <= endDate ? projectedFinishDate : endDate;
    const lineEndRemaining =
      projectedFinishDate <= endDate
        ? 0
        : round1(remaining - ratePerDay * ((endDate - last.date) / DAY_MS));
    line = [
      { date: last.date, remaining },
      { date: lineEndDate, remaining: lineEndRemaining },
    ];
  } else {
    // No (or negative) burn: an honest flat dashed line to sprint end.
    line = [
      { date: last.date, remaining },
      { date: endDate, remaining },
    ];
  }

  return {
    points,
    ideal,
    projection: {
      ratePerDay,
      ptsPerWeek: round1(ratePerDay * 7),
      basisDays,
      projectedFinishDate,
      onTrack: projectedFinishDate !== null && projectedFinishDate <= endDate,
      line,
    },
  };
}

/**
 * Snapshot-based weekly velocity in the shape the MetricGrid velocity card consumes from
 * `getWeeklyVelocity` (trend-burndown.md decision 5 — the §12 swap). Derived from the same
 * trailing-7-day burn as the chart projection so the two never disagree. `null` under the
 * < 2-snapshot guard → the card falls back to the naive model. `weeksNeeded` is `null` (not 0)
 * when there is work left but no burn — the card renders that honestly instead of "on pace".
 */
export function snapshotVelocity(points, sprint, asOf) {
  const burn = trailingBurn(points ?? []);
  if (!burn) return null;

  const start = new Date(sprint.developmentStart);
  const end = new Date(sprint.developmentEnd);
  const today = asOf ? new Date(asOf) : new Date();
  const totalWeeks = Math.ceil((end - start) / DAY_MS / 7);
  const weeksElapsed = Math.max(1, Math.ceil(Math.max(0, today - start) / (DAY_MS * 7)));

  const velocity = round1(burn.ratePerDay * 7);
  const remaining = burn.last.remainingPoints;
  const weeksNeeded =
    velocity > 0 ? Math.ceil(remaining / velocity) : remaining > 0 ? null : 0;

  return {
    velocity,
    weeksElapsed,
    totalWeeks,
    weeksNeeded,
    onTrack: weeksNeeded !== null && weeksNeeded <= totalWeeks - weeksElapsed,
    projectedFinishDate:
      burn.ratePerDay > 0
        ? new Date(burn.last.date.getTime() + (remaining / burn.ratePerDay) * DAY_MS)
        : null,
    fromSnapshots: true,
  };
}

/**
 * Naive linear velocity + projection (§12) — superseded on `/` and `/rollup` by
 * `snapshotVelocity` when ≥ 2 snapshots exist (trend-burndown.md decision 5); deliberately
 * retained as the fallback and the only model on share/export paths (frozen-share pin).
 * Optional `asOf` is the explicit clock (frozen shares, decision 6).
 */
export function getWeeklyVelocity(sprint, completedPoints, points, asOf) {
  const start = new Date(sprint.developmentStart);
  const today = asOf ? new Date(asOf) : new Date();
  const end = new Date(sprint.developmentEnd);

  const totalDuration = (end - start) / DAY_MS;
  const totalWeeks = Math.ceil(totalDuration / 7);
  const elapsed = Math.max(0, today - start);
  const weeksElapsed = Math.max(1, Math.ceil(elapsed / (DAY_MS * 7)));

  const velocity = weeksElapsed > 0 ? (completedPoints / weeksElapsed).toFixed(1) : 0;
  const remainingPoints = points - completedPoints;
  const weeksNeeded = velocity > 0 ? Math.ceil(remainingPoints / velocity) : 0;

  return {
    velocity: parseFloat(velocity),
    weeksElapsed,
    totalWeeks,
    weeksNeeded,
    onTrack: weeksNeeded <= totalWeeks - weeksElapsed,
    projectedPoints: parseFloat(velocity) * totalWeeks,
  };
}

export function getDaysRemaining(sprint) {
  return Math.ceil((new Date(sprint.developmentEnd) - new Date()) / DAY_MS);
}

/**
 * Where the sprint sits on the dev → QA/UAT → release timeline (sprint-phases-delivery-lens.md).
 * The committed delivery runs to `developmentEnd`; the window from dev end to `releaseDate` is the
 * QA/UAT cycle; the sprint TRULY ends at `releaseDate` (not dev end). Without a release date we
 * can't define a QA window, so the sprint is treated as ending at dev end (legacy behavior).
 * `asOf` (Date | ISO, default now) is the explicit clock.
 *   phase: "dev" | "qa" | "released" | "ended"
 *   qaProgress: 0..1 through the QA/UAT window (only in the "qa" phase; else null)
 */
export function getSprintPhase(sprint, asOf) {
  const now = asOf ? new Date(asOf) : new Date();
  const devEnd = new Date(sprint.developmentEnd);
  const release = sprint.releaseDate ? new Date(sprint.releaseDate) : null;
  const daysUntil = (date) => Math.ceil((date - now) / DAY_MS);

  if (now <= devEnd) {
    return {
      phase: "dev",
      daysToDevEnd: daysUntil(devEnd),
      daysToRelease: release ? daysUntil(release) : null,
      qaProgress: null,
    };
  }
  if (release && now <= release) {
    const span = release - devEnd;
    return {
      phase: "qa",
      daysToDevEnd: daysUntil(devEnd),
      daysToRelease: daysUntil(release),
      qaProgress: span > 0 ? Math.max(0, Math.min(1, (now - devEnd) / span)) : 1,
    };
  }
  if (release) {
    return {
      phase: "released",
      daysToDevEnd: daysUntil(devEnd),
      daysToRelease: daysUntil(release),
      qaProgress: 1,
    };
  }
  return { phase: "ended", daysToDevEnd: daysUntil(devEnd), daysToRelease: null, qaProgress: null };
}

/**
 * Eyebrow window label spelling out both cycles, e.g.
 * "Dev cycle Jun 25 – Jul 23 · QA/UAT → release Aug 12" (dev range only when no release date).
 */
export function formatSprintWindow(sprint) {
  const dev = `Dev cycle ${formatDate(sprint.developmentStart)} – ${formatDate(sprint.developmentEnd)}`;
  return sprint.releaseDate ? `${dev} · QA/UAT → release ${formatDate(sprint.releaseDate)}` : dev;
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * UTC-pinned date label for `SprintSnapshot.capturedOn` (UTC midnights, step-7 decision 6).
 * The trend panel renders server-side on `/rollup` but hydrates inside the client tree on `/` —
 * local-tz formatting would shift the day west of UTC and mismatch on hydration.
 */
export function formatDateUTC(value, { year = true } = {}) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
