/**
 * POST /api/rollup/ai-digest — generate the on-demand AI portfolio digest for `/rollup`
 * (risk-comments-rollup-digest.md decision 6, the ai-insights.md "roll-up digest" fast follow).
 * Flat route on purpose: the roll-up is MEMBERSHIP-derived, not team-scoped (ed-rollup.md
 * decision 2), so there is no `[teamId]` to nest under — the sprint travels in the request body
 * instead of the URL path (the same reasoning as the flat `DELETE /api/shares/[shareId]`).
 *
 * Access mirrors `/rollup` exactly: any authenticated user with ≥1 membership (admin sees all
 * teams) may generate a digest over their own portfolio — `requireUser()` then reuse
 * `getRollupData(user, { sprintId })`, same batched reads the page uses.
 *
 * Error mapping (step-5/ai-insights precedent, not the shared helper's job):
 * unauthenticated → 401 (handleRouteError) · zero memberships → 403 · sprintId doesn't resolve to
 * itself (getRollupData falls back to ACTIVE/latest on an unknown id — a digest call must not
 * silently digest the WRONG sprint) → 404 · nothing to summarize → 400 · AI not configured → 503 ·
 * provider failure/timeout/refusal/bad JSON → 502 · misconfiguration falls through → 500 loud.
 */
import { requireUser } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/rbac";
import { parseJsonBody, handleRouteError } from "@/lib/api/route-helpers";
import { digestContract, rollupDigestBodySchema } from "@/lib/schemas/ai";
import { getRollupData } from "@/lib/dashboard-data";
import { buildTrendSeries, getWeeklyVelocity, snapshotVelocity } from "@/lib/metrics.mjs";
import { buildRollupDigestInput, buildRollupDigestPrompt, sanitizeDigest } from "@/lib/ai/digest.mjs";
import { generateJson, getAiConfig } from "@/lib/ai/provider";
import { AiNotConfiguredError, AiProviderError } from "@/lib/ai/errors";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await requireUser();
    const { sprintId } = await parseJsonBody(request, rollupDigestBodySchema);

    const data = await getRollupData(user, { sprintId });
    if (data.teams.length === 0) {
      throw new ForbiddenError("You are not a member of any team");
    }
    if (!data.selectedSprint || data.selectedSprint.id !== sprintId) {
      throw new NotFoundError("Sprint not found");
    }
    if (!data.combined || data.combined.totalIssues === 0) {
      return Response.json(
        { error: "Nothing to summarize yet — no team in your portfolio has synced issues" },
        { status: 400 },
      );
    }

    const asOf = new Date();
    const { selectedSprint, perTeam, combined, combinedSnapshots } = data;
    const series = buildTrendSeries(combinedSnapshots, selectedSprint, asOf);
    // Same velocity the MetricGrid card shows on /rollup: snapshot-based when ≥ 2 snapshots,
    // naive fallback over the additive combined inputs otherwise (metrics.mjs aggregateRollup).
    const velocity =
      snapshotVelocity(series.points, selectedSprint, asOf) ??
      getWeeklyVelocity(selectedSprint, combined.velocityCompletedPoints, combined.velocityPoints);

    const input = buildRollupDigestInput({
      sprint: selectedSprint,
      perTeam,
      combined,
      series,
      velocity,
      asOf,
    });
    const { system, prompt } = buildRollupDigestPrompt(input);
    // Higher budget than the team digest's default (2048): the portfolio prompt asks the model to
    // compare every team by name, which runs longer, and "thinking" models (e.g. gemini-3.5-flash)
    // spend part of maxOutputTokens on invisible reasoning before the visible answer — verified
    // live that 2048 truncates mid-JSON (finishReason: MAX_TOKENS) on a 2-team fixture; 4096 completes.
    const digest = sanitizeDigest(
      await generateJson({ system, prompt, schema: digestContract, maxOutputTokens: 4096 }),
      input,
    );

    const { provider, model } = getAiConfig();
    return Response.json({ digest, generatedAt: asOf.toISOString(), provider, model });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof AiProviderError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return handleRouteError(error);
  }
}
