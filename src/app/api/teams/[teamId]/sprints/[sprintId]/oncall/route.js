/**
 * /api/teams/[teamId]/sprints/[sprintId]/oncall — PUT: replace a team's Support on-call POCs for one
 * sprint (support-oncall.md (d)).
 *
 * One replace-all list in one transaction (decision 13), so "at most one Primary", the dedupe and
 * the headcount cap are checks over a single validated array. Managers of the team
 * (TEAM_MANAGER_ROLES, decision 7) and global admins may write; a CLOSED sprint's rotation is a
 * frozen record (decision 12, the syncTeamSprint rule). An empty list clears the team.
 *
 * Phone numbers are PII: nothing here logs the body (the `phone` redactor key is the safety net).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { withRoute, parseJsonBody, ValidationError, ConflictError } from "@/lib/api/route-helpers";
import { supportPocListSchema } from "@/lib/schemas/oncall";
import { onCallCap } from "@/lib/oncall/rotation.mjs";
import { SprintState } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const PUT = withRoute("teams.sprints.oncall.put", async (request, { params }) => {
  const { teamId, sprintId } = await params;
  const { user } = await requireTeamRole(teamId, TEAM_MANAGER_ROLES);

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, state: true },
  });
  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }
  if (sprint.state === SprintState.CLOSED) {
    throw new ConflictError("This sprint is closed — its on-call rotation is kept as a record");
  }

  const { pocs } = await parseJsonBody(request, supportPocListSchema);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { onCallHeadcount: true },
  });
  const cap = onCallCap(team);
  if (pocs.length > cap) {
    throw new ValidationError(`This team can nominate at most ${cap} on-call POCs`, { cap });
  }

  const [, , saved] = await prisma.$transaction([
    prisma.supportPoc.deleteMany({ where: { teamId, sprintId } }),
    prisma.supportPoc.createMany({
      data: pocs.map((poc, index) => ({
        ...poc,
        teamId,
        sprintId,
        sortOrder: index,
        updatedById: user.id,
      })),
    }),
    prisma.supportPoc.findMany({ where: { teamId, sprintId }, orderBy: { sortOrder: "asc" } }),
  ]);
  return Response.json(saved);
});
