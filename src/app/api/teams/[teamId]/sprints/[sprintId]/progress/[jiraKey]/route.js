/**
 * PUT /api/teams/[teamId]/sprints/[sprintId]/progress/[jiraKey] — write stage/blocked state (team
 * writer roles, i.e. everyone but VIEWER). Ports the prototype's toggleStage/toggleBlocked to an
 * idempotent target-state PUT (domain-apis.md decisions 5–6):
 *
 * - Checklist cascade rule (§4): completing stage n also completes 0..n-1; un-completing it also
 *   un-completes n+1..end.
 * - Create-on-first-write: the row is created sized to the OWNING workflow — the highest-priority
 *   filter in this team+sprint whose Issue cache contains the key (§9). Manual creation is not
 *   status-seeding, so `seededFromStatus` stays null (that's Sync's job, step 5). No cached issue
 *   matches → 404.
 * - Every write attributes `updatedById` to the caller.
 * - `riskComment` (risk-comments-rollup-digest.md decision 2) is independent of blocked/
 *   blockedReason — undefined leaves it untouched, an empty/whitespace string clears it to null,
 *   and it survives unblock/re-block (unlike blockedReason, never auto-cleared).
 */
import { prisma } from "@/lib/db";
import { requireTeamRole, NotFoundError, TEAM_WRITER_ROLES } from "@/lib/rbac";
import { parseJsonBody, handleRouteError, ValidationError } from "@/lib/api/route-helpers";
import { progressWriteSchema } from "@/lib/schemas/progress";
import { stageCountFor, owningWorkflowType } from "@/lib/workflows.mjs";

export const dynamic = "force-dynamic";

/** Apply the §4 checklist cascade to a copy of the stage array. */
function applyStageWrite(stageCompletion, index, completed) {
  const next = [...stageCompletion];
  next[index] = completed;
  if (completed) {
    for (let i = 0; i < index; i++) next[i] = true;
  } else {
    for (let i = index + 1; i < next.length; i++) next[i] = false;
  }
  return next;
}

export async function PUT(request, { params }) {
  try {
    const { teamId, sprintId, jiraKey } = await params;
    const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
    const data = await parseJsonBody(request, progressWriteSchema);

    const progress = await prisma.$transaction(async (tx) => {
      const where = { teamId_sprintId_jiraKey: { teamId, sprintId, jiraKey } };
      const existing = await tx.issueProgress.findUnique({ where });

      let workflowType = existing?.workflowType;
      let stageCompletion = existing ? [...existing.stageCompletion] : null;
      if (!existing) {
        const cached = await tx.issue.findMany({
          where: { jiraKey, filter: { teamId, sprintId } },
          select: { filter: { select: { workflowType: true } } },
        });
        if (cached.length === 0) {
          throw new NotFoundError(
            `No issue ${jiraKey} is cached for this team and sprint — sync or import it first`,
          );
        }
        workflowType = owningWorkflowType(cached.map((issue) => issue.filter.workflowType));
        stageCompletion = new Array(stageCountFor(workflowType)).fill(false);
      }

      if (data.stage) {
        if (data.stage.index >= stageCompletion.length) {
          throw new ValidationError(
            `stage.index must be below ${stageCompletion.length} for ${workflowType}`,
          );
        }
        stageCompletion = applyStageWrite(stageCompletion, data.stage.index, data.stage.completed);
      }

      const blocked = data.blocked ?? existing?.blocked ?? false;
      const blockedReason = blocked
        ? data.blockedReason !== undefined
          ? data.blockedReason
          : (existing?.blockedReason ?? null)
        : null;

      const riskComment =
        data.riskComment !== undefined
          ? data.riskComment || null // empty/whitespace ("" after zod .trim()) clears it
          : (existing?.riskComment ?? null);

      const fields = { stageCompletion, blocked, blockedReason, riskComment, updatedById: user.id };
      if (existing) {
        return tx.issueProgress.update({ where, data: fields });
      }
      return tx.issueProgress.create({
        data: { teamId, sprintId, jiraKey, workflowType, seededFromStatus: null, ...fields },
      });
    });

    return Response.json(progress);
  } catch (error) {
    return handleRouteError(error);
  }
}
