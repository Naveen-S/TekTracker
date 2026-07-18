/**
 * /api/teams/[teamId] — GET: team details (any member); PATCH: update (global admin or the team's
 * ADMIN membership); DELETE: remove the team (global admin; schema cascades memberships, filters,
 * templates, progress, snapshots).
 */
import { prisma } from "@/lib/db";
import { requireAdmin, requireTeamRole, TEAM_ALL_ROLES } from "@/lib/rbac";
import { Role } from "@/generated/prisma/client";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { teamPatchSchema } from "@/lib/schemas/team";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, TEAM_ALL_ROLES);
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    return Response.json(team);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, [Role.ADMIN]);
    const data = await parseJsonBody(request, teamPatchSchema);
    const team = await prisma.team.update({ where: { id: teamId }, data });
    return Response.json(team);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { teamId } = await params;
    await requireAdmin();
    await prisma.team.delete({ where: { id: teamId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
