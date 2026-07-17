/**
 * /api/teams/[teamId]/sprints/[sprintId]/shares — POST: mint a SharedView token for this team's
 * board (share-view-export.md (b)); GET: the manage list for the share dialog.
 *
 * Creating a share is a WRITER-role action (decision 3 — a public link is a broader grant than
 * viewing, so VIEWER is excluded; global admin bypasses per rbac.js). One share = one team's
 * board in one sprint: every filterId must belong to (teamId, sprintId) — no FK backs
 * `includedFilterIds`, so this validation is the only thing preventing a foreign filter from
 * being smuggled into a share. Frozen shares capture their snapshot here, at create time.
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_WRITER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { shareCreateSchema } from "@/lib/schemas/share";
import { generateShareToken } from "@/lib/share-token";
import { buildShareSnapshot } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

async function requireSprint(sprintId) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }
  return sprint;
}

export async function POST(request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
    const sprint = await requireSprint(sprintId);
    const data = await parseJsonBody(request, shareCreateSchema);

    if (data.expiresAt && data.expiresAt.getTime() <= Date.now()) {
      throw new ValidationError("expiresAt must be in the future");
    }

    const filters = await prisma.filter.findMany({
      where: { id: { in: data.filterIds }, teamId, sprintId },
      orderBy: { sortOrder: "asc" },
      include: data.isLive ? undefined : { issues: { orderBy: { jiraKey: "asc" } } },
    });
    if (filters.length !== data.filterIds.length) {
      throw new ValidationError("every filterId must belong to this team and sprint");
    }

    let snapshot = null;
    if (!data.isLive) {
      // Freeze only the progress rows for issues actually in the shared filters.
      const keysInScope = new Set(filters.flatMap((f) => f.issues.map((i) => i.jiraKey)));
      const progress = await prisma.issueProgress.findMany({
        where: { teamId, sprintId },
        select: { jiraKey: true, workflowType: true, stageCompletion: true, blocked: true, blockedReason: true },
      });
      snapshot = buildShareSnapshot(
        filters,
        progress.filter((row) => keysInScope.has(row.jiraKey)),
        sprint,
      );
    }

    const share = await prisma.sharedView.create({
      data: {
        token: generateShareToken(),
        sprintId,
        createdById: user.id,
        isLive: data.isLive,
        includedFilterIds: filters.map((f) => f.id),
        viewDensity: data.viewDensity,
        snapshot: snapshot ?? undefined,
        expiresAt: data.expiresAt ?? null,
      },
    });

    return Response.json({
      id: share.id,
      token: share.token,
      url: `/share/${share.token}`,
      isLive: share.isLive,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      includedFilterIds: share.includedFilterIds,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(_request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
    await requireSprint(sprintId);

    // Sprint + creator scope (admin: the whole sprint). SharedView has no team column and frozen
    // shares may reference deleted filters, so exact team-scoping is unreliable — rows carry the
    // resolvable filter names for display instead.
    const shares = await prisma.sharedView.findMany({
      where: { sprintId, ...(user.isAdmin ? {} : { createdById: user.id }) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        token: true,
        isLive: true,
        expiresAt: true,
        createdAt: true,
        viewDensity: true,
        includedFilterIds: true,
        createdBy: { select: { displayName: true } },
      },
    });

    const allFilterIds = [...new Set(shares.flatMap((share) => share.includedFilterIds))];
    const namedFilters = await prisma.filter.findMany({
      where: { id: { in: allFilterIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(namedFilters.map((filter) => [filter.id, filter.name]));

    return Response.json(
      shares.map((share) => ({
        id: share.id,
        token: share.token,
        url: `/share/${share.token}`,
        isLive: share.isLive,
        expiresAt: share.expiresAt,
        createdAt: share.createdAt,
        createdBy: share.createdBy.displayName,
        filterCount: share.includedFilterIds.length,
        filterNames: share.includedFilterIds
          .map((id) => nameById.get(id))
          .filter((name) => name !== undefined),
      })),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
