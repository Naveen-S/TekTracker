/**
 * Typed errors for the provider-agnostic AI platform (ai-insights.md decision 1). Kept in their
 * own module so `provider.js` and the adapters can share them without a circular import.
 *
 * Mapping (ai-insights.md decision 8, in-route like the step-5 Jira errors):
 *   AiNotConfiguredError → 503 (deliberate dormant state — no AI_PROVIDER set)
 *   AiProviderError      → 502 (the provider failed: HTTP error, timeout, refusal, bad JSON)
 * A *misconfigured* provider (unknown AI_PROVIDER value, missing key) throws a plain Error on
 * purpose → 500 loud (the crypto.js/CRON_SECRET precedent).
 */

/** Thrown when no AI provider is configured at all (`AI_PROVIDER` unset). Maps to HTTP 503. */
export class AiNotConfiguredError extends Error {
  constructor(message = "AI provider is not configured") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

/** Thrown when the configured provider fails to produce a usable response. Maps to HTTP 502. */
export class AiProviderError extends Error {
  constructor(message = "The AI provider request failed", { status } = {}) {
    super(message);
    this.name = "AiProviderError";
    this.status = status ?? null;
  }
}

const DETAIL_MAX_CHARS = 200;

/**
 * Curated error for a non-2xx provider response: status + the provider's own short error message
 * when it has one — never the raw payload, never headers, never the key (ai-insights.md
 * "never log/echo secrets or raw provider payloads").
 *
 * @param {string} providerLabel e.g. "Gemini"
 * @param {Response} response
 * @returns {Promise<AiProviderError>}
 */
export async function providerHttpError(providerLabel, response) {
  let detail = "";
  try {
    const body = await response.json();
    const message = body?.error?.message;
    if (typeof message === "string" && message.trim()) {
      detail = ` — ${message.trim().slice(0, DETAIL_MAX_CHARS)}`;
    }
  } catch {
    // Non-JSON error body: keep just the status.
  }
  return new AiProviderError(`${providerLabel} request failed (${response.status})${detail}`, {
    status: response.status,
  });
}
