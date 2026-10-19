/**
 * Ask StoryBoard orchestration (ask-storyboard.md (b), P6): at most two model calls per question.
 *
 *   Round 1 — catalog + the page's default pack(s) + transcript → either an answer, or a request
 *             for up to three more packs (tool use expressed as a JSON contract, so it works the
 *             same on every provider with no adapter change).
 *   Round 2 — only when round 1 asked: every pack loaded so far → an answer, no more requests.
 *
 * The answer is sanitized against the packs actually sent (Jira keys, sources), so nothing the
 * model cites can point outside the data the viewer was shown.
 *
 * Routing (as-built 13–14): each round goes to the asker's own Claude Connector FIRST
 * (lib/ask/connector.js); the server provider (Gemini — the API-key route) answers it when the
 * connector can't, or when it took the round and failed. A connector round answers `{ pending }`
 * and the caller re-POSTs with `resume`; the resumed request rebuilds the same packs from the same
 * ids, so the connector's answer is sanitized exactly like the provider's.
 */
import { generateJson, getAiConfig, getAskModel, isAiConfigured } from "@/lib/ai/provider";
import { AiProviderError } from "@/lib/ai/errors";
import { isTtsConfigured } from "@/lib/tts/elevenlabs";
import { logger } from "@/lib/log";
import { askAnswerContract, askRoundOneContract, ASK_MAX_NEEDS, ASK_MAX_TURNS, ASK_MAX_TURN_CHARS } from "@/lib/schemas/ask";
import {
  ASK_SYSTEM_PROMPT_ROUND_ONE,
  ASK_SYSTEM_PROMPT_ROUND_TWO,
  buildAskPrompt,
  normalizeTranscript,
  sanitizeAnswer,
} from "@/lib/ask/prompt.mjs";
import { buildCatalog, createAskContext, defaultNeeds, loadPacks } from "@/lib/ask/packs";
import { awaitAskJob, checkConnector, noEngineError, queueAskJob, withConnectorHint } from "@/lib/ask/connector";
import { ConnectorOfflineError } from "@/lib/connector/errors";
import { ASK_DEEP_SYSTEM_PROMPT, DEEP_SOURCE, DEEP_SOURCE_LABEL, buildDeepPrompt, sanitizeDeepAnswer } from "@/lib/ask/deep.mjs";
import { buildDeepScope } from "@/lib/ask/deep-scope";
import { ASK_DEEP_JOB } from "@/lib/connector/jobs";

/** Per model call. Voice needs a quick answer or an honest failure, not the digest's 30s. */
const ASK_TIMEOUT_MS = 20_000;
// "Thinking" models spend part of the budget on invisible reasoning (the digest saw 2048
// truncate mid-JSON), and an answer is short, so 3072 leaves headroom without inviting essays.
const ASK_MAX_OUTPUT_TOKENS = 3072;

const ANSWER_KEYS = ["speech", "detail", "jiraKeys", "sources", "followUps", "grounded"];
const pickAnswer = (reply) => Object.fromEntries(ANSWER_KEYS.map((key) => [key, reply[key]]));

/** Everything a round's prompt is built from — rebuilt identically when a question resumes. */
async function prepareQuestion(user, { context, messages }) {
  const ctx = createAskContext(user);
  const { catalog, index } = await buildCatalog(ctx);
  // The sprint on screen is "the default" the user means — not necessarily the ACTIVE Gate.
  const pageSprint = index.sprints.find((sprint) => sprint.id === context.sprintId);
  if (pageSprint) catalog.defaultSprint = pageSprint.name;
  const ids = {
    teamId: context.teamId,
    sprintId: context.sprintId,
    programId: context.programId,
    bugReportSlug: context.bugReportSlug,
    bugScopeId: context.bugScopeId,
  };
  const loaded = new Set();
  const packs = await loadPacks(ctx, index, defaultNeeds(context), { ids, loaded });
  const { history, question } = normalizeTranscript(messages, {
    maxTurns: ASK_MAX_TURNS,
    maxChars: ASK_MAX_TURN_CHARS,
  });
  return {
    ctx,
    index,
    catalog,
    packs,
    loaded,
    history,
    question,
    context,
    turns: messages.length,
    today: ctx.asOf.toISOString().slice(0, 10),
    viewer: { name: user.displayName, isAdmin: user.isAdmin, askedFrom: context.page },
  };
}

/** Load the packs round 1 asked for. They inherit only the page's SPRINT (an empty sprint means the
 * one the user is looking at); team/program/report stay whatever the model named, never the page's. */
async function addNeeds(state, needs) {
  const more = await loadPacks(state.ctx, state.index, needs, {
    ids: { sprintId: state.context.sprintId },
    loaded: state.loaded,
  });
  state.packs.push(...more);
}

/** One round's request, shared by the provider call and the connector hand-off. */
function roundRequest(state, round) {
  const { today, viewer, catalog, packs, history, question } = state;
  const contract = round === 1 ? askRoundOneContract : askAnswerContract;
  return {
    system: round === 1 ? ASK_SYSTEM_PROMPT_ROUND_ONE : ASK_SYSTEM_PROMPT_ROUND_TWO,
    prompt: buildAskPrompt({ today, viewer, catalog, packs, history, question }),
    contract,
  };
}

/**
 * Run one round: on the asker's connector when it can take it (→ `{ pending }`), otherwise on the
 * provider (→ `{ reply }`). `connector: false` skips the connector — used once it has failed this
 * question, so a broken connector is not retried in a loop. With NO provider configured (as-built
 * 21) the connector is the only engine: if it can't take the round, the user is told what to fix.
 */
async function runRound(user, state, round, { needs = [], connector = true }) {
  const { system, prompt, contract } = roundRequest(state, round);
  let check = null;
  if (connector) {
    check = await checkConnector(user.id);
    if (check.available) {
      return {
        pending: await queueAskJob(user, {
          round,
          needs,
          system,
          prompt,
          jsonSchema: contract.json,
          packs: state.packs,
          asOf: state.ctx.asOf.toISOString(),
        }),
      };
    }
  }
  if (!isAiConfigured()) throw noEngineError(check?.reason ?? "offline");
  try {
    return {
      reply: await generateJson({
        system,
        prompt,
        schema: contract,
        maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
        model: getAskModel(),
        timeoutMs: ASK_TIMEOUT_MS,
      }),
    };
  } catch (error) {
    throw error instanceof AiProviderError ? withConnectorHint(error, check?.hint ?? null) : error;
  }
}

/**
 * Rounds `from`.. through to an answer, each routed by `runRound` (round 1 may ask for more packs).
 * A `reply` only ever comes from the provider, so the provider's name and model are read only then.
 */
async function answerRounds(user, state, from, { needs, connector = true, started }) {
  const providerMeta = () => ({ provider: getAiConfig().provider, model: getAskModel(), started });
  if (from === 1) {
    const one = await runRound(user, state, 1, { connector });
    if (one.pending) return one.pending;
    if (one.reply.type !== "need") {
      return settle(user, state, pickAnswer(one.reply), { ...providerMeta(), rounds: 1 }, { connector });
    }
    needs = one.reply.need.slice(0, ASK_MAX_NEEDS);
    await addNeeds(state, needs);
  }
  const two = await runRound(user, state, 2, { needs, connector });
  if (two.pending) return two.pending;
  return settle(user, state, two.reply, { ...providerMeta(), rounds: 2 }, { connector });
}

/**
 * The last step for an answer from StoryBoard's own data: return it — or, when it isn't grounded
 * and nothing was denied, hand the question to the asker's connector for a DeepContext round.
 */
async function settle(user, state, answer, meta, { connector = true } = {}) {
  const clean = sanitizeAnswer(answer, state.packs);
  // A denial (a team or the leaderboard the viewer can't see) is never routed around.
  const denied = state.packs.some((entry) => entry.data?.denied);
  if (!clean.grounded && !denied && connector && (await checkConnector(user.id)).available) {
    const scope = await buildDeepScope(state.ctx, state.context);
    const { today, viewer, history, question } = state;
    return queueAskJob(user, {
      kind: ASK_DEEP_JOB.kind,
      round: 1,
      system: ASK_DEEP_SYSTEM_PROMPT,
      prompt: buildDeepPrompt({ today, viewer, scope, history, question }),
      jsonSchema: askAnswerContract.json,
      packs: state.packs,
      asOf: state.ctx.asOf.toISOString(),
      fallbackAnswer: { answer: clean, rounds: meta.rounds, provider: meta.provider, model: meta.model },
    });
  }
  return finish(state, clean, meta);
}

function finish(state, answer, { rounds, provider, model, started, costUsd = null }, { deep = false } = {}) {
  const { packs, context, question, turns, ctx } = state;
  const clean = deep ? sanitizeDeepAnswer(answer) : sanitizeAnswer(answer, packs);
  const packsUsed = deep
    ? [{ pack: DEEP_SOURCE, label: DEEP_SOURCE_LABEL, available: true }]
    : packs.map(({ pack, label, data }) => ({ pack, label, available: !data?.unavailable }));
  // P5: what was asked is never logged — only its shape and cost.
  logger.info("ask.answered", {
    page: context.page,
    rounds,
    packs: packsUsed.map((entry) => `${entry.pack}${entry.available ? "" : "(unavailable)"}`),
    grounded: clean.grounded,
    questionChars: question.length,
    turns,
    durationMs: Date.now() - started,
    provider,
    model,
    deep,
    ...(costUsd !== null ? { costUsd } : {}),
  });
  return {
    answer: clean,
    packsUsed,
    rounds,
    provider,
    model,
    generatedAt: ctx.asOf.toISOString(),
    // Which voice speaks it: the configured ElevenLabs voice (via /api/ask/speech) or the browser's.
    voice: isTtsConfigured() ? "elevenlabs" : "browser",
    // So answer chips can link to Jira wherever Ask is opened, without every page threading it.
    jiraBaseUrl: process.env.JIRA_BASE_URL?.trim().replace(/\/+$/, "") || null,
  };
}

/**
 * Enough state to finish a connector answer without rebuilding the packs: the packs and clock it
 * was answered from ride on the job; the rest is pure.
 */
function stateFromJob(user, { context, messages }, job) {
  const { history, question } = normalizeTranscript(messages, {
    maxTurns: ASK_MAX_TURNS,
    maxChars: ASK_MAX_TURN_CHARS,
  });
  const ctx = createAskContext(user, job.asOf ? new Date(job.asOf) : new Date());
  return {
    packs: job.packs,
    context,
    history,
    question,
    turns: messages.length,
    ctx,
    today: ctx.asOf.toISOString().slice(0, 10),
    viewer: { name: user.displayName, isAdmin: user.isAdmin, askedFrom: context.page },
  };
}

/** A question whose round is on the asker's connector: still working, answered, or failed. */
async function resumeQuestion(user, body) {
  const started = Date.now();
  const job = await awaitAskJob(user.id, body.resume);
  if (job.state === "pending") return { pending: job.pending };

  if (job.kind === ASK_DEEP_JOB.kind) {
    const state = stateFromJob(user, body, job);
    if (job.state === "done") {
      const meta = { provider: "claude-connector", model: job.model, started, costUsd: job.costUsd, rounds: 1 };
      return finish(state, job.reply, meta, { deep: true });
    }
    // DeepContext couldn't answer: StoryBoard's own (ungrounded) answer stands.
    logger.warn("ask.deep_failed", { error: job.error.slice(0, 200) });
    const { answer, ...meta } = job.fallbackAnswer;
    return finish(state, answer, { ...meta, started });
  }

  if (job.state === "done") {
    const meta = { provider: "claude-connector", model: job.model, started, costUsd: job.costUsd };
    if (job.round === 2) return settle(user, stateFromJob(user, body, job), job.reply, { ...meta, rounds: 2 });
    if (job.reply.type !== "need") {
      return settle(user, stateFromJob(user, body, job), pickAnswer(job.reply), { ...meta, rounds: 1 });
    }
    // Round 1 asked for more data: load it, and route round 2 like any other round.
    const state = await prepareQuestion(user, body);
    const needs = job.reply.need.slice(0, ASK_MAX_NEEDS);
    await addNeeds(state, needs);
    return answerRounds(user, state, 2, { needs, started });
  }

  // The connector took the round and couldn't finish it: the provider answers from that round on,
  // and the connector is not asked again for this question.
  logger.warn("ask.connector_failed", { round: job.round, error: job.error.slice(0, 200) });
  const state = await prepareQuestion(user, body);
  if (job.round === 2) await addNeeds(state, job.needs);
  try {
    return await answerRounds(user, state, job.round, { needs: job.needs, connector: false, started });
  } catch (error) {
    if (error instanceof ConnectorOfflineError) {
      // No provider to take over (as-built 21): report the connector's own failure.
      throw new ConnectorOfflineError(`Your Claude couldn't answer (${job.error}) — ask again.`);
    }
    if (!(error instanceof AiProviderError)) throw error;
    throw withConnectorHint(error, `Your Claude couldn't answer either (${job.error}).`);
  }
}

/**
 * @param {import("@/generated/prisma/client").User} user
 * @param {import("@/lib/schemas/ask").AskBody} body
 * @returns {Promise<object>} the answer — or `{ pending: { jobId, note } }` while the asker's
 *   connector works on it (re-POST the same body with `resume: jobId`)
 */
export async function answerQuestion(user, body) {
  if (body.resume) return resumeQuestion(user, body);
  const state = await prepareQuestion(user, body);
  return answerRounds(user, state, 1, { started: Date.now() });
}
