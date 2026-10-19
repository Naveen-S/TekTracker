/**
 * Pure data-pack shapers for Ask StoryBoard (ask-storyboard.md (a)). Each takes already-loaded,
 * already-RBAC-scoped data and returns the compact, deterministic JSON the model is grounded in —
 * never raw Jira dumps (ai-insights.md decision 7). Deterministic input → fixture-testable payloads
 * and bounded token spend; lists are capped worst-first with an `overflow` count so the model can
 * say "and N more" instead of pretending the list is complete.
 *
 * Storage-free and plain-Node loadable (`.mjs`, RELATIVE imports only — the metrics.mjs /
 * digest.mjs fixture convention). Dates are ISO `YYYY-MM-DD`.
 */
import { getSprintPhase } from "../metrics.mjs";
import { WORKFLOWS } from "../workflows.mjs";
import { sortRisky, trendPayload, velocityPayload } from "../ai/digest.mjs";

export const ASK_TEAM_MAX_ISSUES = 40;
export const ASK_ROLLUP_MAX_RISKS = 30;
export const ASK_BUG_MAX_ISSUES = 15;
export const ASK_TREND_MAX_SPRINTS = 6;
export const ASK_TREND_MAX_POINTS = 10;
export const ASK_LEADERBOARD_MAX_ROWS = 10;

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);
const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

const WORK_TYPE_LABEL = {
  FEATURE: "Committed roadmap",
  TECH_DEBT: "Tech debt",
  SUPPORT: "External bug",
  INTERNAL_BUG: "Internal bug",
  CUSTOM: "Custom",
};

const PHASE_LABEL = {
  dev: "development",
  qa: "QA/UAT (dev cycle over, before release)",
  released: "released",
  ended: "ended",
};

/** Whole-board ordering: the risk panel's worst-first ranks, then the rest, Done last. */
const ISSUE_RANK = {
  Blocked: 0,
  Behind: 1,
  "At Risk": 2,
  "Not Started": 3,
  "On Track": 4,
  Ahead: 5,
  Done: 6,
};
const sortWorstFirst = (issues) =>
  [...issues].sort(
    (a, b) =>
      (ISSUE_RANK[a.health.status] ?? 9) - (ISSUE_RANK[b.health.status] ?? 9) ||
      b.storyPoints - a.storyPoints,
  );

/** The sprint window + where today sits in it (dev → QA/UAT → released). */
export function shapeSprint(sprint, asOf) {
  const phase = getSprintPhase(sprint, asOf);
  return {
    name: sprint.name,
    ...(sprint.state ? { state: sprint.state } : {}),
    devStart: isoDate(sprint.developmentStart),
    devEnd: isoDate(sprint.developmentEnd),
    releaseDate: isoDate(sprint.releaseDate),
    phase: PHASE_LABEL[phase.phase] ?? phase.phase,
    daysToDevEnd: phase.daysToDevEnd,
    daysToRelease: phase.daysToRelease,
  };
}

/** Committed / Tech debt / External / Internal points (committed-unplanned-work.md lens). */
export function shapeComposition(m) {
  const segment = (points, completed, issues) => ({
    points: round1(points),
    completedPoints: round1(completed),
    issues: issues ?? 0,
  });
  return {
    committedRoadmap: segment(m.committedPoints, m.committedCompletedPoints, m.committedIssueCount),
    techDebt: segment(m.techDebtPoints, m.techDebtCompletedPoints, m.techDebtIssueCount),
    externalBugs: segment(m.externalPoints, m.externalCompletedPoints, m.externalIssueCount),
    internalBugs: segment(m.internalPoints, m.internalCompletedPoints, m.internalIssueCount),
  };
}

/** §12 headline numbers, labelled with the lens each one belongs to (two-lens model). */
export function shapeMetrics(m) {
  return {
    totalIssues: m.totalIssues,
    totalPoints: round1(m.points),
    completedPoints: round1(m.completedPoints),
    sprintHealth: m.sprintHealth.status,
    deliveryCompletionPct: m.deliveryAvgProgress,
    allWorkCompletionPct: m.avgProgress,
    deliveryHealthCounts: m.deliveryHealthCounts,
    allWorkHealthCounts: m.healthCounts,
  };
}

/** One resolved board issue (a `computeSprintMetrics(...).issues` row) → prompt row. */
export function shapeIssue(issue, { teamKey } = {}) {
  const stages = WORKFLOWS[issue.workflowType]?.stages ?? [];
  const done = issue.completedStages ?? 0;
  return {
    ...(teamKey ? { teamKey } : {}),
    jiraKey: issue.jiraKey,
    title: issue.title,
    workType: WORK_TYPE_LABEL[issue.workflowType] ?? issue.workflowType,
    track: issue.filterName,
    jiraStatus: issue.jiraStatus,
    assignee: issue.assigneeName ?? null,
    storyPoints: issue.storyPoints,
    percentComplete: issue.percent,
    health: issue.health.status,
    lastCompletedStage: done > 0 ? (stages[done - 1] ?? null) : null,
    nextStage: stages[done] ?? null,
    ...(issue.priority ? { priority: issue.priority } : {}),
    ...(issue.dueDate ? { dueDate: isoDate(issue.dueDate) } : {}),
    ...(issue.blocked && issue.blockedReason ? { blockedReason: issue.blockedReason } : {}),
    ...(issue.riskComment ? { riskComment: issue.riskComment, knownRisk: true } : {}),
  };
}

/**
 * One scrum team's sprint board.
 * @param {{ team: { key: string, name: string }, programName?: string|null, sprint: object,
 *   metrics: object, series: object|null, velocity: object|null,
 *   capacity: { committedPoints: number }|null, lastSyncedAt: Date|string|null, asOf: Date }} args
 */
export function shapeTeamPack({ team, programName, sprint, metrics, series, velocity, capacity, lastSyncedAt, asOf }) {
  const ordered = sortWorstFirst(metrics.issues);
  const issues = ordered.slice(0, ASK_TEAM_MAX_ISSUES).map((issue) => shapeIssue(issue));
  return {
    team: { key: team.key, name: team.name, ...(programName ? { program: programName } : {}) },
    sprint: shapeSprint(sprint, asOf),
    metrics: shapeMetrics(metrics),
    composition: shapeComposition(metrics),
    committedCapacityPoints: capacity ? round1(capacity.committedPoints) : null,
    velocity: velocityPayload(velocity),
    trend: trendPayload(series),
    lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null,
    issues,
    issuesOverflow: Math.max(0, ordered.length - issues.length),
  };
}

/**
 * The portfolio across several teams (my teams, or a whole program).
 * @param {{ scopeLabel: string, sprint: object, perTeam: Array<{ team: object, metrics: object,
 *   capacity: object|null, lastSyncedAt: Date|null }>, combined: object, combinedCapacity: object|null,
 *   series: object|null, velocity: object|null, asOf: Date }} args
 */
export function shapeRollupPack({ scopeLabel, sprint, perTeam, combined, combinedCapacity, series, velocity, asOf }) {
  const teams = perTeam.map(({ team, metrics, capacity, lastSyncedAt }) => ({
    key: team.key,
    name: team.name,
    ...shapeMetrics(metrics),
    composition: shapeComposition(metrics),
    committedCapacityPoints: capacity ? round1(capacity.committedPoints) : null,
    lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt).toISOString() : null,
  }));
  const risky = sortRisky(
    perTeam.flatMap(({ team, metrics }) =>
      metrics.deliveryIssues.map((issue) => ({ ...issue, teamKey: team.key })),
    ),
  );
  const risks = risky
    .slice(0, ASK_ROLLUP_MAX_RISKS)
    .map((issue) => shapeIssue(issue, { teamKey: issue.teamKey }));
  return {
    scope: scopeLabel,
    sprint: shapeSprint(sprint, asOf),
    teamCount: teams.length,
    combined: {
      ...shapeMetrics(combined),
      composition: shapeComposition(combined),
      committedCapacity: combinedCapacity
        ? {
            points: round1(combinedCapacity.committedPoints),
            teamsConfigured: combinedCapacity.configuredTeamCount,
            teamsTotal: combinedCapacity.totalTeamCount,
          }
        : null,
    },
    velocity: velocityPayload(velocity),
    trend: trendPayload(series),
    teams,
    deliveryRisks: risks,
    deliveryRisksOverflow: Math.max(0, risky.length - risks.length),
  };
}

/** Pick ≤ `max` evenly spaced items, always keeping the last (the most recent reading). */
function sample(list, max) {
  if (list.length <= max) return list;
  const step = (list.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, index) => list[Math.round(index * step)]);
}

/**
 * Burndown for the current sprint + the final reading of recent past sprints.
 * @param {{ scopeLabel: string, sprint: object, series: object|null, velocity: object|null,
 *   history: Array<{ sprint: object, totalPoints: number, completedPoints: number,
 *   totalIssues: number, teamsCaptured: number, capturedOn: Date }>, asOf: Date }} args
 */
export function shapeTrendPack({ scopeLabel, sprint, series, velocity, history, asOf }) {
  const points = series?.points ?? [];
  const latest = points.at(-1) ?? null;
  return {
    scope: scopeLabel,
    // One measure on both sides, so a sprint-over-sprint answer compares like with like: the
    // all-work weighted points completion from the daily snapshots (not the delivery-lens %).
    comparisonMeasure: "pointsCompletionPct = completedPoints / totalPoints, all work, from daily snapshots",
    currentSprint: {
      sprint: shapeSprint(sprint, asOf),
      latestReading: latest
        ? {
            date: isoDate(latest.date),
            totalPoints: round1(latest.totalPoints),
            completedPoints: round1(latest.completedPoints),
            pointsCompletionPct: pct(latest.completedPoints, latest.totalPoints),
          }
        : null,
      velocity: velocityPayload(velocity),
      projection: trendPayload(series),
      burndown: sample(points, ASK_TREND_MAX_POINTS).map((point) => ({
        date: isoDate(point.date),
        totalPoints: round1(point.totalPoints),
        completedPoints: round1(point.completedPoints),
        remainingPoints: round1(point.remainingPoints),
      })),
      snapshotDays: points.length,
    },
    previousSprints: history.slice(0, ASK_TREND_MAX_SPRINTS).map((row) => ({
      sprint: row.sprint.name,
      devEnd: isoDate(row.sprint.developmentEnd),
      lastCapturedOn: isoDate(row.capturedOn),
      totalPoints: round1(row.totalPoints),
      completedPoints: round1(row.completedPoints),
      pointsCompletionPct: pct(row.completedPoints, row.totalPoints),
      totalIssues: row.totalIssues,
      teamsCaptured: row.teamsCaptured,
    })),
  };
}

/**
 * One bug-report view (a scope or "all"), from `getBugReportData(...).views[...]`.
 * @param {{ report: object, view: object, scopeLabel: string, scopes: Array<{ id: string }>,
 *   totalRowKey: string, scopeTotalBandKey: string }} args
 */
export function shapeBugsPack({ report, view, scopeLabel, scopes, totalRowKey, scopeTotalBandKey }) {
  const { matrix } = view;
  const categories = matrix.rows
    .filter((row) => !row.isTotal)
    .map((row) => ({
      category: row.rowLabel,
      open: row.grandTotal.count,
      breachedSla: row.grandTotal.breachedCount,
    }));
  const byPriority = matrix.scopes.map((scope) => ({
    scope: scope.name,
    bands: scope.bands.map((band) => ({
      band: band.label,
      open: matrix.totalRow?.cells?.[scope.id]?.[band.key]?.count ?? 0,
      breachedSla: matrix.totalRow?.cells?.[scope.id]?.[band.key]?.breachedCount ?? 0,
    })),
  }));
  // The same bands summed across scopes, so "how many P0s are breached" is a lookup, not model
  // arithmetic (a live answer added four per-scope numbers and got the sum wrong).
  const allScopes = new Map();
  for (const scope of byPriority) {
    for (const band of scope.bands) {
      const total = allScopes.get(band.band) ?? { band: band.band, open: 0, breachedSla: 0 };
      total.open += band.open;
      total.breachedSla += band.breachedSla;
      allScopes.set(band.band, total);
    }
  }
  let deltaOpen = null;
  let deltaBreached = null;
  if (view.diff?.priorDate) {
    for (const scope of scopes) {
      const delta = view.diff.delta?.(totalRowKey, scope.id, scopeTotalBandKey);
      if (!delta) continue;
      deltaOpen = (deltaOpen ?? 0) + delta.count;
      deltaBreached = (deltaBreached ?? 0) + delta.breachedCount;
    }
  }
  const breached = view.breached.slice(0, ASK_BUG_MAX_ISSUES).map((issue) => ({
    jiraKey: issue.jiraKey,
    title: issue.title,
    priority: issue.priority ?? null,
    jiraStatus: issue.jiraStatus,
    assignee: issue.assigneeName ?? null,
    daysOverSla: issue.daysOverSla,
  }));
  const ownership = view.bySprintOwnership?.configured
    ? {
        pattern: view.bySprintOwnership.pattern,
        ours: view.bySprintOwnership.oursCount,
        dependenciesOnOtherTeams: view.bySprintOwnership.dependencyCount,
        noSprint: view.bySprintOwnership.noSprintCount,
      }
    : null;
  return {
    report: report.name,
    scope: scopeLabel,
    lastRefreshedAt: report.lastRefreshedAt ? new Date(report.lastRefreshedAt).toISOString() : null,
    totals: {
      open: matrix.totalRow?.grandTotal.count ?? 0,
      breachedSla: matrix.totalRow?.grandTotal.breachedCount ?? 0,
    },
    changeSincePriorDay: view.diff?.priorDate
      ? { priorDate: isoDate(view.diff.priorDate), open: deltaOpen, breachedSla: deltaBreached }
      : null,
    byCategory: categories,
    byPriorityAllScopes: [...allScopes.values()],
    byPriorityPerScope: byPriority,
    byTeam: view.byTeam.map((team) => ({
      team: team.teamName,
      open: team.count,
      breachedSla: team.breachedCount,
      topAssignees: team.developers.slice(0, 3).map((dev) => ({ name: dev.name, open: dev.count })),
    })),
    aging: {
      buckets: view.aging.buckets.map((bucket) => ({ age: bucket.label, open: bucket.count })),
      oldest: view.aging.oldest
        ? { jiraKey: view.aging.oldest.jiraKey, ageDays: view.aging.oldest.ageDays }
        : null,
    },
    sprintOwnership: ownership,
    worstSlaBreaches: breached,
    breachesOverflow: Math.max(0, view.breached.length - breached.length),
  };
}

/**
 * The velocity leaderboard for one sprint (leaderboard.md): team points per developer and the
 * top developers by completed points.
 */
export function shapeLeaderboardPack({ sprint, boards, asOf }) {
  return {
    sprint: shapeSprint(sprint, asOf),
    teams: boards.teamBoard.slice(0, ASK_LEADERBOARD_MAX_ROWS).map((row) => ({
      rank: row.rank,
      team: row.team.name,
      pointsPerDeveloper: round1(row.perDeveloper),
      completedPoints: round1(row.completedPoints),
      developerCount: row.developerCount,
    })),
    teamsWithoutHeadcount: boards.unconfiguredTeams.map((team) => team.name),
    developers: boards.developerBoard.slice(0, ASK_LEADERBOARD_MAX_ROWS).map((row) => ({
      rank: row.rank,
      name: row.assigneeName,
      team: row.team?.name ?? null,
      completedPoints: round1(row.completedPoints),
      issues: row.issueCount,
    })),
  };
}

/**
 * Everything StoryBoard knows about one Jira key the viewer can see: sprint-board appearances and
 * bug-report appearances.
 */
export function shapeTicketPack({ jiraKey, sprintHits, bugHits, asOf }) {
  return {
    jiraKey,
    onSprintBoards: sprintHits.map(({ team, sprint, issue }) => ({
      team: team.name,
      sprint: shapeSprint(sprint, asOf),
      ...shapeIssue(issue),
    })),
    inBugReports: bugHits.map(({ report, scopeName, issue, daysOverSla }) => ({
      report: report.name,
      scope: scopeName,
      jiraKey: issue.jiraKey,
      title: issue.title,
      jiraStatus: issue.jiraStatus,
      priority: issue.priority ?? null,
      assignee: issue.assigneeName ?? null,
      createdOn: isoDate(issue.jiraCreatedAt),
      daysOverSla,
    })),
  };
}
