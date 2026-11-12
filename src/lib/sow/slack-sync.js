/**
 * Slack sync for a SOW (sow-tracker.md rounds 2 and 4). StoryBoard holds no Slack credential: an
 * admin's own Claude Connector reads each channel (job kind SLACK_SYNC, read-only Slack tools)
 * and posts back a structured result, which is validated and written here.
 *
 * One "Sync Slack" is a BATCH of steps, one channel each: the pre-QA issues channel first, then
 * every docs-and-decisions channel. The steps run one after another — finishing a step queues the
 * next — because the connector runs one job at a time and a queued job that waits more than a
 * minute is failed as abandoned. A failed step is recorded on its channel and the batch moves on.
 *
 * - Queued only for the requesting admin's connector, and only when it can run it (paired,
 *   online, new enough, idle) — otherwise a 409 that says what to fix.
 * - Issue posts are upserted by (sowId, ts); feed items by a stable key. Admin overrides and
 *   hidden flags are never touched by a sync.
 * - Message text is DATA. It reaches Claude with no tools but the Slack reads, and comes back
 *   through a zod gate, so the worst a hostile message can do is produce a wrong row.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/log";
import { isConnectorOnline } from "@/lib/connector/token";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { failStaleJobs, SLACK_SYNC_JOB } from "@/lib/connector/jobs";
import { versionAtLeast } from "@/lib/ask/connector";
import { feedSyncResultSchema, slackSyncResultSchema } from "@/lib/schemas/sow";
import {
  FEED_SYNC_JSON_SCHEMA,
  FEED_SYNC_SYSTEM,
  SLACK_SYNC_JSON_SCHEMA,
  SLACK_SYNC_SYSTEM,
  buildFeedSyncPrompt,
  buildSlackSyncPrompt,
  feedItemKeys,
  mergeFiles,
  readFeedChannels,
} from "@/lib/sow/slack.mjs";

/** The first connector release that knows the Slack tool ceiling. */
/** 1.2.1 waits for the Slack connection before reading (1.2.0 often read nothing). */
export const SLACK_MIN_CONNECTOR_VERSION = "1.2.1";
/** A re-sync re-reads this far back, to pick up new reactions, replies and late decisions. */
const LOOKBACK_DAYS = 14;
/**
 * A docs-and-decisions channel is re-read in FULL this often. Each run finds a different subset of
 * a long channel's decisions (22, 30 and 19 for the same history), and items are only ever added,
 * so a periodic full read lets coverage catch up.
 */
const FULL_READ_EVERY_DAYS = 7;
const DAY_MS = 86_400_000;

const sowJobs = (sowId) => ({ kind: SLACK_SYNC_JOB.kind, context: { path: ["sowId"], equals: sowId } });
const purposeOf = (job) => job.context?.purpose ?? "ISSUES";

/** Unix-seconds cut-off for a re-read: last sync minus the lookback, or null for a first read. */
const oldestFor = (lastSyncedAt) =>
  lastSyncedAt ? String(Math.floor((new Date(lastSyncedAt).getTime() - LOOKBACK_DAYS * DAY_MS) / 1000)) : null;

/** Why this admin's connector can't run a sync right now, or null when it can. */
async function connectorBlocker(userId, settings) {
  if (!settings.enabled) return "Claude analysis is switched off — an admin can turn it on in Admin → Claude analysis.";
  const connector = await prisma.connectorToken.findUnique({ where: { userId } });
  if (!connector) return "Pair a StoryBoard Connector first (Claude Code in the sidebar). It reads Slack with your own Claude.";
  if (!isConnectorOnline(connector)) return "Your StoryBoard Connector is offline — start it, then sync again.";
  if (!versionAtLeast(connector.connectorVersion, SLACK_MIN_CONNECTOR_VERSION)) {
    return `Update your StoryBoard Connector to ${SLACK_MIN_CONNECTOR_VERSION} or later (Claude Code in the sidebar) — older versions cannot read Slack.`;
  }
  const busy = await prisma.analysisJob.findFirst({ where: { requestedById: userId, status: "RUNNING" }, select: { id: true } });
  return busy ? "Your Claude is busy with another job — sync again when it finishes." : null;
}

/** The prompt, system text and schema for one step, built from the SOW as it is now. */
async function stepContext(sow, step) {
  if (step.purpose === "FEED") {
    const channel = readFeedChannels(sow.feedChannels).find((entry) => entry.id === step.channelId);
    const fullReadDue = !channel?.lastFullReadAt || Date.now() - new Date(channel.lastFullReadAt).getTime() > FULL_READ_EVERY_DAYS * DAY_MS;
    return {
      full: fullReadDue,
      prompt: buildFeedSyncPrompt({ channelId: step.channelId, oldest: fullReadDue ? null : oldestFor(channel?.lastSyncedAt) }),
      system: FEED_SYNC_SYSTEM,
      jsonSchema: FEED_SYNC_JSON_SCHEMA,
    };
  }
  // Screenshots already described are not read again, so a re-sync does not pay for them twice.
  const held = await prisma.sowSlackIssue.findMany({
    where: { sowId: sow.id },
    select: { files: true, suggestedIssue: true, sessionId: true, overrideStatus: true },
  });
  const filesOf = (row) => (Array.isArray(row.files) ? row.files : []);
  const describedFileIds = held.flatMap(filesOf).filter((file) => file?.description).map((file) => file.id);
  const pendingFileIds = held
    .filter((row) => row.overrideStatus !== "NOT_ISSUE" && (row.suggestedIssue || row.sessionId))
    .flatMap(filesOf)
    .filter((file) => file?.kind === "IMAGE" && !file.description)
    .map((file) => file.id);
  return {
    prompt: buildSlackSyncPrompt({ channelId: step.channelId, oldest: oldestFor(sow.slackLastSyncedAt), describedFileIds, pendingFileIds }),
    system: SLACK_SYNC_SYSTEM,
    jsonSchema: SLACK_SYNC_JSON_SCHEMA,
  };
}

/** Create the job for step `index` of a batch. */
async function createStep({ sow, steps, index, batchId, requestedById, attempt = 1 }) {
  const step = steps[index];
  return prisma.analysisJob.create({
    data: {
      jiraKey: SLACK_SYNC_JOB.jiraKey,
      source: SLACK_SYNC_JOB.source,
      kind: SLACK_SYNC_JOB.kind,
      requestedById,
      model: SLACK_SYNC_JOB.model,
      // Finding every decision in a long discussion channel needs more care than tagging issue
      // posts: medium effort found 30 where low found 22 (#configurator-ai, 126 messages).
      effort: step.purpose === "FEED" ? "medium" : SLACK_SYNC_JOB.effort,
      context: {
        sowId: sow.id,
        batchId,
        steps,
        index,
        attempt,
        purpose: step.purpose,
        channelId: step.channelId,
        ...(await stepContext(sow, step)),
      },
    },
  });
}

/** Queue a Slack sync batch for `sowId` on the caller's connector. */
export async function queueSlackSync(sowId, user) {
  const sow = await prisma.sow.findUnique({ where: { id: sowId } });
  if (!sow) throw new NotFoundError("SOW not found");
  const steps = [
    ...(sow.slackChannelId ? [{ purpose: "ISSUES", channelId: sow.slackChannelId }] : []),
    ...readFeedChannels(sow.feedChannels).map((channel) => ({ purpose: "FEED", channelId: channel.id })),
  ];
  if (steps.length === 0) throw new ValidationError("This SOW has no Slack channels — add them in Settings");

  const settings = await getAnalysisSettings();
  await failStaleJobs({ kind: SLACK_SYNC_JOB.kind }, SLACK_SYNC_JOB.timeoutMinutes);
  const active = await prisma.analysisJob.findFirst({ where: { ...sowJobs(sowId), status: { in: ["QUEUED", "RUNNING"] } }, select: { id: true } });
  if (active) throw new ConflictError("A Slack sync for this SOW is already running");
  const blocker = await connectorBlocker(user.id, settings);
  if (blocker) throw new ConflictError(blocker);

  const batchId = randomUUID();
  const job = await createStep({ sow, steps, index: 0, batchId, requestedById: user.id });
  return { jobId: job.id, batchId, steps: steps.length, status: job.status };
}

/**
 * After a step finishes, queue what comes next: the same step once more when its read came back
 * empty (`retry`), otherwise the batch's next step, if any. Never throws.
 */
export async function queueNextStep(job, { retry = false } = {}) {
  const { steps, index, batchId, sowId, attempt = 1 } = job.context ?? {};
  if (!Array.isArray(steps) || typeof index !== "number") return;
  const again = retry && attempt < 2;
  if (!again && index + 1 >= steps.length) return;
  try {
    const sow = await prisma.sow.findUnique({ where: { id: sowId } });
    if (!sow) return;
    await createStep({ sow, steps, index: again ? index : index + 1, batchId, requestedById: job.requestedById, attempt: again ? attempt + 1 : 1 });
  } catch (error) {
    logger.error("sow.slack_next_step_failed", { err: error, sowId });
  }
}

/** Display name of a step's channel, as far as StoryBoard knows it. */
function stepLabel(sow, step) {
  const name = step.purpose === "ISSUES" ? sow?.slackChannelName : readFeedChannels(sow?.feedChannels).find((entry) => entry.id === step.channelId)?.name;
  return `#${name ?? step.channelId}`;
}

/**
 * The latest batch of a SOW, for the page's progress line: RUNNING while any step is queued or
 * running; then SUCCEEDED when every step did, FAILED (with each failure named) otherwise.
 */
export async function getSlackSyncState(sowId) {
  await failStaleJobs({ kind: SLACK_SYNC_JOB.kind }, SLACK_SYNC_JOB.timeoutMinutes);
  const latest = await prisma.analysisJob.findFirst({ where: sowJobs(sowId), orderBy: { createdAt: "desc" } });
  if (!latest) return { status: "NONE" };
  const batchId = latest.context?.batchId;
  const jobs = batchId
    ? await prisma.analysisJob.findMany({ where: { ...sowJobs(sowId), context: { path: ["batchId"], equals: batchId } }, orderBy: { createdAt: "asc" } })
    : [latest];
  const sow = await prisma.sow.findUnique({ where: { id: sowId }, select: { slackChannelName: true, feedChannels: true } });
  const steps = latest.context?.steps ?? [{ purpose: purposeOf(latest), channelId: latest.context?.channelId }];
  const current = jobs.at(-1);
  const total = steps.length;

  const lastIndex = current.context?.index ?? 0;
  const willRetry = current.status === "FAILED" && /came back empty/.test(current.error ?? "") && (current.context?.attempt ?? 1) < 2;
  if (current.status === "QUEUED" || current.status === "RUNNING" || lastIndex + 1 < total || willRetry) {
    const step = steps[current.context?.index ?? 0] ?? steps[0];
    // A step that just finished hands over to the next within a moment; report it as running.
    return {
      status: "RUNNING",
      progressNote: `Reading ${stepLabel(sow, step)}${total > 1 ? ` (${lastIndex + 1} of ${total})` : ""}…`,
    };
  }
  // A retried step leaves its first, failed attempt behind; only each step's last attempt counts.
  const finalByStep = new Map(jobs.map((job) => [job.context?.index ?? 0, job]));
  const finals = [...finalByStep.values()];
  const failed = finals.filter((job) => job.status === "FAILED");
  const notes = finals.filter((job) => job.status === "SUCCEEDED").map((job) => job.progressNote).filter(Boolean);
  if (failed.length === 0) return { status: "SUCCEEDED", progressNote: notes.join(" · ") || "Slack read" };
  return {
    status: "FAILED",
    error: failed.map((job) => `${stepLabel(sow, steps[job.context?.index ?? 0] ?? steps[0])}: ${job.error ?? "failed"}`).join(" · "),
    progressNote: notes.join(" · ") || null,
  };
}

/**
 * The Slack connector sometimes fails to load at the start of a headless run; Claude then answers
 * without reading anything (seen twice: ~9 s, ~$0.01, an empty result). Such a read must never be
 * stamped as synced, and it is worth one automatic retry.
 */
const emptyRead = () => new ValidationError("The Slack read came back empty", { emptyRead: true });
export const isEmptyRead = (error) => Boolean(error?.details?.emptyRead);

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};

const cleanChannelName = (value) => {
  // The extraction sometimes answers the channel's ID, or "name (ID)", where its name was asked for.
  const named = (value ?? "").replace(/^#/, "").replace(/\s*\([CG][A-Z0-9]{6,14}\)\s*$/, "").trim().slice(0, 80);
  return named && !/^[CG][A-Z0-9]{6,14}$/.test(named) ? named : null;
};

const shapeError = (parsed, what) =>
  new ValidationError(`${what} does not match the expected shape`, {
    issues: parsed.error.issues.slice(0, 5).map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });

/** Issues step: validate, upsert posts, stamp the SOW. Returns a one-line note. */
async function applyIssues(job, rawResult) {
  const sowId = job.context?.sowId;
  const parsed = slackSyncResultSchema.safeParse(rawResult);
  if (!parsed.success) throw shapeError(parsed, "Slack sync result");
  const channelName = cleanChannelName(parsed.data.channelName);
  const sowName = (await prisma.sow.findUnique({ where: { id: sowId }, select: { slackChannelName: true } }))?.slackChannelName ?? null;
  const lastSyncedAt = new Date();
  const posts = parsed.data.posts.filter((post) => toDate(post.postedAt));
  // The extraction's "is this a defect?" call can waver between runs. Once a post has been flagged
  // it stays flagged, so a re-sync never silently drops an issue; an admin override removes it.
  const existing = await prisma.sowSlackIssue.findMany({ where: { sowId }, select: { ts: true, suggestedIssue: true, files: true } });
  const flagged = new Set(existing.filter((row) => row.suggestedIssue).map((row) => row.ts));
  const filesByTs = new Map(existing.map((row) => [row.ts, row.files]));
  // Every sync re-reads at least the last 14 days, so no posts at all means no read happened.
  if (posts.length === 0) throw emptyRead();
  await prisma.$transaction(
    async (tx) => {
      for (const post of posts) {
        const facts = {
          authorName: post.authorName,
          authorId: post.authorId ?? null,
          files: mergeFiles(filesByTs.get(post.ts), post.files),
          postedAt: toDate(post.postedAt),
          title: post.title,
          text: post.text,
          reactions: post.reactions,
          replyCount: post.replyCount,
          lastReplyAt: toDate(post.lastReplyAt),
          mentions: post.mentions,
          jiraKeys: post.jiraKeys,
          sessionId: post.sessionId ?? null,
          hasMedia: post.hasMedia,
          suggestedIssue: post.suggestedIssue || flagged.has(post.ts),
          lastSyncedAt,
        };
        await tx.sowSlackIssue.upsert({
          where: { sowId_ts: { sowId, ts: post.ts } },
          update: facts,
          create: { sowId, ts: post.ts, ...facts },
        });
      }
      await tx.sow.update({
        where: { id: sowId },
        data: { slackLastSyncedAt: lastSyncedAt, slackSyncError: null, ...(channelName && !sowName ? { slackChannelName: channelName } : {}) },
      });
    },
    { timeout: 60_000, maxWait: 20_000 },
  );
  logger.info("sow.slack_synced", { sowId, posts: posts.length });
  return `${channelName ? `#${channelName}` : "Issues channel"}: ${posts.length} posts`;
}

/** Write one feed channel's entry (name, sync stamp, error) back onto the SOW. */
async function updateFeedChannel(client, sowId, channelId, patch) {
  const sow = await client.sow.findUnique({ where: { id: sowId }, select: { feedChannels: true } });
  if (!sow) return;
  const channels = readFeedChannels(sow.feedChannels).map((entry) => (entry.id === channelId ? { ...entry, ...patch } : entry));
  await client.sow.update({ where: { id: sowId }, data: { feedChannels: channels } });
}

/**
 * Feed step: validate, then upsert decisions and documents by their stable key. Items are ONLY
 * ever added or refreshed, never removed by a sync: each run finds a different subset of a long
 * channel's decisions, so deleting what one run missed would throw real decisions away. A wrong
 * or stale item is corrected by an admin's Hide.
 */
async function applyFeed(job, rawResult) {
  const { sowId, channelId } = job.context ?? {};
  const parsed = feedSyncResultSchema.safeParse(rawResult);
  if (!parsed.success) throw shapeError(parsed, "Slack decisions result");
  const sow = await prisma.sow.findUnique({ where: { id: sowId }, select: { feedChannels: true } });
  const channel = readFeedChannels(sow?.feedChannels).find((entry) => entry.id === channelId);
  // Even a re-read covers 14 days plus the join notices, so zero messages means no read happened.
  if (parsed.data.messagesRead === 0) throw emptyRead();

  const channelName = cleanChannelName(parsed.data.channelName);
  const items = parsed.data.items.filter((item) => toDate(item.postedAt));
  const keys = feedItemKeys(channelId, items);
  const lastSyncedAt = new Date();

  await prisma.$transaction(
    async (tx) => {
      for (const [index, item] of items.entries()) {
        const facts = {
          channelId,
          kind: item.kind,
          ts: item.ts,
          postedAt: toDate(item.postedAt),
          authorName: item.authorName,
          title: item.title,
          summary: item.summary ?? null,
          url: item.url ?? null,
          lastSyncedAt,
        };
        await tx.sowFeedItem.upsert({
          where: { sowId_key: { sowId, key: keys[index] } },
          update: facts,
          create: { sowId, key: keys[index], ...facts },
        });
      }
      await updateFeedChannel(tx, sowId, channelId, {
        lastSyncedAt: lastSyncedAt.toISOString(),
        ...(job.context?.full ? { lastFullReadAt: lastSyncedAt.toISOString() } : {}),
        error: null,
        // A name already known wins: the extraction re-spells names (underscores became hyphens once).
        ...(channelName && !channel?.name ? { name: channelName } : {}),
      });
    },
    { timeout: 60_000, maxWait: 20_000 },
  );
  const decisions = items.filter((item) => item.kind === "DECISION").length;
  logger.info("sow.feed_synced", { sowId, channelId, decisions, docs: items.length - decisions });
  return `#${channel?.name ?? channelName ?? channelId}: ${decisions} decisions, ${items.length - decisions} docs`;
}

/** Apply a finished step. Throws ValidationError on a malformed result (the caller fails the job). */
export function applySlackSync(job, rawResult) {
  return purposeOf(job) === "FEED" ? applyFeed(job, rawResult) : applyIssues(job, rawResult);
}

/** Record a failed step on its channel so the page can say so. Never throws. */
export async function recordSlackSyncError(job, message) {
  const { sowId, channelId } = job.context ?? {};
  if (!sowId) return;
  const error = String(message).slice(0, 500);
  try {
    if (purposeOf(job) === "FEED") await updateFeedChannel(prisma, sowId, channelId, { error });
    else await prisma.sow.updateMany({ where: { id: sowId }, data: { slackSyncError: error } });
  } catch {
    // Recording the failure must not turn into a second failure.
  }
}
