/**
 * POST /api/teams/[teamId]/sprints/[sprintId]/filters/[filterId]/sync-stages — per-track "Sync
 * stages from Jira" (sync-stages-from-jira.md). Refreshes ONE filter from Jira, then re-derives
 * every one of its issues' stage checklists from the fresh Jira status via StatusStageMapping
 * (overwriting existing rows — the user-triggered variant of the deferred re-seed-forward).
 * Writer roles (everyone but VIEWER); no body. Returns the applied/unmapped counts for the toast.
 *
 * Error mapping is entirely the shared helper's now (observability-and-errors.md): the Jira errors
 * carry their own status + code — missing credential / rejected token → 401, other Jira failures →
 * 502 — alongside CLOSED sprint → 409 and unknown filter → 404, each with a requestId and, for a
 * Jira failure, Jira's own message and the offending JQL.
 */
import { requireTeamRole, TEAM_WRITER_ROLES } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";
import { syncFilterStagesFromJira } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

export const POST = withRoute("teams.sprints.filters.sync-stages", async (_request, { params }) => {
  const { teamId, sprintId, filterId } = await params;
  const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
  const summary = await syncFilterStagesFromJira({ teamId, sprintId, filterId, userId: user.id });
  return Response.json(summary);
});
