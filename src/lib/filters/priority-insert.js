/**
 * Shared priority-ordered Filter insertion (ported out of
 * `teams/[teamId]/sprints/[sprintId]/filters/route.js` decision 7, so that route and the new
 * one-click-sprint-start route call one implementation). Places a new filter after the last
 * existing one of same-or-higher `WORKFLOWS` priority, renumbering `sortOrder` 0..n.
 */
import { WORKFLOWS } from "@/lib/workflows.mjs";

/**
 * @param {import("@/generated/prisma/client").Prisma.TransactionClient} tx
 * @param {{ teamId: string, sprintId: string, workflowType: string } & Record<string, unknown>} fields
 *   full Filter create fields (teamId, sprintId, workflowType, name, sourceType, jql/jiraFilterId,
 *   accentColor, ...) — `sortOrder` is computed here and must not be passed in.
 * @param {{ include?: object }} [options]
 * @returns {Promise<import("@/generated/prisma/client").Filter>}
 */
export async function insertFilterAtPriority(tx, fields, options = {}) {
  const { teamId, sprintId, workflowType } = fields;
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
    data: { ...fields, sortOrder: insertAt },
    include: options.include,
  });
}
