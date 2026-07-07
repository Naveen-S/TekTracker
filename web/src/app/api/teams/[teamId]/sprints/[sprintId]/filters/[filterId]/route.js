/**
 * /api/teams/[teamId]/sprints/[sprintId]/filters/[filterId] — PATCH / DELETE a track (manager
 * roles). Ownership verified against the path's team+sprint (cross-scope ids → 404).
 *
 * DELETE cascades the filter's cached Issue rows but leaves IssueProgress intact — deliberate §9
 * behavior (progress is keyed by team+sprint+jiraKey and survives filter changes), a designed
 * deviation from the prototype, which wiped stages on filter removal (domain-apis.md decision 8).
 * Re-evaluating a progress row's owning workflow after filter changes is Sync's job (step 5).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { filterPatchSchema } from "@/lib/schemas/filter";

export const dynamic = "force-dynamic";

async function requireOwnedFilter(filterId, teamId, sprintId) {
  const filter = await prisma.filter.findFirst({ where: { id: filterId, teamId, sprintId } });
  if (!filter) {
    throw new NotFoundError("Filter not found");
  }
  return filter;
}

export async function PATCH(request, { params }) {
  try {
    const { teamId, sprintId, filterId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    await requireOwnedFilter(filterId, teamId, sprintId);
    const data = await parseJsonBody(request, filterPatchSchema);
    const filter = await prisma.filter.update({ where: { id: filterId }, data });
    return Response.json(filter);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { teamId, sprintId, filterId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    await requireOwnedFilter(filterId, teamId, sprintId);
    await prisma.filter.delete({ where: { id: filterId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
