/**
 * /api/jira-components — GET: list the full catalog (each Component with its Sub-components,
 * incl. which Team has claimed each one); POST: add a Component (admin-only, one-at-a-time entry,
 * one-click-sprint-start.md decision 1 — no bulk import, no live Jira lookup).
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { jiraComponentCreateSchema } from "@/lib/schemas/jira-component";

export const dynamic = "force-dynamic";

export const GET = withRoute("jira-components", async () => {
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
});

export const POST = withRoute("jira-components", async (request) => {
  await requireAdmin();
  const data = await parseJsonBody(request, jiraComponentCreateSchema);
  const component = await prisma.jiraComponent.create({ data });
  return Response.json(component);
});
