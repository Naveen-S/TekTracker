/**
 * /api/programs (program-rollup.md) — GET: list programs with team counts, for the /rollup program
 * picker + the admin Programs section (leadership audience: hasProgramAccess, global admin bypasses);
 * POST: create a program (global admin only — §16 admin-managed provisioning, mirrors /api/teams).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin, hasProgramAccess, ForbiddenError } from "@/lib/rbac";
import { withRoute, parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { programCreateSchema } from "@/lib/schemas/program";

export const dynamic = "force-dynamic";

export const GET = withRoute("programs", async () => {
  try {
    const user = await requireUser();
    if (!(await hasProgramAccess(user))) {
      throw new ForbiddenError();
    }
    const programs = await prisma.program.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { teams: true } } },
    });
    return Response.json(programs);
  } catch (error) {
    return handleRouteError(error);
  }
});

export const POST = withRoute("programs", async (request) => {
  try {
    await requireAdmin();
    const data = await parseJsonBody(request, programCreateSchema);
    const program = await prisma.program.create({ data });
    return Response.json(program);
  } catch (error) {
    return handleRouteError(error);
  }
});
