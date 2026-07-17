/**
 * /api/shares/[shareId] — DELETE: revoke a share link (share-view-export.md (b)). Flat route on
 * purpose: revocation is a creator-or-global-admin check, not a team-role check (decision 7).
 * Deleting the row is the revocation — the public page resolves tokens per request, so the link
 * dies immediately.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/rbac";
import { handleRouteError } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  try {
    const { shareId } = await params;
    const user = await requireUser();

    const share = await prisma.sharedView.findUnique({
      where: { id: shareId },
      select: { id: true, createdById: true },
    });
    if (!share) {
      throw new NotFoundError("Share not found");
    }
    if (share.createdById !== user.id && !user.isAdmin) {
      throw new ForbiddenError("Only the creator or an admin can revoke a share");
    }

    await prisma.sharedView.delete({ where: { id: share.id } });
    return Response.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
