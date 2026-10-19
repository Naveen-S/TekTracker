/**
 * Server-side data packs for Ask StoryBoard (ask-storyboard.md (a)). Every pack is built here
 * from ids — never from client-supplied facts — through the SAME readers the pages use
 * (getRollupData, getDigestData, getBugReportData, getSprintBoards), and checks its own access
 * with the gate its page already applies. A pack the viewer cannot reach comes back as
 * `{ unavailable: "<reason>" }` so the model can say so; one denied pack never fails the request.
 *
 * Reads are memoized per request (`createAskContext`) so a question that pulls both `rollup` and
 * `trend` for the same scope reads the roll-up once.
 */
import { prisma } from "@/lib/db";
import { getDigestData, getRollupData, getSprintSelection } from "@/lib/dashboard-data";
import { getBugReportData } from "@/lib/bug-report-data";
import { getSprintBoards } from "@/lib/leaderboard-data";
import { hasLeaderboardAccess, hasProgramAccess, visibleTeamIds } from "@/lib/rbac";
import {
  buildTrendSeries,
  computeSprintMetrics,
  getWeeklyVelocity,
  snapshotVelocity,
} from "@/lib/metrics.mjs";
import { daysOverSla, slaMapForScope, SCOPE_TOTAL_BAND_KEY, TOTAL_ROW_KEY } from "@/lib/bug-report/matrix.mjs";
import {
  ASK_TREND_MAX_SPRINTS,
  shapeBugsPack,
  shapeLeaderboardPack,
  shapeRollupPack,
  shapeTeamPack,
  shapeTicketPack,
  shapeTrendPack,
} from "@/lib/ask/shape.mjs";

/** Sprints listed in the catalog — the recent ones a leader would ask about. */
const CATALOG_MAX_SPRINTS = 12;
const JIRA_KEY_PATTERN = /^[A-Z][A-Z0-9_]*-\d+$/;
const TICKET_MAX_SPRINT_HITS = 3;

const unavailable = (reason) => ({ unavailable: reason });
/** An access denial, not missing data: Ask must not route around it (no DeepContext round). */
const denied = (reason) => ({ unavailable: reason, denied: true });
const isoDate = (value) => (value ? new Date(value).toISOString().slice(0, 10) : null);
const norm = (value) => (value ?? "").trim().toLowerCase();

/**
 * Per-request state: the viewer, one clock, and memoized reads.
 * @param {import("@/generated/prisma/client").User} user
 */
export function createAskContext(user, asOf = new Date()) {
  const memo = new Map();
  const once = (key, load) => {
    if (!memo.has(key)) memo.set(key, load());
    return memo.get(key);
  };
  return {
    user,
    asOf,
    visibleTeamIds: () => once("visible", () => visibleTeamIds(user)),
    canViewPrograms: () => once("programs", () => hasProgramAccess(user)),
    canViewLeaderboard: () => once("leaderboard", () => hasLeaderboardAccess(user)),
    sprintSelection: () => once("sprints", () => getSprintSelection(undefined)),
    rollup: (programId, sprintId) =>
      once(`rollup:${programId ?? ""}:${sprintId ?? ""}`, () => getRollupData(user, { programId, sprintId })),
  };
}

/**
 * What the viewer can ask about — teams, programs, sprints, bug reports — plus the lookup index
 * used to resolve the model's `need` arguments. Only ever lists things the viewer can see.
 */
export async function buildCatalog(ctx) {
  const [visible, canViewPrograms, canViewLeaderboard, { sprints, selectedSprint }] = await Promise.all([
    ctx.visibleTeamIds(),
    ctx.canViewPrograms(),
    ctx.canViewLeaderboard(),
    ctx.sprintSelection(),
  ]);
  const [teams, memberships, programs, bugReports] = await Promise.all([
    prisma.team.findMany({
      where: visible === null ? {} : { id: { in: visible } },
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, program: { select: { key: true, name: true } } },
    }),
    prisma.teamMembership.findMany({
      where: { userId: ctx.user.id },
      select: { teamId: true, role: true },
    }),
    canViewPrograms
      ? prisma.program.findMany({
          orderBy: { name: "asc" },
          select: { id: true, key: true, name: true, teams: { select: { key: true } } },
        })
      : Promise.resolve([]),
    prisma.bugReport.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, scopes: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true } } },
    }),
  ]);
  const roleByTeam = new Map(memberships.map((row) => [row.teamId, row.role]));
  const recentSprints = sprints.slice(0, CATALOG_MAX_SPRINTS);

  const catalog = {
    myTeams: teams.filter((team) => roleByTeam.has(team.id)).map((team) => team.key),
    teams: teams.map((team) => ({
      key: team.key,
      name: team.name,
      ...(team.program ? { program: team.program.key } : {}),
      ...(roleByTeam.has(team.id) ? { myRole: roleByTeam.get(team.id) } : {}),
    })),
    programs: programs.map((program) => ({
      key: program.key,
      name: program.name,
      teams: program.teams.map((team) => team.key),
    })),
    sprints: recentSprints.map((sprint) => ({
      name: sprint.name,
      state: sprint.state,
      devStart: isoDate(sprint.developmentStart),
      devEnd: isoDate(sprint.developmentEnd),
      releaseDate: isoDate(sprint.releaseDate),
    })),
    defaultSprint: selectedSprint?.name ?? null,
    bugReports: bugReports.map((report) => ({
      slug: report.slug,
      name: report.name,
      scopes: report.scopes.map((scope) => scope.name),
    })),
    leaderboardAvailable: canViewLeaderboard,
  };
  const index = { teams, programs, sprints, selectedSprint, bugReports, roleByTeam, canViewPrograms };
  return { catalog, index };
}

// ── argument resolution ────────────────────────────────────────────────────────────────────

/** Exact id / key / name (case-insensitive), then a unique "contains" match. */
function findOne(list, value, fields) {
  const wanted = norm(value);
  if (!wanted) return null;
  const exact = list.find((item) => fields.some((field) => norm(item[field]) === wanted));
  if (exact) return exact;
  const partial = list.filter((item) => fields.some((field) => norm(item[field]).includes(wanted)));
  return partial.length === 1 ? partial[0] : null;
}

/**
 * Resolve one need (model- or page-supplied) to concrete ids, or a reason it can't be served.
 * `ids` carries the page's own context ids, which win over empty model fields.
 */
function resolveNeed(need, index, ids = {}) {
  const resolved = { pack: need.pack };

  if (need.sprint || ids.sprintId) {
    const sprint = need.sprint
      ? findOne(index.sprints, need.sprint, ["id", "name"])
      : index.sprints.find((candidate) => candidate.id === ids.sprintId);
    if (!sprint && need.sprint) return { ...resolved, error: `No sprint named "${need.sprint}" in StoryBoard` };
    resolved.sprintId = sprint?.id ?? index.selectedSprint?.id;
  } else {
    resolved.sprintId = index.selectedSprint?.id;
  }

  if (need.pack === "team") {
    const team = need.team
      ? findOne(index.teams, need.team, ["id", "key", "name"])
      : (index.teams.find((candidate) => candidate.id === ids.teamId) ??
        (index.roleByTeam.size === 1 ? index.teams.find((candidate) => index.roleByTeam.has(candidate.id)) : null));
    if (!team) {
      return {
        ...resolved,
        error: need.team
          ? `"${need.team}" is not a team this viewer can see in StoryBoard`
          : "No team was specified",
      };
    }
    resolved.teamId = team.id;
  }

  if (need.pack === "rollup" || need.pack === "trend") {
    if (need.program) {
      const program = index.canViewPrograms ? findOne(index.programs, need.program, ["id", "key", "name"]) : null;
      if (!program) {
        return {
          ...resolved,
          error: index.canViewPrograms
            ? `No program named "${need.program}"`
            : "This viewer does not have program-level access",
        };
      }
      resolved.programId = program.id;
    } else if (need.team) {
      // "How is <team> doing over time?" — a one-team trend is a team pack's job; keep the roll-up.
      resolved.programId = undefined;
    } else {
      resolved.programId = index.programs.some((program) => program.id === ids.programId) ? ids.programId : undefined;
    }
  }

  if (need.pack === "bugs") {
    if (index.bugReports.length === 0) return { ...resolved, error: "No bug report is configured in StoryBoard" };
    const report = need.bugReport
      ? findOne(index.bugReports, need.bugReport, ["slug", "name"])
      : (index.bugReports.find((candidate) => candidate.slug === ids.bugReportSlug) ?? index.bugReports[0]);
    if (!report) return { ...resolved, error: `No bug report named "${need.bugReport}"` };
    resolved.bugReportSlug = report.slug;
    const scopeWanted = norm(need.bugScope);
    if (scopeWanted && scopeWanted !== "all") {
      const scope = findOne(report.scopes, need.bugScope, ["id", "name"]);
      if (!scope) return { ...resolved, error: `The ${report.name} report has no "${need.bugScope}" scope` };
      resolved.bugScopeId = scope.id;
    } else if (!need.bugScope && ids.bugScopeId && report.scopes.some((scope) => scope.id === ids.bugScopeId)) {
      resolved.bugScopeId = ids.bugScopeId;
    }
  }

  if (need.pack === "ticket") {
    const jiraKey = (need.jiraKey ?? "").trim().toUpperCase();
    if (!JIRA_KEY_PATTERN.test(jiraKey)) return { ...resolved, error: "No valid Jira key was given" };
    resolved.jiraKey = jiraKey;
  }

  return resolved;
}

/** The pack(s) a question starts with, from the page it was asked on. */
export function defaultNeeds(context) {
  switch (context.page) {
    case "board":
      return [{ pack: "team" }];
    case "bugs":
      return [{ pack: "bugs" }];
    case "leaderboard":
      return [{ pack: "leaderboard" }];
    default:
      return [{ pack: "rollup" }];
  }
}

/** A stable identity for a resolved need, so the same pack is never loaded twice. */
const needKey = (resolved) =>
  [resolved.pack, resolved.teamId, resolved.programId, resolved.sprintId, resolved.bugReportSlug, resolved.bugScopeId, resolved.jiraKey]
    .map((part) => part ?? "")
    .join("|");

// ── pack builders ──────────────────────────────────────────────────────────────────────────

function velocityFor(series, sprint, completedPoints, points, asOf) {
  return snapshotVelocity(series.points, sprint, asOf) ?? getWeeklyVelocity(sprint, completedPoints, points, asOf);
}

async function rollupPack(ctx, { programId, sprintId }) {
  const data = await ctx.rollup(programId, sprintId);
  if (data.teams.length === 0) return { label: "roll-up", data: unavailable("The viewer is not on any team yet") };
  if (!data.selectedSprint) return { label: "roll-up", data: unavailable("No sprint is configured yet") };
  const scopeLabel = data.selectedProgram ? `${data.selectedProgram.name} program` : "the viewer's teams";
  const series = buildTrendSeries(data.combinedSnapshots, data.selectedSprint, ctx.asOf);
  const velocity = velocityFor(
    series,
    data.selectedSprint,
    data.combined.velocityCompletedPoints,
    data.combined.velocityPoints,
    ctx.asOf,
  );
  return {
    label: `${scopeLabel} · ${data.selectedSprint.name}`,
    data: shapeRollupPack({
      scopeLabel,
      sprint: data.selectedSprint,
      perTeam: data.perTeam,
      combined: data.combined,
      combinedCapacity: data.combinedCapacity,
      series,
      velocity,
      asOf: ctx.asOf,
    }),
  };
}

async function teamPack(ctx, { teamId, sprintId }) {
  const visible = await ctx.visibleTeamIds();
  if (visible !== null && !visible.includes(teamId)) {
    return { label: "team", data: denied("That team is not visible to this viewer") };
  }
  const digest = await getDigestData(teamId, sprintId);
  if (!digest) return { label: "team", data: unavailable("That team or sprint does not exist") };
  const { team, sprint, filters, progressByKey, snapshots } = digest;
  const [teamRow, capacity] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamId }, select: { program: { select: { name: true } } } }),
    prisma.sprintCapacity.findUnique({
      where: { sprintId_teamId: { sprintId, teamId } },
      select: { committedPoints: true },
    }),
  ]);
  const metrics = computeSprintMetrics(filters, progressByKey, sprint, ctx.asOf);
  const series = buildTrendSeries(snapshots, sprint, ctx.asOf);
  const velocity = velocityFor(series, sprint, metrics.velocityCompletedPoints, metrics.velocityPoints, ctx.asOf);
  const syncTimes = filters.map((filter) => filter.lastSyncedAt).filter(Boolean);
  return {
    label: `${team.name} · ${sprint.name}`,
    data: shapeTeamPack({
      team,
      programName: teamRow?.program?.name ?? null,
      sprint,
      metrics,
      series,
      velocity,
      capacity,
      lastSyncedAt: syncTimes.length > 0 ? new Date(Math.max(...syncTimes.map((value) => value.getTime()))) : null,
      asOf: ctx.asOf,
    }),
  };
}

async function bugsPack(ctx, { bugReportSlug, bugScopeId }) {
  const data = await getBugReportData(bugReportSlug, ctx.asOf);
  if (!data) return { label: "bugs", data: unavailable("No bug report is configured in StoryBoard") };
  if (!data.configured) return { label: data.report.name, data: unavailable("This bug report is not configured yet") };
  const scope = bugScopeId ? data.report.scopes.find((candidate) => candidate.id === bugScopeId) : null;
  const view = scope ? data.views[scope.id] : data.views.all;
  const scopeLabel = scope ? scope.name : "all scopes";
  return {
    label: `${data.report.name} bug report · ${scopeLabel}`,
    data: shapeBugsPack({
      report: data.report,
      view,
      scopeLabel,
      scopes: scope ? [scope] : data.report.scopes,
      totalRowKey: TOTAL_ROW_KEY,
      scopeTotalBandKey: SCOPE_TOTAL_BAND_KEY,
    }),
  };
}

async function trendPack(ctx, { programId, sprintId }) {
  const data = await ctx.rollup(programId, sprintId);
  if (data.teams.length === 0) return { label: "trend", data: unavailable("The viewer is not on any team yet") };
  if (!data.selectedSprint) return { label: "trend", data: unavailable("No sprint is configured yet") };
  const sprint = data.selectedSprint;
  const scopeLabel = data.selectedProgram ? `${data.selectedProgram.name} program` : "the viewer's teams";
  const series = buildTrendSeries(data.combinedSnapshots, sprint, ctx.asOf);
  const velocity = velocityFor(series, sprint, data.combined.velocityCompletedPoints, data.combined.velocityPoints, ctx.asOf);

  // Previous sprints = the ones that started before this one (Gates are global and ordered).
  const previous = data.sprints
    .filter((candidate) => new Date(candidate.developmentStart) < new Date(sprint.developmentStart))
    .slice(0, ASK_TREND_MAX_SPRINTS);
  const teamIds = data.teams.map((team) => team.id);
  const rows =
    previous.length > 0
      ? await prisma.sprintSnapshot.findMany({
          where: { sprintId: { in: previous.map((candidate) => candidate.id) }, teamId: { in: teamIds } },
          orderBy: { capturedOn: "asc" },
          select: { sprintId: true, teamId: true, capturedOn: true, totalPoints: true, completedPoints: true, totalIssues: true },
        })
      : [];
  // Last captured row per (sprint, team) — the sprint's final reading for that team — then summed.
  const lastByTeam = new Map();
  for (const row of rows) lastByTeam.set(`${row.sprintId}|${row.teamId}`, row);
  const history = previous
    .map((candidate) => {
      const finals = [...lastByTeam.values()].filter((row) => row.sprintId === candidate.id);
      if (finals.length === 0) return null;
      return {
        sprint: candidate,
        totalPoints: finals.reduce((sum, row) => sum + row.totalPoints, 0),
        completedPoints: finals.reduce((sum, row) => sum + row.completedPoints, 0),
        totalIssues: finals.reduce((sum, row) => sum + row.totalIssues, 0),
        teamsCaptured: finals.length,
        capturedOn: new Date(Math.max(...finals.map((row) => row.capturedOn.getTime()))),
      };
    })
    .filter(Boolean);

  return {
    label: `trend for ${scopeLabel} · ${sprint.name} and earlier sprints`,
    data: shapeTrendPack({ scopeLabel, sprint, series, velocity, history, asOf: ctx.asOf }),
  };
}

async function leaderboardPack(ctx, { sprintId }, index) {
  if (!(await ctx.canViewLeaderboard())) {
    return { label: "leaderboard", data: denied("This viewer does not have access to the leaderboard") };
  }
  const sprint = index.sprints.find((candidate) => candidate.id === sprintId);
  if (!sprint) return { label: "leaderboard", data: unavailable("No sprint is configured yet") };
  const boards = await getSprintBoards(sprint);
  return { label: `leaderboard · ${sprint.name}`, data: shapeLeaderboardPack({ sprint, boards, asOf: ctx.asOf }) };
}

async function ticketPack(ctx, { jiraKey }) {
  const visible = await ctx.visibleTeamIds();
  const issueRows = await prisma.issue.findMany({
    where: {
      jiraKey,
      filter: { workflowType: { not: "NEEDS_ATTENTION" }, ...(visible === null ? {} : { teamId: { in: visible } }) },
    },
    include: {
      filter: {
        include: {
          team: { select: { id: true, key: true, name: true } },
          sprint: {
            select: { id: true, name: true, state: true, developmentStart: true, developmentEnd: true, releaseDate: true },
          },
        },
      },
    },
  });
  const sprintRows = issueRows
    .sort((a, b) => b.filter.sprint.developmentStart - a.filter.sprint.developmentStart)
    .slice(0, TICKET_MAX_SPRINT_HITS);
  const progress = sprintRows.length
    ? await prisma.issueProgress.findMany({
        where: { jiraKey, OR: sprintRows.map((row) => ({ teamId: row.filter.teamId, sprintId: row.filter.sprintId })) },
        select: { teamId: true, sprintId: true, jiraKey: true, workflowType: true, stageCompletion: true, blocked: true, blockedReason: true, riskComment: true },
      })
    : [];
  const sprintHits = sprintRows
    .map((row) => {
      const { filter } = row;
      const progressRow = progress.find((candidate) => candidate.teamId === filter.teamId && candidate.sprintId === filter.sprintId);
      const metrics = computeSprintMetrics(
        [{ ...filter, issues: [row] }],
        progressRow ? { [jiraKey]: progressRow } : {},
        filter.sprint,
        ctx.asOf,
      );
      const issue = metrics.issues[0];
      return issue ? { team: filter.team, sprint: filter.sprint, issue } : null;
    })
    .filter(Boolean);

  // /bugs is open to every signed-in user, so its cache needs no team gate.
  const bugRows = await prisma.bugReportIssue.findMany({
    where: { jiraKey, report: { isActive: true } },
    include: { report: { select: { name: true } }, scope: { select: { name: true, slaTargets: true } } },
  });
  const bugHits = bugRows.map((issue) => ({
    report: issue.report,
    scopeName: issue.scope.name,
    issue,
    daysOverSla: daysOverSla(issue, slaMapForScope(issue.scope.slaTargets), ctx.asOf),
  }));

  if (sprintHits.length === 0 && bugHits.length === 0) {
    return { label: jiraKey, data: unavailable(`StoryBoard has no record of ${jiraKey} that this viewer can see`) };
  }
  return { label: `ticket ${jiraKey}`, data: shapeTicketPack({ jiraKey, sprintHits, bugHits, asOf: ctx.asOf }) };
}

/**
 * Resolve + load a list of needs, skipping any already in `loaded` (keyed by needKey).
 *
 * @returns {Promise<Array<{ pack: string, label: string, data: object }>>}
 */
export async function loadPacks(ctx, index, needs, { ids = {}, loaded = new Set() } = {}) {
  const jobs = [];
  for (const need of needs) {
    const resolved = resolveNeed(need, index, ids);
    const key = needKey(resolved);
    if (loaded.has(key)) continue;
    loaded.add(key);
    if (resolved.error) {
      jobs.push(Promise.resolve({ pack: need.pack, label: need.pack, data: unavailable(resolved.error) }));
      continue;
    }
    jobs.push(
      buildPack(ctx, resolved, index).then((built) => ({ pack: resolved.pack, label: built.label, data: built.data })),
    );
  }
  return Promise.all(jobs);
}

function buildPack(ctx, resolved, index) {
  switch (resolved.pack) {
    case "rollup":
      return rollupPack(ctx, resolved);
    case "team":
      return teamPack(ctx, resolved);
    case "bugs":
      return bugsPack(ctx, resolved);
    case "trend":
      return trendPack(ctx, resolved);
    case "leaderboard":
      return leaderboardPack(ctx, resolved, index);
    case "ticket":
      return ticketPack(ctx, resolved);
    default:
      return Promise.resolve({ label: resolved.pack, data: unavailable("Unknown data pack") });
  }
}
