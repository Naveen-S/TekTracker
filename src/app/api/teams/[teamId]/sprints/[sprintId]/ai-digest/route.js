/**
 * POST /api/teams/[teamId]/sprints/[sprintId]/ai-digest — generate the on-demand AI sprint
 * digest (ai-insights.md (c)). Any team member incl. VIEWER (decision 5 — the read-side personas
 * are the audience); no request body (the server derives everything). Metrics/trend are computed
 * at request time exactly as the dashboard does, so the digest matches what the board shows.
 *
 * AI errors map here (not in the shared helper — the step-5 Jira precedent):
 * not configured → 503 (dormant state) · provider failure/timeout/refusal/bad JSON → 502 ·
 * misconfiguration (unknown provider, missing key) falls through → 500 loud.
 */
import { requireTeamRole, TEAM_ALL_ROLES, NotFoundError } from "@/lib/rbac";
import { handleRouteError } from "@/lib/api/route-helpers";
import { getDigestData } from "@/lib/dashboard-data";
import {
  buildTrendSeries,
  computeSprintMetrics,
  getWeeklyVelocity,
  snapshotVelocity,
} from "@/lib/metrics.mjs";
import { buildDigestInput, buildDigestPrompt, sanitizeDigest } from "@/lib/ai/digest.mjs";
import { digestContract } from "@/lib/schemas/ai";
import { generateJson, getAiConfig } from "@/lib/ai/provider";
import { AiNotConfiguredError, AiProviderError } from "@/lib/ai/errors";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  try {
    const { teamId, sprintId } = await params;
    await requireTeamRole(teamId, TEAM_ALL_ROLES);

    const data = await getDigestData(teamId, sprintId);
    if (!data) throw new NotFoundError("Sprint not found");
    const { team, sprint, filters, progressByKey, snapshots } = data;

    const asOf = new Date();
    const metrics = computeSprintMetrics(filters, progressByKey, sprint);
    if (metrics.totalIssues === 0) {
      return Response.json(
        { error: "Nothing to summarize yet — add filters and sync Jira first" },
        { status: 400 },
      );
    }
    const series = buildTrendSeries(snapshots, sprint, asOf);
    // Same velocity the MetricGrid card shows: snapshot-based when ≥ 2 snapshots, naive fallback.
    const velocity =
      snapshotVelocity(series.points, sprint, asOf) ??
      getWeeklyVelocity(sprint, metrics.velocityCompletedPoints, metrics.velocityPoints);

    const input = buildDigestInput({ team, sprint, metrics, series, velocity, asOf });
    const { system, prompt } = buildDigestPrompt(input);
    // Bumped from the generateJson default (2048) — risk-comments-rollup-digest.md live smoke
    // found "thinking" models (e.g. gemini-3.5-flash) spend part of maxOutputTokens on invisible
    // reasoning before the visible answer; 2048 truncated mid-JSON (finishReason: MAX_TOKENS) on
    // a real sprint fixture even for a single team. 4096 completes reliably.
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
