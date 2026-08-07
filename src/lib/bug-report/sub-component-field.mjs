/**
 * Pure helpers for the custom sub-component Jira field (enhancing-bug-board.md (b)) — split out of
 * refresh.js so they are plain-Node testable (refresh.js pulls in Prisma). No fetch, no Prisma.
 *
 * Jira's REST `fields` param needs a field's ID (`customfield_XXXXX`), not its human name, so we
 * discover the id from Jira's field metadata by matching the shared `SUB_COMPONENT_FIELD` JQL
 * clause. Imported by RELATIVE path so a fixture can load it without the Next `@/` alias.
 */
import { SUB_COMPONENT_FIELD } from "../jira/issue-type-defaults.mjs";

// SUB_COMPONENT_FIELD is JQL-quoted, e.g. '"sub-component[dropdown]"'. Its clause name is
// `sub-component[dropdown]`; the display name is likely `sub-component`.
const SUB_COMPONENT_CLAUSE = SUB_COMPONENT_FIELD.replace(/^"|"$/g, "").trim().toLowerCase();
const SUB_COMPONENT_NAME = SUB_COMPONENT_CLAUSE.replace(/\[.*\]$/, "").trim();

/**
 * Find the custom sub-component field's REST id from Jira's field metadata (decision 6). Matches on
 * the JQL clause name first (most reliable), then the display name. Returns null when absent.
 * @param {Array<{ id: string, name?: string, clauseNames?: string[] }>} fields
 * @returns {string | null}
 */
export function resolveSubComponentFieldId(fields) {
  if (!Array.isArray(fields)) return null;
  const match = fields.find((field) => {
    const clauses = (field.clauseNames ?? []).map((clause) => String(clause).toLowerCase());
    if (clauses.includes(SUB_COMPONENT_CLAUSE)) return true;
    const name = String(field.name ?? "").trim().toLowerCase();
    return name === SUB_COMPONENT_NAME || name === SUB_COMPONENT_CLAUSE;
  });
  return match?.id ?? null;
}

/**
 * Extract a readable sub-component value from a Jira custom-field cell. Handles the shapes a
 * dropdown/select field can take: a single option `{ value }`, a multi-select array, a cascading
 * `{ value, child: { value } }`, or a bare string. Returns null when empty.
 * @param {unknown} value
 * @returns {string | null}
 */
export function extractSubComponent(value) {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const names = value.map(extractSubComponent).filter(Boolean);
    return names.length > 0 ? names.join(", ") : null;
  }
  if (typeof value === "object") {
    const own = value.value ?? value.name ?? null;
    const child = value.child ? extractSubComponent(value.child) : null;
    const parts = [own, child].filter(Boolean);
    return parts.length > 0 ? parts.join(" - ") : null;
  }
  return null;
}
