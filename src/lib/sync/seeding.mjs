/**
 * Pure seeding/shape helpers for the hybrid stage model (sync-hybrid-seeding.md decisions 5–6).
 * Split out of the sync engine so they are loadable OUTSIDE Next (unit tests, scripts) — the
 * engine's other imports (db, auth) need the Next runtime. `.mjs` + relative import for the same
 * plain-Node reason as workflows.mjs (see bootstrap-seed.md).
 */
import { stageCountFor } from "../workflows.mjs";

/**
 * Seed a stage array from a raw Jira status: a matching StatusStageMapping row — team-specific
 * beats global (`teamId: null`), matched case-insensitively — checks stages `0..stageIndex` (the
 * §4 checklist rule); no match → all false, `seededFromStatus: null`.
 *
 * @param {string} workflowType
 * @param {string} jiraStatus raw Jira status name
 * @param {Array<{ workflowType: string, jiraStatus: string, stageIndex: number, teamId: string | null }>} mappings
 * @returns {{ stages: boolean[], seededFromStatus: string | null }}
 */
export function buildSeededStages(workflowType, jiraStatus, mappings) {
  const count = stageCountFor(workflowType);
  const stages = new Array(count).fill(false);
  const status = jiraStatus.toLowerCase();
  const candidates = mappings.filter(
    (m) => m.workflowType === workflowType && m.jiraStatus.toLowerCase() === status,
  );
  const match = candidates.find((m) => m.teamId !== null) ?? candidates[0] ?? null;
  if (!match) {
    return { stages, seededFromStatus: null };
  }
  for (let i = 0; i <= match.stageIndex && i < count; i++) {
    stages[i] = true;
  }
  return { stages, seededFromStatus: jiraStatus };
}

/**
 * Decide what a per-track "Sync stages from Jira" pass (sync-stages-from-jira.md) should do to ONE
 * issue's progress row, given its fresh Jira status. Unlike the create-only sync engine, this
 * OVERWRITES existing rows from status — with one guard: an unmapped status never WIPES an existing
 * row (only lays down an all-false baseline for a brand-new key, matching sync's create-only rule).
 *
 * @param {{ workflowType: string, jiraStatus: string, mappings: Array<object>, existing: { updatedById: string | null } | null }} args
 * @returns {{ stages: boolean[], seededFromStatus: string | null, unmapped: boolean, write: boolean, overwroteManual: boolean }}
 */
export function resolveStageResync({ workflowType, jiraStatus, mappings, existing }) {
  const { stages, seededFromStatus } = buildSeededStages(workflowType, jiraStatus, mappings);
  const unmapped = seededFromStatus === null;
  // Non-destructive: don't overwrite an existing row whose current status has no mapping — only
  // seed a baseline for a key that has no row yet.
  const write = !unmapped || !existing;
  const overwroteManual = write && Boolean(existing) && existing.updatedById != null;
  return { stages, seededFromStatus, unmapped, write, overwroteManual };
}

/**
 * Fit a stage array to another workflow's length: truncate or pad with `false`, prefix preserved
 * (owning-workflow re-evaluation / seed.md shape rule).
 * @param {boolean[]} stageCompletion
 * @param {string} workflowType target workflow
 * @returns {boolean[]}
 */
export function reshapeStageCompletion(stageCompletion, workflowType) {
  const count = stageCountFor(workflowType);
  const next = stageCompletion.slice(0, count);
  while (next.length < count) {
    next.push(false);
  }
  return next;
}

/**
 * Collapse a per-track stage re-sync's row updates into the fewest possible write statements
 * (`updateMany` per distinct payload). A track's issues share very few distinct
 * (workflowType, stages, seededFromStatus) triples — one per Jira status in play — so this turns
 * N round-trips into ~"number of distinct statuses", which is what keeps the write inside Prisma's
 * interactive-transaction budget (a per-row `update` loop over ~100 issues blew the 5s timeout
 * against Neon → P2028).
 *
 * @param {Array<{ id: string, workflowType: string, stageCompletion: boolean[], seededFromStatus: string | null }>} updates
 * @returns {Array<{ ids: string[], data: { workflowType: string, stageCompletion: boolean[], seededFromStatus: string | null } }>}
 */
export function groupStageUpdates(updates) {
  const groups = new Map();
  for (const change of updates) {
    const { id, ...data } = change;
    // JSON (not a joined string) so a status containing the separator can't collide two payloads.
    const key = JSON.stringify([data.workflowType, data.seededFromStatus, data.stageCompletion]);
    const group = groups.get(key);
    if (group) {
      group.ids.push(id);
    } else {
      groups.set(key, { ids: [id], data });
    }
  }
  return [...groups.values()];
}
