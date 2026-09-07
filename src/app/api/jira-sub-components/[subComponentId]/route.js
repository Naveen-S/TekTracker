/**
 * /api/jira-sub-components/[subComponentId] — PATCH: rename, or admin-level manual
 * reassign/unassign (`teamId`, bypassing the double-claim check `PATCH
 * /api/teams/[teamId]/sub-components` enforces — an admin correcting a mistake); DELETE: remove
 * it (unclaims it from any Team first). Admin-only.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { jiraSubComponentPatchSchema } from "@/lib/schemas/jira-component";

export const dynamic = "force-dynamic";

async function requireSubComponent(subComponentId) {
  const subComponent = await prisma.jiraSubComponent.findUnique({ where: { id: subComponentId } });
  if (!subComponent) {
    throw new NotFoundError("Jira sub-component not found");
  }
  return subComponent;
}

export const PATCH = withRoute("jira-sub-components", async (request, { params }) => {
  try {
    await requireAdmin();
    const { subComponentId } = await params;
    await requireSubComponent(subComponentId);
    const data = await parseJsonBody(request, jiraSubComponentPatchSchema);
    const subComponent = await prisma.jiraSubComponent.update({
      where: { id: subComponentId },
      data,
    });
    return Response.json(subComponent);
  } catch (error) {
    return handleRouteError(error);
  }
});

export const DELETE = withRoute("jira-sub-components", async (_request, { params }) => {
  try {
    await requireAdmin();
    const { subComponentId } = await params;
    await requireSubComponent(subComponentId);
    await prisma.jiraSubComponent.delete({ where: { id: subComponentId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
});
