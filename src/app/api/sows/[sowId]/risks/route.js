/**
 * PUT /api/sows/[sowId]/risks — replace the SOW's whole risks / blockers / decisions list
 * (sow-tracker.md (e)). Global admins only.
 */
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { sowRisksSchema } from "@/lib/schemas/sow";
import { replaceRisks } from "@/lib/sow/write";

export const dynamic = "force-dynamic";

export const PUT = withRoute("sows.risks.put", async (request, { params }) => {
  await requireAdmin();
  const { sowId } = await params;
  const { risks } = await parseJsonBody(request, sowRisksSchema);
  await replaceRisks(sowId, risks);
  return Response.json({ ok: true, risks: risks.length });
});
