/**
 * Ask StoryBoard on the asker's own Claude Connector (ask-storyboard.md as-built 13–14).
 *
 * Routing (Naveen, 2026-10-05): the asker's StoryBoard Connector answers FIRST — their Claude Code,
 * from the exact prompt the provider would see, with no tools. The server AI provider (Gemini, the
 * API-key route) answers only when the connector can't: not paired, offline, too old, busy with a
 * ticket analysis, or it took the round and then failed. Only ever the asker's connector: it spends
 * their subscription.
 *
 * Transport is a short poll on the same route: `/api/ask` answers `{ pending }` and the client
 * re-POSTs with `resume: jobId`; each resume holds up to RESUME_HOLD_MS. No request is held for the
 * whole run, so no proxy read-timeout can cut an answer off.
 *
 * Ask stays ephemeral (decision 4): the job carries the prompt (and so the question) only while it
 * is pending; the connector event route wipes it on finish, a resume deletes the finished row, and
 * abandoned rows are deleted after ASK_JOB_TTL_MS.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";
import { NotFoundError } from "@/lib/rbac";
import { AiProviderError } from "@/lib/ai/errors";
import { ConnectorOfflineError } from "@/lib/connector/errors";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { isConnectorOnline } from "@/lib/connector/token";
import { ASK_DEEP_JOB, ASK_JOB, ASK_KINDS, failStaleJobs } from "@/lib/connector/jobs";

/** The first connector release that can run a tool-less Ask job. */
export const ASK_MIN_CONNECTOR_VERSION = "1.1.0";

const RESUME_HOLD_MS = 8_000;
const CHECK_MS = 750;
const ASK_JOB_TTL_MS = 10 * 60_000;
/** An online connector claims within ~2 s (it long-polls); past this, the round is given up on. */
const ASK_PICKUP_GRACE_MS = 15_000;
/** A claimed round past the connector's own kill timer + slack is dead. */
const runLimitMs = (kind) =>
  (kind === ASK_DEEP_JOB.kind ? ASK_DEEP_JOB : ASK_JOB).timeoutMinutes * 60_000 + 15_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** `"1.10.0" >= "1.9.2"` — numeric per part; a missing/garbled version is never new enough. */
export function versionAtLeast(version, minimum) {
  if (!version) return false;
  const parts = (value) => value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const have = parts(version);
  const need = parts(minimum);
  for (let index = 0; index < need.length; index += 1) {
    if ((have[index] ?? 0) !== need[index]) return (have[index] ?? 0) > need[index];
  }
  return true;
}

/**
 * Can the asker's connector take a round right now? When it can't, `hint` says why — it is added
 * to the provider's error only if the provider fails too. It stays null when the user never opted
 * into the connector, so nobody is nagged about a feature they don't use.
 *
 * `reason` names the cause, so a server with no AI provider can tell the user exactly what to fix
 * (`noEngineError`).
 *
 * @returns {Promise<{ available: true } | { available: false, hint: string | null,
 *   reason: "disabled" | "unpaired" | "offline" | "outdated" | "busy" }>}
 */
export async function checkConnector(userId) {
  const settings = await getAnalysisSettings();
  if (!settings.enabled) return { available: false, hint: null, reason: "disabled" };
  const connector = await prisma.connectorToken.findUnique({ where: { userId } });
  if (!connector) return { available: false, hint: null, reason: "unpaired" };
  if (!isConnectorOnline(connector)) {
    return {
      available: false,
      hint: "Your StoryBoard Connector is offline, so your Claude couldn't answer.",
      reason: "offline",
    };
  }
  if (!versionAtLeast(connector.connectorVersion, ASK_MIN_CONNECTOR_VERSION)) {
    return {
      available: false,
      hint: "Update your StoryBoard Connector (Settings → Claude Connector) so your Claude can answer.",
      reason: "outdated",
    };
  }
  await failStaleJobs({ requestedById: userId }, settings.timeoutMinutes);
  // The connector runs one job at a time; a ticket analysis can hold it for minutes.
  const busy = await prisma.analysisJob.findFirst({
    where: { requestedById: userId, status: "RUNNING", kind: { notIn: ASK_KINDS } },
    select: { id: true },
  });
  if (busy) {
    return {
      available: false,
      hint: "Your Claude is busy with a ticket analysis, so it couldn't answer.",
      reason: "busy",
    };
  }
  return { available: true };
}

const NO_ENGINE_MESSAGES = {
  disabled: "Ask needs Claude analysis switched on by an admin, or an AI provider on the server.",
  unpaired: "Pair a StoryBoard Connector in Settings → Claude Connector to use Ask.",
  offline: "Start your StoryBoard Connector to use Ask — it answers with your Claude.",
  outdated: "Update your StoryBoard Connector (Settings → Claude Connector) to use Ask.",
  busy: "Your Claude is busy with a ticket analysis — ask again when it finishes.",
};

/**
 * The error for a question nobody can answer: the asker's connector can't take it and the server
 * has no AI provider to fall back on (ask-storyboard.md as-built 21). 409 with code
 * CONNECTOR_OFFLINE — something the user can fix, not a server fault.
 *
 * @param {string} reason a `checkConnector` reason
 */
export function noEngineError(reason) {
  return new ConnectorOfflineError(NO_ENGINE_MESSAGES[reason] ?? NO_ENGINE_MESSAGES.offline);
}

/** The provider's error, with why the connector couldn't answer either (when there's a reason). */
export function withConnectorHint(providerError, hint) {
  if (!hint) return providerError;
  return new AiProviderError(`${providerError.message} ${hint}`, {
    status: providerError.details?.providerStatus,
  });
}

/** The status line the panel shows while the connector works. */
function pendingNote({ kind, status, round, progressNote }) {
  if (kind === ASK_DEEP_JOB.kind) {
    // The connector streams what DeepContext is doing ("Querying the code knowledge graph…").
    if (status === "RUNNING" && progressNote && !progressNote.startsWith("Starting")) {
      return `Not in StoryBoard — ${progressNote.charAt(0).toLowerCase()}${progressNote.slice(1)}`;
    }
    return "Not in StoryBoard — searching Jira with DeepContext…";
  }
  if (round === 2) return "Your Claude is reading more StoryBoard data…";
  if (status === "RUNNING") return "Your Claude is answering…";
  return "Asking your Claude…";
}

/**
 * Queue one round on the asker's connector (call `checkConnector` first).
 *
 * @param {import("@/generated/prisma/client").User} user
 * `packs` (the data the prompt was built from) and `asOf` ride along so the answer can be sanitized
 * on resume without rebuilding them. They are data, never the question, but are deleted with the row.
 *
 * A DeepContext round (`kind: ASK_DEEP`) also carries `fallbackAnswer` — StoryBoard's own reply,
 * returned as-is if the deep round fails.
 *
 * @param {{ round: 1 | 2, needs?: object[], system: string, prompt: string, jsonSchema: object,
 *   packs: object[], asOf: string, kind?: string, fallbackAnswer?: object }} round
 * @returns {Promise<{ pending: { jobId: string, note: string } }>}
 */
export async function queueAskJob(user, round) {
  const spec = round.kind === ASK_DEEP_JOB.kind ? ASK_DEEP_JOB : ASK_JOB;
  await prisma.analysisJob.deleteMany({
    where: {
      requestedById: user.id,
      kind: { in: ASK_KINDS },
      createdAt: { lt: new Date(Date.now() - ASK_JOB_TTL_MS) },
    },
  });
  const job = await prisma.analysisJob.create({
    data: {
      jiraKey: spec.jiraKey,
      source: spec.source,
      kind: spec.kind,
      requestedById: user.id,
      model: spec.model,
      effort: spec.effort,
      context: {
        ...(round.fallbackAnswer ? { fallbackAnswer: round.fallbackAnswer } : {}),
        round: round.round,
        needs: round.needs ?? [],
        packs: round.packs,
        asOf: round.asOf,
        system: round.system,
        prompt: round.prompt,
        jsonSchema: round.jsonSchema,
      },
    },
    select: { id: true },
  });
  logger.info("ask.connector_queued", { kind: spec.kind, round: round.round });
  return {
    pending: { jobId: job.id, note: pendingNote({ kind: spec.kind, status: "QUEUED", round: round.round }) },
  };
}

/** Fail an Ask round the connector never picked up, or whose run outlived its kill timer. */
async function failStuckAskJob(job) {
  const now = Date.now();
  // The row (prompt included) is deleted by the resume reading it, moments later.
  const finished = { status: "FAILED", finishedAt: new Date(now) };
  const { count } = await prisma.analysisJob.updateMany({
    where: { id: job.id, status: "QUEUED", createdAt: { lt: new Date(now - ASK_PICKUP_GRACE_MS) } },
    data: { ...finished, error: "your connector didn't pick the question up" },
  });
  if (count > 0) return true;
  const stuck = await prisma.analysisJob.updateMany({
    where: { id: job.id, status: "RUNNING", claimedAt: { lt: new Date(now - runLimitMs(job.kind)) } },
    data: { ...finished, error: "your Claude took too long" },
  });
  return stuck.count > 0;
}

/**
 * Wait (≤ RESUME_HOLD_MS) for the asker's Ask job. A finished row is deleted as it is read; a
 * failed one is reported (not thrown) so the caller can let the provider answer that round.
 *
 * @returns {Promise<{ state: "pending", pending: { jobId: string, note: string } }
 *   | { state: "failed", kind: string, round: 1 | 2, needs: object[], packs: object[],
 *       asOf: string, fallbackAnswer?: object, error: string }
 *   | { state: "done", kind: string, round: 1 | 2, needs: object[], packs: object[], asOf: string,
 *       reply: object, model: string, costUsd: number | null }>}
 */
export async function awaitAskJob(userId, jobId) {
  const deadline = Date.now() + RESUME_HOLD_MS;
  for (;;) {
    let job = await prisma.analysisJob.findFirst({
      where: { id: jobId, requestedById: userId, kind: { in: ASK_KINDS } },
    });
    if (job && (job.status === "QUEUED" || job.status === "RUNNING") && (await failStuckAskJob(job))) {
      job = await prisma.analysisJob.findFirst({ where: { id: jobId } });
    }
    if (!job) {
      throw new NotFoundError("That question is no longer pending — ask it again");
    }
    const { round = 1, needs = [], packs = [], asOf, reply, fallbackAnswer, costUsd = null } =
      job.context ?? {};
    const base = { kind: job.kind, round, needs, packs, asOf };

    if (job.status === "SUCCEEDED" || job.status === "FAILED") {
      await prisma.analysisJob.deleteMany({ where: { id: job.id } });
      if (job.status === "FAILED" || !reply) {
        return { state: "failed", ...base, fallbackAnswer, error: job.error ?? "no answer came back" };
      }
      return { state: "done", ...base, reply, model: job.model, costUsd };
    }
    if (Date.now() + CHECK_MS >= deadline) {
      const note = pendingNote({ kind: job.kind, status: job.status, round, progressNote: job.progressNote });
      return { state: "pending", pending: { jobId: job.id, note } };
    }
    await sleep(CHECK_MS);
  }
}
