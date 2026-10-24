/**
 * /api/security/programs (security-vulnerability-tracker.md (c)) — GET: every security program,
 * any signed-in user; POST: create one, global admin only. A security program is NOT a StoryBoard
 * Program (components don't map 1:1); `programId` is an optional link only.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { securityProgramCreateSchema } from "@/lib/schemas/security";

export const dynamic = "force-dynamic";

export const GET = withRoute("security.programs", async () => {
  await requireUser();
  const programs = await prisma.securityProgram.findMany({
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    include: { program: { select: { id: true, key: true, name: true } } },
  });
  return Response.json(programs);
});

export const POST = withRoute("security.programs", async (request) => {
  await requireAdmin();
  const data = await parseJsonBody(request, securityProgramCreateSchema);
  const program = await prisma.securityProgram.create({ data });
  return Response.json(program);
});
