/**
 * PATCH /api/sows/[sowId]/feed-items/[itemId] — hide or restore one decision or document pulled
 * from a docs-and-decisions Slack channel (sow-tracker.md round 4), for when the extraction got
 * it wrong. Survives every re-sync (a sync never touches `hidden`). Global admins only.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { feedItemPatchSchema } from "@/lib/schemas/sow";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("sows.feed_items.patch", async (request, { params }) => {
  await requireAdmin();
  const { sowId, itemId } = await params;
  const { hidden } = await parseJsonBody(request, feedItemPatchSchema);
  const { count } = await prisma.sowFeedItem.updateMany({ where: { id: itemId, sowId }, data: { hidden } });
  if (count === 0) throw new NotFoundError("Item not found");
  return Response.json({ ok: true });
});
