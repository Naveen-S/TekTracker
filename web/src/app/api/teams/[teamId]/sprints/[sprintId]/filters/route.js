/**
 * /api/teams/[teamId]/sprints/[sprintId]/filters — GET: the sprint's tracks ordered by sortOrder,
 * each with its cached issues (any member); POST: create a track (manager roles), either from full
 * fields or `{ fromTemplateId }` + overrides.
 *
 * No Jira calls here (domain-apis.md prototype-parity note): a new filter starts with zero cached
 * issues until Sync (step 5) or the importer populates the Issue cache.
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_ALL_ROLES, TEAM_MANAGER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { filterCreateSchema } from "@/lib/schemas/filter";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { WorkflowType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

async function requireSprint(sprintId) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true } });
  if (!sprint) {
    throw new NotFoundError("Sprint not found");
  }
}

export async function GET(_request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    await requireTeamRole(teamId, TEAM_ALL_ROLES);
    await requireSprint(sprintId);
    const filters = await prisma.filter.findMany({
      where: { teamId, sprintId },
      orderBy: { sortOrder: "asc" },
      include: { issues: true },
    });
    return Response.json(filters);
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Resolve `{ fromTemplateId }` + overrides into concrete filter fields (template must be the team's). */
async function resolveFilterFields(data, teamId) {
  const { fromTemplateId, ...overrides } = data;
  if (!fromTemplateId) {
    return overrides;
  }
  const template = await prisma.filterTemplate.findFirst({ where: { id: fromTemplateId, teamId } });
  if (!template) {
    throw new NotFoundError("Filter template not found");
  }
  return {
    name: overrides.name ?? template.name,
    workflowType: overrides.workflowType ?? template.workflowType,
    sourceType: overrides.sourceType ?? template.sourceType,
    jql: overrides.jql !== undefined ? overrides.jql : template.jql,
    jiraFilterId: overrides.jiraFilterId !== undefined ? overrides.jiraFilterId : template.jiraFilterId,
    accentColor: overrides.accentColor !== undefined ? overrides.accentColor : template.accentColor,
  };
}

export async function POST(request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    await requireTeamRole(teamId, TEAM_MANAGER_ROLES);
    await requireSprint(sprintId);
    const data = await parseJsonBody(request, filterCreateSchema);
    const fields = await resolveFilterFields(data, teamId);
    const workflowType = fields.workflowType ?? WorkflowType.FEATURE;

    // Priority insertion (decision 7, ports the prototype's insertFilterInOrder): place the new
    // filter after the last one of same-or-higher workflow priority, renumbering sortOrder 0..n.
    const filter = await prisma.$transaction(async (tx) => {
      const existing = await tx.filter.findMany({
        where: { teamId, sprintId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, workflowType: true },
      });
      const newPriority = WORKFLOWS[workflowType].priority;
      let insertAt = existing.findIndex((f) => WORKFLOWS[f.workflowType].priority > newPriority);
      if (insertAt === -1) {
        insertAt = existing.length;
      }
      for (let i = 0; i < existing.length; i++) {
        await tx.filter.update({
          where: { id: existing[i].id },
          data: { sortOrder: i < insertAt ? i : i + 1 },
        });
      }
      return tx.filter.create({
        data: { ...fields, workflowType, teamId, sprintId, sortOrder: insertAt },
        include: { issues: true },
      });
    });
    return Response.json(filter);
  } catch (error) {
    return handleRouteError(error);
  }
}
