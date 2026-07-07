/**
 * /api/sprints — GET: list global sprints/Gates, optional `?state=` (any authenticated user);
 * POST: create (global admin only — §13.3 admin-gated sprint config; fixes flaw §14.6 in web/).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { sprintCreateSchema, sprintStateSchema } from "@/lib/schemas/sprint";
import { validate } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireUser();
    const stateParam = new URL(request.url).searchParams.get("state");
    const where = {};
    if (stateParam !== null) {
      const parsed = validate(sprintStateSchema, stateParam);
      if (!parsed.success) {
        throw new ValidationError(`state: ${parsed.error}`);
      }
      where.state = parsed.data;
    }
    const sprints = await prisma.sprint.findMany({ where, orderBy: { developmentStart: "desc" } });
    return Response.json(sprints);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    const user = await requireAdmin();
    const data = await parseJsonBody(request, sprintCreateSchema);
    const sprint = await prisma.sprint.create({ data: { ...data, createdById: user.id } });
    return Response.json(sprint);
  } catch (error) {
    return handleRouteError(error);
  }
}
