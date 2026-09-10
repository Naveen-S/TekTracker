/**
 * Pure helpers for adding/editing a board track (editable-filters.md).
 *
 * Split out of the dialog so the two rules that matter are testable outside React/Next: what the
 * API body must carry, and whether an edit changes what the track PULLS (which is what decides
 * whether the board re-syncs). `.mjs` + relative imports so plain-Node fixtures can load it — the
 * same reason `workflows.mjs` / `seeding.mjs` are `.mjs` (see bootstrap-seed.md).
 */

/** Fields that change what a track pulls from Jira, or the SHAPE of its stage checklists. */
const RESYNC_FIELDS = ["sourceType", "jql", "jiraFilterId", "workflowType"];

/** Trim to a value or null — the API rejects "", but null means "clear this column". */
const clean = (value) => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
};

/**
 * Shape the dialog's values into an API body — the same shape for POST …/filters and PATCH
 * …/filters/[filterId], so create and edit can't drift apart.
 *
 * The two source columns are deliberately asymmetric:
 * - a **JQL** track sends `jiraFilterId: null`. `buildJiraSearchUrl` prefers the id over the jql,
 *   so a leftover id from a previous source would point the card's Jira link at the abandoned
 *   filter.
 * - a **JIRA_FILTER** track does not send `jql` at all. On that source the column holds the JQL the
 *   sync engine last resolved *from* the Jira filter (`engine.js` → `filterUpdate.jql`) — derived
 *   display data, not user input. Nulling it would blank the card's query line until the next sync.
 *
 * @param {{ name: string, workflowType: string, sourceType: string, jql?: string, jiraFilterId?: string, accentColor?: string|null }} form
 * @returns {object} body for the create/patch route
 */
export function buildFilterPayload(form) {
  const payload = {
    name: form.name.trim(),
    workflowType: form.workflowType,
    sourceType: form.sourceType,
    accentColor: clean(form.accentColor),
  };
  if (form.sourceType === "JQL") {
    payload.jql = clean(form.jql);
    payload.jiraFilterId = null;
  } else {
    payload.jiraFilterId = clean(form.jiraFilterId);
  }
  return payload;
}

/**
 * The PATCH body for a track edit plus the "does this need a re-sync?" verdict — true only when the
 * edit changes what the track PULLS or the SHAPE of its stage checklists, so a rename or a recolour
 * saves without a Jira round-trip (editable-filters.md decision 3).
 *
 * @param {{ name: string, workflowType: string, sourceType: string, jql: string|null, jiraFilterId: string|null, accentColor: string|null }} before the filter as it is on the server
 * @param {object} form the dialog's current values
 * @returns {{ patch: object, needsResync: boolean, changed: boolean }}
 */
export function buildFilterPatch(before, form) {
  const patch = buildFilterPayload(form);
  // Every field on both sides is a trimmed string or null, so a plain !== is the whole comparison.
  // Only keys the payload actually carries are compared — see the asymmetry note above.
  const keys = Object.keys(patch);
  const differs = (key) => clean(before[key]) !== patch[key];
  return {
    patch,
    needsResync: RESYNC_FIELDS.filter((key) => keys.includes(key)).some(differs),
    changed: keys.some(differs),
  };
}
