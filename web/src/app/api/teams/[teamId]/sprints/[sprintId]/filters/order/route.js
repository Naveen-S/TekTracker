/**
 * PUT /api/teams/[teamId]/sprints/[sprintId]/filters/order — persist a drag-reorder (manager
 * roles). The body must list EXACTLY the sprint's filter ids (validated as a set); sortOrder
 * becomes the array index (domain-apis.md decision 7).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { filterReorderSchema } from "@/lib/schemas/filter";

export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    const { filterIds } = await parseJsonBody(request, filterReorderSchema);

    const filters = await prisma.$transaction(async (tx) => {
      const existing = await tx.filter.findMany({
        where: { teamId, sprintId },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((f) => f.id));
      const sameSet =
        filterIds.length === existingIds.size && filterIds.every((id) => existingIds.has(id));
      if (!sameSet) {
        throw new ValidationError(
          "filterIds must contain exactly the ids of this sprint's filters, each once",
        );
      }
      for (let i = 0; i < filterIds.length; i++) {
        await tx.filter.update({ where: { id: filterIds[i] }, data: { sortOrder: i } });
      }
      return tx.filter.findMany({ where: { teamId, sprintId }, orderBy: { sortOrder: "asc" } });
    });
    return Response.json(filters);
  } catch (error) {
    return handleRouteError(error);
  }
}
