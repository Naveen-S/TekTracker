/**
 * /api/teams/[teamId]/sprints/[sprintId]/filters/[filterId] — PATCH / DELETE a track (manager
 * roles). Ownership verified against the path's team+sprint (cross-scope ids → 404).
 *
 * PATCH refuses to touch the auto-generated "Needs attention" track, in either direction: that
 * track's name/jql/sourceType are rewritten from the team roster on every sync
 * (ensureNeedsAttentionFilter), so an edit to it silently reverts, and re-typing a real track INTO
 * it would hide the track from the board and hand it to the generator to clobber. Unreachable from
 * the UI (the board partitions NA out before rendering the filter cards) — reachable from here.
 *
 * DELETE cascades the filter's cached Issue rows but leaves IssueProgress intact — deliberate §9
 * behavior (progress is keyed by team+sprint+jiraKey and survives filter changes), a designed
 * deviation from the prototype, which wiped stages on filter removal (domain-apis.md decision 8).
 * Re-evaluating a progress row's owning workflow after filter changes is Sync's job (step 5).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { filterPatchSchema } from "@/lib/schemas/filter";

export const dynamic = "force-dynamic";

// String literal, never `WorkflowType.NEEDS_ATTENTION` — a stale/partial generated client can make
// that enum member `undefined`, which silently widens a comparison. See ensure-filter.js.
const NEEDS_ATTENTION = "NEEDS_ATTENTION";

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
    const existing = await requireOwnedFilter(filterId, teamId, sprintId);
    if (existing.workflowType === NEEDS_ATTENTION) {
      throw new ValidationError(
        "The Needs attention track is generated from the team roster — edit the roster in Admin instead",
      );
    }
    const data = await parseJsonBody(request, filterPatchSchema);
    if (data.workflowType === NEEDS_ATTENTION) {
      throw new ValidationError("A track cannot be changed into the generated Needs attention track");
    }
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
