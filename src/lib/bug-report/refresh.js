/**
 * Bug-report refresh pipeline (gm-bug-report.md (c)) — mirrors each scope's Jira universe into the
 * `BugReportIssue` cache and upserts today's `BugReportSnapshot` rows. Called by the refresh route
 * and the daily cron; no request/response types in here (the sync/engine.js precedent).
 *
 * Invariants:
 * - The cache holds RAW JIRA FACTS ONLY (decision 12). Band/category/breach are NOT resolved here
 *   — they are read-time pure functions in matrix.mjs, so config edits need no refresh.
 * - **A failed scope aborts before the FIRST write** (decision 17). Every scope is resolved and
 *   fetched up front; only when all of them succeeded do we touch the database. A zeroed row on a
 *   leadership dashboard is a lie, and the fallback category would absorb it invisibly.
 * - Network calls happen OUTSIDE the transaction; the cache replace is atomic per report.
 * - Snapshots upsert on (reportId, capturedOn, rowKey, scopeKey, bandKey) at UTC midnight, so a
 *   same-day re-run refreshes values instead of duplicating (step-7 precedent).
 */
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/rbac";
import { fetchFilter, searchIssues, getJiraAuthForUser } from "@/lib/jira/client";
import { buildMatrix, snapshotRows } from "@/lib/bug-report/matrix.mjs";
import { FilterSourceType } from "@/generated/prisma/client";

/** A bug universe is bigger than a sprint track, but still bounded — fail loudly past this. */
const BUG_SEARCH_MAX_ISSUES = 10000;

/** Everything the cache stores, and nothing more (decision 12). */
const BUG_ISSUE_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "reporter",
  "components",
  "labels",
  "created",
  "updated",
];

/** Normalize an instant to its UTC midnight — one canonical `capturedOn` per day. */
export function utcMidnight(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function joinNames(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((item) => item?.name ?? item).filter(Boolean).join(", ") || null;
}

/** Raw Jira issue → `BugReportIssue` columns (minus reportId/scopeId, which the caller owns). */
export function toBugIssueRow(raw) {
  const fields = raw.fields ?? {};
  return {
    jiraKey: raw.key,
    title: fields.summary ?? "(no summary)",
    issueType: fields.issuetype?.name ?? "Unknown",
    jiraStatus: fields.status?.name ?? "Unknown",
    statusCategory: fields.status?.statusCategory?.name ?? null,
    priority: fields.priority?.name ?? null,
    assigneeName: fields.assignee?.displayName ?? null,
    reporterName: fields.reporter?.displayName ?? null,
    components: joinNames(fields.components),
    labels: Array.isArray(fields.labels) && fields.labels.length > 0 ? fields.labels.join(", ") : null,
    jiraCreatedAt: toDate(fields.created),
    jiraUpdatedAt: toDate(fields.updated),
  };
}

/**
 * Resolve the Jira credential a refresh runs with (decision 16): the `CRON_SYNC_USER_EMAIL`
 * SERVICE credential for both cron and manual refreshes, falling back to the caller's only when
 * it is unset.
 *
 * This deliberately departs from step 5's "you sync what YOUR token can see". A bug report is one
 * shared org artifact: if each viewer refreshed with their own token, the headline number would
 * flip-flop between people and disagree with the nightly snapshot. The identity actually used is
 * returned so the UI can show it.
 *
 * @param {string | null} callerUserId
 * @returns {Promise<{ auth: object, email: string }>}
 */
export async function resolveRefreshAuth(callerUserId) {
  const serviceEmail = process.env.CRON_SYNC_USER_EMAIL?.trim();
  if (serviceEmail) {
    const serviceUser = await prisma.user.findUnique({
      where: { email: serviceEmail },
      select: { id: true, email: true },
    });
    if (serviceUser) {
      return { auth: await getJiraAuthForUser(serviceUser.id), email: serviceUser.email };
    }
  }
  if (!callerUserId) {
    throw new NotFoundError(
      "No Jira credential available — set CRON_SYNC_USER_EMAIL to a user who has logged in",
    );
  }
  const caller = await prisma.user.findUnique({
    where: { id: callerUserId },
    select: { id: true, email: true },
  });
  return { auth: await getJiraAuthForUser(callerUserId), email: caller?.email ?? null };
}

/** Load a report with the full config the matrix needs, ordered. */
export async function loadReportConfig(reportId) {
  const report = await prisma.bugReport.findUnique({
    where: { id: reportId },
    include: {
      scopes: { orderBy: { sortOrder: "asc" }, include: { slaTargets: true } },
      bands: { orderBy: { sortOrder: "asc" } },
      categories: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!report) throw new NotFoundError("Bug report not found");
  return report;
}

/** Resolve a scope's JQL — saved filter ids are re-read every refresh so Jira edits are picked up. */
async function resolveScopeJql(scope, auth) {
  if (scope.sourceType === FilterSourceType.JIRA_FILTER) {
    if (!scope.jiraFilterId) {
      throw new Error(`Scope "${scope.name}" has no Jira filter id`);
    }
    const filter = await fetchFilter({ auth, filterId: scope.jiraFilterId });
    if (!filter.jql?.trim()) {
      throw new Error(`Jira filter ${scope.jiraFilterId} ("${filter.name}") has no JQL`);
    }
    return filter.jql.trim();
  }
  if (!scope.jql?.trim()) {
    throw new Error(`Scope "${scope.name}" has no JQL`);
  }
  return scope.jql.trim();
}

/**
 * Refresh one report end to end.
 *
 * @param {string} reportId
 * @param {{ auth: object, refreshedByEmail?: string | null, asOf?: Date }} args
 * @returns {Promise<{ reportId: string, scopes: Array<object>, totalIssues: number, snapshotRows: number, capturedOn: Date }>}
 */
export async function refreshBugReport(reportId, { auth, refreshedByEmail = null, asOf = new Date() }) {
  const report = await loadReportConfig(reportId);
  if (report.scopes.length === 0) {
    throw new NotFoundError(`Bug report "${report.name}" has no scopes configured`);
  }

  // ── Phase 1: resolve + fetch EVERYTHING before writing anything (decision 17) ──
  const fetched = [];
  try {
    for (const scope of report.scopes) {
      const jql = await resolveScopeJql(scope, auth);
      const raw = await searchIssues({
        auth,
        jql,
        fields: BUG_ISSUE_FIELDS,
        maxIssues: BUG_SEARCH_MAX_ISSUES,
      });
      fetched.push({ scope, jql, rows: raw.map(toBugIssueRow) });
    }
  } catch (error) {
    // Record why, leave cache + snapshots untouched, and let the caller map the status.
    await prisma.bugReport.update({
      where: { id: reportId },
      data: { lastRefreshError: error.message?.slice(0, 500) ?? "Refresh failed" },
    });
    throw error;
  }

  // ── Phase 2: atomic cache replace ──
  const lastSyncedAt = new Date();
  await prisma.$transaction(async (tx) => {
    for (const { scope, jql, rows } of fetched) {
      await tx.bugReportIssue.deleteMany({ where: { scopeId: scope.id } });
      if (rows.length > 0) {
        await tx.bugReportIssue.createMany({
          data: rows.map((row) => ({ ...row, reportId, scopeId: scope.id, lastSyncedAt })),
        });
      }
      await tx.bugReportScope.update({
        where: { id: scope.id },
        data: { resolvedJql: jql, resolvedAt: lastSyncedAt },
      });
    }
    await tx.bugReport.update({
      where: { id: reportId },
      data: {
        lastRefreshedAt: lastSyncedAt,
        lastRefreshedByEmail: refreshedByEmail,
        lastRefreshError: null,
      },
    });
  });

  // ── Phase 3: classify (read-time pure) + snapshot today ──
  const issues = fetched.flatMap(({ scope, rows }) =>
    rows.map((row) => ({ ...row, scopeId: scope.id })),
  );
  const capturedOn = utcMidnight(asOf);
  const written = await writeSnapshot(report, issues, capturedOn, asOf);

  return {
    reportId,
    scopes: fetched.map(({ scope, rows }) => ({ id: scope.id, name: scope.name, issues: rows.length })),
    totalIssues: issues.length,
    snapshotRows: written,
    capturedOn,
  };
}

/**
 * Build the matrix and write its cells as one day's snapshot rows. Idempotent per day: the day's
 * rows are replaced wholesale.
 *
 * Replace-then-insert rather than N upserts — a real report is ~70 cells (rows × scopes × bands),
 * and 70 sequential upserts inside one interactive transaction blows Prisma's timeout against a
 * remote Postgres. This is 2 statements, still atomic, and still exactly-one-set-per-day.
 * Snapshot ids are not referenced by anything, so re-minting them costs nothing.
 */
export async function writeSnapshot(report, issues, capturedOn, asOf = new Date()) {
  const matrix = buildMatrix(issues, report, asOf);
  const rows = snapshotRows(matrix, report.id, capturedOn);

  await prisma.$transaction(async (tx) => {
    await tx.bugReportSnapshot.deleteMany({ where: { reportId: report.id, capturedOn } });
    if (rows.length > 0) {
      await tx.bugReportSnapshot.createMany({ data: rows });
    }
  });

  return rows.length;
}
