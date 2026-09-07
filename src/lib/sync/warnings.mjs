/**
 * Sync warnings — pure derivation, no I/O (observability-and-errors.md; closes project-overview
 * §14.14).
 *
 * The flaw being closed: `syncTeamSprint` REPLACES a filter's Issue cache with whatever Jira
 * returns, so a renamed component, an edited saved filter, or a token that quietly lost project
 * scope takes a track from 34 issues to 0 **without failing**. Progress rows survive (they are keyed
 * by team+sprint+jiraKey) but the board simply shows an empty track, and nothing anywhere says why.
 * Observed on a live team's Tech Debt track on 2026-08-28.
 *
 * A warning is NOT an error: the sync succeeded and the data is what Jira said. It is a signal that
 * what Jira said is suspicious. Warnings ride back on the sync response and are logged; they never
 * change a status code, and they are never inputs to §12 metrics.
 *
 * Pure module with no imports, so the fixtures can load it directly (house convention: pure `.mjs`
 * uses relative imports, never the `@/` alias).
 */

/** Stable codes — the UI groups on these, so they are part of the response contract. */
export const SYNC_WARNING_CODES = Object.freeze({
  /** A track that HAD issues now has none — the silent board-wipe of §14.14. */
  TRACK_EMPTIED: "TRACK_EMPTIED",
  /** A brand-new track matched nothing on its very first sync — almost always a wrong JQL. */
  TRACK_EMPTY: "TRACK_EMPTY",
  /** Jira statuses with no StatusStageMapping row, so stages could not be derived from them. */
  UNMAPPED_STATUSES: "UNMAPPED_STATUSES",
});

const EMPTIED_HINT =
  "The query ran fine but matched nothing. Check the track's JQL — a renamed component or sub-component, an edited saved filter, or a Jira token that lost access to the project will all empty a track silently.";

const EMPTY_HINT =
  "This track matched no issues on its first sync. Check the JQL — a mistyped sub-component or fix version matches nothing rather than erroring.";

/**
 * Derive warnings from the per-filter refresh summaries of one sync.
 *
 * @param {Array<{ id: string, name: string, total: number, previousTotal: number,
 *   firstSync?: boolean }>} summaries
 * @returns {Array<{ code: string, filterId: string, filterName: string, previous?: number,
 *   current: number, hint: string }>}
 */
export function deriveSyncWarnings(summaries = []) {
  const warnings = [];

  for (const summary of summaries) {
    if (!summary || summary.total !== 0) continue;

    // A track that used to hold issues and now holds none: the dangerous case.
    if (summary.previousTotal > 0) {
      warnings.push({
        code: SYNC_WARNING_CODES.TRACK_EMPTIED,
        filterId: summary.id,
        filterName: summary.name,
        previous: summary.previousTotal,
        current: 0,
        hint: EMPTIED_HINT,
      });
      continue;
    }

    // A track that has never returned anything. Only flagged on the FIRST sync: a genuinely empty
    // Support track early in a sprint is normal and must not cry wolf on every refresh.
    if (summary.firstSync) {
      warnings.push({
        code: SYNC_WARNING_CODES.TRACK_EMPTY,
        filterId: summary.id,
        filterName: summary.name,
        current: 0,
        hint: EMPTY_HINT,
      });
    }
  }

  return warnings;
}

/**
 * Warning for Jira statuses that no StatusStageMapping covers, so the stage checklist could not be
 * derived for those issues. Returns null when everything mapped.
 *
 * @param {{ filterId: string, filterName: string, statuses: string[], count: number }} args
 * @returns {{ code: string, filterId: string, filterName: string, statuses: string[],
 *   count: number, hint: string } | null}
 */
export function buildUnmappedWarning({ filterId, filterName, statuses = [], count = 0 }) {
  if (count <= 0) return null;
  const named = [...new Set(statuses.filter(Boolean))].sort();
  return {
    code: SYNC_WARNING_CODES.UNMAPPED_STATUSES,
    filterId,
    filterName,
    statuses: named,
    count,
    hint: named.length
      ? `No stage mapping exists for ${named.map((status) => `"${status}"`).join(", ")} — those issues kept their existing stages. Add a mapping in /admin to derive stages from them.`
      : "Some issues have a Jira status with no stage mapping; they kept their existing stages.",
  };
}
