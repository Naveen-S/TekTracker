/**
 * Pure seeding/shape helpers for the hybrid stage model (sync-hybrid-seeding.md decisions 5–6).
 * Split out of the sync engine so they are loadable OUTSIDE Next (unit tests, scripts) — the
 * engine's other imports (db, auth) need the Next runtime. `.mjs` + relative import for the same
 * plain-Node reason as workflows.mjs (see bootstrap-seed.md).
 */
import { stageCountFor } from "../workflows.mjs";

/**
 * Jira statuses that mean the work is finished, on every workflow (sync-jira-status-rules.md).
 * An issue in one of these has its whole checklist completed — when its row is first seeded, by the
 * per-track "Sync stages", AND by the top-level Sync Jira, which forward-completes an existing row
 * (the one place that sync overwrites stages). Code, not StatusStageMapping rows, so it holds on
 * every workflow without a re-seed of the office DB. Matched case-insensitively.
 */
export const COMPLETED_JIRA_STATUSES = Object.freeze([
  "UAT",
  "Testing",
  "Support Validation",
  "Support Clarification",
  "Won't Fix",
  "Not Applicable",
  "Done",
  "Closed",
  "Released",
]);

/** Jira statuses that mark an issue Blocked on the board (sync-jira-status-rules.md). */
export const BLOCKED_JIRA_STATUSES = Object.freeze(["Blocked"]);

/**
 * The `blockedReason` the top-level sync writes when it blocks an issue from its Jira status. It is
 * also how the sync recognises its own block later: only a row carrying exactly this reason is
 * unblocked when the Jira status moves off Blocked, so a block someone set by hand is never undone.
 */
export const JIRA_BLOCKED_REASON = "Blocked in Jira";

/** Lower-case, trim, and fold the typographic apostrophe ("Won’t Fix") onto the plain one. */
function normalizeStatus(status) {
  return (status ?? "").trim().replace(/’/g, "'").toLowerCase();
}

const COMPLETED_SET = new Set(COMPLETED_JIRA_STATUSES.map(normalizeStatus));
const BLOCKED_SET = new Set(BLOCKED_JIRA_STATUSES.map(normalizeStatus));

/** @param {string | null | undefined} jiraStatus */
export function isCompletedJiraStatus(jiraStatus) {
  return COMPLETED_SET.has(normalizeStatus(jiraStatus));
}

/** @param {string | null | undefined} jiraStatus */
export function isBlockedJiraStatus(jiraStatus) {
  return BLOCKED_SET.has(normalizeStatus(jiraStatus));
}

/**
 * Seed a stage array from a raw Jira status. A completed status (COMPLETED_JIRA_STATUSES) checks
 * every stage. Otherwise a matching StatusStageMapping row — team-specific beats global
 * (`teamId: null`), matched case-insensitively — checks stages `0..stageIndex` (the §4 checklist
 * rule); no match → all false, `seededFromStatus: null`.
 *
 * @param {string} workflowType
 * @param {string} jiraStatus raw Jira status name
 * @param {Array<{ workflowType: string, jiraStatus: string, stageIndex: number, teamId: string | null }>} mappings
 * @returns {{ stages: boolean[], seededFromStatus: string | null }}
 */
export function buildSeededStages(workflowType, jiraStatus, mappings) {
  const count = stageCountFor(workflowType);
  if (count > 0 && isCompletedJiraStatus(jiraStatus)) {
    return { stages: new Array(count).fill(true), seededFromStatus: jiraStatus };
  }
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
 * The Blocked rule both syncs apply (sync-jira-status-rules.md decisions 3–4): a Blocked Jira
 * status blocks the row with JIRA_BLOCKED_REASON unless it is already blocked (a hand-set block and
 * its reason are kept); any other status lifts the block only if the sync set it.
 *
 * @param {{ jiraStatus: string, blocked: boolean, blockedReason: string | null }} row
 * @returns {{ data: object, blocked: boolean, unblocked: boolean }} `data` empty when unchanged
 */
export function resolveBlockedRule({ jiraStatus, blocked, blockedReason }) {
  if (isBlockedJiraStatus(jiraStatus)) {
    return blocked
      ? { data: {}, blocked: false, unblocked: false }
      : { data: { blocked: true, blockedReason: JIRA_BLOCKED_REASON }, blocked: true, unblocked: false };
  }
  if (blocked && blockedReason === JIRA_BLOCKED_REASON) {
    return { data: { blocked: false, blockedReason: null }, blocked: false, unblocked: true };
  }
  return { data: {}, blocked: false, unblocked: false };
}

/**
 * The status rules the top-level Sync Jira applies to an issue's progress row
 * (sync-jira-status-rules.md). Everything else about that sync stays create-only; these are the
 * two cases where Jira's status is allowed to change a row that already exists:
 *
 * - **Completed** status → every stage checked. Only written when the row is not already complete,
 *   so a re-sync is a no-op. Stamps `seededFromStatus` and clears `updatedById` (status-derived, as
 *   the per-track "Sync stages" does).
 * - **Blocked** status → resolveBlockedRule (shared with the per-track "Sync stages").
 *
 * @param {{ jiraStatus: string, stageCompletion: boolean[], blocked: boolean,
 *   blockedReason: string | null }} row current stages (already sized to the owning workflow)
 * @returns {{ data: object, completed: boolean, blocked: boolean, unblocked: boolean }}
 *   `data` is the patch to write (empty when nothing changes)
 */
export function resolveStatusRules({ jiraStatus, stageCompletion, blocked, blockedReason }) {
  const data = {};
  let completed = false;

  if (
    isCompletedJiraStatus(jiraStatus) &&
    stageCompletion.length > 0 &&
    !stageCompletion.every(Boolean)
  ) {
    data.stageCompletion = new Array(stageCompletion.length).fill(true);
    data.seededFromStatus = jiraStatus;
    data.updatedById = null;
    completed = true;
  }

  const blockedRule = resolveBlockedRule({ jiraStatus, blocked, blockedReason });
  Object.assign(data, blockedRule.data);

  return { data, completed, blocked: blockedRule.blocked, unblocked: blockedRule.unblocked };
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
