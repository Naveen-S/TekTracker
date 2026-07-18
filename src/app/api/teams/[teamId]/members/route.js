/**
 * /api/teams/[teamId]/members — GET: list memberships (any member); POST: add a member by email
 * (global admin or team ADMIN). Per §16 provisioning, the user must have signed in with Jira first
 * (that's what creates their User row) — unknown emails are a 404, not an invite.
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_ALL_ROLES } from "@/lib/rbac";
import { Role } from "@/generated/prisma/client";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { membershipCreateSchema } from "@/lib/schemas/team";

export const dynamic = "force-dynamic";

const memberUserSelect = { id: true, email: true, displayName: true, avatarUrl: true };

export async function GET(_request, { params }) {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, TEAM_ALL_ROLES);
    const members = await prisma.teamMembership.findMany({
      where: { teamId },
      include: { user: { select: memberUserSelect } },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(members);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, [Role.ADMIN]);
    const { email, role } = await parseJsonBody(request, membershipCreateSchema);

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) {
      throw new NotFoundError("No user with that email has signed in yet");
    }

    const membership = await prisma.teamMembership.create({
      data: { teamId, userId: user.id, role },
      include: { user: { select: memberUserSelect } },
    });
    return Response.json(membership);
  } catch (error) {
    return handleRouteError(error);
  }
}
