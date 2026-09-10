/**
 * Shared height-budgeted page packer for the app's leadership PDF exports.
 *
 * Extracted from `lib/bug-report/pdf-layout.mjs` when the roll-up export became its second consumer
 * (rollup-export.md) — the same extraction `export-visual-consistency.md` decision 1 performed on
 * the print kit itself. Pure and generic over a THREE-LEVEL tree: a `section` (the bug report's
 * team, the roll-up's scrum team) holds `groups` (developer / track) which hold `items` (issues).
 *
 * Row counts are the wrong unit — the visual rows have different heights, so a fixed-count slice can
 * overflow one page and orphan a header on the next. This budgets the exact pixel heights instead:
 * a page may hold several small sections, a large section repeats its header on continuation pages
 * with `continued: true`, and at least one item always stays with a newly rendered group header.
 */

export const TEAM_PAGE_BODY_HEIGHT = 620;
export const TEAM_SECTION_HEIGHT = 84;
export const TEAM_SECTION_GAP = 12;
export const DEVELOPER_ROW_HEIGHT = 24;
export const ISSUE_ROW_HEIGHT = 34;

/**
 * Pack a PRE-ORDERED list of "team" sections (team → developers → issues) into landscape A4 bodies.
 *
 * A page can hold multiple small teams. A large team repeats its header on continuation pages,
 * and a developer split across pages repeats the developer header with a continuation marker.
 * At least one issue is always kept with a newly rendered developer header. The ordering of
 * `orderedTeams` is respected as-is — callers decide risk-sort (teams) vs. fixed order (ownership).
 */
export function packSections(orderedTeams, bodyHeight, pageType) {
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


/** Split a flat row list into fixed-size page chunks. */
export function chunkRows(rows = [], size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}
