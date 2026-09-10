/**
 * /api/jira-components/[componentId]/sub-components — POST: add ONE Sub-component under a
 * Component (admin-only, one at a time — one-click-sprint-start.md decision 1). Newly created
 * sub-components are unassigned (teamId = null) until a team claims them via
 * PATCH /api/teams/[teamId]/sub-components.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { jiraSubComponentCreateSchema } from "@/lib/schemas/jira-component";

export const dynamic = "force-dynamic";

export const POST = withRoute("jira-components.sub-components", async (request, { params }) => {
  await requireAdmin();
  const { componentId } = await params;
  const component = await prisma.jiraComponent.findUnique({ where: { id: componentId } });
  if (!component) {
    throw new NotFoundError("Jira component not found");
  }
  const data = await parseJsonBody(request, jiraSubComponentCreateSchema);
  const subComponent = await prisma.jiraSubComponent.create({ data: { ...data, componentId } });
  return Response.json(subComponent);
});
