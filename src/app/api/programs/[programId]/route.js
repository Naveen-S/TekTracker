/**
 * /api/programs/[programId] (program-rollup.md) — PATCH: rename/describe/re-key a program; DELETE:
 * remove it. Both global-admin only (mirrors /api/teams/[teamId]). Deleting a Program does NOT
 * cascade to its teams — the Team.programId FK is `onDelete: SetNull`, so its teams simply become
 * unassigned (and a program-scoped roll-up falls back to the viewer's own teams).
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { programPatchSchema } from "@/lib/schemas/program";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("programs", async (request, { params }) => {
  try {
    const { programId } = await params;
    await requireAdmin();
    const data = await parseJsonBody(request, programPatchSchema);
    const program = await prisma.program.update({ where: { id: programId }, data });
    return Response.json(program);
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = withRoute("programs", async (_request, { params }) => {
  try {
    const { programId } = await params;
    await requireAdmin();
    await prisma.program.delete({ where: { id: programId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
});
