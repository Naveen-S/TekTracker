/**
 * /api/sows/[sowId]/shares — GET: this SOW's public links; POST: mint one (sow-tracker.md (e),
 * decisions 7 and 17). Global admins only. The token is a bearer capability, so it is 192 random
 * bits supplied here, never a guessable id; links are live and optionally expire.
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { sowShareCreateSchema } from "@/lib/schemas/sow";
import { requireSow } from "@/lib/sow/write";
import { generateShareToken } from "@/lib/share-token";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

const toView = (share) => ({
  id: share.id,
  token: share.token,
  expiresAt: share.expiresAt,
  expired: Boolean(share.expiresAt && share.expiresAt.getTime() <= Date.now()),
  createdAt: share.createdAt,
  createdBy: share.createdByEmail,
});

export const GET = withRoute("sows.shares.list", async (_request, { params }) => {
  await requireAdmin();
  const { sowId } = await params;
  await requireSow(sowId);
  const shares = await prisma.sowShare.findMany({ where: { sowId }, orderBy: { createdAt: "desc" } });
  return Response.json(shares.map(toView));
});

export const POST = withRoute("sows.shares.create", async (request, { params }) => {
  const user = await requireAdmin();
  const { sowId } = await params;
  await requireSow(sowId);
  const { expiresInDays } = await parseJsonBody(request, sowShareCreateSchema);
  const share = await prisma.sowShare.create({
    data: {
      sowId,
      token: generateShareToken(),
      createdById: user.id,
      createdByEmail: user.email,
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * DAY_MS) : null,
    },
  });
  return Response.json(toView(share), { status: 201 });
});
