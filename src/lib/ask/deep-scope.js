/**
 * The Jira scope a DeepContext round searches (ask-storyboard.md as-built 16), built server-side
 * from the page the question was asked on and ONLY from teams the viewer can see:
 *   a team page → that team · a program roll-up → that program's teams · anything else → all of
 *   the viewer's visible teams. A question about a SOW gets that SOW's docs, repos and projects.
 * Projects = those teams' Jira projects + the external-bug project (customer bugs live there).
 */
import { prisma } from "@/lib/db";
import { DEFAULT_EXTERNAL_BUG_PROJECT_KEY } from "@/lib/jira/issue-type-defaults.mjs";
import { isSowContext } from "@/lib/ask/deep.mjs";

/**
 * @param {ReturnType<import("@/lib/ask/packs").createAskContext>} ctx
 * @param {{ teamId?: string, programId?: string }} context the page's ids
 */
const CONFLUENCE_SPACE = /\/wiki\/spaces\/([A-Za-z0-9~]+)\//;
const GITHUB_REPO = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/;
const SOW_MAX_PAGES = 25;

/**
 * A SOW's scope (sow-tracker.md round 5): its Confluence spaces and pages (the curated reading
 * list plus Confluence links shared in its docs-and-decisions channels), its repositories (the
 * list, plus repos of pull requests shared there) and its Jira projects (home + every project its
 * mirrored tickets come from). SOWs are open to every signed-in user, so no team gate applies.
 */
async function buildSowScope(context) {
  const sow = context.sowSlug
    ? await prisma.sow.findUnique({ where: { slug: context.sowSlug } })
    : await prisma.sow.findFirst({ where: { status: "ACTIVE" }, orderBy: { launchDate: "asc" } });
  if (!sow) return null;
  const [projects, sharedDocs] = await Promise.all([
    prisma.sowIssue.findMany({ where: { sowId: sow.id }, distinct: ["projectKey"], select: { projectKey: true } }),
    prisma.sowFeedItem.findMany({ where: { sowId: sow.id, kind: "DOC", hidden: false }, select: { title: true, url: true } }),
  ]);
  const references = Array.isArray(sow.references) ? sow.references : [];
  const pages = [
    // The primary source first: the deep round is told to read it before anything else.
    ...references
      .filter((reference) => reference.kind === "CONFLUENCE" && reference.url)
      .sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)))
      .map((reference) => ({ title: reference.label, url: reference.url, ...(reference.primary ? { primary: true } : {}) })),
    ...sharedDocs.filter((doc) => CONFLUENCE_SPACE.test(doc.url ?? "") || /atlassian\.net\/wiki\//.test(doc.url ?? "")).map((doc) => ({ title: doc.title, url: doc.url })),
  ];
  const unique = [...new Map(pages.map((page) => [page.url, page])).values()];
  const spaces = [...new Set(unique.map((page) => CONFLUENCE_SPACE.exec(page.url)?.[1]).filter(Boolean))];
  // Repositories as "owner/repo" where known (the GitHub link wins over the label), with the
  // reading list's note on what each does.
  const repoName = (reference) => GITHUB_REPO.exec(reference.url ?? "")?.[1] ?? reference.label;
  const listed = references.filter((reference) => reference.kind === "REPO").map((reference) => ({ name: repoName(reference), ...(reference.note ? { note: reference.note } : {}) }));
  const shared = sharedDocs.map((doc) => GITHUB_REPO.exec(doc.url ?? "")?.[1]).filter(Boolean).map((name) => ({ name }));
  const repos = [...new Map([...shared, ...listed].map((repo) => [repo.name, repo])).values()];
  return {
    sow: sow.name,
    description: sow.description,
    confluence: { spaces, pages: unique.slice(0, SOW_MAX_PAGES) },
    repositories: repos,
    jiraProjects: [...new Set([...sow.homeProjectKeys, ...projects.map((row) => row.projectKey)])],
  };
}

export async function buildDeepScope(ctx, context) {
  if (isSowContext(context)) {
    const scope = await buildSowScope(context);
    if (scope) return scope;
  }
  const visible = await ctx.visibleTeamIds(); // null ⇒ every team (global admin)
  const teams = await prisma.team.findMany({
    where: visible === null ? {} : { id: { in: visible } },
    select: {
      id: true,
      key: true,
      name: true,
      jiraProjectKeys: true,
      program: { select: { id: true, key: true, name: true } },
      subComponents: { select: { name: true } },
    },
    orderBy: { key: "asc" },
  });

  let inScope = teams;
  const team = context.teamId && teams.find((entry) => entry.id === context.teamId);
  if (team) {
    inScope = [team];
  } else if (context.programId) {
    const programTeams = teams.filter((entry) => entry.program?.id === context.programId);
    if (programTeams.length > 0) inScope = programTeams;
  }

  const programs = [...new Map(inScope.filter((entry) => entry.program).map((entry) => [entry.program.id, entry.program])).values()];
  return {
    programs: programs.map(({ key, name }) => ({ key, name })),
    teams: inScope.map((entry) => ({
      key: entry.key,
      name: entry.name,
      subComponents: entry.subComponents.map((sub) => sub.name),
    })),
    jiraProjects: [...new Set([...inScope.flatMap((entry) => entry.jiraProjectKeys), DEFAULT_EXTERNAL_BUG_PROJECT_KEY])],
    note: `${DEFAULT_EXTERNAL_BUG_PROJECT_KEY} holds customer-reported bugs for every program; match it to these teams by component/sub-component only when the question is about a team.`,
  };
}
