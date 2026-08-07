/**
 * Pure helpers for the Jira Sprint field on bug issues (bug-sprint-ownership.md (b)) — split out of
 * refresh.js so they are plain-Node testable (refresh.js pulls in Prisma). No fetch, no Prisma.
 *
 * The Sprint field is a standard Jira field, but its custom-field id varies by instance
 * (`customfield_10020` on most, but not all), so the REST `fields` param can't be hardcoded blindly:
 * we resolve the id from Jira's field metadata (name/clause "sprint"), falling back to the common
 * default. Its value shape is the same one `src/lib/jira/transform.js` already handles for the
 * sprint-side Issue cache — the extractor below is a faithful port so this module has no cross-file
 * runtime dependency and loads under plain Node without the Next `@/` alias.
 */

/** The common Jira Sprint custom-field id; the fallback when discovery finds nothing. */
export const DEFAULT_SPRINT_FIELD = "customfield_10020";

/**
 * Find the Sprint field's REST id from Jira's field metadata. Matches the display name "sprint"
 * first (the Sprint field is reliably named), then a "sprint" JQL clause. Returns null when absent
 * — the caller then falls back to DEFAULT_SPRINT_FIELD.
 * @param {Array<{ id: string, name?: string, clauseNames?: string[] }>} fields
 * @returns {string | null}
 */
export function resolveSprintFieldId(fields) {
  if (!Array.isArray(fields)) return null;
  const match = fields.find((field) => {
    const name = String(field.name ?? "").trim().toLowerCase();
    if (name === "sprint") return true;
    const clauses = (field.clauseNames ?? []).map((clause) => String(clause).toLowerCase());
    return clauses.includes("sprint");
  });
  return match?.id ?? null;
}

/**
 * Extract a readable sprint name from a Jira Sprint field cell. Sprint values vary by Jira age:
 * an array of sprint objects (prefer the active one, else the most recent), a single object, or the
 * legacy `"...name=Sprint 1,startDate=..."` GreenHopper string. Returns null when empty. Port of
 * `extractSprintName` in `src/lib/jira/transform.js`.
 * @param {unknown} rawSprint
 * @returns {string | null}
 */
export function extractSprintName(rawSprint) {
  if (Array.isArray(rawSprint) && rawSprint.length > 0) {
    const active = rawSprint.find((s) => s?.state?.toLowerCase() === "active");
    const chosen = active ?? rawSprint[rawSprint.length - 1];
    return chosen?.name ?? null;
  }
  if (rawSprint && typeof rawSprint === "object" && rawSprint.name) {
    return rawSprint.name;
  }
  if (typeof rawSprint === "string") {
    const match = rawSprint.match(/name=([^,\]]+)/);
    if (match) return match[1].trim();
  }
  return null;
}
