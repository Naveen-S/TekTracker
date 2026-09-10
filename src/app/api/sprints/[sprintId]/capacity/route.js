/**
 * /api/sprints/[sprintId]/capacity — PUT: batch-save one sprint's per-team "committed capacity"
 * matrix (committed-unplanned-work.md decision 6, "one transactional document" — the whole matrix
 * saves at once, mirroring bug-report-config.jsx's SLA-days matrix precedent). Admin-only
 * (decision 7 — matches Sprint config's existing global-admin-only gate, no carve-out).
 *
 * A row's `committedPoints: null` CLEARS that team's capacity for this sprint (decision 3:
 * unconfigured is a real state, not zero) rather than writing a zero row.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody, ValidationError } from "@/lib/api/route-helpers";
import { sprintCapacityMatrixSchema } from "@/lib/schemas/sprint-capacity";

export const dynamic = "force-dynamic";

export const PUT = withRoute("sprints.capacity", async (request, { params }) => {
  await requireAdmin();
  const { sprintId } = await params;

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true } });
  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }

  const { rows } = await parseJsonBody(request, sprintCapacityMatrixSchema);

  const teamIds = rows.map((row) => row.teamId);
  const knownTeams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true },
  });
  if (knownTeams.length !== new Set(teamIds).size) {
    throw new ValidationError("one or more teamIds do not exist");
  }

  await prisma.$transaction(
    rows.map((row) =>
      row.committedPoints === null || row.committedPoints === undefined
        ? prisma.sprintCapacity.deleteMany({ where: { sprintId, teamId: row.teamId } })
        : prisma.sprintCapacity.upsert({
            where: { sprintId_teamId: { sprintId, teamId: row.teamId } },
            update: { committedPoints: row.committedPoints },
            create: { sprintId, teamId: row.teamId, committedPoints: row.committedPoints },
          }),
    ),
  );

  const updated = await prisma.sprintCapacity.findMany({ where: { sprintId } });
  return Response.json(updated);
});
