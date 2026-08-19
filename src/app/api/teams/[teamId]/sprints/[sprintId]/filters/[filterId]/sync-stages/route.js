/**
 * POST /api/teams/[teamId]/sprints/[sprintId]/filters/[filterId]/sync-stages — per-track "Sync
 * stages from Jira" (sync-stages-from-jira.md). Refreshes ONE filter from Jira, then re-derives
 * every one of its issues' stage checklists from the fresh Jira status via StatusStageMapping
 * (overwriting existing rows — the user-triggered variant of the deferred re-seed-forward).
 * Writer roles (everyone but VIEWER); no body. Returns the applied/unmapped counts for the toast.
 *
 * Jira-specific errors map here (as the full-sync route does): missing credential / rejected token
 * → 401, other Jira failures → 502; CLOSED sprint → 409 and unknown filter → 404 via handleRouteError.
 */
import { requireTeamRole, TEAM_WRITER_ROLES } from "@/lib/rbac";
import { handleRouteError } from "@/lib/api/route-helpers";
import { syncFilterStagesFromJira } from "@/lib/sync/engine";
import { JiraAuthError, JiraApiError, JiraCredentialMissingError } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  try {
    const { teamId, sprintId, filterId } = await params;
    const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
    const summary = await syncFilterStagesFromJira({ teamId, sprintId, filterId, userId: user.id });
    return Response.json(summary);
  } catch (error) {
    if (error instanceof JiraCredentialMissingError || error instanceof JiraAuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof JiraApiError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return handleRouteError(error);
  }
}
