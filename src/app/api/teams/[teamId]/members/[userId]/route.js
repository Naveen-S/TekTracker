/**
 * /api/teams/[teamId]/members/[userId] — PATCH: change a member's role; DELETE: remove them.
 * Both require global admin or the team's ADMIN membership. The composite unique
 * (userId, teamId) scopes every write to this team — a userId from another team 404s.
 */
import { prisma } from "@/lib/db";
import { requireTeamRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/client";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { membershipPatchSchema } from "@/lib/schemas/team";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("teams.members", async (request, { params }) => {
  const { teamId, userId } = await params;
  await requireTeamRole(teamId, [Role.ADMIN]);
  const { role } = await parseJsonBody(request, membershipPatchSchema);
  const membership = await prisma.teamMembership.update({
    where: { userId_teamId: { userId, teamId } },
    data: { role },
    include: { user: { select: { id: true, email: true, displayName: true, avatarUrl: true } } },
  });
  return Response.json(membership);
});

export const DELETE = withRoute("teams.members", async (_request, { params }) => {
  const { teamId, userId } = await params;
  await requireTeamRole(teamId, [Role.ADMIN]);
  await prisma.teamMembership.delete({ where: { userId_teamId: { userId, teamId } } });
  return Response.json({ ok: true });
});
