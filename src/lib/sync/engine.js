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
import { ConflictError } from "@/lib/api/route-helpers";
import { owningWorkflowType } from "@/lib/workflows.mjs";
import { ensureNeedsAttentionFilter } from "@/lib/needs-attention/ensure-filter";
import {
  buildSeededStages,
  groupStageUpdates,
  reshapeStageCompletion,
  resolveStageResync,
} from "@/lib/sync/seeding.mjs";
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
import { FilterSourceType, SprintState } from "@/generated/prisma/client";

// String literal, never `WorkflowType.NEEDS_ATTENTION` — a stale/partial generated client can make
// that enum member `undefined`, which Prisma strips from a `where` (widening it). See ensure-filter.js.
const NEEDS_ATTENTION = "NEEDS_ATTENTION";

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
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, state: true },
  });
  if (!sprint) throw new NotFoundError("Sprint not found");
  // Guards the leaderboard's core invariant (leaderboard.md decision 7): a CLOSED sprint's Issue/
  // IssueProgress rows must stay frozen so historical per-developer/per-team data can be computed
  // live. The cron already only ever selects ACTIVE sprints — this only affects manual sync.
  if (sprint.state === SprintState.CLOSED) {
    throw new ConflictError(
      "Cannot sync a CLOSED sprint — its historical data is frozen for the leaderboard and history views",
    );
  }
  // Keep the always-on "Needs attention" hygiene track in step with the team's roster BEFORE loading
  // filters, so it's fetched + cached by the normal loop below like any other track
  // (needs-attention-roster.md). Clearing the roster deletes it; never generated for CLOSED sprints
  // (guarded above).
  await prisma.$transaction((tx) => ensureNeedsAttentionFilter(tx, { team, sprintId }));
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
  //    Exclude the NEEDS_ATTENTION track: untagged items must never spawn IssueProgress rows. A key
  //    that ALSO lives in a real track is still seeded via that track's row.
  const cache = await prisma.issue.findMany({
    where: {
      filter: { teamId, sprintId, workflowType: { not: NEEDS_ATTENTION } },
    },
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

  // Re-evaluations carry a per-row stage array, so they can't be collapsed like the stage re-sync's
  // writes (groupStageUpdates) — raise the budget instead: each row is one round-trip to Neon and
  // the default 5s ceiling is ~100 rows (P2028).
  await prisma.$transaction(
    async (tx) => {
      if (toCreate.length > 0) {
        await tx.issueProgress.createMany({ data: toCreate });
      }
      for (const change of reevaluations) {
        await tx.issueProgress.update({
          where: { id: change.id },
          data: { workflowType: change.workflowType, stageCompletion: change.stageCompletion },
        });
      }
    },
    { timeout: 30_000 },
  );

  return {
    filters: filterSummaries,
    progressSeeded: toCreate.length,
    workflowsReevaluated: reevaluations.length,
  };
}

/**
 * Per-track "Sync stages from Jira" (sync-stages-from-jira.md): refresh ONE filter's cache from
 * Jira, then re-derive every one of its issues' stage checklists from the fresh Jira status via
 * StatusStageMapping — OVERWRITING existing rows (the user-triggered, per-track variant of the
 * "re-seed forward" the create-only sync deliberately skips, sync-hybrid-seeding.md decision 5).
 *
 * Contract vs. {@link syncTeamSprint}:
 * - Scoped to one filter, but owning workflow is still computed across ALL filters holding a key.
 * - Overwrites `stageCompletion`/`workflowType`/`seededFromStatus`; PRESERVES blocked/risk fields.
 * - Resets `updatedById` to null (status-derived, not a manual edit) so re-runs stay idempotent —
 *   only hand-edits made AFTER an apply count as "manual" again.
 * - An unmapped status never wipes an existing row (resolveStageResync); it's counted, not applied.
 *
 * @param {{ teamId: string, sprintId: string, filterId: string, userId: string }} args
 * @returns {Promise<{ filterId: string, filterName: string, total: number, applied: number, unmapped: number, overwroteManual: number }>}
 */
export async function syncFilterStagesFromJira({ teamId, sprintId, filterId, userId }) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new NotFoundError("Team not found");
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, state: true },
  });
  if (!sprint) throw new NotFoundError("Sprint not found");
  if (sprint.state === SprintState.CLOSED) {
    throw new ConflictError(
      "Cannot sync a CLOSED sprint — its historical data is frozen for the leaderboard and history views",
    );
  }
  const filter = await prisma.filter.findFirst({ where: { id: filterId, teamId, sprintId } });
  if (!filter) throw new NotFoundError("Filter not found");

  const auth = await getJiraAuthForUser(userId);
  // Same dead-token fail-fast as syncTeamSprint — Jira degrades bad Basic auth to anonymous.
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

  // 1. Pull the latest issues for THIS filter and replace its cache (the "pull latest, then map"
  //    contract). Reuses the same atomic refresh as the full sync.
  let jql = filter.jql;
  const filterUpdate = {};
  if (filter.sourceType === FilterSourceType.JIRA_FILTER) {
    const jiraFilter = await fetchFilter({ auth, filterId: filter.jiraFilterId });
    jql = jiraFilter.jql;
    filterUpdate.jql = jql;
  }
  const rawIssues = await searchIssues({ auth, jql, fields: requestFields });
  const rows = rawIssues.map((issue) => transformJiraIssue(issue, fieldIds));
  await refreshFilterCache(filter, rows, filterUpdate);

  // The fresh Jira status per key comes straight from the just-refreshed rows (a key may also sit
  // in another, staler filter — always trust the track we just synced).
  const freshStatusByKey = new Map(rows.map((row) => [row.jiraKey, row.jiraStatus]));
  const keys = [...freshStatusByKey.keys()];

  // 2. Owning workflow needs EVERY filter that holds a key (§9 one-progress-row rule) — except the
  //    NEEDS_ATTENTION hygiene track, which never owns a progress row (it's always lowest priority
  //    anyway, so this is defensive/symmetric with syncTeamSprint).
  const cache = await prisma.issue.findMany({
    where: {
      filter: { teamId, sprintId, workflowType: { not: NEEDS_ATTENTION } },
    },
    select: { jiraKey: true, filter: { select: { workflowType: true } } },
  });
  const typesByKey = new Map();
  for (const row of cache) {
    const types = typesByKey.get(row.jiraKey) ?? [];
    types.push(row.filter.workflowType);
    typesByKey.set(row.jiraKey, types);
  }

  const mappings = await prisma.statusStageMapping.findMany({
    where: { OR: [{ teamId }, { teamId: null }] },
  });
  const existingProgress = await prisma.issueProgress.findMany({
    where: { teamId, sprintId, jiraKey: { in: keys } },
    select: { id: true, jiraKey: true, updatedById: true },
  });
  const progressByKey = new Map(existingProgress.map((progress) => [progress.jiraKey, progress]));

  // 3. Re-derive stages for every key in this filter and stage the writes.
  const toCreate = [];
  const toUpdate = [];
  let unmapped = 0;
  let overwroteManual = 0;
  for (const jiraKey of keys) {
    const owning = owningWorkflowType(typesByKey.get(jiraKey) ?? [filter.workflowType]);
    const existing = progressByKey.get(jiraKey) ?? null;
    const plan = resolveStageResync({
      workflowType: owning,
      jiraStatus: freshStatusByKey.get(jiraKey),
      mappings,
      existing,
    });
    if (plan.unmapped) unmapped += 1;
    if (!plan.write) continue;
    if (plan.overwroteManual) overwroteManual += 1;
    if (existing) {
      toUpdate.push({
        id: existing.id,
        workflowType: owning,
        stageCompletion: plan.stages,
        seededFromStatus: plan.seededFromStatus,
      });
    } else {
      toCreate.push({
        teamId,
        sprintId,
        jiraKey,
        workflowType: owning,
        stageCompletion: plan.stages,
        seededFromStatus: plan.seededFromStatus,
      });
    }
  }

  // One `updateMany` per distinct payload instead of one `update` per issue: a per-row loop over a
  // real track (~100 issues) spends ~100 sequential round-trips to Neon and overran Prisma's 5s
  // interactive-transaction budget (P2028). Grouping collapses that to roughly one write per Jira
  // status in the track; the raised timeout is headroom for a very large track, not the fix.
  const updateGroups = groupStageUpdates(toUpdate);
  await prisma.$transaction(
    async (tx) => {
      if (toCreate.length > 0) {
        await tx.issueProgress.createMany({ data: toCreate });
      }
      for (const group of updateGroups) {
        await tx.issueProgress.updateMany({
          where: { id: { in: group.ids } },
          // status-derived, not a manual edit — keeps repeated syncs idempotent (see contract above)
          data: { ...group.data, updatedById: null },
        });
      }
    },
    { timeout: 30_000 },
  );

  return {
    filterId: filter.id,
    filterName: filter.name,
    total: keys.length,
    applied: toCreate.length + toUpdate.length,
    unmapped,
    overwroteManual,
  };
}
