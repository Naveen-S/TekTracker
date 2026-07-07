/**
 * /api/teams/[teamId]/filter-templates/[templateId] — PATCH / DELETE (manager roles). Ownership is
 * verified against the path's team — a template id from another team is a 404, never cross-team
 * access (domain-apis.md decision 4).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { filterTemplatePatchSchema } from "@/lib/schemas/filter";

export const dynamic = "force-dynamic";

async function requireOwnedTemplate(templateId, teamId) {
  const template = await prisma.filterTemplate.findFirst({ where: { id: templateId, teamId } });
  if (!template) {
    throw new NotFoundError("Filter template not found");
  }
  return template;
}

export async function PATCH(request, { params }) {
  try {
    const { teamId, templateId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    await requireOwnedTemplate(templateId, teamId);
    const data = await parseJsonBody(request, filterTemplatePatchSchema);
    const template = await prisma.filterTemplate.update({ where: { id: templateId }, data });
    return Response.json(template);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { teamId, templateId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    await requireOwnedTemplate(templateId, teamId);
    await prisma.filterTemplate.delete({ where: { id: templateId } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
