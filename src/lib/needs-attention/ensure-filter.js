/**
 * Keep the single always-on "Needs attention" hygiene track in sync with a team's roster
 * (needs-attention-roster.md). Called from {@link syncTeamSprint} BEFORE the fetch loop so the
 * returned filter is fetched + cached by the normal loop like any other track — the track's issues
 * therefore stay a plain read of the Issue cache, and the roster auto-refreshes on every Sync + the
 * daily cron with no button to click (the ratified "always present, auto-refreshed" decision).
 *
 * Idempotent:
 * - roster + project keys non-empty ⇒ UPSERT the one NEEDS_ATTENTION filter (create with a distinct
 *   accent, else refresh its `jql` from the CURRENT roster — this is the "stay fresh on a roster
 *   edit" path);
 * - roster empty (builder returns null) ⇒ DELETE any existing NA filter so clearing the roster
 *   removes the track (its cached Issue rows cascade away).
 *
 * Never generated for CLOSED sprints — `syncTeamSprint` rejects those before calling this.
 */
import { buildNeedsAttentionJql, NEEDS_ATTENTION_NAME } from "@/lib/sprint-start/track-jql.mjs";
import { insertFilterAtPriority } from "@/lib/filters/priority-insert";
import { FilterSourceType } from "@/generated/prisma/client";

/** Amber "caution" accent — signals a hygiene surface, distinct from the delivery tracks. */
export const NEEDS_ATTENTION_ACCENT = "#f59e0b";

// Match on the STRING literal, NEVER `WorkflowType.NEEDS_ATTENTION`. A stale or partially-hot-reloaded
// generated client can make that enum member `undefined`; Prisma then STRIPS the key from a `where`,
// silently widening it to "any filter" — which, in the delete branch below, would remove a real track.
// The string can never be undefined. (This bug deleted real tracks once — never reintroduce the enum
// object here.)
const NA = "NEEDS_ATTENTION";

/**
 * @param {import("@/generated/prisma/client").Prisma.TransactionClient} tx
 * @param {{ team: { id: string, memberEmails: string[], jiraProjectKeys: string[] }, sprintId: string }} args
 * @returns {Promise<import("@/generated/prisma/client").Filter|null>} the NA filter, or null if none
 */
export async function ensureNeedsAttentionFilter(tx, { team, sprintId }) {
  const jql = buildNeedsAttentionJql({
    memberEmails: team.memberEmails,
    projectKeys: team.jiraProjectKeys,
  });
  const existing = await tx.filter.findFirst({
    where: { teamId: team.id, sprintId, workflowType: NA },
  });

  if (!jql) {
    // Delete scoped BY workflowType (deleteMany), so the DB constraint is applied at delete time and
    // it can only ever remove NA rows — never a real track — no matter what `existing` resolved to.
    await tx.filter.deleteMany({ where: { teamId: team.id, sprintId, workflowType: NA } });
    return null;
  }
  if (existing) {
    return tx.filter.update({
      where: { id: existing.id },
      data: { jql, sourceType: FilterSourceType.JQL, name: NEEDS_ATTENTION_NAME },
    });
  }
  return insertFilterAtPriority(tx, {
    teamId: team.id,
    sprintId,
    workflowType: NA,
    name: NEEDS_ATTENTION_NAME,
    sourceType: FilterSourceType.JQL,
    jql,
    accentColor: NEEDS_ATTENTION_ACCENT,
  });
}
