/**
 * PATCH /api/sows/[sowId]/slack-issues/[issueId] — an admin's override on one Slack post
 * (sow-tracker.md round 2, decision 4): mark it Issue / Not an issue / Fixed, link a Jira ticket,
 * add a note; `null` clears a field and hands the status back to the reactions. Survives every
 * re-sync (the sync only rewrites the raw Slack facts). Global admins only.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { slackIssuePatchSchema } from "@/lib/schemas/sow";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("sows.slack_issues.patch", async (request, { params }) => {
  const user = await requireAdmin();
  const { sowId, issueId } = await params;
  const patch = await parseJsonBody(request, slackIssuePatchSchema);
  const { count } = await prisma.sowSlackIssue.updateMany({
    where: { id: issueId, sowId },
    data: { ...patch, updatedById: user.id },
  });
  if (count === 0) throw new NotFoundError("Slack issue not found");
  return Response.json({ ok: true });
});
