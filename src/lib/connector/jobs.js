/**
 * The Claude analysis job queue (claude-connector-analysis.md, PROPOSED P5).
 *
 * `AnalysisJob` is transient: QUEUED → RUNNING (claimed by the requester's own connector) →
 * SUCCEEDED | FAILED. There is no worker process — stale jobs are failed LAZILY whenever the queue
 * is read, and old rows are pruned by the daily cron.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";
import { ANALYSIS_JSON_SCHEMA } from "@/lib/schemas/analysis";
import {
  ANALYSIS_ALLOWED_TOOLS,
  ISSUE_ANALYSIS_SYSTEM_APPEND,
  buildIssueAnalysisPrompt,
} from "@/lib/ai/issue-analysis.mjs";

/** A queued job the connector never claimed within this window is failed (connector went away). */
const QUEUE_GRACE_MS = 60_000;
/** Slack on top of the admin timeout before a RUNNING job is declared dead (connector kills first). */
const RUN_GRACE_MS = 120_000;

/**
 * Fail jobs that can no longer complete: QUEUED past the claim grace, RUNNING past timeout + grace.
 * Scoped by `where` (a jiraKey or a requester) so a read only touches the rows it is about to show.
 *
 * @param {object} where extra AnalysisJob filter
 * @param {number} timeoutMinutes current admin timeout
 */
export async function failStaleJobs(where, timeoutMinutes) {
  const now = Date.now();
  const finishedAt = new Date(now);
  await prisma.analysisJob.updateMany({
    where: { ...where, status: "QUEUED", createdAt: { lt: new Date(now - QUEUE_GRACE_MS) } },
    data: {
      status: "FAILED",
      error: "Your connector did not pick this up — is it still running?",
      finishedAt,
    },
  });
  await prisma.analysisJob.updateMany({
    where: {
      ...where,
      status: "RUNNING",
      claimedAt: { lt: new Date(now - timeoutMinutes * 60_000 - RUN_GRACE_MS) },
    },
    data: { status: "FAILED", error: `Timed out after ${timeoutMinutes} minutes`, finishedAt },
  });
}

/** The job (if any) currently QUEUED or RUNNING for a ticket. */
export function findActiveJob(jiraKey) {
  return prisma.analysisJob.findFirst({
    where: { jiraKey, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
    include: { requestedBy: { select: { displayName: true } } },
  });
}

/**
 * Everything the connector needs to run one job — composed server-side so the connector stays a
 * dumb runner (it still enforces its own local ceiling on tools/timeout).
 *
 * @param {{ id: string, jiraKey: string, kind: string, model: string, effort: string, context: object }} job
 * @param {{ maxBudgetUsd: number, timeoutMinutes: number }} settings
 */
export function buildJobPayload(job, settings) {
  return {
    jobId: job.id,
    jiraKey: job.jiraKey,
    kind: job.kind,
    prompt: buildIssueAnalysisPrompt(job.context, job.kind),
    appendSystemPrompt: ISSUE_ANALYSIS_SYSTEM_APPEND,
    jsonSchema: ANALYSIS_JSON_SCHEMA,
    model: job.model,
    effort: job.effort,
    maxBudgetUsd: settings.maxBudgetUsd,
    timeoutMinutes: settings.timeoutMinutes,
    allowedTools: ANALYSIS_ALLOWED_TOOLS,
  };
}

/**
 * Delete finished-or-abandoned jobs older than `days` (daily cron). Never throws — a prune failure
 * must not fail the cron run (the pruneErrorLog precedent).
 * @returns {Promise<number>}
 */
export async function pruneAnalysisJobs(days = 7) {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const { count } = await prisma.analysisJob.deleteMany({ where: { createdAt: { lt: cutoff } } });
    return count;
  } catch (error) {
    logger.warn("analysis_jobs.prune_failed", { err: error });
    return 0;
  }
}
