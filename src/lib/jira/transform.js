/**
 * Jira issue → `Issue` cache-row transform (sync-hybrid-seeding.md (b)). Pure — no DB, no fetch —
 * so it is unit-testable standalone. Ported from the prototype's `transformJiraIssue`
 * (src/jiraService.js) with the schema-enabled upgrades:
 *
 * - FULL assignee `displayName` + `accountId` (the prototype kept first-name-only and dropped the
 *   id — flagged as lossy in seed.md).
 * - `priority` and a real `dueDate` DateTime (the prototype dropped priority and formatted the
 *   date to a year-less string).
 * - The prototype's DERIVED `status`/`stage`/`percent` are not ported — they were effectively
 *   unused (§6); stage truth lives in `IssueProgress`.
 *
 * Field ids are per-team (§14.7 fix): `Team.storyPointsFieldId`/`sprintFieldId` override the
 * defaults below.
 */

export const DEFAULT_STORY_POINTS_FIELD = "customfield_10008";
export const LEGACY_STORY_POINTS_FIELD = "customfield_10016";
export const DEFAULT_SPRINT_FIELD = "customfield_10020";

/**
 * The `fields` list requested from Jira search — everything the transform reads, nothing more.
 * @param {{ storyPointsFieldId: string, sprintFieldId: string }} fieldIds
 * @returns {string[]}
 */
export function buildIssueFields({ storyPointsFieldId, sprintFieldId }) {
  return [
    "summary",
    "status",
    "assignee",
    "issuetype",
    storyPointsFieldId,
    LEGACY_STORY_POINTS_FIELD,
    "duedate",
    "priority",
    sprintFieldId,
    "fixVersions",
  ];
}

/**
 * Sprint field values vary by Jira age: array of sprint objects, single object, or the legacy
 * `"...name=Sprint 1,startDate=..."` string (port of src/jiraService.js:195-208).
 */
function extractSprintName(rawSprint) {
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

/**
 * Transform one raw Jira issue into the `Issue` cache columns (minus `filterId`/`lastSyncedAt`,
 * which the sync engine owns).
 *
 * @param {{ key: string, fields: Record<string, unknown> }} raw
 * @param {{ storyPointsFieldId?: string, sprintFieldId?: string }} [fieldIds]
 */
export function transformJiraIssue(raw, fieldIds = {}) {
  const {
    storyPointsFieldId = DEFAULT_STORY_POINTS_FIELD,
    sprintFieldId = DEFAULT_SPRINT_FIELD,
  } = fieldIds;
  const fields = raw.fields ?? {};

  const points = Number(fields[storyPointsFieldId] ?? fields[LEGACY_STORY_POINTS_FIELD] ?? 0);

  const fixVersions =
    Array.isArray(fields.fixVersions) && fields.fixVersions.length > 0
      ? fields.fixVersions.map((v) => v.name).join(", ")
      : null;

  return {
    jiraKey: raw.key,
    title: fields.summary ?? "(no summary)",
    issueType: fields.issuetype?.name ?? "Story",
    jiraStatus: fields.status?.name ?? "Unknown",
    assigneeName: fields.assignee?.displayName ?? fields.assignee?.name ?? null,
    assigneeAccountId: fields.assignee?.accountId ?? null,
    storyPoints: Number.isFinite(points) ? points : 0,
    priority: fields.priority?.name ?? null,
    dueDate: fields.duedate ? new Date(fields.duedate) : null,
    jiraSprintName: extractSprintName(fields[sprintFieldId]),
    fixVersions,
  };
}
