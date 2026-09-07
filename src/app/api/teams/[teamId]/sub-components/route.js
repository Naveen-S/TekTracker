/**
 * /api/teams/[teamId]/sub-components — PATCH: full-replacement claim set for a team
 * (one-click-sprint-start.md decision 1). Same gate as `PATCH /api/teams/[teamId]` (team ADMIN
 * membership or global admin) since claiming sub-components is team-setup, not sprint work.
 *
 * Claiming folds each claimed sub-component's parent Component's `projectKey` into
 * `Team.jiraProjectKeys` (additive dedup — never pruned on unclaim, since nothing else reads that
 * field today).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody, handleRouteError, ConflictError } from "@/lib/api/route-helpers";
import { subComponentClaimSchema } from "@/lib/schemas/jira-component";
import { Role } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("teams.sub-components", async (request, { params }) => {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, [Role.ADMIN]);
    const { subComponentIds } = await parseJsonBody(request, subComponentClaimSchema);

    const requested = await prisma.jiraSubComponent.findMany({
      where: { id: { in: subComponentIds } },
      include: { component: true },
    });
    const foundIds = new Set(requested.map((s) => s.id));
    const missing = subComponentIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(`Sub-component(s) not found: ${missing.join(", ")}`);
    }

    const conflicts = requested.filter((s) => s.teamId && s.teamId !== teamId);
    if (conflicts.length > 0) {
      throw new ConflictError(
        "Some sub-components are already claimed by a different team",
        conflicts.map((s) => ({
          id: s.id,
          name: s.name,
          claimedByTeamId: s.teamId,
        })),
      );
    }

    const projectKeys = [...new Set(requested.map((s) => s.component.projectKey))];

    const team = await prisma.$transaction(async (tx) => {
      await tx.jiraSubComponent.updateMany({
        where: { teamId, id: { notIn: subComponentIds } },
        data: { teamId: null },
      });
      if (subComponentIds.length > 0) {
        await tx.jiraSubComponent.updateMany({
          where: { id: { in: subComponentIds } },
          data: { teamId },
        });
      }
      const current = await tx.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { jiraProjectKeys: true },
      });
      const mergedProjectKeys = [...new Set([...current.jiraProjectKeys, ...projectKeys])];
      return tx.team.update({
        where: { id: teamId },
        data: { jiraProjectKeys: mergedProjectKeys },
        include: {
          subComponents: { include: { component: true }, orderBy: { name: "asc" } },
        },
      });
    });

    return Response.json(team);
  } catch (error) {
    return handleRouteError(error);
  }
});
