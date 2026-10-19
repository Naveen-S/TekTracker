/**
 * /api/analysis-settings — Claude analysis configuration (claude-connector-analysis.md decisions
 * 13–14). GET: any signed-in user (the dialog needs the allowed models); PUT: global admin only.
 * The singleton row is upserted, so an unseeded database can be configured straight from /admin.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/rbac";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { analysisSettingsSchema } from "@/lib/schemas/analysis";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { ANALYSIS_SETTINGS_ID } from "@/lib/connector/defaults.mjs";

export const dynamic = "force-dynamic";

export const GET = withRoute("analysis-settings", async () => {
  await requireUser();
  return Response.json(await getAnalysisSettings());
});

export const PUT = withRoute("analysis-settings", async (request) => {
  await requireAdmin();
  const input = await parseJsonBody(request, analysisSettingsSchema);
  const data = { ...input, allowedModels: [...new Set(input.allowedModels)] };
  await prisma.claudeAnalysisSettings.upsert({
    where: { id: ANALYSIS_SETTINGS_ID },
    update: data,
    create: { id: ANALYSIS_SETTINGS_ID, ...data },
  });
  return Response.json(await getAnalysisSettings());
});
