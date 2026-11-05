/**
 * The on-call "bug pulse" (support-oncall.md decision 5): a team's open / total External and
 * Internal bugs for one sprint, read from its existing SUPPORT and INTERNAL_BUG board tracks.
 *
 * Display-only. "Open" is the board's own definition of not-done — per-issue weighted completion
 * < 100 (decision 11) — so the numbers match what the board shows. `resolveProgress` and
 * `calculateWeightedCompletion` are imported from the §12 core unchanged. Only SUPPORT /
 * INTERNAL_BUG filters are read, so NEEDS_ATTENTION is excluded by construction.
 */
import { calculateWeightedCompletion, resolveProgress } from "../metrics.mjs";
import { WORKFLOWS } from "../workflows.mjs";

const KIND_BY_WORKFLOW = { SUPPORT: "external", INTERNAL_BUG: "internal" };

/**
 * @param {{ workflowType: string, issues: { jiraKey: string }[] }[]} filters  one team + sprint
 * @param {Record<string, object>} progressByKey  that team + sprint's IssueProgress rows by key
 * @returns {{ external: { open: number, total: number }, internal: { open: number, total: number } }}
 */
export function bugPulse(filters, progressByKey) {
  const pulse = { external: { open: 0, total: 0 }, internal: { open: 0, total: 0 } };
  const seen = { external: new Set(), internal: new Set() };

  for (const filter of filters) {
    const kind = KIND_BY_WORKFLOW[filter.workflowType];
    if (!kind) continue;
    for (const issue of filter.issues ?? []) {
      // The same key can sit under two filters of one kind — count it once.
      if (seen[kind].has(issue.jiraKey)) continue;
      seen[kind].add(issue.jiraKey);

      const { workflowType, stageCompletion } = resolveProgress(
        issue.jiraKey,
        filter.workflowType,
        progressByKey,
      );
      const percent = calculateWeightedCompletion(stageCompletion, WORKFLOWS[workflowType].weights);
      pulse[kind].total += 1;
      if (percent < 100) pulse[kind].open += 1;
    }
  }
  return pulse;
}
