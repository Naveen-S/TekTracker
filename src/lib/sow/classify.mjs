/**
 * Read-time classification of mirrored SOW tickets (sow-tracker.md decisions 3–4). Pure: the
 * mirror holds raw Jira facts, so editing a rule re-renders the page with no Jira refresh.
 */
import { DEFAULT_KIND_RULES, FALLBACK_KIND, KINDS } from "./defaults.mjs";

const lower = (value) => String(value ?? "").trim().toLowerCase();
const lowerList = (list) => (Array.isArray(list) ? list.map(lower).filter(Boolean) : []);

/** Drop malformed rules and pre-lowercase their values. A rule with no condition never matches. */
export function normalizeRules(rules) {
  const source = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_KIND_RULES;
  return source
    .filter((rule) => rule && KINDS.includes(rule.kind))
    .map((rule) => ({
      kind: rule.kind,
      projects: lowerList(rule.projects),
      issueTypes: lowerList(rule.issueTypes),
      labels: lowerList(rule.labels),
    }))
    .filter((rule) => rule.projects.length + rule.issueTypes.length + rule.labels.length > 0);
}

function matches(rule, issue) {
  if (rule.projects.length > 0 && !rule.projects.includes(lower(issue.projectKey))) return false;
  if (rule.issueTypes.length > 0 && !rule.issueTypes.includes(lower(issue.issueType))) return false;
  if (rule.labels.length > 0) {
    const labels = lowerList(issue.labels);
    if (!rule.labels.some((label) => labels.includes(label))) return false;
  }
  return true;
}

/** The first matching rule's kind, else the always-visible fallback. */
export function classifyKind(issue, normalizedRules) {
  const rule = normalizedRules.find((candidate) => matches(candidate, issue));
  return rule ? rule.kind : FALLBACK_KIND;
}

/**
 * A cross-team dependency: owned by a project that is not "ours" and that no project rule
 * claims (RELB / GMDRP / ENG are kinds, not dependencies). No home projects ⇒ nothing is flagged.
 */
export function isDependency(issue, normalizedRules, homeProjectKeys) {
  const home = lowerList(homeProjectKeys);
  if (home.length === 0) return false;
  const project = lower(issue.projectKey);
  if (home.includes(project)) return false;
  return !normalizedRules.some((rule) => rule.projects.includes(project));
}

/**
 * @param {Array<object>} issues mirrored rows
 * @param {{ kindRules?: unknown, homeProjectKeys?: string[] }} config
 * @returns {Array<object>} the rows with `kind` and `isDependency`
 */
export function classifyIssues(issues, config) {
  const rules = normalizeRules(config?.kindRules);
  return issues.map((issue) => ({
    ...issue,
    kind: classifyKind(issue, rules),
    isDependency: isDependency(issue, rules, config?.homeProjectKeys),
  }));
}
