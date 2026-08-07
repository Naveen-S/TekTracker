/**
 * Bugs-by-scrum-team grouping (enhancing-bug-board.md (c)) — PURE.
 *
 * The team of a bug is a READ-TIME, FK-less join: `bug.subComponent` → `JiraSubComponent.name` →
 * `teamId` (decision 3). No Prisma, no fetch, no clock of its own — every time-dependent call takes
 * an explicit `asOf` (the matrix.mjs precedent) — so this is plain-Node testable and re-renders
 * instantly when the catalog changes, with no Jira refresh. SLA breach is reused verbatim from
 * matrix.mjs (per (scope, priority), keyed by Jira priority NAME). Imported by RELATIVE path so a
 * plain-Node fixture can load it without the Next `@/` alias.
 */
import { isBreached, daysOverSla, slaMapForScope } from "./matrix.mjs";

export const UNASSIGNED_TEAM_KEY = "__unassigned__";
export const UNASSIGNED_TEAM_LABEL = "Unassigned / Untagged";
export const UNASSIGNED_DEVELOPER = "Unassigned";

const EMPTY_SLA = new Map();

/** Case/whitespace-tolerant — sub-component values are free text (e.g. "DR_GM-Configurator"). */
function norm(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Build the read-time sub-component → team lookup from the claimed catalog rows.
 * Unclaimed sub-components (`teamId = null`) are skipped, so their bugs fall to the Unassigned
 * bucket (decision 4).
 * @param {Array<{ name: string, teamId?: string | null, team?: { id: string, key: string, name: string } | null }>} rows
 * @returns {Map<string, { teamId: string, teamKey: string | null, teamName: string }>}
 */
export function buildSubComponentTeamMap(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const team = row.team ?? null;
    const teamId = team?.id ?? row.teamId ?? null;
    if (!teamId) continue;
    map.set(norm(row.name), {
      teamId,
      teamKey: team?.key ?? null,
      teamName: team?.name ?? teamId,
    });
  }
  return map;
}

/** `scopes[]` (each carrying `slaTargets`) → `Map(scopeId → normalized priority→days map)`. */
export function buildSlaByScope(scopes) {
  return new Map((scopes ?? []).map((scope) => [scope.id, slaMapForScope(scope.slaTargets)]));
}

/** First sub-component on the issue that maps to a claimed team, else null (a bug counts once). */
function resolveTeam(issue, teamMap) {
  if (!issue?.subComponent) return null;
  for (const part of String(issue.subComponent).split(",")) {
    const team = teamMap.get(norm(part));
    if (team) return team;
  }
  return null;
}

/**
 * Group scope-filtered bugs by scrum team → developer → issues.
 *
 * Teams are worst-first (open count desc), the Unassigned bucket always LAST. Each team's
 * developers are worst-first too, with the "Unassigned" developer last; each developer's issues are
 * ordered most-over-SLA first (breached before within-SLA). The caller passes issues already
 * filtered to the selected scope, so the grouping is scope-aware for free.
 *
 * @param {Array<{ scopeId: string, subComponent?: string | null, assigneeName?: string | null, priority?: string | null, jiraCreatedAt?: Date | string | null, jiraKey: string, title: string, jiraStatus: string }>} issues
 * @param {Map<string, { teamId: string, teamKey: string | null, teamName: string }>} teamMap
 * @param {Map<string, Map<string, number>>} slaByScope scopeId → priority→days map
 * @param {Date} asOf
 */
export function groupByTeam(issues, teamMap, slaByScope, asOf) {
  const teams = new Map();

  const ensureTeam = (key, teamKey, teamName, isUnassigned) => {
    let team = teams.get(key);
    if (!team) {
      team = { key, teamKey, teamName, isUnassigned, count: 0, breachedCount: 0, developers: new Map() };
      teams.set(key, team);
    }
    return team;
  };

  for (const issue of issues ?? []) {
    const matched = resolveTeam(issue, teamMap);
    const team = matched
      ? ensureTeam(matched.teamId, matched.teamKey, matched.teamName, false)
      : ensureTeam(UNASSIGNED_TEAM_KEY, null, UNASSIGNED_TEAM_LABEL, true);

    const sla = slaByScope.get(issue.scopeId) ?? EMPTY_SLA;
    const breached = isBreached(issue, sla, asOf);

    team.count += 1;
    if (breached) team.breachedCount += 1;

    const devName = issue.assigneeName?.trim() || UNASSIGNED_DEVELOPER;
    let dev = team.developers.get(devName);
    if (!dev) {
      dev = { name: devName, count: 0, breachedCount: 0, issues: [] };
      team.developers.set(devName, dev);
    }
    dev.count += 1;
    if (breached) dev.breachedCount += 1;
    dev.issues.push({
      jiraKey: issue.jiraKey,
      title: issue.title,
      priority: issue.priority ?? null,
      jiraStatus: issue.jiraStatus,
      scopeId: issue.scopeId,
      daysOverSla: daysOverSla(issue, sla, asOf),
    });
  }

  const sortIssues = (a, b) => (b.daysOverSla ?? -1) - (a.daysOverSla ?? -1);
  const sortDevelopers = (a, b) => {
    const au = a.name === UNASSIGNED_DEVELOPER ? 1 : 0;
    const bu = b.name === UNASSIGNED_DEVELOPER ? 1 : 0;
    if (au !== bu) return au - bu;
    return b.count - a.count || b.breachedCount - a.breachedCount || a.name.localeCompare(b.name);
  };

  return [...teams.values()]
    .map((team) => ({
      key: team.key,
      teamKey: team.teamKey,
      teamName: team.teamName,
      isUnassigned: team.isUnassigned,
      count: team.count,
      breachedCount: team.breachedCount,
      developers: [...team.developers.values()]
        .map((dev) => ({ ...dev, issues: dev.issues.slice().sort(sortIssues) }))
        .sort(sortDevelopers),
    }))
    .sort(
      (a, b) =>
        (a.isUnassigned ? 1 : 0) - (b.isUnassigned ? 1 : 0) ||
        b.count - a.count ||
        b.breachedCount - a.breachedCount ||
        String(a.teamName).localeCompare(String(b.teamName)),
    );
}
