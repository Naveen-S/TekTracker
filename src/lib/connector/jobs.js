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
import { ASK_DEEP_TOOLS } from "@/lib/ask/deep.mjs";

/**
 * Ask StoryBoard jobs (ask-storyboard.md as-built 13–14): a question round answered by the asker's
 * own connector first (the server AI provider only when it can't). Not about one ticket, so the
 * required `jiraKey` holds a sentinel no real key can equal (real keys always carry `-<digits>`).
 * Tool-less and small: Haiku at low effort, thinking off — measured at 7–8 s and ~$0.01 per round.
 * One minute is the run cap (the connector's minimum): past it, the provider answers instead.
 */
export const ASK_JOB = Object.freeze({
  kind: "ASK",
  jiraKey: "ASK",
  source: "ASK",
  model: "haiku",
  effort: "low",
  maxBudgetUsd: 0.5,
  timeoutMinutes: 1,
});

/**
 * The DeepContext round of an Ask question (ask-storyboard.md as-built 16): asked only when
 * StoryBoard's data couldn't answer. It has read-only ORBIT DeepContext tools, so it is slower:
 * measured 45–53 s and $0.14–0.20 on Haiku.
 */
export const ASK_DEEP_JOB = Object.freeze({
  ...ASK_JOB,
  kind: "ASK_DEEP",
  maxBudgetUsd: 1,
  timeoutMinutes: 3,
});

/** Both Ask kinds: a spoken question waits on them, so they jump ticket analyses in the queue. */
export const ASK_KINDS = [ASK_JOB.kind, ASK_DEEP_JOB.kind];

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
  if (ASK_KINDS.includes(job.kind)) {
    // The prompt was built server-side (lib/ask/orchestrate.js). An ASK round answers from it
    // alone — no tools at all; an ASK_DEEP round may also read DeepContext's Jira graph.
    const spec = job.kind === ASK_DEEP_JOB.kind ? ASK_DEEP_JOB : ASK_JOB;
    return {
      jobId: job.id,
      jiraKey: job.jiraKey,
      kind: job.kind,
      prompt: job.context.prompt,
      appendSystemPrompt: job.context.system,
      jsonSchema: job.context.jsonSchema,
      model: job.model,
      effort: job.effort,
      maxBudgetUsd: Math.min(spec.maxBudgetUsd, settings.maxBudgetUsd),
      timeoutMinutes: spec.timeoutMinutes,
      allowedTools: spec === ASK_DEEP_JOB ? ASK_DEEP_TOOLS : [],
    };
  }
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
