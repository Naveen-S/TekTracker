/**
 * /api/sows/[sowId]/slack-sync (sow-tracker.md round 2) — POST: queue a read of the SOW's pre-QA
 * Slack channel on the calling admin's own Claude Connector; GET: that sync's latest state, which
 * the page polls. Global admins only. StoryBoard holds no Slack credential: the connector reads
 * the channel with two read-only Slack tools and posts the result to /api/connector/jobs/[jobId].
 */
import { requireAdmin } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";
import { getSlackSyncState, queueSlackSync } from "@/lib/sow/slack-sync";

export const dynamic = "force-dynamic";

export const GET = withRoute("sows.slack_sync.state", async (_request, { params }) => {
  await requireAdmin();
  const { sowId } = await params;
  return Response.json(await getSlackSyncState(sowId));
});

export const POST = withRoute("sows.slack_sync.queue", async (_request, { params }) => {
  const user = await requireAdmin();
  const { sowId } = await params;
  return Response.json(await queueSlackSync(sowId, user), { status: 202 });
});
