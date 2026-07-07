/**
 * Sync engine (sync-hybrid-seeding.md (c)) — fetches every filter of a team+sprint from Jira,
 * replaces the Issue cache, seeds missing IssueProgress rows via StatusStageMapping (the HYBRID
 * stage model, §6/§16), and re-evaluates owning workflows (§9). Called by the sync route now and
 * the step-7 cron later — no request/response types in here.
 *
 * Invariants:
 * - IssueProgress is CREATE-ONLY here (decision 5): existing rows are never re-seeded — manual
 *   edits win. `seededFromStatus` records what seeded a row (null when no mapping matched).
 * - Network calls happen OUTSIDE transactions; each filter's cache replace is atomic.
 * - Progress rows whose key left every filter survive untouched (§9 decoupling).
 */
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/rbac";
import { owningWorkflowType } from "@/lib/workflows.mjs";
import { buildSeededStages, reshapeStageCompletion } from "@/lib/sync/seeding.mjs";
import {
  getJiraAuthForUser,
  fetchMyself,
  fetchFilter,
  searchIssues,
  JiraAuthError,
} from "@/lib/jira/client";
import {
  transformJiraIssue,
  buildIssueFields,
  DEFAULT_STORY_POINTS_FIELD,
  DEFAULT_SPRINT_FIELD,
} from "@/lib/jira/transform";
import { FilterSourceType } from "@/generated/prisma/client";

/** Refresh one filter's Issue cache atomically; returns the added/removed diff (decision 4). */
async function refreshFilterCache(filter, rows, filterUpdate) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.issue.findMany({
      where: { filterId: filter.id },
      select: { jiraKey: true },
    });
    const existingKeys = new Set(existing.map((issue) => issue.jiraKey));
    const newKeys = new Set(rows.map((row) => row.jiraKey));
    const addedKeys = [...newKeys].filter((key) => !existingKeys.has(key));
    const removedKeys = [...existingKeys].filter((key) => !newKeys.has(key));

    const lastSyncedAt = new Date();
    await tx.issue.deleteMany({ where: { filterId: filter.id } });
    if (rows.length > 0) {
      await tx.issue.createMany({
        data: rows.map((row) => ({ ...row, filterId: filter.id, lastSyncedAt })),
      });
    }
    await tx.filter.update({
      where: { id: filter.id },
      data: { ...filterUpdate, lastSyncedAt },
    });

    return {
      id: filter.id,
      name: filter.name,
      total: rows.length,
      added: addedKeys.length,
      removed: removedKeys.length,
      addedKeys,
      removedKeys,
    };
  });
}

/**
 * Sync all filters of a team+sprint with the calling user's Jira credential.
 * @param {{ teamId: string, sprintId: string, userId: string }} args
 * @returns {Promise<{ filters: Array<object>, progressSeeded: number, workflowsReevaluated: number }>}
 */
export async function syncTeamSprint({ teamId, sprintId, userId }) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new NotFoundError("Team not found");
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true } });
  if (!sprint) throw new NotFoundError("Sprint not found");
  const filters = await prisma.filter.findMany({
    where: { teamId, sprintId },
    orderBy: { sortOrder: "asc" },
  });

  const auth = await getJiraAuthForUser(userId);
  // Fail fast on a dead token. Jira silently treats invalid Basic auth as ANONYMOUS on endpoints
  // that allow it — search then "succeeds" with zero issues instead of 401ing. Only /myself
  // reliably rejects, so validate before syncing anything.
  try {
    await fetchMyself(auth);
  } catch (error) {
    if (error instanceof JiraAuthError) {
      throw new JiraAuthError(
        "Stored Jira token is invalid or expired — log in again to reconnect your Jira account",
      );
    }
    throw error;
  }
  const fieldIds = {
    storyPointsFieldId: team.storyPointsFieldId ?? DEFAULT_STORY_POINTS_FIELD,
    sprintFieldId: team.sprintFieldId ?? DEFAULT_SPRINT_FIELD,
  };
  const requestFields = buildIssueFields(fieldIds);

  // 1. Per filter, sequentially (decision 10): fetch from Jira, then replace the cache atomically.
  const filterSummaries = [];
  for (const filter of filters) {
    let jql = filter.jql;
    const filterUpdate = {};
    if (filter.sourceType === FilterSourceType.JIRA_FILTER) {
      const jiraFilter = await fetchFilter({ auth, filterId: filter.jiraFilterId });
      jql = jiraFilter.jql; // search the filter's CURRENT jql and refresh our copy (decision 9)
      filterUpdate.jql = jql;
    }
    const rawIssues = await searchIssues({ auth, jql, fields: requestFields });
    const rows = rawIssues.map((issue) => transformJiraIssue(issue, fieldIds));
    filterSummaries.push(await refreshFilterCache(filter, rows, filterUpdate));
  }

  // 2. Group the refreshed cache by key (an issue may sit in several filters; ONE progress row).
  const cache = await prisma.issue.findMany({
    where: { filter: { teamId, sprintId } },
    select: { jiraKey: true, jiraStatus: true, filter: { select: { workflowType: true } } },
  });
  const byKey = new Map();
  for (const row of cache) {
    const entry = byKey.get(row.jiraKey) ?? { types: [], jiraStatus: row.jiraStatus };
    entry.types.push(row.filter.workflowType);
    byKey.set(row.jiraKey, entry);
  }

  const existingProgress = await prisma.issueProgress.findMany({
    where: { teamId, sprintId },
    select: { id: true, jiraKey: true, workflowType: true, stageCompletion: true },
  });
  const progressKeys = new Set(existingProgress.map((progress) => progress.jiraKey));
  const mappings = await prisma.statusStageMapping.findMany({
    where: { OR: [{ teamId }, { teamId: null }] },
  });

  // 3. Seed progress for keys that have none (create-only; sync is not a manual edit, so no
  //    updatedById attribution).
  const toCreate = [];
  for (const [jiraKey, entry] of byKey) {
    if (progressKeys.has(jiraKey)) continue;
    const workflowType = owningWorkflowType(entry.types);
    const { stages, seededFromStatus } = buildSeededStages(workflowType, entry.jiraStatus, mappings);
    toCreate.push({
      teamId,
      sprintId,
      jiraKey,
      workflowType,
      stageCompletion: stages,
      seededFromStatus,
    });
  }

  // 4. Re-evaluate owning workflows for existing rows still in the cache (decision 6).
  const reevaluations = [];
  for (const progress of existingProgress) {
    const entry = byKey.get(progress.jiraKey);
    if (!entry) continue;
    const owning = owningWorkflowType(entry.types);
    if (owning === progress.workflowType) continue;
    reevaluations.push({
      id: progress.id,
      workflowType: owning,
      stageCompletion: reshapeStageCompletion(progress.stageCompletion, owning),
    });
  }

  await prisma.$transaction(async (tx) => {
    if (toCreate.length > 0) {
      await tx.issueProgress.createMany({ data: toCreate });
    }
    for (const change of reevaluations) {
      await tx.issueProgress.update({
        where: { id: change.id },
        data: { workflowType: change.workflowType, stageCompletion: change.stageCompletion },
      });
    }
  });

  return {
    filters: filterSummaries,
    progressSeeded: toCreate.length,
    workflowsReevaluated: reevaluations.length,
  };
}
