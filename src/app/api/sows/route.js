/**
 * /api/sows — POST: create a SOW (sow-tracker.md (e), decision 9). Global admins only (decision 2).
 * The plan is laid out from the standard template, or copied from `duplicateOf` and rescaled onto
 * the new start → launch window. Nothing is fetched from Jira here; the first Refresh does that.
 */
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { sowCreateSchema } from "@/lib/schemas/sow";
import { createSow } from "@/lib/sow/write";

export const dynamic = "force-dynamic";

export const POST = withRoute("sows.create", async (request) => {
  await requireAdmin();
  const input = await parseJsonBody(request, sowCreateSchema);
  const sow = await createSow(input);
  return Response.json({ id: sow.id, slug: sow.slug, name: sow.name }, { status: 201 });
});
