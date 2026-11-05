/**
 * /api/teams — GET: list the caller's teams with their role (global admins see all teams);
 * POST: create a team (global admin only — §16 admin-managed provisioning).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { teamCreateSchema } from "@/lib/schemas/team";
import { saveRosterContacts } from "@/lib/teams/roster-contacts";

export const dynamic = "force-dynamic";

export const GET = withRoute("teams", async () => {
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
});

export const POST = withRoute("teams", async (request) => {
  const user = await requireAdmin();
  const { rosterContacts, ...data } = await parseJsonBody(request, teamCreateSchema);
  const team = await prisma.$transaction(async (tx) => {
    const created = await tx.team.create({ data });
    if (rosterContacts) await saveRosterContacts(tx, created.memberEmails, rosterContacts, user.id);
    return created;
  });
  return Response.json(team);
});
