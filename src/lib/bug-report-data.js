/**
 * Server-only bug-report data assembly (gm-bug-report.md (f)) — the `/bugs` page resolves a
 * report by slug (or the first active one), its config, its cached issues, the read-time matrix,
 * the prior snapshot day for deltas, and the trend series. Reads go straight through Prisma
 * (coding-standards: server components fetch directly), mirroring `dashboard-data.js`.
 *
 * Classification is NOT stored (decision 12) — `buildMatrix` runs here on every render from raw
 * cached facts + current config, so an admin config edit is visible immediately.
 */
import { prisma } from "@/lib/db";
import {
  agingBuckets,
  buildMatrix,
  diffMatrix,
  slaMapForScope,
  daysOverSla,
  cellJql,
  cellBreachedJql,
  SCOPE_TOTAL_BAND_KEY,
  TOTAL_ROW_KEY,
} from "@/lib/bug-report/matrix.mjs";

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

  const matrix = buildMatrix(issues, report, asOf);

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
  const diff = diffMatrix(matrix, priorRows);

  // Trend: the Total row's per-scope totals per captured day.
  const trendRows = await prisma.bugReportSnapshot.findMany({
    where: { reportId: report.id, rowKey: TOTAL_ROW_KEY, bandKey: SCOPE_TOTAL_BAND_KEY },
    orderBy: { capturedOn: "asc" },
    select: { capturedOn: true, scopeKey: true, scopeLabel: true, count: true, breachedCount: true },
  });

  // Per-scope SLA maps power the breach panel's "N days over" copy.
  const slaByScope = new Map(report.scopes.map((scope) => [scope.id, slaMapForScope(scope.slaTargets)]));
  const breached = issues
    .map((issue) => {
      const over = daysOverSla(issue, slaByScope.get(issue.scopeId) ?? new Map(), asOf);
      return over === null ? null : { ...issue, daysOverSla: over };
    })
    .filter(Boolean)
    .sort((a, b) => b.daysOverSla - a.daysOverSla);

  return {
    report,
    reports,
    configured,
    matrix,
    diff: { priorDate: diff.priorDate, delta: diff.delta },
    trend: buildTrendSeries(trendRows),
    aging: agingBuckets(issues, asOf),
    breached,
    issues,
    statusVocabulary: countBy(issues, (issue) => issue.jiraStatus),
    priorityVocabulary: countBy(issues, (issue) => issue.priority ?? "(none)"),
    jiraBaseUrl: (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, ""),
    asOf,
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

/** `[{capturedOn, scopeKey, count, breachedCount}]` → one point per day, summed across scopes. */
function buildTrendSeries(rows) {
  const byDay = new Map();
  for (const row of rows) {
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
