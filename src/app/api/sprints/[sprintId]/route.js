/**
 * /api/sprints/[sprintId] — GET: one sprint (any authenticated user); PATCH: update incl. `state`
 * transitions (global admin). Deliberately NO DELETE (domain-apis.md decision 8): a sprint closes
 * via `state: CLOSED`; deleting would cascade filters/progress/shares/snapshots.
 *
 * The start-before-end rule is re-checked against the MERGED existing+patch dates, so patching a
 * single date can't invert the window (the schema alone can't see the stored other half).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { sprintPatchSchema } from "@/lib/schemas/sprint";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { sprintId } = await params;
    await requireUser();
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) {
      throw new NotFoundError("Sprint not found");
    }
    return Response.json(sprint);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { sprintId } = await params;
    await requireAdmin();
    const data = await parseJsonBody(request, sprintPatchSchema);

    const existing = await prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!existing) {
      throw new NotFoundError("Sprint not found");
    }
    const start = data.developmentStart ?? existing.developmentStart;
    const end = data.developmentEnd ?? existing.developmentEnd;
    if (start >= end) {
      throw new ValidationError("developmentStart must be before developmentEnd");
    }

    const sprint = await prisma.sprint.update({ where: { id: sprintId }, data });
    return Response.json(sprint);
  } catch (error) {
    return handleRouteError(error);
  }
}
