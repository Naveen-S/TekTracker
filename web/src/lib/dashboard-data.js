/**
 * Server-only dashboard data assembly (ui-port.md (b), ed-rollup.md (b)): the `/` page resolves
 * the caller's teams+role, the selected team/sprint (with defaults), the sprint's filters+cached
 * issues, progress rows, and computed metrics; the `/rollup` page resolves the same across EVERY
 * team the caller belongs to (admin: all teams) for one sprint. Reads go straight through Prisma
 * (coding-standards: server components fetch directly).
 */
import { prisma } from "@/lib/db";
import { Role, SprintState } from "@/generated/prisma/client";
import { aggregateRollup, computeSprintMetrics } from "@/lib/metrics.mjs";
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
  if (selectedTeam && selectedSprint) {
    filters = await prisma.filter.findMany({
      where: { teamId: selectedTeam.id, sprintId: selectedSprint.id },
      orderBy: { sortOrder: "asc" },
      include: { issues: { orderBy: { jiraKey: "asc" } } },
    });
    const progress = await prisma.issueProgress.findMany({
      where: { teamId: selectedTeam.id, sprintId: selectedSprint.id },
      select: { jiraKey: true, workflowType: true, stageCompletion: true, blocked: true, blockedReason: true },
    });
    progressByKey = Object.fromEntries(progress.map((row) => [row.jiraKey, row]));
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
    metrics: selectedSprint ? computeSprintMetrics(filters, progressByKey, selectedSprint) : null,
    jiraBaseUrl: process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") ?? null,
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
  if (selectedSprint && teams.length > 0) {
    const teamIds = teams.map((team) => team.id);
    const filters = await prisma.filter.findMany({
      where: { teamId: { in: teamIds }, sprintId: selectedSprint.id },
      orderBy: { sortOrder: "asc" },
      include: { issues: { orderBy: { jiraKey: "asc" } } },
    });
    const progress = await prisma.issueProgress.findMany({
      where: { teamId: { in: teamIds }, sprintId: selectedSprint.id },
      select: { teamId: true, jiraKey: true, workflowType: true, stageCompletion: true, blocked: true },
    });

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
    combined: selectedSprint ? aggregateRollup(perTeam.map((entry) => entry.metrics)) : null,
  };
}

/** Team roles that make the VIEWER-only UI read-only (re-exported for the client shell). */
export const VIEWER_ROLE = Role.VIEWER;
