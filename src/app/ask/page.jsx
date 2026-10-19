/**
 * /ask — Ask StoryBoard on a phone (ask-storyboard.md (f)): a full-screen, tap-to-talk page that
 * a home-screen icon or a Siri / Assistant shortcut opens directly. Server component: resolves
 * the viewer's default scope and sprint, then hands ids (never data) to the client — every answer
 * is still built by `/api/ask` under the viewer's RBAC.
 *
 * Default scope = the widest useful one (decision 5 / P-mobile): `?team=` (a team the viewer can
 * see) → `?program=` → the one program the viewer's own teams belong to (leadership only) → all of
 * the viewer's teams. Signed-out visitors go to /login and come back here (`?next=`).
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSprintSelection } from "@/lib/dashboard-data";
import { hasProgramAccess, visibleTeamIds } from "@/lib/rbac";
import { isAskEnabled } from "@/lib/ask/availability";
import { AskMobile } from "@/components/ask/ask-mobile";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask · StoryBoard" };

const str = (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export default async function AskPage({ searchParams }) {
  const params = await searchParams;
  const teamParam = str(params.team);
  const programParam = str(params.program);
  const sprintParam = str(params.sprint);

  const user = await getCurrentUser();
  if (!user) {
    const query = new URLSearchParams(
      Object.entries({ team: teamParam, program: programParam }).filter(([, value]) => value),
    ).toString();
    redirect(`/login?next=${encodeURIComponent(`/ask${query ? `?${query}` : ""}`)}`);
  }

  const [visible, canViewPrograms, memberships, { sprints, selectedSprint }] = await Promise.all([
    visibleTeamIds(user),
    hasProgramAccess(user),
    prisma.teamMembership.findMany({
      where: { userId: user.id },
      select: { team: { select: { id: true, key: true, name: true, programId: true } } },
      orderBy: { team: { name: "asc" } },
    }),
    getSprintSelection(sprintParam, user.defaultSprintId),
  ]);
  const myTeams = memberships.map((membership) => membership.team);
  const programs = canViewPrograms
    ? await prisma.program.findMany({ orderBy: { name: "asc" }, select: { id: true, key: true, name: true } })
    : [];

  const requestedTeam =
    teamParam && (visible === null || visible.includes(teamParam))
      ? await prisma.team.findUnique({ where: { id: teamParam }, select: { id: true, key: true, name: true } })
      : null;
  const myProgramIds = [...new Set(myTeams.map((team) => team.programId).filter(Boolean))];
  const program =
    programs.find((candidate) => candidate.id === programParam) ??
    (!teamParam && !programParam && myProgramIds.length === 1
      ? programs.find((candidate) => candidate.id === myProgramIds[0])
      : null) ??
    null;

  const sprintLabel = selectedSprint ? ` · ${selectedSprint.name}` : "";
  let scopeValue = "mine";
  let context = { page: "ask" };
  let contextLabel = `Your teams${sprintLabel}`;
  if (requestedTeam) {
    scopeValue = `team:${requestedTeam.id}`;
    context = { page: "board", teamId: requestedTeam.id };
    contextLabel = `${requestedTeam.name}${sprintLabel}`;
  } else if (program) {
    scopeValue = `program:${program.id}`;
    context = { page: "ask", programId: program.id };
    contextLabel = `${program.name} program${sprintLabel}`;
  }
  if (selectedSprint) context.sprintId = selectedSprint.id;

  const teamOptions = myTeams.some((team) => team.id === requestedTeam?.id) || !requestedTeam
    ? myTeams
    : [...myTeams, requestedTeam];
  const scopeOptions = [
    { value: "mine", label: "My teams" },
    ...programs.map((candidate) => ({ value: `program:${candidate.id}`, label: `${candidate.name} program` })),
    ...teamOptions.map((team) => ({ value: `team:${team.id}`, label: `${team.name} team` })),
  ];

  // The recent Gates, plus the selected one if it is older (a pinned past release).
  const recent = sprints.slice(0, 12);
  const sprintOptions = (
    selectedSprint && !recent.some((sprint) => sprint.id === selectedSprint.id) ? [...recent, selectedSprint] : recent
  ).map((sprint) => ({ id: sprint.id, name: sprint.name }));

  return (
    <AskMobile
      askEnabled={await isAskEnabled()}
      scopeOptions={scopeOptions}
      scopeValue={scopeValue}
      sprints={sprintOptions}
      sprintId={selectedSprint?.id ?? null}
      context={context}
      contextLabel={contextLabel}
      userKey={user.email}
    />
  );
}
