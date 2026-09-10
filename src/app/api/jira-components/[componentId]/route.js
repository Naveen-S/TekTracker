/**
 * /api/jira-components/[componentId] — PATCH: rename/rekey a Component; DELETE: remove it
 * (schema-cascades its Sub-components — any team's claim on one goes with it). Admin-only.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { jiraComponentPatchSchema } from "@/lib/schemas/jira-component";

export const dynamic = "force-dynamic";

async function requireComponent(componentId) {
  const component = await prisma.jiraComponent.findUnique({ where: { id: componentId } });
  if (!component) {
    throw new NotFoundError("Jira component not found");
  }
  return component;
}

export const PATCH = withRoute("jira-components", async (request, { params }) => {
  await requireAdmin();
  const { componentId } = await params;
  await requireComponent(componentId);
  const data = await parseJsonBody(request, jiraComponentPatchSchema);
  const component = await prisma.jiraComponent.update({ where: { id: componentId }, data });
  return Response.json(component);
});

export const DELETE = withRoute("jira-components", async (_request, { params }) => {
  await requireAdmin();
  const { componentId } = await params;
  await requireComponent(componentId);
  await prisma.jiraComponent.delete({ where: { id: componentId } });
  return Response.json({ ok: true });
});
