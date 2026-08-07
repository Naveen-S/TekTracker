/**
 * Pure layout helpers for the bug-report PDF.
 *
 * The original export paginated a flattened team/developer/issue tree by row count. Those rows
 * have different heights, so a 30-row slice could overflow while the next slice started with an
 * orphaned issue. The landscape appendix uses fixed-height visual rows and this helper budgets
 * those exact heights. A split repeats both the team and developer context on the next sheet.
 */

export const TEAM_PAGE_BODY_HEIGHT = 620;
export const TEAM_SECTION_HEIGHT = 84;
export const TEAM_SECTION_GAP = 12;
export const DEVELOPER_ROW_HEIGHT = 24;
export const ISSUE_ROW_HEIGHT = 34;

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

/**
 * Pack a PRE-ORDERED list of "team" sections (team → developers → issues) into landscape A4 bodies.
 *
 * A page can hold multiple small teams. A large team repeats its header on continuation pages,
 * and a developer split across pages repeats the developer header with a continuation marker.
 * At least one issue is always kept with a newly rendered developer header. The ordering of
 * `orderedTeams` is respected as-is — callers decide risk-sort (teams) vs. fixed order (ownership).
 */
function packSections(orderedTeams, bodyHeight, pageType) {
  const pages = [];
  let page = { type: pageType, sections: [], usedHeight: 0 };

  const flush = () => {
    if (page.sections.length > 0) pages.push(page);
    page = { type: pageType, sections: [], usedHeight: 0 };
  };

  const sectionCost = () => TEAM_SECTION_HEIGHT + (page.sections.length > 0 ? TEAM_SECTION_GAP : 0);

  const startSection = (team, continued) => {
    let cost = sectionCost();
    const minimum = cost + DEVELOPER_ROW_HEIGHT + ISSUE_ROW_HEIGHT;
    if (page.sections.length > 0 && page.usedHeight + minimum > bodyHeight) flush();
    cost = sectionCost();

    const section = { team, continued, developers: [] };
    page.sections.push(section);
    page.usedHeight += cost;
    return section;
  };

  for (const team of orderedTeams) {
    let section = null;
    let teamContinued = false;

    for (const developer of team.developers) {
      let issueIndex = 0;
      let developerContinued = false;

      while (issueIndex < developer.issues.length) {
        if (!section) section = startSection(team, teamContinued);

        const remainingAfterHeader = bodyHeight - page.usedHeight - DEVELOPER_ROW_HEIGHT;
        if (remainingAfterHeader < ISSUE_ROW_HEIGHT) {
          flush();
          teamContinued = true;
          developerContinued = issueIndex > 0;
          section = startSection(team, true);
        }

        const issueCapacity = Math.max(
          1,
          Math.floor((bodyHeight - page.usedHeight - DEVELOPER_ROW_HEIGHT) / ISSUE_ROW_HEIGHT),
        );
        const issues = developer.issues.slice(issueIndex, issueIndex + issueCapacity);

        section.developers.push({
          developer,
          issues,
          continued: developerContinued,
        });
        page.usedHeight += DEVELOPER_ROW_HEIGHT + issues.length * ISSUE_ROW_HEIGHT;
        issueIndex += issues.length;

        if (issueIndex < developer.issues.length) {
          flush();
          teamContinued = true;
          developerContinued = true;
          section = null;
        }
      }
    }
  }

  flush();
  return pages;
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

export function chunkRows(rows = [], size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
