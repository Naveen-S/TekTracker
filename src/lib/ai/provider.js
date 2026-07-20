/**
 * Provider-agnostic AI platform (ai-insights.md decision 1 — RATIFIED 2026-07-20): feature code
 * calls `generateJson(...)` and never knows which provider answered. The provider is selected by
 * `AI_PROVIDER` env at call time; each provider's key can be configured simultaneously, so
 * switching (downtime, cost, any reason) is an env flip + restart — zero code changes. Adding a
 * provider = one adapter module + a `PROVIDERS` row.
 *
 * Env is read LAZILY inside functions, never at module load — `yarn build` must pass with every
 * `AI_*` var unset (the DB/env-free invariant), and unset `AI_PROVIDER` is the supported dormant
 * state (no UI affordance, route → 503 via `AiNotConfiguredError`).
 */
import { validate } from "@/lib/validation";
import { AiNotConfiguredError, AiProviderError } from "./errors";
import { generate as generateGemini } from "./adapters/gemini";
import { generate as generateAnthropic } from "./adapters/anthropic";

/** Per-provider wiring: env var holding the key, default model, adapter. `AI_MODEL` overrides
 * the model (the operator's cost lever — e.g. a cheaper tier — lives in env, not code). */
const PROVIDERS = {
  gemini: {
    label: "Gemini",
    keyVar: "GEMINI_API_KEY",
    defaultModel: "gemini-3.5-flash", // current stable flash tier (ai.google.dev, 2026-07-20)
    generate: generateGemini,
  },
  anthropic: {
    label: "Anthropic",
    keyVar: "ANTHROPIC_API_KEY",
    defaultModel: "claude-opus-4-8", // per the claude-api skill (2026-07-20)
    generate: generateAnthropic,
  },
};

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2; // one generation + one repair retry (decision 8)

/** Cheap dormancy probe for UI affordances — true whenever AI_PROVIDER is set (a *misconfigured*
 * provider stays visible so the loud route error is seen, not silently hidden). */
export function isAiConfigured() {
  return Boolean(process.env.AI_PROVIDER?.trim());
}

/**
 * Resolve the active provider config. Throws `AiNotConfiguredError` (→ 503) when no provider is
 * set; throws a plain Error (→ 500, loud) for an unknown provider or a missing key.
 *
 * @returns {{ provider: string, label: string, model: string, apiKey: string,
 *   generate: Function }}
 */
export function getAiConfig() {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!provider) {
    throw new AiNotConfiguredError();
  }
  const spec = PROVIDERS[provider];
  if (!spec) {
    throw new Error(
      `Unknown AI_PROVIDER "${provider}" — expected one of: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }
  const apiKey = process.env[spec.keyVar]?.trim();
  if (!apiKey) {
    throw new Error(`${spec.keyVar} is not set — it is required while AI_PROVIDER=${provider}`);
  }
  return {
    provider,
    label: spec.label,
    model: process.env.AI_MODEL?.trim() || spec.defaultModel,
    apiKey,
    generate: spec.generate,
  };
}

/** Strip ```json fences some models wrap around JSON-mode output, then parse. */
function tryParseJson(text) {
  const bare = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(bare) };
  } catch {
    return { ok: false, error: "the reply was not valid JSON" };
  }
}

/**
 * Generate a schema-conforming JSON object from the active provider (decision 8): ask for native
 * JSON output (`schema.json` steers the provider), parse, zod-validate (`schema.zod` is the real
 * gate), and on failure retry ONCE with the validation error appended to the prompt. Timeouts and
 * network failures surface as `AiProviderError` (→ 502).
 *
 * @template T
 * @param {{ system: string, prompt: string,
 *   schema: { name: string, zod: import("zod").ZodType<T>, json: object },
 *   maxOutputTokens?: number }} request
 * @returns {Promise<T>}
 */
export async function generateJson({ system, prompt, schema, maxOutputTokens = 2048 }) {
  const config = getAiConfig();

  let attemptPrompt = prompt;
  let lastError = "";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let text;
    try {
      text = await config.generate({
        apiKey: config.apiKey,
        model: config.model,
        system,
        prompt: attemptPrompt,
        jsonSchema: schema.json,
        maxOutputTokens,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      if (error?.name === "TimeoutError" || error?.name === "AbortError") {
        throw new AiProviderError(`${config.label} request timed out after ${TIMEOUT_MS / 1000}s`);
      }
      // fetch network failure (DNS, refused connection, TLS) — no response to curate.
      throw new AiProviderError(`Could not reach ${config.label} (${error?.message ?? "network error"})`);
    }

    const parsed = tryParseJson(text);
    const result = parsed.ok
      ? validate(schema.zod, parsed.value)
      : { success: false, error: parsed.error };
    if (result.success) {
      return result.data;
    }
    lastError = result.error;
    attemptPrompt =
      `${prompt}\n\nYour previous reply was rejected (${lastError}). ` +
      `Reply again with ONLY a JSON object that matches the required "${schema.name}" schema — no prose, no code fences.`;
  }

  throw new AiProviderError(`${config.label} returned an invalid response (${lastError}) — try again`);
}
