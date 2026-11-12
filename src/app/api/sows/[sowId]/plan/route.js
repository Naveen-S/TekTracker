/**
 * PUT /api/sows/[sowId]/plan — replace the SOW's whole plan: phases with their plan items
 * (sow-tracker.md (e)). One list, one transaction (the support-oncall PUT precedent), so phase
 * order, unique names and date order are checks over a single validated body. Global admins only.
 */
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { sowPlanSchema } from "@/lib/schemas/sow";
import { replacePlan } from "@/lib/sow/write";

export const dynamic = "force-dynamic";

export const PUT = withRoute("sows.plan.put", async (request, { params }) => {
  await requireAdmin();
  const { sowId } = await params;
  const { phases } = await parseJsonBody(request, sowPlanSchema);
  await replacePlan(sowId, phases);
  return Response.json({ ok: true, phases: phases.length });
});
