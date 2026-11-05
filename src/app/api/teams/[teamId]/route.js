/**
 * /api/teams/[teamId] — GET: team details (any member); PATCH: update, incl. the roster's contact
 * details (global admin or the team's ADMIN membership); DELETE: remove the team (global admin; schema cascades memberships, filters,
 * templates, progress, snapshots).
 */
import { prisma } from "@/lib/db";
import { requireAdmin, requireTeamRole, TEAM_ALL_ROLES } from "@/lib/rbac";
import { Role } from "@/generated/prisma/client";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { teamPatchSchema } from "@/lib/schemas/team";
import { saveRosterContacts } from "@/lib/teams/roster-contacts";

export const dynamic = "force-dynamic";

export const GET = withRoute("teams", async (_request, { params }) => {
  const { teamId } = await params;
  await requireTeamRole(teamId, TEAM_ALL_ROLES);
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  return Response.json(team);
});

export const PATCH = withRoute("teams", async (request, { params }) => {
  const { teamId } = await params;
  const { user } = await requireTeamRole(teamId, [Role.ADMIN]);
  const { rosterContacts, ...data } = await parseJsonBody(request, teamPatchSchema);
  // Roster contacts (support-oncall.md as-built 15) are written against the roster as saved.
  const team = await prisma.$transaction(async (tx) => {
    const updated = Object.keys(data).length
      ? await tx.team.update({ where: { id: teamId }, data })
      : await tx.team.findUniqueOrThrow({ where: { id: teamId } });
    if (rosterContacts) await saveRosterContacts(tx, updated.memberEmails, rosterContacts, user.id);
    return updated;
  });
  return Response.json(team);
});

export const DELETE = withRoute("teams", async (_request, { params }) => {
  const { teamId } = await params;
  await requireAdmin();
  await prisma.team.delete({ where: { id: teamId } });
  return Response.json({ ok: true });
});
