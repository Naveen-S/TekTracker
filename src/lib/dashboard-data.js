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
import { TEAM_MANAGER_ROLES, TEAM_WRITER_ROLES } from "@/lib/rbac";

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

/** All sprints (Gates are global) + the selection default: requested, else ACTIVE, else latest. */
async function getSprintSelection(sprintId) {
  const sprints = await prisma.sprint.findMany({
    orderBy: { developmentStart: "desc" },
    select: {
      id: true,
      name: true,
      state: true,
      developmentStart: true,
      developmentEnd: true,
      releaseDate: true,
    },
  });
  const selectedSprint =
    sprints.find((sprint) => sprint.id === sprintId) ??
    sprints.find((sprint) => sprint.state === SprintState.ACTIVE) ??
    sprints[0] ??
    null;
  return { sprints, selectedSprint };
}

function serializeUser(user) {
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
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0] ?? null;
  const myRole = selectedTeam ? (roleByTeam.get(selectedTeam.id) ?? null) : null;

  const { sprints, selectedSprint } = await getSprintSelection(sprintId);

  let filters = [];
  let progressByKey = {};
  let snapshots = [];
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
      },
    });
    progressByKey = Object.fromEntries(progress.map((row) => [row.jiraKey, row]));
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
  }

  // UI affordances only — every mutation is re-checked server-side by the step-4/5 routes.
  const canWrite = user.isAdmin || (myRole !== null && TEAM_WRITER_ROLES.includes(myRole));
  const canManage = user.isAdmin || (myRole !== null && TEAM_MANAGER_ROLES.includes(myRole));
  const canConfigureSprint = user.isAdmin;

  return {
    user: serializeUser(user),
    teams: teams.map((team) => ({ ...team, myRole: roleByTeam.get(team.id) ?? null })),
    selectedTeam,
    myRole,
    can: { write: canWrite, manage: canManage, configureSprint: canConfigureSprint },
    sprints,
    selectedSprint,
    filters,
    progressByKey,
    snapshots,
    // Request-time clock for the trend panel's "today" marker + projection — passed down so the
    // SSR render and the client hydration draw identical geometry (no client-side new Date()).
    asOf: new Date(),
    metrics: selectedSprint ? computeSprintMetrics(filters, progressByKey, selectedSprint) : null,
    jiraBaseUrl: process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") ?? null,
    // UI affordance only (ai-insights.md decision 3) — the ai-digest route re-checks per request.
    aiEnabled: isAiConfigured(),
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
    combined: selectedSprint ? aggregateRollup(perTeam.map((entry) => entry.metrics)) : null,
    jiraBaseUrl: process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") ?? null,
    // UI affordance only (ai-insights.md decision 3 precedent) — the rollup ai-digest route
    // re-checks per request.
    aiEnabled: isAiConfigured(),
  };
}

/** Team roles that make the VIEWER-only UI read-only (re-exported for the client shell). */
export const VIEWER_ROLE = Role.VIEWER;

/**
 * Freeze the INPUTS of a shared view (share-view-export.md decision 5): filters (with cached
 * issues), progress rows, and the sprint window as of capture. Stored in `SharedView.snapshot`;
 * the share page recomputes metrics from these with `asOf = capturedAt`, so a frozen share's
 * numbers never drift — not even if an admin later edits the sprint dates. The JSON round-trip
 * turns Dates into ISO strings (metrics/format helpers coerce them back).
 */
export function buildShareSnapshot(filters, progressRows, sprint) {
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
  return {
    isLive: true,
    viewDensity: share.viewDensity,
    jiraBaseUrl,
    sprint: share.sprint,
    filters,
    progressByKey,
    metrics: computeSprintMetrics(filters, progressByKey, share.sprint),
    asOf: null,
    lastSyncedAt:
      syncTimes.length > 0
        ? new Date(Math.max(...syncTimes.map((value) => value.getTime())))
        : null,
  };
}
