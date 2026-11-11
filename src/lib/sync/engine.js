/**
 * Sync engine (sync-hybrid-seeding.md (c)) — fetches every filter of a team+sprint from Jira,
 * replaces the Issue cache, seeds missing IssueProgress rows via StatusStageMapping (the HYBRID
 * stage model, §6/§16), and re-evaluates owning workflows (§9). Called by the sync route now and
 * the step-7 cron later — no request/response types in here.
 *
 * Invariants:
 * - IssueProgress is CREATE-ONLY here (decision 5): existing rows are never re-seeded — manual
 *   edits win. `seededFromStatus` records what seeded a row (null when no mapping matched).
 *   Two exceptions, from the issue's Jira status (sync-jira-status-rules.md, resolveStatusRules):
 *   a completed status completes the checklist, and a Blocked status blocks the row (lifted again
 *   only when the sync set it).
 * - Network calls happen OUTSIDE transactions; each filter's cache replace is atomic.
 * - Progress rows whose key left every filter survive untouched (§9 decoupling).
 */
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/rbac";
import { ConflictError } from "@/lib/api/route-helpers";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/log";
import { deriveSyncWarnings, buildUnmappedWarning } from "@/lib/sync/warnings.mjs";
import { owningWorkflowType } from "@/lib/workflows.mjs";
import { ensureNeedsAttentionFilter } from "@/lib/needs-attention/ensure-filter";
import {
  buildSeededStages,
  groupStageUpdates,
  isBlockedJiraStatus,
  JIRA_BLOCKED_REASON,
  reshapeStageCompletion,
  resolveBlockedRule,
  resolveStageResync,
  resolveStatusRules,
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

/**
 * Refresh one filter's Issue cache atomically; returns the added/removed diff (decision 4) plus
 * `previousTotal`/`firstSync`, which are what let deriveSyncWarnings notice a track that Jira just
 * silently emptied (§14.14). Both are free here — the transaction already reads the existing keys.
 */
async function refreshFilterCache(filter, rows, filterUpdate) {
  const firstSync = filter.lastSyncedAt === null;
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
      previousTotal: existingKeys.size,
      firstSync,
      added: addedKeys.length,
      removed: removedKeys.length,
      addedKeys,
      removedKeys,
    };
  });
}

/**
 * Name the track in a failure. A sync walks every filter sequentially, so without this the whole
 * run reports one Jira error with no clue WHICH track produced it — and with several tracks per
 * team that is most of the triage. The JQL itself is already attached by `searchIssues`.
 *
 * @param {unknown} error
 * @param {{ id: string, name: string, sourceType: string, jiraFilterId: string | null }} filter
 * @returns {unknown} the same error, annotated when it is one of ours.
 */
function annotateTrackFailure(error, filter) {
  if (!(error instanceof AppError)) return error;
  error.message = `Track "${filter.name}" failed: ${error.message}`;
  return error.withDetails({
    filterId: filter.id,
    filterName: filter.name,
    sourceType: filter.sourceType,
    ...(filter.jiraFilterId ? { jiraFilterId: filter.jiraFilterId } : {}),
  });
}

/**
 * Sync all filters of a team+sprint with the calling user's Jira credential.
 * @param {{ teamId: string, sprintId: string, userId: string }} args
 * @returns {Promise<{ filters: Array<object>, warnings: Array<object>, progressSeeded: number,
 *   workflowsReevaluated: number, statusCompleted: number, statusBlocked: number,
 *   statusUnblocked: number }>}
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
    const startedAt = Date.now();
    try {
      let jql = filter.jql;
      const filterUpdate = {};
      if (filter.sourceType === FilterSourceType.JIRA_FILTER) {
        const jiraFilter = await fetchFilter({ auth, filterId: filter.jiraFilterId });
        jql = jiraFilter.jql; // search the filter's CURRENT jql and refresh our copy (decision 9)
        filterUpdate.jql = jql;
      }
      const rawIssues = await searchIssues({ auth, jql, fields: requestFields });
      const rows = rawIssues.map((issue) => transformJiraIssue(issue, fieldIds));
      const summary = await refreshFilterCache(filter, rows, filterUpdate);
      filterSummaries.push(summary);
      logger.debug("sync.track", {
        filterName: summary.name,
        total: summary.total,
        previousTotal: summary.previousTotal,
        added: summary.added,
        removed: summary.removed,
        ms: Date.now() - startedAt,
      });
    } catch (error) {
      throw annotateTrackFailure(error, filter);
    }
  }

  // A track Jira just emptied is a SUCCESSFUL sync with a suspicious result (§14.14) — surfaced,
  // never thrown.
  const warnings = deriveSyncWarnings(filterSummaries);
  for (const warning of warnings) {
    logger.warn("sync.warning", warning);
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
    select: {
      id: true,
      jiraKey: true,
      workflowType: true,
      stageCompletion: true,
      blocked: true,
      blockedReason: true,
    },
  });
  const progressKeys = new Set(existingProgress.map((progress) => progress.jiraKey));
  const mappings = await prisma.statusStageMapping.findMany({
    where: { OR: [{ teamId }, { teamId: null }] },
  });

  // 3. Seed progress for keys that have none (create-only; sync is not a manual edit, so no
  //    updatedById attribution). A completed status seeds a full checklist (buildSeededStages) and a
  //    Blocked status seeds a blocked row (sync-jira-status-rules.md).
  const toCreate = [];
  let statusCompleted = 0;
  let statusBlocked = 0;
  let statusUnblocked = 0;
  for (const [jiraKey, entry] of byKey) {
    if (progressKeys.has(jiraKey)) continue;
    const workflowType = owningWorkflowType(entry.types);
    const { stages, seededFromStatus } = buildSeededStages(workflowType, entry.jiraStatus, mappings);
    const blocked = isBlockedJiraStatus(entry.jiraStatus);
    if (blocked) statusBlocked += 1;
    toCreate.push({
      teamId,
      sprintId,
      jiraKey,
      workflowType,
      stageCompletion: stages,
      seededFromStatus,
      ...(blocked ? { blocked: true, blockedReason: JIRA_BLOCKED_REASON } : {}),
    });
  }

  // 4. Existing rows still in the cache: re-evaluate the owning workflow (decision 6), then apply
  //    the Jira status rules on top of the reshaped stages — the only overwrite this sync makes.
  const updates = [];
  let reevaluated = 0;
  for (const progress of existingProgress) {
    const entry = byKey.get(progress.jiraKey);
    if (!entry) continue;
    const data = {};
    const owning = owningWorkflowType(entry.types);
    let stageCompletion = progress.stageCompletion;
    if (owning !== progress.workflowType) {
      stageCompletion = reshapeStageCompletion(progress.stageCompletion, owning);
      data.workflowType = owning;
      data.stageCompletion = stageCompletion;
      reevaluated += 1;
    }
    const rules = resolveStatusRules({
      jiraStatus: entry.jiraStatus,
      stageCompletion,
      blocked: progress.blocked,
      blockedReason: progress.blockedReason,
    });
    Object.assign(data, rules.data);
    if (rules.completed) statusCompleted += 1;
    if (rules.blocked) statusBlocked += 1;
    if (rules.unblocked) statusUnblocked += 1;
    if (Object.keys(data).length > 0) updates.push({ id: progress.id, data });
  }

  // Updates carry a per-row payload, so they can't be collapsed like the stage re-sync's writes
  // (groupStageUpdates) — raise the budget instead: each row is one round-trip to Neon and the
  // default 5s ceiling is ~100 rows (P2028). Only rows that actually change are written.
  await prisma.$transaction(
    async (tx) => {
      if (toCreate.length > 0) {
        await tx.issueProgress.createMany({ data: toCreate });
      }
      for (const change of updates) {
        await tx.issueProgress.update({ where: { id: change.id }, data: change.data });
      }
    },
    { timeout: 30_000 },
  );

  logger.info("sync.done", {
    tracks: filterSummaries.length,
    issues: filterSummaries.reduce((sum, filter) => sum + filter.total, 0),
    progressSeeded: toCreate.length,
    workflowsReevaluated: reevaluated,
    statusCompleted,
    statusBlocked,
    statusUnblocked,
    warnings: warnings.length,
  });

  return {
    filters: filterSummaries,
    warnings,
    progressSeeded: toCreate.length,
    workflowsReevaluated: reevaluated,
    statusCompleted,
    statusBlocked,
    statusUnblocked,
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
 * - Completed Jira statuses check every stage, and the Blocked rule (resolveBlockedRule) runs here
 *   exactly as in Sync Jira (sync-jira-status-rules.md). A Blocked status leaves the stages alone
 *   and is not reported as unmapped — it is handled.
 *
 * @param {{ teamId: string, sprintId: string, filterId: string, userId: string }} args
 * @returns {Promise<{ filterId: string, filterName: string, total: number, applied: number,
 *   unmapped: number, overwroteManual: number, statusBlocked: number, statusUnblocked: number,
 *   warnings: Array<object> }>}
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
  let refreshSummary;
  let rows;
  try {
    let jql = filter.jql;
    const filterUpdate = {};
    if (filter.sourceType === FilterSourceType.JIRA_FILTER) {
      const jiraFilter = await fetchFilter({ auth, filterId: filter.jiraFilterId });
      jql = jiraFilter.jql;
      filterUpdate.jql = jql;
    }
    const rawIssues = await searchIssues({ auth, jql, fields: requestFields });
    rows = rawIssues.map((issue) => transformJiraIssue(issue, fieldIds));
    refreshSummary = await refreshFilterCache(filter, rows, filterUpdate);
  } catch (error) {
    throw annotateTrackFailure(error, filter);
  }

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
    select: { id: true, jiraKey: true, updatedById: true, blocked: true, blockedReason: true },
  });
  const progressByKey = new Map(existingProgress.map((progress) => [progress.jiraKey, progress]));

  // 3. Re-derive stages for every key in this filter and stage the writes.
  const toCreate = [];
  const toUpdate = [];
  let unmapped = 0;
  let overwroteManual = 0;
  let statusBlocked = 0;
  let statusUnblocked = 0;
  const unmappedStatuses = [];
  // Blocked-rule writes, by payload: there are only two (block / lift), so one updateMany each.
  const blockIds = [];
  const unblockIds = [];
  for (const jiraKey of keys) {
    const owning = owningWorkflowType(typesByKey.get(jiraKey) ?? [filter.workflowType]);
    const existing = progressByKey.get(jiraKey) ?? null;
    const jiraStatus = freshStatusByKey.get(jiraKey);
    const plan = resolveStageResync({ workflowType: owning, jiraStatus, mappings, existing });
    const blockedStatus = isBlockedJiraStatus(jiraStatus);
    // Blocked is handled by the Blocked rule, so it isn't "unmapped" (its stages still stay put).
    if (plan.unmapped && !blockedStatus) {
      unmapped += 1;
      // Keep the STATUS NAMES, not just the count: "3 unmapped" sends you hunting, whereas
      // "no mapping for \"In Review\"" is the fix.
      if (jiraStatus) unmappedStatuses.push(jiraStatus);
    }
    if (existing) {
      const rule = resolveBlockedRule({
        jiraStatus,
        blocked: existing.blocked,
        blockedReason: existing.blockedReason,
      });
      if (rule.blocked) {
        blockIds.push(existing.id);
        statusBlocked += 1;
      }
      if (rule.unblocked) {
        unblockIds.push(existing.id);
        statusUnblocked += 1;
      }
    } else if (blockedStatus) {
      statusBlocked += 1;
    }
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
        ...(blockedStatus ? { blocked: true, blockedReason: JIRA_BLOCKED_REASON } : {}),
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
      // The Blocked rule never touches stages or updatedById — blocking isn't a stage edit.
      if (blockIds.length > 0) {
        await tx.issueProgress.updateMany({
          where: { id: { in: blockIds } },
          data: { blocked: true, blockedReason: JIRA_BLOCKED_REASON },
        });
      }
      if (unblockIds.length > 0) {
        await tx.issueProgress.updateMany({
          where: { id: { in: unblockIds } },
          data: { blocked: false, blockedReason: null },
        });
      }
    },
    { timeout: 30_000 },
  );

  const warnings = deriveSyncWarnings([refreshSummary]);
  const unmappedWarning = buildUnmappedWarning({
    filterId: filter.id,
    filterName: filter.name,
    statuses: unmappedStatuses,
    count: unmapped,
  });
  if (unmappedWarning) warnings.push(unmappedWarning);
  for (const warning of warnings) {
    logger.warn("sync.warning", warning);
  }

  logger.info("sync.stages_done", {
    filterName: filter.name,
    total: keys.length,
    applied: toCreate.length + toUpdate.length,
    unmapped,
    overwroteManual,
    statusBlocked,
    statusUnblocked,
  });

  return {
    filterId: filter.id,
    filterName: filter.name,
    total: keys.length,
    applied: toCreate.length + toUpdate.length,
    unmapped,
    overwroteManual,
    statusBlocked,
    statusUnblocked,
    warnings,
  };
}
