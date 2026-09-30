/**
 * /api/analyses/[jiraKey] — GET: everything the analysis dialog needs in one read
 * (claude-connector-analysis.md): the saved (latest-only) analysis, the job in flight — or the
 * caller's own most recent failed attempt, so the dialog can show why it failed — plus the admin
 * settings and the caller's connector status that decide whether "Run" is enabled.
 *
 * Gate: the caller must be able to see the ticket in either cache (404 otherwise, PROPOSED P2).
 */
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { NotFoundError } from "@/lib/rbac";
import { withRoute, ValidationError } from "@/lib/api/route-helpers";
import { jiraKeySchema } from "@/lib/schemas/analysis";
import { canViewTicket } from "@/lib/connector/access";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { isConnectorOnline } from "@/lib/connector/token";
import { failStaleJobs, findActiveJob } from "@/lib/connector/jobs";

export const dynamic = "force-dynamic";

function serializeJob(job) {
  return job
    ? {
        id: job.id,
        status: job.status,
        kind: job.kind,
        model: job.model,
        progressNote: job.progressNote,
        error: job.error,
        requestedBy: job.requestedBy?.displayName ?? null,
        createdAt: job.createdAt,
        finishedAt: job.finishedAt,
      }
    : null;
}

export const GET = withRoute("analyses.get", async (_request, { params }) => {
  const user = await requireUser();
  const parsed = jiraKeySchema.safeParse((await params).jiraKey);
  if (!parsed.success) {
    throw new ValidationError("Invalid Jira key");
  }
  const jiraKey = parsed.data;
  if (!(await canViewTicket(user, jiraKey))) {
    throw new NotFoundError("Ticket not found");
  }

  const settings = await getAnalysisSettings();
  await failStaleJobs({ jiraKey }, settings.timeoutMinutes);

  const [analysis, active, connector] = await Promise.all([
    prisma.issueAnalysis.findUnique({
      where: { jiraKey },
      include: { analyzedBy: { select: { displayName: true } } },
    }),
    findActiveJob(jiraKey),
    prisma.connectorToken.findUnique({ where: { userId: user.id } }),
  ]);

  // No job in flight: surface the caller's own latest attempt if it failed after the saved result.
  let job = active;
  if (!job) {
    const mine = await prisma.analysisJob.findFirst({
      where: { jiraKey, requestedById: user.id },
      orderBy: { createdAt: "desc" },
      include: { requestedBy: { select: { displayName: true } } },
    });
    if (mine?.status === "FAILED" && (!analysis || mine.createdAt > analysis.analyzedAt)) job = mine;
  }

  return Response.json({
    jiraKey,
    analysis: analysis
      ? {
          kind: analysis.kind,
          source: analysis.source,
          result: analysis.result,
          model: analysis.model,
          costUsd: analysis.costUsd,
          durationMs: analysis.durationMs,
          analyzedBy: analysis.analyzedBy?.displayName ?? null,
          analyzedAt: analysis.analyzedAt,
        }
      : null,
    job: serializeJob(job),
    settings: {
      enabled: settings.enabled,
      allowedModels: settings.allowedModels,
      defaultModel: settings.defaultModel,
    },
    connector: { paired: Boolean(connector), online: isConnectorOnline(connector) },
  });
});
