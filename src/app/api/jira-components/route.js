/**
 * /api/jira-components — GET: list the full catalog (each Component with its Sub-components,
 * incl. which Team has claimed each one); POST: add a Component (admin-only, one-at-a-time entry,
 * one-click-sprint-start.md decision 1 — no bulk import, no live Jira lookup).
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { jiraComponentCreateSchema } from "@/lib/schemas/jira-component";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const components = await prisma.jiraComponent.findMany({
      orderBy: { name: "asc" },
      include: {
        subComponents: {
          orderBy: { name: "asc" },
          include: { team: { select: { id: true, name: true } } },
        },
      },
    });
    return Response.json(components);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin();
    const data = await parseJsonBody(request, jiraComponentCreateSchema);
    const component = await prisma.jiraComponent.create({ data });
    return Response.json(component);
  } catch (error) {
    return handleRouteError(error);
  }
}
