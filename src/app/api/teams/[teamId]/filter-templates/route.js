/**
 * /api/teams/[teamId]/filter-templates — GET: list the team's reusable track definitions (any
 * member); POST: create one (manager roles). Templates exist so EMs don't re-type JQL every
 * release (§16); they're instantiated into sprint Filters via POST …/filters { fromTemplateId }.
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, TEAM_ALL_ROLES, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { filterTemplateCreateSchema } from "@/lib/schemas/filter";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, TEAM_ALL_ROLES);
    const templates = await prisma.filterTemplate.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
    });
    return Response.json(templates);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request, { params }) {
  try {
    const { teamId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    const data = await parseJsonBody(request, filterTemplateCreateSchema);
    const template = await prisma.filterTemplate.create({ data: { ...data, teamId } });
    return Response.json(template);
  } catch (error) {
    return handleRouteError(error);
  }
}
