/**
 * JQL builders for /security (spec (d): "every number links to its Jira JQL" — the artifact's
 * `jlink` behaviour is what made it trustworthy). Pure.
 *
 * Two kinds of link:
 * - SEMANTIC JQL where Jira can express the set exactly (program base, `fixVersion IS EMPTY`,
 *   `assignee IS EMPTY`, label clauses, `updated <= -Nd`);
 * - `key IN (…)` for sets only the server can compute (overdue, SLA state, campaign/triage groups).
 *   Past KEYS_LINK_MAX keys the URL gets unwieldy, so the caller's closest semantic approximation
 *   is used instead (documented on the call site).
 */

export const KEYS_LINK_MAX = 150;

export const quote = (value) => `"${String(value).replace(/"/g, '\\"')}"`;

/** `labels != X` alone silently drops unlabelled issues (GM-10529) — always guard with IS EMPTY. */
export const notLabel = (label) => `(labels IS EMPTY OR labels != ${quote(label)})`;

const exclusion = (program) => (program.excludeLabel ? ` AND ${notLabel(program.excludeLabel)}` : "");

/** One program's slice of the open pipeline. */
export function programBaseJql(program, settings) {
  return `${settings.openPipelineJql} AND ${settings.priorityJql} AND component = ${quote(program.component)}${exclusion(program)}`;
}

/** The "All programs" open pipeline — an OR of each program's own slice (exclusions differ). */
export function rollupBaseJql(programs, settings) {
  const clauses = programs.map((program) => `(component = ${quote(program.component)}${exclusion(program)})`);
  return `${settings.openPipelineJql} AND ${settings.priorityJql} AND (${clauses.join(" OR ")})`;
}

/** One program's Done-inclusive progress universe. */
export const programProgressJql = (program) => `(${program.progressJql})${exclusion(program)}`;

/** The rollup's progress universe — the UNION of each program's own JQL (never one combined query). */
export const rollupProgressJql = (programs) => programs.map((program) => `(${programProgressJql(program)})`).join(" OR ");

/** `key IN (…)` for a computed set, or the approximation when the set is too large / empty. */
export function keysJql(keys, approximation = null) {
  if (keys.length === 0) return approximation;
  if (keys.length > KEYS_LINK_MAX) return approximation;
  return `key IN (${keys.join(", ")}) ORDER BY key`;
}

/** "customfield_14539" → "cf[14539]" (the "Story Points" name alias is ambiguous on this site). */
export function cfRef(fieldId) {
  const match = /^customfield_(\d+)$/.exec(fieldId ?? "");
  return match ? `cf[${match[1]}]` : fieldId;
}

/** Neither story points nor an original estimate. */
export const noEstimateClause = (storyPointsField) => {
  const cf = cfRef(storyPointsField);
  return `(${cf} IS EMPTY OR ${cf} = 0) AND (originalEstimate IS EMPTY OR originalEstimate = 0)`;
};

/** `fixVersion IN (…)` naming every version observed in a month, else the canonical `.1.0`. */
export function versionsClause(versionNames, fallbackName) {
  const names = [...new Set(versionNames)].sort();
  return names.length > 0 ? `fixVersion IN (${names.map(quote).join(", ")})` : `fixVersion = ${quote(fallbackName)}`;
}

export const and = (base, clause) => (clause ? `${base} AND ${clause}` : base);

/** A browse/search URL for a JQL (null-safe). */
export function jqlUrl(jiraBaseUrl, jql) {
  if (!jiraBaseUrl || !jql) return null;
  return `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}`;
}

export const browseUrl = (jiraBaseUrl, key) => (jiraBaseUrl ? `${jiraBaseUrl}/browse/${key}` : null);
