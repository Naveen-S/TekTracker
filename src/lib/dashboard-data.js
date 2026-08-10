/**
 * Server-only dashboard data assembly (ui-port.md (b), ed-rollup.md (b)): the `/` page resolves
 * the caller's teams+role, the selected team/sprint (with defaults), the sprint's filters+cached
 * issues, progress rows, and computed metrics; the `/rollup` page resolves the same across EVERY
 * team the caller belongs to (admin: all teams) for one sprint; the public `/share/[token]` page
 * resolves a SharedView token (share-view-export.md — session-less by design). Reads go straight
 * through Prisma (coding-standards: server components fetch directly).
 */
import { prisma } from "@/lib/db";
import { Role, SprintState } from "@/generated/prisma/client";
import { aggregateRollup, combineSnapshotsByDay, computeSprintMetrics } from "@/lib/metrics.mjs";
import { isAiConfigured } from "@/lib/ai/provider";
import { TEAM_MANAGER_ROLES, TEAM_WRITER_ROLES, hasLeaderboardAccess } from "@/lib/rbac";
import { groupSubComponentsByComponent } from "@/lib/sprint-start/track-jql.mjs";

/**
 * A team's one-click-sprint-start config (one-click-sprint-start.md): its per-track Issue Type
 * overrides + claimed sub-components grouped by parent Component. `null` team ⇒ `componentGroups: []`
 * so the dashboard can render "no sub-components configured yet" without a null check everywhere.
 */
async function getTeamSprintStartConfig(teamId) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      featureIssueTypes: true,
      techDebtIssueTypes: true,
      internalBugIssueTypes: true,
      supportIssueTypes: true,
      subComponents: {
        orderBy: { name: "asc" },
        select: { name: true, component: { select: { name: true, projectKey: true } } },
      },
    },
  });
  if (!team) return { issueTypeOverrides: null, componentGroups: [] };
  const { subComponents, ...issueTypeOverrides } = team;
  return { issueTypeOverrides, componentGroups: groupSubComponentsByComponent(subComponents) };
}

/**
 * Whether any bug-report dashboard exists — drives the TopBar "Bugs" link (gm-bug-report.md (f)).
 * Exported for `leaderboard-data.js` (leaderboard.md), which needs the same flag for its own
 * TopBar.
 */
export async function hasActiveBugReport() {
  return (await prisma.bugReport.count({ where: { isActive: true } })) > 0;
}

/** The caller's memberships → role map + visible teams (global admin sees all teams). */
async function getMembershipContext(user) {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId: user.id },
    select: { teamId: true, role: true },
  });
  const roleByTeam = new Map(memberships.map((m) => [m.teamId, m.role]));

  const teams = await prisma.team.findMany({
    where: user.isAdmin ? {} : { id: { in: [...roleByTeam.keys()] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, key: true },
  });
  return { roleByTeam, teams };
}

/**
 * All sprints (Gates are global) + the selection default: requested, else the user's pinned
 * release, else ACTIVE, else latest. Exported for `leaderboard-data.js` (leaderboard.md) — the
 * sprint selector there follows the same default rule as `/` and `/rollup`; kept here rather than
 * duplicated so the three never drift.
 *
 * `fallbackSprintId` (default-team-release.md) is the caller's pinned default release, passed ONLY
 * by the `/` board's getDashboardData; /rollup + /leaderboard omit it and are unaffected. It sits
 * above the ACTIVE default so a pinned release is honored even once CLOSED, and a *deleted* pin
 * simply misses the `find` and falls through to ACTIVE.
 */
export async function getSprintSelection(sprintId, fallbackSprintId) {
  const sprints = await prisma.sprint.findMany({
    orderBy: { developmentStart: "desc" },
    select: {
      id: true,
      name: true,
      state: true,
      developmentStart: true,
      developmentEnd: true,
      releaseDate: true,
      fixVersions: true,
    },
  });
  const selectedSprint =
    sprints.find((sprint) => sprint.id === sprintId) ??
    sprints.find((sprint) => sprint.id === fallbackSprintId) ??
    sprints.find((sprint) => sprint.state === SprintState.ACTIVE) ??
    sprints[0] ??
    null;
  return { sprints, selectedSprint };
}

/** Exported for `leaderboard-data.js` (leaderboard.md) — the same trimmed user shape everywhere. */
export function serializeUser(user) {
  return {
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
  };
}

/**
 * @param {import("@/generated/prisma/client").User} user
 * @param {{ teamId?: string, sprintId?: string }} [selection] from searchParams
 */
export async function getDashboardData(user, { teamId, sprintId } = {}) {
  const { roleByTeam, teams } = await getMembershipContext(user);
  // Selection precedence (default-team-release.md): explicit ?team= param → the user's pinned
  // default team → first visible team. A stale pin (team no longer visible) misses both `find`s and
  // falls through, so it never strands the user.
  const selectedTeam =
    teams.find((team) => team.id === teamId) ??
    teams.find((team) => team.id === user.defaultTeamId) ??
    teams[0] ??
    null;
  const myRole = selectedTeam ? (roleByTeam.get(selectedTeam.id) ?? null) : null;

  const { sprints, selectedSprint } = await getSprintSelection(sprintId, user.defaultSprintId);

  let filters = [];
  let progressByKey = {};
  let snapshots = [];
  // committed-unplanned-work.md — admin-configured Committed-points target for this team+sprint.
  // A sibling of `metrics` (never folded into computeSprintMetrics), since it's an admin-entered
  // value, not derived from issues; `null` when unconfigured (decision 3).
  let capacity = null;
  if (selectedTeam && selectedSprint) {
    filters = await prisma.filter.findMany({
      where: { teamId: selectedTeam.id, sprintId: selectedSprint.id },
      orderBy: { sortOrder: "asc" },
      include: { issues: { orderBy: { jiraKey: "asc" } } },
    });
    const progress = await prisma.issueProgress.findMany({
      where: { teamId: selectedTeam.id, sprintId: selectedSprint.id },
      select: {
        jiraKey: true,
        workflowType: true,
        stageCompletion: true,
        blocked: true,
        blockedReason: true,
        riskComment: true,
        updatedById: true,
      },
    });
    // `manuallyEdited` (a human touched the stages) drives the per-track "Sync stages" confirm
    // count in the matrix — sync/seed writes leave updatedById null (sync-stages-from-jira.md).
    progressByKey = Object.fromEntries(
      progress.map(({ updatedById, ...row }) => [
        row.jiraKey,
        { ...row, manuallyEdited: updatedById != null },
      ]),
    );
    // Daily step-7 cron rows powering the trend/burndown panel (trend-burndown.md (b)).
    snapshots = await prisma.sprintSnapshot.findMany({
      where: { teamId: selectedTeam.id, sprintId: selectedSprint.id },
      orderBy: { capturedOn: "asc" },
      select: {
        capturedOn: true,
        totalPoints: true,
        completedPoints: true,
        avgProgress: true,
        totalIssues: true,
      },
    });
    const capacityRow = await prisma.sprintCapacity.findUnique({
      where: { sprintId_teamId: { sprintId: selectedSprint.id, teamId: selectedTeam.id } },
      select: { committedPoints: true },
    });
    capacity = capacityRow ? { committedPoints: capacityRow.committedPoints } : null;
  }

  // UI affordances only — every mutation is re-checked server-side by the step-4/5 routes.
  const canWrite = user.isAdmin || (myRole !== null && TEAM_WRITER_ROLES.includes(myRole));
  const canManage = user.isAdmin || (myRole !== null && TEAM_MANAGER_ROLES.includes(myRole));
  const canConfigureSprint = user.isAdmin;

  // One-click-sprint-start.md: the team's resolved project/sub-components/issue-types, used by the
  // dialog's preview (client-side JQL preview via the same pure track-jql.mjs builder) — no new
  // GET route needed.
  const sprintStartConfig = selectedTeam
    ? await getTeamSprintStartConfig(selectedTeam.id)
    : { issueTypeOverrides: null, componentGroups: [] };

  return {
    user: serializeUser(user),
    teams: teams.map((team) => ({ ...team, myRole: roleByTeam.get(team.id) ?? null })),
    selectedTeam,
    myRole,
    // The user's pinned default view (default-team-release.md) — drives the top-bar star's
    // filled/empty state. Kept out of serializeUser (reused by /leaderboard) since it's board-only.
    defaults: { teamId: user.defaultTeamId ?? null, sprintId: user.defaultSprintId ?? null },
    can: { write: canWrite, manage: canManage, configureSprint: canConfigureSprint },
    sprints,
    selectedSprint,
    filters,
    progressByKey,
    snapshots,
    capacity,
    sprintStartConfig,
    // Request-time clock for the trend panel's "today" marker + projection — passed down so the
    // SSR render and the client hydration draw identical geometry (no client-side new Date()).
    asOf: new Date(),
    metrics: selectedSprint ? computeSprintMetrics(filters, progressByKey, selectedSprint) : null,
    jiraBaseUrl: process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") ?? null,
    // UI affordance only (ai-insights.md decision 3) — the ai-digest route re-checks per request.
    aiEnabled: isAiConfigured(),
    hasBugReport: await hasActiveBugReport(),
    // Sidebar nav visibility only (leaderboard.md) — /leaderboard re-checks per request.
    hasLeaderboardAccess: await hasLeaderboardAccess(user),
  };
}

/**
 * Lean read model for the AI digest route (ai-insights.md (c)) — the same selects the dashboard
 * assembly uses, minus membership/selection resolution (the route's RBAC guard already scoped
 * the team). `null` when the team or sprint doesn't exist.
 */
export async function getDigestData(teamId, sprintId) {
  const [team, sprint] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, key: true } }),
    prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        developmentStart: true,
        developmentEnd: true,
        releaseDate: true,
      },
    }),
  ]);
  if (!team || !sprint) return null;

  const filters = await prisma.filter.findMany({
    where: { teamId, sprintId },
    orderBy: { sortOrder: "asc" },
    include: { issues: { orderBy: { jiraKey: "asc" } } },
  });
  const progress = await prisma.issueProgress.findMany({
    where: { teamId, sprintId },
    select: {
      jiraKey: true,
      workflowType: true,
      stageCompletion: true,
      blocked: true,
      blockedReason: true,
      riskComment: true,
    },
  });
  const snapshots = await prisma.sprintSnapshot.findMany({
    where: { teamId, sprintId },
    orderBy: { capturedOn: "asc" },
    select: {
      capturedOn: true,
      totalPoints: true,
      completedPoints: true,
      avgProgress: true,
      totalIssues: true,
    },
  });

  return {
    team,
    sprint,
    filters,
    progressByKey: Object.fromEntries(progress.map((row) => [row.jiraKey, row])),
    snapshots,
  };
}

/**
 * Cross-team roll-up for `/rollup` (ed-rollup.md decision 3): membership-derived teams (any role;
 * admin sees all) for ONE selected global sprint. Two batched queries — no per-team N+1 — grouped
 * in JS; progress maps stay per team (§9: the same jiraKey may hold different progress in two
 * teams), so metrics are computed per team and summed by the pure `aggregateRollup`.
 *
 * @param {import("@/generated/prisma/client").User} user
 * @param {{ sprintId?: string }} [selection] from searchParams
 */
export async function getRollupData(user, { sprintId } = {}) {
  const { roleByTeam, teams } = await getMembershipContext(user);
  const { sprints, selectedSprint } = await getSprintSelection(sprintId);

  let perTeam = [];
  let combinedSnapshots = [];
  let combinedCapacity = null;
  if (selectedSprint && teams.length > 0) {
    const teamIds = teams.map((team) => team.id);
    const filters = await prisma.filter.findMany({
      where: { teamId: { in: teamIds }, sprintId: selectedSprint.id },
      orderBy: { sortOrder: "asc" },
      include: { issues: { orderBy: { jiraKey: "asc" } } },
    });
    // blockedReason + riskComment (risk-comments-rollup-digest.md decision 4) travel through so
    // the roll-up's RiskCalloutsPanel + all-risks dialog can render them — attached per team below,
    // NEVER merged across teams (§9: the same jiraKey may hold different progress in two teams).
    const progress = await prisma.issueProgress.findMany({
      where: { teamId: { in: teamIds }, sprintId: selectedSprint.id },
      select: {
        teamId: true,
        jiraKey: true,
        workflowType: true,
        stageCompletion: true,
        blocked: true,
        blockedReason: true,
        riskComment: true,
      },
    });
    // One batched read (no per-team N+1), combined per day by the pure helper (decisions 6–7).
    const snapshotRows = await prisma.sprintSnapshot.findMany({
      where: { teamId: { in: teamIds }, sprintId: selectedSprint.id },
      orderBy: { capturedOn: "asc" },
      select: {
        teamId: true,
        capturedOn: true,
        totalPoints: true,
        completedPoints: true,
        avgProgress: true,
        totalIssues: true,
      },
    });
    combinedSnapshots = combineSnapshotsByDay(snapshotRows);

    // committed-unplanned-work.md — one batched (no-N+1) read, attached per team below and summed
    // into a portfolio total. `configuredTeamCount`/`totalTeamCount` drive the roll-up's "N of M
    // teams configured" caveat (decision 8) rather than hiding the total for partial configuration.
    const capacityRows = await prisma.sprintCapacity.findMany({
      where: { teamId: { in: teamIds }, sprintId: selectedSprint.id },
      select: { teamId: true, committedPoints: true },
    });
    const capacityByTeam = new Map(capacityRows.map((row) => [row.teamId, row.committedPoints]));
    combinedCapacity =
      capacityRows.length > 0
        ? {
            committedPoints: capacityRows.reduce((sum, row) => sum + row.committedPoints, 0),
            configuredTeamCount: capacityRows.length,
            totalTeamCount: teams.length,
          }
        : null;

    perTeam = teams.map((team) => {
      const teamFilters = filters.filter((filter) => filter.teamId === team.id);
      const progressByKey = Object.fromEntries(
        progress.filter((row) => row.teamId === team.id).map((row) => [row.jiraKey, row]),
      );
      const syncTimes = teamFilters
        .map((filter) => filter.lastSyncedAt)
        .filter((value) => value !== null);
      return {
        team,
        myRole: roleByTeam.get(team.id) ?? null,
        filters: teamFilters,
        metrics: computeSprintMetrics(teamFilters, progressByKey, selectedSprint),
        capacity: capacityByTeam.has(team.id)
          ? { committedPoints: capacityByTeam.get(team.id) }
          : null,
        lastSyncedAt:
          syncTimes.length > 0
            ? new Date(Math.max(...syncTimes.map((value) => value.getTime())))
            : null,
      };
    });
  }

  return {
    user: serializeUser(user),
    teams: teams.map((team) => ({ ...team, myRole: roleByTeam.get(team.id) ?? null })),
    sprints,
    selectedSprint,
    perTeam,
    combinedSnapshots,
    combinedCapacity,
    combined: selectedSprint ? aggregateRollup(perTeam.map((entry) => entry.metrics)) : null,
    jiraBaseUrl: process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") ?? null,
    // UI affordance only (ai-insights.md decision 3 precedent) — the rollup ai-digest route
    // re-checks per request.
    aiEnabled: isAiConfigured(),
    hasBugReport: await hasActiveBugReport(),
    // Sidebar nav visibility only (leaderboard.md) — /leaderboard re-checks per request.
    hasLeaderboardAccess: await hasLeaderboardAccess(user),
  };
}

/** Team roles that make the VIEWER-only UI read-only (re-exported for the client shell). */
export const VIEWER_ROLE = Role.VIEWER;

/**
 * Freeze the INPUTS of a shared view (share-view-export.md decision 5): filters (with cached
 * issues), progress rows, the sprint window as of capture, and — committed-unplanned-work.md —
 * the team's committed capacity as of capture. Stored in `SharedView.snapshot`; the share page
 * recomputes metrics from these with `asOf = capturedAt`, so a frozen share's numbers never drift —
 * not even if an admin later edits the sprint dates or the capacity matrix. The JSON round-trip
 * turns Dates into ISO strings (metrics/format helpers coerce them back).
 *
 * @param {object|null} capacity `{ committedPoints } | null`, as returned by getDashboardData.
 */
export function buildShareSnapshot(filters, progressRows, sprint, capacity) {
  return JSON.parse(
    JSON.stringify({
      capturedAt: new Date(),
      sprint: {
        name: sprint.name,
        developmentStart: sprint.developmentStart,
        developmentEnd: sprint.developmentEnd,
        releaseDate: sprint.releaseDate,
      },
      filters,
      progress: progressRows,
      capacity: capacity ?? null,
    }),
  );
}

/**
 * Public read model for `/share/[token]` (share-view-export.md (a)) — the ONLY session-less data
 * assembly: the token is the bearer capability (decision 2), so this returns board data with no
 * user/role/`can` fields at all. `null` for unknown, revoked (row deleted), or expired tokens —
 * and for a live share whose included filters were ALL deleted since sharing; the page renders
 * the same generic invalid/expired state for every null (don't reveal which).
 */
export async function getShareData(token) {
  if (!token) return null;
  const share = await prisma.sharedView.findUnique({
    where: { token },
    include: { sprint: true },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  const jiraBaseUrl = process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") ?? null;

  if (!share.isLive) {
    const snapshot = share.snapshot;
    if (!snapshot || !Array.isArray(snapshot.filters)) return null;
    const sprint = snapshot.sprint ?? share.sprint;
    const asOf = snapshot.capturedAt ?? share.createdAt.toISOString();
    const progressByKey = Object.fromEntries(
      (snapshot.progress ?? []).map((row) => [row.jiraKey, row]),
    );
    return {
      isLive: false,
      viewDensity: share.viewDensity,
      jiraBaseUrl,
      sprint,
      filters: snapshot.filters,
      progressByKey,
      metrics: computeSprintMetrics(snapshot.filters, progressByKey, sprint, asOf),
      capacity: snapshot.capacity ?? null,
      asOf,
      lastSyncedAt: null,
    };
  }

  // Live share: resolve includedFilterIds → current rows; filters deleted since sharing drop out.
  const filters = await prisma.filter.findMany({
    where: { id: { in: share.includedFilterIds }, sprintId: share.sprintId },
    orderBy: { sortOrder: "asc" },
    include: { issues: { orderBy: { jiraKey: "asc" } } },
  });
  if (filters.length === 0) return null;
  // One team per share (decision 3, validated on create) — progress keys are (team, sprint, key).
  const teamId = filters[0].teamId;
  const progress = await prisma.issueProgress.findMany({
    where: { teamId, sprintId: share.sprintId },
    select: { jiraKey: true, workflowType: true, stageCompletion: true, blocked: true, blockedReason: true },
  });
  const progressByKey = Object.fromEntries(progress.map((row) => [row.jiraKey, row]));
  const syncTimes = filters.map((filter) => filter.lastSyncedAt).filter((value) => value !== null);
  const capacityRow = await prisma.sprintCapacity.findUnique({
    where: { sprintId_teamId: { sprintId: share.sprintId, teamId } },
    select: { committedPoints: true },
  });
  return {
    isLive: true,
    viewDensity: share.viewDensity,
    jiraBaseUrl,
    sprint: share.sprint,
    filters,
    progressByKey,
    metrics: computeSprintMetrics(filters, progressByKey, share.sprint),
    capacity: capacityRow ? { committedPoints: capacityRow.committedPoints } : null,
    asOf: null,
    lastSyncedAt:
      syncTimes.length > 0
        ? new Date(Math.max(...syncTimes.map((value) => value.getTime())))
        : null,
  };
}
