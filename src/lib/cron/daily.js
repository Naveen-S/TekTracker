/**
 * Daily background job (background-sync-snapshots.md (b), master plan step 7) — for every ACTIVE
 * sprint: refresh each filter-bearing team's Issue cache through the step-5 sync engine, then
 * upsert the per-team `SprintSnapshot` row (§9), the data behind VP trend/burndown (§2.2/§14.8).
 * Called by the /api/cron/daily route — no request/response types in here.
 *
 * Invariants (decisions 3–7):
 * - The Jira refresh runs with the CRON_SYNC_USER_EMAIL service credential. Missing/dead
 *   credential skips the refresh for ALL teams — snapshots are still written (a data point from
 *   a stale cache beats a hole in the trend line) and the summary says why.
 * - Per-team refresh errors are isolated: team B's Jira 5xx never costs team C its snapshot.
 * - Teams run SEQUENTIALLY (§14.9 rate-limit storm; step-5 decision 10 precedent). All of a
 *   sprint's teams refresh first, then one batched snapshot read — fresh cache where refresh
 *   succeeded, last-good cache where it failed.
 * - Only teams with ≥1 filter in the sprint are snapshotted — no zero-noise rows (decision 5).
 * - Metrics are computed per team; progress maps are NEVER merged across teams (§9). Org totals
 *   are not stored — they are the sum over team rows.
 * - Upsert on (sprintId, teamId, capturedOn = UTC midnight): same-day re-runs refresh values
 *   instead of erroring (decision 6).
 */
import { prisma } from "@/lib/db";
import { syncTeamSprint } from "@/lib/sync/engine";
import { getJiraAuthForUser, fetchMyself } from "@/lib/jira/client";
import { computeSprintMetrics, snapshotValues } from "@/lib/metrics.mjs";
import { SprintState } from "@/generated/prisma/client";

/** Normalize an instant to its UTC midnight — one canonical `capturedOn` per day (decision 6). */
function utcMidnight(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Resolve + validate the service Jira credential (decision 3). Every failure degrades to
 * `{ skipped }` (decision 4 — the run never aborts over Jira): the engine's own per-team
 * fail-fast would otherwise burn a doomed /myself round-trip per team.
 * @returns {Promise<{ user: { id: string, email: string, displayName: string } } | { skipped: string }>}
 */
async function resolveRefreshUser() {
  const email = process.env.CRON_SYNC_USER_EMAIL?.trim();
  if (!email) {
    return { skipped: "CRON_SYNC_USER_EMAIL is not set — Jira refresh skipped" };
  }
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, displayName: true },
  });
  if (!user) {
    return { skipped: `No user found for CRON_SYNC_USER_EMAIL (${email}) — Jira refresh skipped` };
  }
  try {
    await fetchMyself(await getJiraAuthForUser(user.id));
  } catch (error) {
    return { skipped: `Service Jira credential unusable (${error.message}) — Jira refresh skipped` };
  }
  return { user };
}

/** Refresh (sequential) then snapshot (batched) every filter-bearing team of one sprint. */
async function runSprint(sprint, capturedOn, refreshUser) {
  const teams = await prisma.team.findMany({
    where: { filters: { some: { sprintId: sprint.id } } },
    orderBy: { name: "asc" },
    select: { id: true, key: true, name: true },
  });

  // 1. Refresh every team first, one at a time; errors recorded per team, never rethrown.
  const refreshByTeam = new Map();
  for (const team of teams) {
    if (!refreshUser) {
      refreshByTeam.set(team.id, { skipped: true });
      continue;
    }
    try {
      const result = await syncTeamSprint({
        teamId: team.id,
        sprintId: sprint.id,
        userId: refreshUser.id,
      });
      refreshByTeam.set(team.id, {
        filters: result.filters.length,
        issues: result.filters.reduce((sum, filter) => sum + filter.total, 0),
        progressSeeded: result.progressSeeded,
        workflowsReevaluated: result.workflowsReevaluated,
      });
    } catch (error) {
      refreshByTeam.set(team.id, { error: error.message });
    }
  }

  // 2. One batched read per sprint (getRollupData's two-query pattern, decision 7).
  const teamIds = teams.map((team) => team.id);
  const filters = await prisma.filter.findMany({
    where: { teamId: { in: teamIds }, sprintId: sprint.id },
    orderBy: { sortOrder: "asc" },
    include: { issues: true },
  });
  const progress = await prisma.issueProgress.findMany({
    where: { teamId: { in: teamIds }, sprintId: sprint.id },
    select: { teamId: true, jiraKey: true, workflowType: true, stageCompletion: true, blocked: true },
  });

  const teamSummaries = [];
  for (const team of teams) {
    const teamFilters = filters.filter((filter) => filter.teamId === team.id);
    const progressByKey = Object.fromEntries(
      progress.filter((row) => row.teamId === team.id).map((row) => [row.jiraKey, row]),
    );
    const values = snapshotValues(computeSprintMetrics(teamFilters, progressByKey, sprint));
    await prisma.sprintSnapshot.upsert({
      where: { sprintId_teamId_capturedOn: { sprintId: sprint.id, teamId: team.id, capturedOn } },
      create: { sprintId: sprint.id, teamId: team.id, capturedOn, ...values },
      update: values,
    });
    teamSummaries.push({ team, refresh: refreshByTeam.get(team.id), snapshot: values });
  }

  return { sprint: { id: sprint.id, name: sprint.name }, teams: teamSummaries };
}

/**
 * Run the daily job: ACTIVE sprints × filter-bearing teams → refresh + snapshot.
 * @param {{ capturedOn?: Date }} [args] the run instant; normalized to UTC midnight here.
 * @returns {Promise<{ capturedOn: Date, refresh: object, sprints: Array<object> }>} run summary.
 */
export async function runDailyJob({ capturedOn } = {}) {
  const day = utcMidnight(capturedOn ?? new Date());
  const refresh = await resolveRefreshUser();

  const sprints = await prisma.sprint.findMany({
    where: { state: SprintState.ACTIVE },
    orderBy: { developmentStart: "asc" },
    select: { id: true, name: true, developmentStart: true, developmentEnd: true },
  });

  const sprintSummaries = [];
  for (const sprint of sprints) {
    sprintSummaries.push(await runSprint(sprint, day, refresh.user ?? null));
  }

  return {
    capturedOn: day,
    refresh: refresh.user
      ? { user: { email: refresh.user.email, displayName: refresh.user.displayName } }
      : { skipped: refresh.skipped },
    sprints: sprintSummaries,
  };
}
