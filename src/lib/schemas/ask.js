import { z } from "zod";

/**
 * Ask StoryBoard contracts (ask-storyboard.md (b)/(d)). Like `digestContract` (schemas/ai.js),
 * every model-facing contract comes in two renderings that MUST stay in lockstep:
 *   zod          — the real gate, enforced by generateJson after parsing;
 *   JSON Schema  — steers the providers' native JSON modes.
 * Kept FLAT on purpose: Gemini's schema subset has no `oneOf`, so round 1's "answer OR need more
 * data" union is one object with a `type` enum, and zod's refinement enforces the branch rules.
 * Every property is listed in `required` (empty string / empty array when unused) — the shape
 * Anthropic's strict structured output wants, and the digest's proven precedent.
 */

/** The data packs the model may ask for (lib/ask/packs.js builds each one). */
export const ASK_PACKS = ["rollup", "team", "bugs", "trend", "leaderboard", "ticket"];

/** Where the question was asked — decides the default pack(s) sent in round 1. */
export const ASK_PAGES = ["board", "rollup", "bugs", "leaderboard", "ask", "other"];

export const ASK_MAX_TURNS = 12;
export const ASK_MAX_TURN_CHARS = 1000;
export const ASK_MAX_NEEDS = 3;

const id = z.string().trim().min(1).max(100);

export const askBodySchema = z.object({
  context: z
    .object({
      page: z.enum(ASK_PAGES).default("other"),
      teamId: id.optional(),
      sprintId: id.optional(),
      programId: id.optional(),
      bugReportSlug: id.optional(),
      bugScopeId: id.optional(),
    })
    .default({ page: "other" }),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(ASK_MAX_TURN_CHARS),
      }),
    )
    .min(1)
    .max(ASK_MAX_TURNS + 1)
    .refine((messages) => messages.at(-1).role === "user", {
      message: "The last message must be the user's question",
    }),
  // Set when re-asking for a question that fell back to the asker's Claude Connector: the
  // `pending.jobId` from the previous reply. The same context + messages travel with it.
  resume: id.optional(),
});

/** POST /api/ask/speech — one answer's spoken text (an answer's `speech` is ≤ 800 chars). */
export const askSpeechBodySchema = z.object({
  text: z.string().trim().min(1).max(800),
});

// ── The answer ─────────────────────────────────────────────────────────────────────────────

const answerFields = {
  speech: z.string().trim().max(800),
  detail: z.array(z.string().trim().min(1).max(400)).max(8).default([]),
  jiraKeys: z.array(z.string().trim()).default([]),
  sources: z.array(z.string().trim()).default([]),
  followUps: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  grounded: z.boolean(),
};

export const askAnswerZodSchema = z.object(answerFields).refine((answer) => answer.speech.length > 0, {
  message: "speech must not be empty",
  path: ["speech"],
});

const ANSWER_JSON_PROPERTIES = {
  speech: {
    type: "string",
    description:
      "The spoken answer: 1-3 short, plain sentences a busy executive hears read aloud. No markdown, no lists, no Jira keys read out unless asked for one.",
  },
  detail: {
    type: "array",
    description: "Up to 6 short supporting bullet lines shown on screen (numbers, names, keys). Empty when not needed.",
    items: { type: "string" },
  },
  jiraKeys: {
    type: "array",
    description: "Jira keys the answer refers to — only keys present in the supplied data",
    items: { type: "string" },
  },
  sources: {
    type: "array",
    description: "Names of the data packs the answer used (e.g. rollup, team, bugs)",
    items: { type: "string" },
  },
  followUps: {
    type: "array",
    description: "Up to 3 short follow-up questions the user might ask next",
    items: { type: "string" },
  },
  grounded: {
    type: "boolean",
    description: "false when the supplied data does not contain the answer",
  },
};
const ANSWER_REQUIRED = ["speech", "detail", "jiraKeys", "sources", "followUps", "grounded"];

export const ASK_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: ANSWER_JSON_PROPERTIES,
  required: ANSWER_REQUIRED,
  additionalProperties: false,
};

/** Round 2 (and any round that must answer): answer-only. */
export const askAnswerContract = {
  name: "storyboard_answer",
  zod: askAnswerZodSchema,
  json: ASK_ANSWER_JSON_SCHEMA,
};

// ── Round 1: answer, or ask for more data ────────────────────────────────────────────────────

const needItemZod = z.object({
  pack: z.enum(ASK_PACKS),
  team: z.string().trim().default(""),
  program: z.string().trim().default(""),
  sprint: z.string().trim().default(""),
  bugReport: z.string().trim().default(""),
  bugScope: z.string().trim().default(""),
  jiraKey: z.string().trim().default(""),
});

export const askRoundOneZodSchema = z
  .object({
    type: z.enum(["answer", "need"]),
    need: z.array(needItemZod).default([]),
    ...answerFields,
    speech: z.string().trim().max(800).default(""),
    grounded: z.boolean().default(true),
  })
  .superRefine((reply, ctx) => {
    if (reply.type === "answer" && reply.speech.length === 0) {
      ctx.addIssue({ code: "custom", path: ["speech"], message: "an answer needs speech" });
    }
    if (reply.type === "need" && reply.need.length === 0) {
      ctx.addIssue({ code: "custom", path: ["need"], message: "type need requires at least one pack" });
    }
  });

const NEED_ITEM_JSON = {
  type: "object",
  properties: {
    pack: { type: "string", enum: ASK_PACKS },
    team: { type: "string", description: "Team key or name from the catalog, or empty" },
    program: { type: "string", description: "Program key or name from the catalog, or empty" },
    sprint: { type: "string", description: "Sprint name from the catalog, or empty for the default" },
    bugReport: { type: "string", description: "Bug report slug from the catalog, or empty" },
    bugScope: { type: "string", description: "Bug scope name (e.g. External), or empty for all" },
    jiraKey: { type: "string", description: "Jira key, only for the ticket pack" },
  },
  required: ["pack", "team", "program", "sprint", "bugReport", "bugScope", "jiraKey"],
  additionalProperties: false,
};

export const ASK_ROUND_ONE_JSON_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: ["answer", "need"],
      description: 'answer = the supplied data is enough; need = request more packs first',
    },
    need: {
      type: "array",
      description: "When type is need: up to 3 packs to load. Empty when answering.",
      items: NEED_ITEM_JSON,
    },
    ...ANSWER_JSON_PROPERTIES,
  },
  required: ["type", "need", ...ANSWER_REQUIRED],
  additionalProperties: false,
};

export const askRoundOneContract = {
  name: "storyboard_answer_or_need",
  zod: askRoundOneZodSchema,
  json: ASK_ROUND_ONE_JSON_SCHEMA,
};

/**
 * Clamp a model reply to the answer limits before it is validated: over-long strings are cut and
 * extra items dropped, so a reply that is merely too long isn't rejected outright. The connector
 * path has no repair retry (the provider path does). Anything structurally wrong still fails zod.
 *
 * @param {unknown} reply
 */
export function clampAskReply(reply) {
  if (!reply || typeof reply !== "object" || Array.isArray(reply)) return reply;
  const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : value);
  const list = (value, items, max) =>
    Array.isArray(value)
      ? value
          .map((item) => text(item, max))
          .filter((item) => typeof item !== "string" || item.length > 0)
          .slice(0, items)
      : value;
  return {
    ...reply,
    speech: text(reply.speech, 800),
    detail: list(reply.detail, 8, 400),
    followUps: list(reply.followUps, 6, 160),
    ...(Array.isArray(reply.need) ? { need: reply.need.slice(0, ASK_MAX_NEEDS) } : {}),
  };
}

/** @typedef {z.infer<typeof askBodySchema>} AskBody */
/** @typedef {z.infer<typeof askAnswerZodSchema>} AskAnswer */
/** @typedef {z.infer<typeof needItemZod>} AskNeed */
