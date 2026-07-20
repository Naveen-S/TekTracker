/**
 * Anthropic adapter (ai-insights.md decisions 2/9) — a thin `fetch` wrapper over
 * `POST {base}/v1/messages` (shape from the repo's claude-api skill, 2026-07-20: structured
 * outputs are `output_config.format`, sampling params are rejected on current models — none are
 * sent, prefills 400 — none used). Everything Anthropic-shaped lives here and only here (§17
 * isolation): endpoint, auth headers, body layout, refusal handling, response digging.
 */
import { AiProviderError, providerHttpError } from "../errors";

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * @param {{ apiKey: string, model: string, system: string, prompt: string, jsonSchema: object,
 *   maxOutputTokens: number, signal: AbortSignal }} request
 * @returns {Promise<string>} the model's raw text (expected to be JSON — parsed by the caller)
 */
export async function generate({ apiKey, model, system, prompt, jsonSchema, maxOutputTokens, signal }) {
  // Override exists for the mock round-trip verification + proxies.
  const baseUrl = (process.env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxOutputTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema: jsonSchema } },
    }),
    signal,
  });
  if (!response.ok) throw await providerHttpError("Anthropic", response);

  const data = await response.json();
  // Safety classifiers answer HTTP 200 with stop_reason "refusal" and empty/partial content —
  // check before reading content (claude-api skill).
  if (data.stop_reason === "refusal") {
    throw new AiProviderError("Anthropic declined to generate this digest");
  }
  const text = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text) {
    throw new AiProviderError(`Anthropic returned no text (${data.stop_reason ?? "empty response"})`);
  }
  return text;
}
