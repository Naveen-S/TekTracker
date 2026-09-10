/**
 * Pure layout helpers for the bug-report PDF.
 *
 * The original export paginated a flattened team/developer/issue tree by row count. Those rows
 * have different heights, so a 30-row slice could overflow while the next slice started with an
 * orphaned issue. The landscape appendix uses fixed-height visual rows and budgets those exact
 * heights via `packSections`, which moved to the shared export kit (`lib/export/page-packer.mjs`)
 * when the roll-up export became its second consumer — rollup-export.md. The height constants are
 * re-exported here so existing importers keep working unchanged. A split repeats both the team and
 * developer context on the next sheet.
 */

import {
  chunkRows,
  DEVELOPER_ROW_HEIGHT,
  ISSUE_ROW_HEIGHT,
  TEAM_PAGE_BODY_HEIGHT,
  TEAM_SECTION_GAP,
  TEAM_SECTION_HEIGHT,
  packSections,
} from "../export/page-packer.mjs";

export {
  chunkRows,
  DEVELOPER_ROW_HEIGHT,
  ISSUE_ROW_HEIGHT,
  TEAM_PAGE_BODY_HEIGHT,
  TEAM_SECTION_GAP,
  TEAM_SECTION_HEIGHT,
};

function rate(part, whole) {
  return whole > 0 ? part / whole : 0;
}

function riskCompare(a, b, nameKey) {
  return (
    b.breachedCount - a.breachedCount ||
    rate(b.breachedCount, b.count) - rate(a.breachedCount, a.count) ||
    b.count - a.count ||
    String(a[nameKey]).localeCompare(String(b[nameKey]))
  );
}

/** Highest SLA exposure first, without mutating the server-provided view. */
export function sortTeamsByRisk(teams = []) {
  return teams
    .map((team) => ({
      ...team,
      developers: (team.developers ?? [])
        .map((developer) => ({ ...developer, issues: [...(developer.issues ?? [])] }))
        .sort((a, b) => riskCompare(a, b, "name")),
    }))
    .sort((a, b) => riskCompare(a, b, "teamName"));
}

/** Risk-ordered team appendix — highest SLA exposure first (bug-report-pdf-export.md). */
export function paginateTeamAppendix(teams = [], bodyHeight = TEAM_PAGE_BODY_HEIGHT) {
  return packSections(sortTeamsByRisk(teams), bodyHeight, "teams");
}

/**
 * Sprint-ownership appendix (bug-sprint-ownership.md): buckets → sprints → issues, shaped to reuse
 * the team packer + renderer (a bucket reads as a "team", a sprint as a "developer"). Bucket ORDER
 * is preserved (Ours → Dependencies → No sprint) rather than risk-sorted so the callout reads
 * ours-first; empty buckets are dropped.
 */
export function paginateOwnershipAppendix(buckets = [], bodyHeight = TEAM_PAGE_BODY_HEIGHT) {
  const asTeams = (buckets ?? [])
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      key: bucket.key,
      teamName: bucket.label,
      teamKey: null,
      count: bucket.count,
      breachedCount: bucket.breachedCount,
      developers: (bucket.sprints ?? []).map((sprint) => ({
        name: sprint.name ?? "No sprint",
        count: sprint.count,
        breachedCount: sprint.breachedCount,
        issues: sprint.issues ?? [],
      })),
    }));
  return packSections(asTeams, bodyHeight, "ownership");
}
