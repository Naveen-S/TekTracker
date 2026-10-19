import { z } from "zod";
import { ANALYSIS_EFFORTS } from "@/lib/connector/defaults.mjs";
import { ANALYSIS_SOURCES } from "@/lib/ai/issue-analysis.mjs";

/**
 * Claude Connector contracts (claude-connector-analysis.md). The analysis result has two renderings
 * that MUST stay in lockstep (the digest.js precedent):
 *   `analysisResultSchema`  — the real gate, enforced server-side when the connector posts a result.
 *   `ANALYSIS_JSON_SCHEMA`  — plain JSON Schema handed to `claude -p --json-schema`, steering the
 *                             StructuredOutput tool. Sections that don't apply are `null`.
 * The zod side is deliberately lenient on length (sanitizeAnalysis caps everything) and strict on
 * shape, so a slightly chatty model is trimmed rather than rejected.
 */

const str = z.string();
const nstr = z.string().nullish();

const location = z.object({ repo: nstr, path: nstr, symbol: nstr, why: nstr, url: nstr });

export const analysisResultSchema = z.object({
  summary: str.trim().min(1),
  confidence: z.enum(["low", "medium", "high"]).catch("low"),
  rootCause: z.object({ hypothesis: nstr, locations: z.array(location).default([]) }).nullish(),
  security: z
    .object({
      cve: nstr,
      affectedComponent: nstr,
      usages: z.array(str).default([]),
      exploitability: nstr,
      fixPath: nstr,
    })
    .nullish(),
  hygiene: z
    .object({ suggestedSubComponent: nstr, suggestedFixVersion: nstr, rationale: nstr })
    .nullish(),
  similarTickets: z
    .array(z.object({ key: nstr, title: nstr, resolution: nstr, why: nstr }))
    .default([]),
  triage: z
    .object({ team: nstr, subComponent: nstr, priority: nstr, assignee: nstr, rationale: nstr })
    .nullish(),
  sizing: z.object({ estimate: nstr, basis: nstr }).nullish(),
  nextSteps: z.array(str).default([]),
  citations: z.array(z.object({ label: nstr, url: nstr })).default([]),
});

const S = { type: "string" };
const NS = { type: ["string", "null"] };
const nullableObject = (properties, description) => ({
  type: ["object", "null"],
  description,
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "2-4 sentence answer a manager can read on its own" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    rootCause: nullableObject(
      {
        hypothesis: NS,
        locations: {
          type: "array",
          description: "Code locations found via DeepContext — never invented",
          items: {
            type: "object",
            properties: { repo: NS, path: NS, symbol: NS, why: NS, url: NS },
            required: ["repo", "path", "symbol", "why", "url"],
            additionalProperties: false,
          },
        },
      },
      "Root cause (bugs) or implementation areas (delivery work)",
    ),
    security: nullableObject(
      {
        cve: NS,
        affectedComponent: NS,
        usages: { type: "array", items: S },
        exploitability: NS,
        fixPath: NS,
      },
      "Vulnerability tickets only; otherwise null",
    ),
    hygiene: nullableObject(
      { suggestedSubComponent: NS, suggestedFixVersion: NS, rationale: NS },
      "Needs-attention tickets only; otherwise null",
    ),
    similarTickets: {
      type: "array",
      items: {
        type: "object",
        properties: { key: NS, title: NS, resolution: NS, why: NS },
        required: ["key", "title", "resolution", "why"],
        additionalProperties: false,
      },
    },
    triage: nullableObject({ team: NS, subComponent: NS, priority: NS, assignee: NS, rationale: NS }),
    sizing: nullableObject({ estimate: NS, basis: NS }),
    nextSteps: { type: "array", items: S },
    citations: {
      type: "array",
      description: "Sources from tool results (https URLs only)",
      items: {
        type: "object",
        properties: { label: S, url: S },
        required: ["label", "url"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "summary",
    "confidence",
    "rootCause",
    "security",
    "hygiene",
    "similarTickets",
    "triage",
    "sizing",
    "nextSteps",
    "citations",
  ],
  additionalProperties: false,
};

const JIRA_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
export const jiraKeySchema = z.string().trim().toUpperCase().regex(JIRA_KEY, "Invalid Jira key");

/** A model alias or id: letters, digits, dot, dash, underscore, brackets (e.g. `opus`, `claude-opus-5-5[1m]`). */
export const modelNameSchema = z.string().trim().regex(/^[\w.\-[\]]{1,64}$/, "Invalid model name");

/** POST /api/analyses */
export const analysisCreateSchema = z.object({
  jiraKey: jiraKeySchema,
  source: z.enum(ANALYSIS_SOURCES),
  model: modelNameSchema.optional(),
});

/** POST /api/connector/jobs/[jobId] — one event from the local connector. */
export const connectorEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("progress"), note: z.string().trim().min(1).max(300) }),
  z.object({
    type: z.literal("result"),
    result: z.unknown(),
    costUsd: z.number().nonnegative().nullish(),
    durationMs: z.number().int().nonnegative().nullish(),
  }),
  z.object({ type: z.literal("error"), message: z.string().trim().min(1).max(1000) }),
]);

/** PUT /api/analysis-settings (admin). */
export const analysisSettingsSchema = z
  .object({
    enabled: z.boolean(),
    allowedModels: z.array(modelNameSchema).min(1).max(8),
    defaultModel: modelNameSchema,
    effort: z.enum(ANALYSIS_EFFORTS),
    maxBudgetUsd: z.number().positive().max(50),
    timeoutMinutes: z.number().int().min(1).max(60),
  })
  .refine((value) => value.allowedModels.includes(value.defaultModel), {
    message: "The default model must be one of the allowed models",
    path: ["defaultModel"],
  });

/** @typedef {z.infer<typeof analysisCreateSchema>} AnalysisCreateInput */
/** @typedef {z.infer<typeof connectorEventSchema>} ConnectorEvent */
/** @typedef {z.infer<typeof analysisSettingsSchema>} AnalysisSettingsInput */
