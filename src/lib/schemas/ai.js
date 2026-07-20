import { z } from "zod";

/**
 * The AI digest contract (ai-insights.md decision 8) — what every provider must return, in two
 * renderings that MUST stay in lockstep:
 *   `digestZodSchema`    — the real gate, enforced in lib/ai/provider.js after parsing.
 *   `DIGEST_JSON_SCHEMA` — plain JSON Schema steering the providers' native JSON modes
 *                          (Anthropic needs `additionalProperties: false` + `required`; Gemini's
 *                          subset dialect is derived from this in its adapter). Kept FLAT — no
 *                          unions beyond the severity enum (Gemini subset limits).
 */

export const DIGEST_SEVERITIES = ["danger", "warn", "info"];

export const digestZodSchema = z.object({
  headline: z.string().trim().min(1).max(200),
  narrative: z.array(z.string().trim().min(1)).min(1).max(6),
  callouts: z
    .array(
      z.object({
        severity: z.enum(DIGEST_SEVERITIES),
        text: z.string().trim().min(1),
        jiraKeys: z.array(z.string().trim()).default([]),
      }),
    )
    .max(10),
});

export const DIGEST_JSON_SCHEMA = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      description: "One-line sprint summary for a leadership audience (max ~15 words)",
    },
    narrative: {
      type: "array",
      description: "2-4 short paragraphs: overall status, pace vs plan, what needs attention",
      items: { type: "string" },
    },
    callouts: {
      type: "array",
      description: "Risk call-outs, most severe first; cite Jira keys from the supplied data",
      items: {
        type: "object",
        properties: {
          severity: { type: "string", enum: DIGEST_SEVERITIES },
          text: { type: "string" },
          jiraKeys: {
            type: "array",
            description: "Jira keys this call-out refers to — only keys present in the data",
            items: { type: "string" },
          },
        },
        required: ["severity", "text", "jiraKeys"],
        additionalProperties: false,
      },
    },
  },
  required: ["headline", "narrative", "callouts"],
  additionalProperties: false,
};

/** The `schema` argument shape `generateJson` consumes (name / zod gate / provider steering). */
export const digestContract = {
  name: "sprint_digest",
  zod: digestZodSchema,
  json: DIGEST_JSON_SCHEMA,
};

/** @typedef {z.infer<typeof digestZodSchema>} SprintDigest */
