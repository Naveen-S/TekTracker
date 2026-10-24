/**
 * POST /api/security/refresh — re-read the Confluence vocabulary and the Jira mirror now, then
 * upsert today's snapshots (security-vulnerability-tracker.md (c), P2). Global admins only: the
 * nightly cron refreshes for everyone; this is for "right after triaging in the artifact".
 *
 * The credential is the SERVICE one where configured (P3), never the clicker's, so the numbers do
 * not depend on who pressed the button. Read-only against Atlassian.
 */
import { requireAdmin } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";
import { resolveRefreshAuth } from "@/lib/jira/refresh-auth";
import { refreshSecurityTracker } from "@/lib/security/refresh";

export const dynamic = "force-dynamic";

export const POST = withRoute("security.refresh", async () => {
  const user = await requireAdmin();
  const { auth, email } = await resolveRefreshAuth(user.id);
  const summary = await refreshSecurityTracker({ auth, refreshedByEmail: email });
  return Response.json(summary);
});
