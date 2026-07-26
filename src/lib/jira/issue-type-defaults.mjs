/**
 * Global default Jira Issue Type mapping per track (one-click-sprint-start.md), with a per-team
 * override (mirrors the `DEFAULT_STORY_POINTS_FIELD`/`Team.storyPointsFieldId` pattern in
 * `jira/transform.js`). Confirmed by Naveen against the real DR_GM/GM Jira setup.
 */

export const DEFAULT_ROADMAP_ISSUE_TYPES = ["Story"];
export const DEFAULT_TECH_DEBT_ISSUE_TYPES = ["Tech Story"];
export const DEFAULT_INTERNAL_BUG_ISSUE_TYPES = ["Bug"];
export const DEFAULT_SUPPORT_ISSUE_TYPES = ["Tap Ticket"];

/** External Bug ("Support") project — fixed in v1, not per-team overridable. */
export const DEFAULT_EXTERNAL_BUG_PROJECT_KEY = "ENG";

/**
 * The custom Jira field a team's own project uses to tag its fine-grained sub-components —
 * NOT the standard Jira "Component" field (that one's reserved for the coarser External Bug
 * scoping, e.g. `component = DR_GM`, per one-click-sprint-start.md decision 7). Confirmed against
 * a real generated JQL sample from Naveen's Jira instance: `"sub-component[dropdown]" IN (...)`.
 * Fixed in v1, not per-team overridable (same posture as DEFAULT_EXTERNAL_BUG_PROJECT_KEY).
 */
export const SUB_COMPONENT_FIELD = '"sub-component[dropdown]"';

const OVERRIDE_FIELD_BY_WORKFLOW = {
  FEATURE: "featureIssueTypes",
  TECH_DEBT: "techDebtIssueTypes",
  INTERNAL_BUG: "internalBugIssueTypes",
  SUPPORT: "supportIssueTypes",
};

const DEFAULT_BY_WORKFLOW = {
  FEATURE: DEFAULT_ROADMAP_ISSUE_TYPES,
  TECH_DEBT: DEFAULT_TECH_DEBT_ISSUE_TYPES,
  INTERNAL_BUG: DEFAULT_INTERNAL_BUG_ISSUE_TYPES,
  SUPPORT: DEFAULT_SUPPORT_ISSUE_TYPES,
};

/**
 * The Issue Type list for a track: the team's override if non-empty, else the global default.
 * @param {{ featureIssueTypes?: string[], techDebtIssueTypes?: string[], internalBugIssueTypes?: string[], supportIssueTypes?: string[] }} team
 * @param {"FEATURE"|"TECH_DEBT"|"INTERNAL_BUG"|"SUPPORT"} workflowType
 * @returns {string[]}
 */
export function resolveIssueTypes(team, workflowType) {
  const override = team?.[OVERRIDE_FIELD_BY_WORKFLOW[workflowType]];
  return override && override.length > 0 ? override : DEFAULT_BY_WORKFLOW[workflowType];
}
