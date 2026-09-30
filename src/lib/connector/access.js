/**
 * Ticket visibility + server-built context for Claude analysis (claude-connector-analysis.md
 * decision 8, PROPOSED P2).
 *
 * "Anyone who can see the ticket" is resolved against the two caches the buttons live on:
 *   BUG    — a `BugReportIssue` in an ACTIVE bug report. `/bugs` is open to every signed-in user.
 *   SPRINT — an `Issue` in a Filter of a team the user can see: global admin, a TeamMembership, or
 *            (leadership with `hasProgramAccess`) any team that belongs to a Program — exactly the
 *            set a program roll-up can show them.
 * A ticket the caller cannot see answers 404, never 403, so the endpoints can't probe key existence.
 *
 * The context sent to Claude is built HERE from the cache — never from client-supplied fields.
 */
import { prisma } from "@/lib/db";
import { hasProgramAccess, NotFoundError } from "@/lib/rbac";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { calculateWeightedCompletion, resolveProgress } from "@/lib/metrics.mjs";
import { resolveAnalysisKind } from "@/lib/ai/issue-analysis.mjs";

const DAY_MS = 86_400_000;

function toDate(value) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function ageDays(from, now) {
  return from ? Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY_MS)) : null;
}

function splitList(value) {
  return value
    ? value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
}

/**
 * The team ids whose sprint Issues `user` may see, or `null` meaning "every team" (global admin).
 * @param {import("@/generated/prisma/client").User} user
 * @returns {Promise<string[] | null>}
 */
export async function visibleTeamIds(user) {
  if (user.isAdmin) return null;
  const memberships = await prisma.teamMembership.findMany({
    where: { userId: user.id },
    select: { teamId: true },
  });
  const ids = new Set(memberships.map((membership) => membership.teamId));
  if (await hasProgramAccess(user)) {
    const programTeams = await prisma.team.findMany({
      where: { programId: { not: null } },
      select: { id: true },
    });
    for (const team of programTeams) ids.add(team.id);
  }
  return [...ids];
}

async function bugContext(jiraKey, now) {
  const issue = await prisma.bugReportIssue.findFirst({
    where: { jiraKey, report: { isActive: true } },
    orderBy: { lastSyncedAt: "desc" },
    include: {
      report: { select: { name: true } },
      scope: { select: { name: true, slaTargets: { select: { priorityName: true, days: true } } } },
    },
  });
  if (!issue) return null;

  const owner = issue.subComponent
    ? await prisma.jiraSubComponent.findFirst({
        where: { name: issue.subComponent, teamId: { not: null } },
        select: { team: { select: { key: true, name: true } } },
      })
    : null;
  const sla = issue.scope.slaTargets.find((target) => target.priorityName === issue.priority);
  const age = ageDays(issue.jiraCreatedAt, now);

  return {
    jiraKey: issue.jiraKey,
    source: "BUG",
    title: issue.title,
    issueType: issue.issueType,
    status: issue.jiraStatus,
    statusCategory: issue.statusCategory,
    priority: issue.priority,
    assignee: issue.assigneeName,
    reporter: issue.reporterName,
    components: splitList(issue.components),
    subComponent: issue.subComponent,
    owningTeam: owner?.team ?? null,
    jiraSprint: issue.jiraSprintName,
    labels: splitList(issue.labels),
    createdOn: toDate(issue.jiraCreatedAt),
    ageDays: age,
    bugReport: issue.report.name,
    scope: issue.scope.name,
    slaDays: sla?.days ?? null,
    daysOverSla: sla && age !== null && age > sla.days ? age - sla.days : null,
  };
}

async function sprintContext(user, jiraKey) {
  const teamIds = await visibleTeamIds(user);
  const issues = await prisma.issue.findMany({
    where: { jiraKey, filter: teamIds === null ? {} : { teamId: { in: teamIds } } },
    include: {
      filter: {
        select: {
          name: true,
          workflowType: true,
          teamId: true,
          sprintId: true,
          team: { select: { key: true, name: true } },
          sprint: {
            select: {
              name: true,
              state: true,
              developmentEnd: true,
              releaseDate: true,
              fixVersions: true,
            },
          },
        },
      },
    },
    orderBy: { lastSyncedAt: "desc" },
  });
  if (issues.length === 0) return null;

  // Prefer the ACTIVE sprint's copy; otherwise the most recently synced one.
  const issue = issues.find((row) => row.filter.sprint.state === "ACTIVE") ?? issues[0];
  const { filter } = issue;

  const progressRow = await prisma.issueProgress.findUnique({
    where: {
      teamId_sprintId_jiraKey: { teamId: filter.teamId, sprintId: filter.sprintId, jiraKey },
    },
  });
  const context = {
    jiraKey: issue.jiraKey,
    source: "SPRINT",
    title: issue.title,
    issueType: issue.issueType,
    status: issue.jiraStatus,
    priority: issue.priority,
    assignee: issue.assigneeName,
    storyPoints: issue.storyPoints,
    dueDate: toDate(issue.dueDate),
    jiraSprint: issue.jiraSprintName,
    fixVersions: splitList(issue.fixVersions),
    track: filter.name,
    workflowType: filter.workflowType,
    team: filter.team,
    sprint: {
      name: filter.sprint.name,
      developmentEnd: toDate(filter.sprint.developmentEnd),
      releaseDate: toDate(filter.sprint.releaseDate),
    },
  };

  if (filter.workflowType === "NEEDS_ATTENTION") {
    const subComponents = await prisma.jiraSubComponent.findMany({
      where: { teamId: filter.teamId },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    context.missingFields =
      issue.fixVersions == null ? ["fixVersion", "sub-component (possibly)"] : ["sub-component"];
    context.teamSubComponents = subComponents.map((row) => row.name);
    context.sprintFixVersions = filter.sprint.fixVersions;
    return context;
  }

  const progressByKey = progressRow ? { [jiraKey]: progressRow } : {};
  const progress = resolveProgress(jiraKey, filter.workflowType, progressByKey);
  const workflow = WORKFLOWS[progress.workflowType];
  context.progress = {
    percentComplete: Math.round(calculateWeightedCompletion(progress.stageCompletion, workflow.weights)),
    stagesDone: workflow.stages.filter((_, index) => progress.stageCompletion[index]),
    stagesRemaining: workflow.stages.filter((_, index) => !progress.stageCompletion[index]),
    blocked: progress.blocked,
    blockedReason: progress.blockedReason,
    riskComment: progress.riskComment,
  };
  return context;
}

/**
 * Resolve a ticket the caller can see, with the server-built context and analysis kind.
 *
 * @param {import("@/generated/prisma/client").User} user
 * @param {string} jiraKey
 * @param {"BUG" | "SPRINT"} source which cache the button lives on
 * @param {Date} [now]
 * @returns {Promise<{ source: string, kind: string, context: object }>}
 * @throws {NotFoundError}
 */
export async function resolveVisibleTicket(user, jiraKey, source, now = new Date()) {
  const context = source === "BUG" ? await bugContext(jiraKey, now) : await sprintContext(user, jiraKey);
  if (!context) {
    throw new NotFoundError("Ticket not found");
  }
  return { source, kind: resolveAnalysisKind(context), context };
}

/**
 * Whether `user` can see `jiraKey` in EITHER cache — the read gate for a saved analysis, which is
 * keyed by jiraKey alone (PROPOSED P1) and may have been produced from the other cache.
 *
 * @param {import("@/generated/prisma/client").User} user
 * @param {string} jiraKey
 * @returns {Promise<boolean>}
 */
export async function canViewTicket(user, jiraKey) {
  const bug = await prisma.bugReportIssue.findFirst({
    where: { jiraKey, report: { isActive: true } },
    select: { id: true },
  });
  if (bug) return true;
  const teamIds = await visibleTeamIds(user);
  const issue = await prisma.issue.findFirst({
    where: { jiraKey, filter: teamIds === null ? {} : { teamId: { in: teamIds } } },
    select: { id: true },
  });
  return issue !== null;
}
