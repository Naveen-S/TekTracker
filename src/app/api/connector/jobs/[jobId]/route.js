/**
 * /api/connector/jobs/[jobId] — POST (connector Bearer auth): one event about a RUNNING job the
 * caller's connector claimed (claude-connector-analysis.md §Scope c).
 *   progress → the live status line the dialog polls
 *   error    → the job FAILED (shown only to its requester)
 *   result   → zod gate + sanitize, then upsert the latest-only `IssueAnalysis` and mark SUCCEEDED
 * An Ask StoryBoard job (kind ASK, ask-storyboard.md as-built 13–14) is different: its result
 * is one answer round, validated against Ask's own contract and parked on the job for the waiting
 * `/api/ask` request — never an `IssueAnalysis`. Its prompt (which carries the question) is wiped
 * the moment the job finishes, either way; the waiting request deletes the row as it reads it.
 * Jobs of other users are invisible (404); a job that is no longer RUNNING (stale-failed, already
 * finished) answers 409 so a late connector cannot overwrite a newer outcome.
 */
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/rbac";
import { withRoute, parseJsonBody, ConflictError, ValidationError } from "@/lib/api/route-helpers";
import { requireConnector } from "@/lib/connector/token";
import { analysisResultSchema, connectorEventSchema } from "@/lib/schemas/analysis";
import { sanitizeAnalysis } from "@/lib/ai/issue-analysis.mjs";
import { ASK_DEEP_JOB, ASK_KINDS } from "@/lib/connector/jobs";
import { askAnswerContract, askRoundOneContract, clampAskReply } from "@/lib/schemas/ask";

export const dynamic = "force-dynamic";

export const POST = withRoute("connector.jobs.event", async (request, { params }) => {
  const { userId } = await requireConnector(request);
  const { jobId } = await params;
  const event = await parseJsonBody(request, connectorEventSchema);

  const job = await prisma.analysisJob.findFirst({ where: { id: jobId, requestedById: userId } });
  if (!job) {
    throw new NotFoundError("Job not found");
  }
  if (job.status !== "RUNNING") {
    throw new ConflictError("This job is no longer running", { status: job.status });
  }

  if (event.type === "progress") {
    await prisma.analysisJob.update({ where: { id: job.id }, data: { progressNote: event.note } });
    return Response.json({ ok: true });
  }

  const isAsk = ASK_KINDS.includes(job.kind);
  // What an Ask job keeps once it finishes: the round bookkeeping and the packs it was answered
  // from (to sanitize the answer) — never the prompt, which carries the question.
  const askRemains = isAsk
    ? {
        round: job.context?.round ?? 1,
        needs: job.context?.needs ?? [],
        packs: job.context?.packs ?? [],
        asOf: job.context?.asOf ?? null,
        // A DeepContext round keeps StoryBoard's own answer to fall back on if it fails.
        ...(job.context?.fallbackAnswer ? { fallbackAnswer: job.context.fallbackAnswer } : {}),
      }
    : null;

  if (event.type === "error") {
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: event.message,
        finishedAt: new Date(),
        ...(isAsk ? { context: askRemains } : {}),
      },
    });
    return Response.json({ ok: true });
  }

  if (isAsk) {
    const contract =
      job.kind === ASK_DEEP_JOB.kind || askRemains.round === 2 ? askAnswerContract : askRoundOneContract;
    const reply = contract.zod.safeParse(clampAskReply(event.result));
    if (!reply.success) {
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: "Claude returned an answer StoryBoard could not read",
          finishedAt: new Date(),
          context: askRemains,
        },
      });
      throw new ValidationError("Answer does not match the expected shape", {
        issues: reply.error.issues.slice(0, 5).map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        progressNote: null,
        finishedAt: new Date(),
        context: {
          ...askRemains,
          reply: reply.data,
          costUsd: event.costUsd ?? null,
          durationMs: event.durationMs ?? null,
        },
      },
    });
    return Response.json({ ok: true });
  }

  const parsed = analysisResultSchema.safeParse(event.result);
  if (!parsed.success) {
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: "Claude returned a result StoryBoard could not read — try again",
        finishedAt: new Date(),
      },
    });
    throw new ValidationError("Analysis result does not match the expected shape", {
      issues: parsed.error.issues.slice(0, 5).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const result = sanitizeAnalysis(parsed.data, job.kind);
  const analysis = {
    source: job.source,
    kind: job.kind,
    result,
    model: job.model,
    costUsd: event.costUsd ?? null,
    durationMs: event.durationMs ?? null,
    analyzedById: userId,
    analyzedAt: new Date(),
  };
  await prisma.$transaction([
    prisma.issueAnalysis.upsert({
      where: { jiraKey: job.jiraKey },
      update: analysis,
      create: { jiraKey: job.jiraKey, ...analysis },
    }),
    prisma.analysisJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", progressNote: null, finishedAt: new Date() },
    }),
  ]);
  return Response.json({ ok: true });
});
