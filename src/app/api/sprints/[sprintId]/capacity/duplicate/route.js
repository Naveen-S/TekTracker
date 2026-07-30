/**
 * /api/sprints/[sprintId]/capacity/duplicate — POST: copy another sprint's committed-capacity
 * matrix INTO this one (committed-unplanned-work.md decision 6, "duplicate to another sprint").
 * `[sprintId]` in the URL is the DESTINATION; `sourceSprintId` in the body is where the numbers
 * come from — this reads as "copy INTO the sprint I'm viewing FROM another sprint," and the same
 * route serves "duplicate to next sprint" when the admin views the next sprint and copies from the
 * current one. Overwrites any existing rows for teams present in the source (admin UI is expected
 * to confirm before calling this when the destination already has configured rows, decision 10).
 * Admin-only (decision 7).
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { sprintCapacityDuplicateSchema } from "@/lib/schemas/sprint-capacity";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    await requireAdmin();
    const { sprintId } = await params; // destination
    const { sourceSprintId } = await parseJsonBody(request, sprintCapacityDuplicateSchema);

    if (sourceSprintId === sprintId) {
      throw new ValidationError("sourceSprintId must differ from the target sprint");
    }

    const [target, source] = await Promise.all([
      prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true } }),
      prisma.sprint.findUnique({ where: { id: sourceSprintId }, select: { id: true } }),
    ]);
    if (!target) throw new NotFoundError("Target sprint not found");
    if (!source) throw new NotFoundError("Source sprint not found");

    const sourceRows = await prisma.sprintCapacity.findMany({ where: { sprintId: sourceSprintId } });

    await prisma.$transaction(
      sourceRows.map((row) =>
        prisma.sprintCapacity.upsert({
          where: { sprintId_teamId: { sprintId, teamId: row.teamId } },
          update: { committedPoints: row.committedPoints },
          create: { sprintId, teamId: row.teamId, committedPoints: row.committedPoints },
        }),
      ),
    );

    const updated = await prisma.sprintCapacity.findMany({ where: { sprintId } });
    return Response.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
