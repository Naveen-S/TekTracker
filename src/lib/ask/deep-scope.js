/**
 * The Jira scope a DeepContext round searches (ask-storyboard.md as-built 16), built server-side
 * from the page the question was asked on and ONLY from teams the viewer can see:
 *   a team page → that team · a program roll-up → that program's teams · anything else → all of
 *   the viewer's visible teams.
 * Projects = those teams' Jira projects + the external-bug project (customer bugs live there).
 */
import { prisma } from "@/lib/db";
import { DEFAULT_EXTERNAL_BUG_PROJECT_KEY } from "@/lib/jira/issue-type-defaults.mjs";

/**
 * @param {ReturnType<import("@/lib/ask/packs").createAskContext>} ctx
 * @param {{ teamId?: string, programId?: string }} context the page's ids
 */
export async function buildDeepScope(ctx, context) {
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
