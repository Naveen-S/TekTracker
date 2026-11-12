/**
 * POST /api/sows/[sowId]/refresh — re-read the SOW's Jira source now and write today's snapshot
 * (sow-tracker.md (e), decision 11). Global admins only; the nightly cron refreshes for everyone.
 * Runs on the SERVICE credential where configured, so the numbers do not depend on who clicked.
 * Read-only against Jira.
 */
import { requireAdmin } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";
import { resolveRefreshAuth } from "@/lib/jira/refresh-auth";
import { refreshSow } from "@/lib/sow/refresh";

export const dynamic = "force-dynamic";

export const POST = withRoute("sows.refresh", async (_request, { params }) => {
  const user = await requireAdmin();
  const { sowId } = await params;
  const { auth, email } = await resolveRefreshAuth(user.id);
  return Response.json(await refreshSow(sowId, { auth, refreshedByEmail: email }));
});
