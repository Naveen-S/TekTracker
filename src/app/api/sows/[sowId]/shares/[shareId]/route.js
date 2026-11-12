/**
 * DELETE /api/sows/[sowId]/shares/[shareId] — revoke a public link; it stops working at once
 * (sow-tracker.md (e)). Global admins only.
 */
import { prisma } from "@/lib/db";
import { requireAdmin, NotFoundError } from "@/lib/rbac";
import { withRoute } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export const DELETE = withRoute("sows.shares.revoke", async (_request, { params }) => {
  await requireAdmin();
  const { sowId, shareId } = await params;
  const { count } = await prisma.sowShare.deleteMany({ where: { id: shareId, sowId } });
  if (count === 0) throw new NotFoundError("Share link not found");
  return Response.json({ ok: true });
});
