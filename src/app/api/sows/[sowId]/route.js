/**
 * /api/sows/[sowId] — PATCH: settings, classification rules and weights; DELETE: remove the SOW
 * with its plan, risks, mirror and share links (sow-tracker.md (e)). Global admins only.
 * Classification is read-time, so a rule or weight edit re-renders with no Jira refresh.
 */
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { sowPatchSchema } from "@/lib/schemas/sow";
import { requireSow, updateSow } from "@/lib/sow/write";

export const dynamic = "force-dynamic";

export const PATCH = withRoute("sows.patch", async (request, { params }) => {
  await requireAdmin();
  const { sowId } = await params;
  const patch = await parseJsonBody(request, sowPatchSchema);
  const sow = await updateSow(sowId, patch);
  return Response.json({ id: sow.id, slug: sow.slug, name: sow.name });
});

export const DELETE = withRoute("sows.delete", async (_request, { params }) => {
  await requireAdmin();
  const { sowId } = await params;
  await requireSow(sowId);
  await prisma.sow.delete({ where: { id: sowId } });
  return Response.json({ ok: true });
});
