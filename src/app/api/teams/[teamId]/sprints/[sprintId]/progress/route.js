/**
 * GET /api/teams/[teamId]/sprints/[sprintId]/progress — all IssueProgress rows for the sprint (any
 * member, incl. VIEWER). Progress is the PRODUCT data (§9) — the stage overlay + blocked flags —
 * joined to the Issue cache by jiraKey at read time; the assembled delivery-matrix payload is
 * step 6's concern.
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_ALL_ROLES } from "@/lib/rbac";
import { handleRouteError } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    await requireTeamRole(teamId, TEAM_ALL_ROLES);
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true } });
    if (!sprint) {
      throw new NotFoundError("Sprint not found");
    }
    const progress = await prisma.issueProgress.findMany({
      where: { teamId, sprintId },
      orderBy: { jiraKey: "asc" },
    });
    return Response.json(progress);
  } catch (error) {
    return handleRouteError(error);
  }
}
