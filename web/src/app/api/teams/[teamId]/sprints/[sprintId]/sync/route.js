/**
 * POST /api/teams/[teamId]/sprints/[sprintId]/sync — sync all of the sprint's filters from Jira
 * with the CALLER's stored credential (sync-hybrid-seeding.md decisions 1–3). Writer roles
 * (everyone but VIEWER); no body. Returns the per-filter added/removed diff + seeding counts
 * (the prototype's sync-toast data).
 *
 * Jira-specific errors map here (not in the shared helper): missing credential / rejected token →
 * 401 (re-login re-writes the credential), other Jira failures → 502.
 */
import { requireTeamRole, TEAM_WRITER_ROLES } from "@/lib/rbac";
import { handleRouteError } from "@/lib/api/route-helpers";
import { syncTeamSprint } from "@/lib/sync/engine";
import { JiraAuthError, JiraApiError, JiraCredentialMissingError } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
    const summary = await syncTeamSprint({ teamId, sprintId, userId: user.id });
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
