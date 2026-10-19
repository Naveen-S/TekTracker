/**
 * /api/analyses — POST: queue a Claude analysis of one ticket (claude-connector-analysis.md).
 *
 * The job is run by the REQUESTER's own local connector (it spends their Claude subscription), so
 * the request is refused up front when that connector is offline (decision 10 — no hidden queue).
 * The ticket context is built server-side from the cache the button lives on; the client sends only
 * the key, which cache, and an optional model from the admin-allowed list.
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withRoute, parseJsonBody, ValidationError } from "@/lib/api/route-helpers";
import { analysisCreateSchema } from "@/lib/schemas/analysis";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { resolveVisibleTicket } from "@/lib/connector/access";
import { isConnectorOnline } from "@/lib/connector/token";
import { failStaleJobs, findActiveJob } from "@/lib/connector/jobs";
import {
  AnalysisDisabledError,
  AnalysisInProgressError,
  ConnectorOfflineError,
} from "@/lib/connector/errors";

export const dynamic = "force-dynamic";

export const POST = withRoute("analyses", async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, analysisCreateSchema);

  const settings = await getAnalysisSettings();
  if (!settings.enabled) {
    throw new AnalysisDisabledError();
  }
  const model = input.model ?? settings.defaultModel;
  if (!settings.allowedModels.includes(model)) {
    throw new ValidationError("That model is not allowed", { allowedModels: settings.allowedModels });
  }

  const ticket = await resolveVisibleTicket(user, input.jiraKey, input.source);

  const connector = await prisma.connectorToken.findUnique({ where: { userId: user.id } });
  if (!isConnectorOnline(connector)) {
    throw new ConnectorOfflineError(
      connector
        ? "Your StoryBoard Connector is offline — start it, then try again"
        : "Pair a StoryBoard Connector in Settings to run Claude analysis",
    );
  }

  await failStaleJobs({ jiraKey: input.jiraKey }, settings.timeoutMinutes);
  const active = await findActiveJob(input.jiraKey);
  if (active) {
    throw new AnalysisInProgressError(undefined, { requestedBy: active.requestedBy.displayName });
  }

  const job = await prisma.analysisJob.create({
    data: {
      jiraKey: input.jiraKey,
      source: ticket.source,
      kind: ticket.kind,
      requestedById: user.id,
      model,
      effort: settings.effort,
      context: ticket.context,
    },
    select: { id: true, status: true, kind: true, createdAt: true },
  });
  return Response.json({ job }, { status: 201 });
});
