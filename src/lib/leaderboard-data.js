/**
 * Server-only data assembly for the Velocity/Leaderboard page (leaderboard.md). ORG-WIDE by
 * design (decision 5) — every `Team`, never membership-scoped like `getMembershipContext` —
 * gating happens at the page level via `hasLeaderboardAccess` (`lib/rbac.js`), not by narrowing
 * which teams show up here.
 *
 * No new snapshot table: `Issue`/`IssueProgress` rows persist per (team, sprint) indefinitely once
 * synced (sync-hybrid-seeding.md), and the manual sync route is now gated away from `CLOSED`
 * sprints (leaderboard.md decision 7), so a past sprint's rows are permanently frozen. That lets
 * every board here — including "all-time" — be computed LIVE from `Issue`+`IssueProgress`, exactly
 * like `computeSprintMetrics` already does for the current sprint on `/`.
 */
import { prisma } from "@/lib/db";
import {
  computeSprintMetrics,
  aggregateByDeveloper,
  teamVelocityPerDeveloper,
  aggregateTeamAllTime,
  aggregateDeveloperAllTime,
  rankBy,
} from "@/lib/metrics.mjs";
import { getSprintSelection, hasActiveBugReport, serializeUser } from "@/lib/dashboard-data";

/** Every team + its admin-entered leaderboard divisor (decision 3) — org-wide, not membership-scoped. */
async function getAllTeamsWithDeveloperCount() {
  return prisma.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, key: true, developerCount: true },
  });
}

/**
 * Every `(team, sprint)` pair with ≥1 `Filter`, reduced to a `computeSprintMetrics` result — the
 * all-time boards' + the personal stats card's shared source of history. THREE batched queries
 * total regardless of how many teams/sprints exist (no N+1): filters (+issues), the sprints they
 * belong to, and progress rows — grouped in JS via `Map`, never nested array scans. Progress maps
 * stay per (team, sprint) and are never merged across teams (§9), matching `getRollupData`.
 *
 * Sorted by `sprint.developmentStart` ascending so `aggregateDeveloperAllTime`'s "last row wins"
 * team-tag reads as "most recent team" for a developer who has spanned more than one.
 *
 * @param {string[]} teamIds
 * @returns {Promise<Array<{ teamId: string, sprintId: string, metrics: object }>>}
 */
async function getTeamSprintHistory(teamIds) {
  if (teamIds.length === 0) return [];

  const filters = await prisma.filter.findMany({
    where: { teamId: { in: teamIds } },
    orderBy: { sortOrder: "asc" },
    include: { issues: { orderBy: { jiraKey: "asc" } } },
  });
  if (filters.length === 0) return [];

  const sprintIds = [...new Set(filters.map((filter) => filter.sprintId))];
  const [sprints, progress] = await Promise.all([
    prisma.sprint.findMany({
      where: { id: { in: sprintIds } },
      select: { id: true, developmentStart: true, developmentEnd: true },
    }),
    prisma.issueProgress.findMany({
      where: { teamId: { in: teamIds }, sprintId: { in: sprintIds } },
      select: {
        teamId: true,
        sprintId: true,
        jiraKey: true,
        workflowType: true,
        stageCompletion: true,
        blocked: true,
        blockedReason: true,
        riskComment: true,
      },
    }),
  ]);
  const sprintById = new Map(sprints.map((sprint) => [sprint.id, sprint]));

  const groups = new Map();
  for (const filter of filters) {
    const key = `${filter.teamId}::${filter.sprintId}`;
    const group = groups.get(key) ?? { teamId: filter.teamId, sprintId: filter.sprintId, filters: [] };
    group.filters.push(filter);
    groups.set(key, group);
  }
  const progressByGroup = new Map();
  for (const row of progress) {
    const key = `${row.teamId}::${row.sprintId}`;
    const map = progressByGroup.get(key) ?? {};
    map[row.jiraKey] = row;
    progressByGroup.set(key, map);
  }

  return [...groups.values()]
    .map(({ teamId, sprintId, filters: teamSprintFilters }) => {
      const sprint = sprintById.get(sprintId);
      if (!sprint) return null; // defensive — every filter's sprintId should resolve
      const progressByKey = progressByGroup.get(`${teamId}::${sprintId}`) ?? {};
      return {
        teamId,
        sprintId,
        metrics: computeSprintMetrics(teamSprintFilters, progressByKey, sprint),
      };
    })
    .filter(Boolean)
    .sort((a, b) => sprintById.get(a.sprintId).developmentStart - sprintById.get(b.sprintId).developmentStart);
}

/** ONE sprint, org-wide team + developer boards (decision 4's sprint-scoped view). */
export async function getSprintBoards(sprint) {
  const teams = await getAllTeamsWithDeveloperCount();
  const teamIds = teams.map((team) => team.id);

  const [filters, progress] = await Promise.all([
    prisma.filter.findMany({
      where: { teamId: { in: teamIds }, sprintId: sprint.id },
      orderBy: { sortOrder: "asc" },
      include: { issues: { orderBy: { jiraKey: "asc" } } },
    }),
    prisma.issueProgress.findMany({
      where: { teamId: { in: teamIds }, sprintId: sprint.id },
      select: {
        teamId: true,
        jiraKey: true,
        workflowType: true,
        stageCompletion: true,
        blocked: true,
        blockedReason: true,
        riskComment: true,
      },
    }),
  ]);

  const teamRows = [];
  const unconfiguredTeams = [];
  // Merged by assigneeAccountId ACROSS teams — a developer with issues in two teams this sprint
  // (Open Risk 3) has their points summed correctly here, not double-listed.
  const developerRows = new Map();

  for (const team of teams) {
    const teamFilters = filters.filter((filter) => filter.teamId === team.id);
    if (teamFilters.length === 0) continue; // no data this sprint — absent from both boards

    const progressByKey = Object.fromEntries(
      progress.filter((row) => row.teamId === team.id).map((row) => [row.jiraKey, row]),
    );
    const metrics = computeSprintMetrics(teamFilters, progressByKey, sprint);
    const perDeveloper = teamVelocityPerDeveloper(metrics.velocityCompletedPoints, team.developerCount);

    if (perDeveloper === null) {
      unconfiguredTeams.push(team);
    } else {
      teamRows.push({
        teamId: team.id,
        team,
        totalPoints: metrics.velocityPoints,
        completedPoints: metrics.velocityCompletedPoints,
        developerCount: team.developerCount,
        perDeveloper,
      });
    }

    for (const row of aggregateByDeveloper(metrics.issues)) {
      const existing = developerRows.get(row.assigneeAccountId);
      if (existing) {
        existing.totalPoints += row.totalPoints;
        existing.completedPoints += row.completedPoints;
        existing.issueCount += row.issueCount;
      } else {
        developerRows.set(row.assigneeAccountId, { ...row, teamId: team.id, team });
      }
    }
  }

  return {
    teamBoard: rankBy(teamRows, { metricKey: "perDeveloper" }),
    unconfiguredTeams,
    developerBoard: rankBy([...developerRows.values()], { metricKey: "completedPoints" }),
  };
}

/** Every sprint, org-wide team + developer boards (decision 4's all-time view). */
export async function getAllTimeBoards() {
  const teams = await getAllTeamsWithDeveloperCount();
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const historyRows = await getTeamSprintHistory(teams.map((team) => team.id));

  const teamRows = [];
  const unconfiguredTeams = [];
  for (const totals of aggregateTeamAllTime(historyRows)) {
    const team = teamsById.get(totals.teamId);
    if (!team) continue;
    const perDeveloper = teamVelocityPerDeveloper(totals.completedPoints, team.developerCount);
    if (perDeveloper === null) {
      unconfiguredTeams.push(team);
    } else {
      teamRows.push({ ...totals, team, developerCount: team.developerCount, perDeveloper });
    }
  }

  const developerRows = aggregateDeveloperAllTime(historyRows).map((row) => ({
    ...row,
    team: teamsById.get(row.teamId) ?? null,
  }));

  return {
    teamBoard: rankBy(teamRows, { metricKey: "perDeveloper" }),
    unconfiguredTeams,
    developerBoard: rankBy(developerRows, { metricKey: "completedPoints" }),
  };
}

/**
 * The `/leaderboard` page's single entry point.
 * @param {import("@/generated/prisma/client").User} user
 * @param {{ sprintId?: string, view?: "sprint"|"allTime" }} [selection] from searchParams
 */
export async function getLeaderboardData(user, { sprintId, view } = {}) {
  const { sprints, selectedSprint } = await getSprintSelection(sprintId);
  const normalizedView = view === "allTime" ? "allTime" : "sprint";

  let boards = { teamBoard: [], unconfiguredTeams: [], developerBoard: [] };
  if (normalizedView === "allTime") {
    boards = await getAllTimeBoards();
  } else if (selectedSprint) {
    boards = await getSprintBoards(selectedSprint);
  }

  return {
    user: serializeUser(user),
    sprints,
    selectedSprint,
    view: normalizedView,
    ...boards,
    hasBugReport: await hasActiveBugReport(),
  };
}

/**
 * ONE developer's all-time delivered points, scoped to a SINGLE team (decision 6 — mirrors `/`'s
 * single-selected-team framing rather than rolling up all the caller's memberships). Reuses
 * `getTeamSprintHistory` + `aggregateDeveloperAllTime` — the same code path as the org-wide
 * all-time board, just called with one team.
 *
 * @param {string|null|undefined} jiraAccountId
 * @param {string|null|undefined} teamId
 * @returns {Promise<{ totalPoints: number, completedPoints: number, issueCount: number }>}
 */
export async function getMyAllTimePoints(jiraAccountId, teamId) {
  const empty = { totalPoints: 0, completedPoints: 0, issueCount: 0 };
  if (!jiraAccountId || !teamId) return empty;

  const historyRows = await getTeamSprintHistory([teamId]);
  const mine = aggregateDeveloperAllTime(historyRows).find(
    (row) => row.assigneeAccountId === jiraAccountId,
  );
  return mine
    ? { totalPoints: mine.totalPoints, completedPoints: mine.completedPoints, issueCount: mine.issueCount }
    : empty;
}
