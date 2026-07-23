/**
 * POST /api/bug-reports/[reportId]/refresh — re-pull every scope from Jira, replace the cache, and
 * upsert today's snapshot rows.
 *
 * Allowed for ANY authenticated user (gm-bug-report.md decision 18): a refresh is a read against
 * Jira, and the dashboard is org-level. The credential used is the SERVICE one where configured,
 * not the caller's (decision 16) — so the number never depends on who pressed the button.
 *
 * Error mapping (the step-5 sync-route precedent, not the shared helper's job): stored credential
 * rejected by Jira → 401 · Jira API failure/timeout → 502 · missing report or no usable credential
 * → 404 (handleRouteError) · anything else → 500 loud.
 */
import { requireUser } from "@/lib/auth";
import { handleRouteError } from "@/lib/api/route-helpers";
import { refreshBugReport, resolveRefreshAuth } from "@/lib/bug-report/refresh";
import { JiraAuthError, JiraApiError, JiraCredentialMissingError } from "@/lib/jira/client";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const user = await requireUser();
    const { reportId } = await params;

    const { auth, email } = await resolveRefreshAuth(user.id);
    const summary = await refreshBugReport(reportId, { auth, refreshedByEmail: email });

    return Response.json(summary);
  } catch (error) {
    if (error instanceof JiraAuthError || error instanceof JiraCredentialMissingError) {
      return Response.json(
        { error: "Stored Jira credential is invalid or expired — log in again to reconnect" },
        { status: 401 },
      );
    }
    if (error instanceof JiraApiError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return handleRouteError(error);
  }
}
