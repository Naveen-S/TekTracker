/**
 * /api/teams — GET: list the caller's teams with their role (global admins see all teams);
 * POST: create a team (global admin only — §16 admin-managed provisioning).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { teamCreateSchema } from "@/lib/schemas/team";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const memberships = await prisma.teamMembership.findMany({
      where: { userId: user.id },
      select: { teamId: true, role: true },
    });
    const roleByTeam = new Map(memberships.map((m) => [m.teamId, m.role]));
    const teams = await prisma.team.findMany({
      where: user.isAdmin ? {} : { id: { in: [...roleByTeam.keys()] } },
      orderBy: { name: "asc" },
    });
    return Response.json(teams.map((team) => ({ ...team, myRole: roleByTeam.get(team.id) ?? null })));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const data = await parseJsonBody(request, teamCreateSchema);
    const team = await prisma.team.create({ data });
    return Response.json(team);
  } catch (error) {
    return handleRouteError(error);
  }
}
