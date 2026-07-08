/**
 * Server-only dashboard data assembly (ui-port.md (b)): one call the `/` page makes to resolve the
 * caller's teams+role, the selected team/sprint (with defaults), the sprint's filters+cached
 * issues, progress rows, and computed metrics. Reads go straight through Prisma
 * (coding-standards: server components fetch directly); 6b's ED roll-up will generalize this.
 */
import { prisma } from "@/lib/db";
import { Role, SprintState } from "@/generated/prisma/client";
import { computeSprintMetrics } from "@/lib/metrics.mjs";
import { TEAM_MANAGER_ROLES, TEAM_WRITER_ROLES } from "@/lib/rbac";

/**
 * @param {import("@/generated/prisma/client").User} user
 * @param {{ teamId?: string, sprintId?: string }} [selection] from searchParams
 */
export async function getDashboardData(user, { teamId, sprintId } = {}) {
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
  const selectedTeam = teams.find((team) => team.id === teamId) ?? teams[0] ?? null;
  const myRole = selectedTeam ? (roleByTeam.get(selectedTeam.id) ?? null) : null;

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
    user: {
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      isAdmin: user.isAdmin,
    },
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

/** Team roles that make the VIEWER-only UI read-only (re-exported for the client shell). */
export const VIEWER_ROLE = Role.VIEWER;
