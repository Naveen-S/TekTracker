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
