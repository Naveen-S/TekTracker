/**
 * Server-only bug-report data assembly (gm-bug-report.md (f); extended by enhancing-bug-board.md
 * (d)) — the `/bugs` page resolves a report by slug (or the first active one), its config, cached
 * issues, and — computed at read time from raw cached facts + current config — the matrix, prior-day
 * deltas, trend, aging, breach list, and the by-scrum-team breakdown. Reads go straight through
 * Prisma (server components fetch directly), mirroring `dashboard-data.js`.
 *
 * The scope toggle (enhancing-bug-board.md decision 2) is served by pre-computing ONE view per
 * scope plus an "all" view here; the page pre-renders all of them and a client switcher mounts the
 * selected one, so switching is instant with no server round-trip. Everything is derived from a
 * single issues + single snapshot query, sliced in memory.
 *
 * The team of a bug is a READ-TIME, FK-less join to the `JiraSubComponent → Team` catalog
 * (enhancing-bug-board.md decision 3): the cache stays a dumb Jira mirror; claiming a sub-component
 * in /admin re-renders instantly with no refresh, exactly like band/category/SLA classification.
 */
import { prisma } from "@/lib/db";
import {
  agingBuckets,
  buildMatrix,
  diffMatrix,
  daysOverSla,
  cellJql,
  cellBreachedJql,
  SCOPE_TOTAL_BAND_KEY,
  TOTAL_ROW_KEY,
} from "@/lib/bug-report/matrix.mjs";
import { buildSubComponentTeamMap, buildSlaByScope, groupByTeam } from "@/lib/bug-report/by-team.mjs";
import { groupBySprintOwnership } from "@/lib/bug-report/sprint-ownership.mjs";

const EMPTY_SLA = new Map();

const CONFIG_INCLUDE = {
  scopes: { orderBy: { sortOrder: "asc" }, include: { slaTargets: true } },
  bands: { orderBy: { sortOrder: "asc" } },
  categories: { orderBy: { sortOrder: "asc" } },
};

/** Every report, for the switcher + admin list. */
export async function listBugReports() {
  return prisma.bugReport.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, isActive: true, lastRefreshedAt: true },
  });
}

/** One report with its full config — the admin surface's read. */
export async function getBugReportConfig(reportId) {
  return prisma.bugReport.findUnique({ where: { id: reportId }, include: CONFIG_INCLUDE });
}

/**
 * The `/bugs` read. Returns `null` when no report exists at all (the empty-config state).
 *
 * @param {string} [slug] from the route segment; falls back to the first active report
 * @param {Date} [asOf] request-time clock — one instant for the whole render so it cannot
 *   straddle midnight (the share-view-export.md `asOf` precedent)
 */
export async function getBugReportData(slug, asOf = new Date()) {
  const reports = await listBugReports();
  if (reports.length === 0) return null;

  const selected =
    (slug && reports.find((report) => report.slug === slug)) ??
    reports.find((report) => report.isActive) ??
    reports[0];

  const report = await prisma.bugReport.findUnique({
    where: { id: selected.id },
    include: CONFIG_INCLUDE,
  });
  if (!report) return null;

  const configured = report.scopes.length > 0 && report.bands.length > 0;

  const issues = configured
    ? await prisma.bugReportIssue.findMany({
        where: { reportId: report.id },
        orderBy: { jiraCreatedAt: "asc" },
      })
    : [];

  // Deltas come from the most recent PRIOR capture day — never zero-filled across a gap.
  const priorDay = await prisma.bugReportSnapshot.findFirst({
    where: { reportId: report.id, capturedOn: { lt: startOfUtcDay(asOf) } },
    orderBy: { capturedOn: "desc" },
    select: { capturedOn: true },
  });
  const priorRows = priorDay
    ? await prisma.bugReportSnapshot.findMany({
        where: { reportId: report.id, capturedOn: priorDay.capturedOn },
      })
    : [];

  // Trend: the Total row's per-scope totals per captured day (sliced per scope in buildTrendSeries).
  const trendRows = await prisma.bugReportSnapshot.findMany({
    where: { reportId: report.id, rowKey: TOTAL_ROW_KEY, bandKey: SCOPE_TOTAL_BAND_KEY },
    orderBy: { capturedOn: "asc" },
    select: { capturedOn: true, scopeKey: true, scopeLabel: true, count: true, breachedCount: true },
  });

  // Read-time sub-component → team catalog (enhancing-bug-board.md decision 3), loaded once.
  const catalogRows = configured
    ? await prisma.jiraSubComponent.findMany({
        include: { team: { select: { id: true, key: true, name: true } } },
      })
    : [];
  const teamMap = buildSubComponentTeamMap(catalogRows);
  const slaByScope = buildSlaByScope(report.scopes);

  // One view per scope + an "all" view; derived in memory (no extra queries) — enhancing-bug-board (d).
  const buildView = (scopeSubset, scopeId) => {
    const scopeIds = new Set(scopeSubset.map((scope) => scope.id));
    const viewIssues = scopeId ? issues.filter((issue) => scopeIds.has(issue.scopeId)) : issues;
    const config = scopeId ? { ...report, scopes: scopeSubset } : report;
    const matrix = buildMatrix(viewIssues, config, asOf);
    const diff = diffMatrix(matrix, priorRows);
    const breached = viewIssues
      .map((issue) => {
        const over = daysOverSla(issue, slaByScope.get(issue.scopeId) ?? EMPTY_SLA, asOf);
        return over === null ? null : { ...issue, daysOverSla: over };
      })
      .filter(Boolean)
      .sort((a, b) => b.daysOverSla - a.daysOverSla);
    return {
      scopeId: scopeId ?? null,
      matrix,
      diff: { priorDate: diff.priorDate, delta: diff.delta },
      trend: buildTrendSeries(trendRows, scopeId),
      aging: agingBuckets(viewIssues, asOf),
      breached,
      byTeam: groupByTeam(viewIssues, teamMap, slaByScope, asOf),
      bySprintOwnership: groupBySprintOwnership(viewIssues, report.sprintOwnershipPattern, slaByScope, asOf),
      issues: viewIssues,
    };
  };

  const views = { all: buildView(report.scopes, null) };
  for (const scope of report.scopes) {
    views[scope.id] = buildView([scope], scope.id);
  }

  // The scope emphasized in the All view (decision 1). "External" by name, else the first scope.
  const externalScope = report.scopes.find((scope) => /extern/i.test(scope.name)) ?? report.scopes[0];

  return {
    report,
    reports,
    configured,
    issues,
    statusVocabulary: countBy(issues, (issue) => issue.jiraStatus),
    priorityVocabulary: countBy(issues, (issue) => issue.priority ?? "(none)"),
    jiraBaseUrl: (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, ""),
    asOf,
    externalScopeId: externalScope?.id ?? null,
    scopeOptions: report.scopes.map((scope) => ({ id: scope.id, name: scope.name })),
    views,
    // The matrix passes back its TRIMMED scope ({ id, name, bands } — no resolvedJql/jql/
    // jiraFilterId/slaTargets), so resolve the full scope by id here; otherwise the universe
    // clause is silently dropped and every link degrades to just `priority IN (…)`.
    cellJql: (scope, rowKey, bandKey) =>
      cellJql(report.scopes.find((full) => full.id === scope.id) ?? scope, rowKey, bandKey, report),
    cellBreachedJql: (scope, rowKey, bandKey) =>
      cellBreachedJql(report.scopes.find((full) => full.id === scope.id) ?? scope, rowKey, bandKey, report),
  };
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * `[{capturedOn, scopeKey, count, breachedCount}]` → one point per day. With `scopeId` set, only
 * that scope's rows are kept (the per-scope view); otherwise summed across scopes (the All view).
 */
function buildTrendSeries(rows, scopeId = null) {
  const byDay = new Map();
  for (const row of rows) {
    if (scopeId && row.scopeKey !== scopeId) continue;
    const key = row.capturedOn.toISOString();
    const point = byDay.get(key) ?? { capturedOn: row.capturedOn, count: 0, breachedCount: 0, scopes: {} };
    point.count += row.count;
    point.breachedCount += row.breachedCount;
    point.scopes[row.scopeLabel] = row.count;
    byDay.set(key, point);
  }
  return [...byDay.values()].sort((a, b) => a.capturedOn - b.capturedOn);
}

/** Distinct-value counts — feeds the admin pickers so a status can't be typo'd (scope (h)). */
function countBy(items, pick) {
  const counts = new Map();
  for (const item of items) {
    const key = pick(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}
