/**
 * /api/security/programs/[programId] (security-vulnerability-tracker.md (c)) — PATCH: edit a
 * program; DELETE: remove it. Global admin only. A program that already has snapshot history is
 * DEACTIVATED instead of deleted, so its week-over-week history is never orphaned.
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { securityProgramPatchSchema } from "@/lib/schemas/security";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("security.programs", async (request, { params }) => {
  const { programId } = await params;
  await requireAdmin();
  const data = await parseJsonBody(request, securityProgramPatchSchema);
  const program = await prisma.securityProgram.update({ where: { id: programId }, data });
  return Response.json(program);
});

export const DELETE = withRoute("security.programs", async (_request, { params }) => {
  const { programId } = await params;
  await requireAdmin();
  const program = await prisma.securityProgram.findUniqueOrThrow({ where: { id: programId } });
  const history = await prisma.securitySnapshot.count({ where: { programKey: program.key } });
  if (history > 0) {
    await prisma.securityProgram.update({ where: { id: programId }, data: { isActive: false } });
    return Response.json({ ok: true, deactivated: true });
  }
  await prisma.securityProgram.delete({ where: { id: programId } });
  return Response.json({ ok: true, deactivated: false });
});
