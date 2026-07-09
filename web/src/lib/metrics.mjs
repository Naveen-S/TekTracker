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

/** Per-issue health vs the time-elapsed expectation (§12 bands). */
export function getHealthStatus(completionPercent, isBlocked, sprint) {
  if (isBlocked) return { status: "Blocked", tone: "danger", icon: "⊗" };

  const today = new Date();
  const startDate = new Date(sprint.developmentStart);
  const endDate = new Date(sprint.developmentEnd);
  const totalDays = (endDate - startDate) / DAY_MS;
  const elapsedDays = (today - startDate) / DAY_MS;
  const expectedProgress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const progressDelta = completionPercent - expectedProgress;

  if (completionPercent === 100) return { status: "Done", tone: "success", icon: "✓" };
  if (completionPercent === 0 && expectedProgress < 5)
    return { status: "Not Started", tone: "neutral", icon: "○" };
  if (progressDelta >= 10) return { status: "Ahead", tone: "success", icon: "↗" };
  if (progressDelta >= -10) return { status: "On Track", tone: "info", icon: "→" };
  if (progressDelta >= -25) return { status: "At Risk", tone: "warn", icon: "⚠" };
  return { status: "Behind", tone: "danger", icon: "↓" };
}

/** The owning workflow + checklist for an issue: its progress row, else all-false in the filter's workflow. */
export function resolveProgress(jiraKey, filterWorkflowType, progressByKey) {
  const progress = progressByKey[jiraKey];
  const workflowType = progress?.workflowType ?? filterWorkflowType;
  const stageCompletion =
    progress?.stageCompletion ?? new Array(WORKFLOWS[workflowType].stages.length).fill(false);
  return { workflowType, stageCompletion, blocked: progress?.blocked ?? false };
}

/**
 * Aggregate sprint metrics over a set of filters (§12) — same return shape as the prototype's
 * `computeSprintMetrics`, minus hex colors. Issues appearing in several filters are counted per
 * appearance (prototype parity).
 */
export function computeSprintMetrics(filters, progressByKey, sprint) {
  const issues = filters.flatMap((filter) =>
    (filter.issues ?? []).map((issue) => {
      const { workflowType, stageCompletion, blocked } = resolveProgress(
        issue.jiraKey,
        filter.workflowType,
        progressByKey,
      );
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
        health: getHealthStatus(percent, blocked, sprint),
      };
    }),
  );

  const points = issues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const avgProgress =
    issues.length > 0
      ? Math.round(issues.reduce((sum, issue) => sum + issue.percent, 0) / issues.length)
      : 0;
  const completedPoints = issues.reduce(
    (sum, issue) => sum + issue.storyPoints * (issue.percent / 100),
    0,
  );

  const velocityIssues = issues.filter(
    (issue) => issue.workflowType === "FEATURE" || issue.workflowType === "TECH_DEBT",
  );
  const velocityPoints = velocityIssues.reduce((sum, issue) => sum + issue.storyPoints, 0);
  const velocityCompletedPoints = velocityIssues.reduce(
    (sum, issue) => sum + issue.storyPoints * (issue.percent / 100),
    0,
  );

  const countStatuses = (list) => ({
    blocked: list.filter((i) => i.health.status === "Blocked").length,
    behind: list.filter((i) => i.health.status === "Behind").length,
    atRisk: list.filter((i) => i.health.status === "At Risk").length,
    onTrack: list.filter((i) => i.health.status === "On Track").length,
    ahead: list.filter((i) => i.health.status === "Ahead").length,
    done: list.filter((i) => i.health.status === "Done").length,
  });

  const featureIssues = issues.filter((issue) => issue.workflowType === "FEATURE");
  const allHealthCounts = countStatuses(issues);
  const featureHealthCounts = countStatuses(featureIssues);
  const totalFeatureIssues = featureIssues.length;

  return {
    issues,
    totalIssues: issues.length,
    points,
    avgProgress,
    completedPoints,
    velocityPoints,
    velocityCompletedPoints,
    sprintHealth: bandSprintHealth(featureHealthCounts, totalFeatureIssues, avgProgress),
    totalFeatureIssues,
    healthCounts: allHealthCounts,
    featureHealthCounts,
    blockedCount: allHealthCounts.blocked,
    behindCount: allHealthCounts.behind,
    atRiskCount: allHealthCounts.atRisk,
    riskCount: allHealthCounts.blocked + allHealthCounts.behind + allHealthCounts.atRisk,
    featureBlockedCount: featureHealthCounts.blocked,
    featureOnTrackCount: featureHealthCounts.onTrack,
    featureAheadCount: featureHealthCounts.ahead,
  };
}

/**
 * §12 sprint-health banding over FEATURE health counts — shared by `computeSprintMetrics` (one
 * team) and `aggregateRollup` (portfolio, 6b) so `/` and `/rollup` can never drift.
 */
function bandSprintHealth(featureHealthCounts, totalFeatureIssues, avgProgress) {
  if (totalFeatureIssues === 0) return { status: "No Data", tone: "neutral", icon: "○" };
  if (featureHealthCounts.blocked > 0 || featureHealthCounts.behind > totalFeatureIssues * 0.3)
    return { status: "Critical", tone: "danger", icon: "⚠" };
  if (featureHealthCounts.atRisk + featureHealthCounts.behind > totalFeatureIssues * 0.2)
    return { status: "At Risk", tone: "warn", icon: "⚠" };
  if (featureHealthCounts.done === totalFeatureIssues)
    return { status: "Complete", tone: "success", icon: "✓" };
  if (avgProgress >= 90) return { status: "Excellent", tone: "success", icon: "🎯" };
  if (featureHealthCounts.ahead + featureHealthCounts.onTrack > totalFeatureIssues * 0.7)
    return { status: "Healthy", tone: "info", icon: "✓" };
  return { status: "Fair", tone: "info", icon: "→" };
}

const HEALTH_COUNT_KEYS = ["blocked", "behind", "atRisk", "onTrack", "ahead", "done"];

/**
 * Portfolio roll-up over per-team `computeSprintMetrics` results (ed-rollup.md decisions 4–5).
 * Progress rows are keyed PER TEAM (§9) so per-team metrics are computed first and summed here —
 * never recomputed over merged progress maps. Sums for counts/points/velocity inputs,
 * issue-weighted `avgProgress`, and portfolio health = the same §12 bands re-applied to the
 * summed feature health counts (one blocked feature anywhere → Critical; teams with no feature
 * issues contribute nothing; all-empty → No Data). Velocity stays additive: feed the summed
 * `velocityCompletedPoints`/`velocityPoints` to `getWeeklyVelocity` — with the org-wide sprint
 * cadence that equals the sum of per-team weekly velocities. Mirrors the per-team →
 * org-totals shape the step-7 `SprintSnapshot` job will write.
 */
export function aggregateRollup(perTeamMetrics) {
  const sumOf = (pick) => perTeamMetrics.reduce((sum, metrics) => sum + pick(metrics), 0);
  const sumCounts = (pick) =>
    Object.fromEntries(HEALTH_COUNT_KEYS.map((key) => [key, sumOf((m) => pick(m)[key])]));

  const totalIssues = sumOf((m) => m.totalIssues);
  const totalFeatureIssues = sumOf((m) => m.totalFeatureIssues);
  const healthCounts = sumCounts((m) => m.healthCounts);
  const featureHealthCounts = sumCounts((m) => m.featureHealthCounts);
  const avgProgress =
    totalIssues > 0 ? Math.round(sumOf((m) => m.avgProgress * m.totalIssues) / totalIssues) : 0;

  return {
    teamCount: perTeamMetrics.length,
    totalIssues,
    points: sumOf((m) => m.points),
    avgProgress,
    completedPoints: sumOf((m) => m.completedPoints),
    velocityPoints: sumOf((m) => m.velocityPoints),
    velocityCompletedPoints: sumOf((m) => m.velocityCompletedPoints),
    sprintHealth: bandSprintHealth(featureHealthCounts, totalFeatureIssues, avgProgress),
    totalFeatureIssues,
    healthCounts,
    featureHealthCounts,
    blockedCount: healthCounts.blocked,
    behindCount: healthCounts.behind,
    atRiskCount: healthCounts.atRisk,
    riskCount: healthCounts.blocked + healthCounts.behind + healthCounts.atRisk,
    featureBlockedCount: featureHealthCounts.blocked,
    featureOnTrackCount: featureHealthCounts.onTrack,
    featureAheadCount: featureHealthCounts.ahead,
  };
}

/** Naive linear velocity + projection (§12) — replace with SprintSnapshot actuals in step 7. */
export function getWeeklyVelocity(sprint, completedPoints, points) {
  const start = new Date(sprint.developmentStart);
  const today = new Date();
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

export function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
