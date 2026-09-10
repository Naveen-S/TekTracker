/**
 * POST /api/teams/[teamId]/sprints/[sprintId]/sync — sync all of the sprint's filters from Jira
 * with the CALLER's stored credential (sync-hybrid-seeding.md decisions 1–3). Writer roles
 * (everyone but VIEWER); no body. Returns the per-filter added/removed diff + seeding counts
 * (the prototype's sync-toast data).
 *
 * Error mapping lives in the shared helper now (observability-and-errors.md): the Jira errors carry
 * their own status + code — missing credential / rejected token → 401 (re-login re-writes the
 * credential), other Jira failures → 502 — and the response additionally names the track that
 * failed, what Jira actually said, and the requestId.
 *
 * The summary also carries `warnings[]`: a sync that takes a non-empty track to zero issues is a
 * SUCCESS with a suspicious result (§14.14), reported rather than thrown.
 */
import { requireTeamRole, TEAM_WRITER_ROLES } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";
import { syncTeamSprint } from "@/lib/sync/engine";

export const dynamic = "force-dynamic";

export const POST = withRoute("teams.sprints.sync", async (_request, { params }) => {
  const { teamId, sprintId } = await params;
  const { user } = await requireTeamRole(teamId, TEAM_WRITER_ROLES);
  const summary = await syncTeamSprint({ teamId, sprintId, userId: user.id });
  return Response.json(summary);
});
