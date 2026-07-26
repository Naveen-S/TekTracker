/**
 * /api/jira-components/[componentId] — PATCH: rename/rekey a Component; DELETE: remove it
 * (schema-cascades its Sub-components — any team's claim on one goes with it). Admin-only.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { jiraComponentPatchSchema } from "@/lib/schemas/jira-component";

export const dynamic = "force-dynamic";

async function requireComponent(componentId) {
  const component = await prisma.jiraComponent.findUnique({ where: { id: componentId } });
  if (!component) {
    throw new NotFoundError("Jira component not found");
  }
  return component;
}

export async function PATCH(request, { params }) {
  try {
    await requireAdmin();
    const { componentId } = await params;
    await requireComponent(componentId);
    const data = await parseJsonBody(request, jiraComponentPatchSchema);
    const component = await prisma.jiraComponent.update({ where: { id: componentId }, data });
    return Response.json(component);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    await requireAdmin();
    const { componentId } = await params;
    await requireComponent(componentId);
    await prisma.jiraComponent.delete({ where: { id: componentId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
