/**
 * Gemini adapter (ai-insights.md decisions 2/9) — a thin `fetch` wrapper over
 * `POST {base}/v1beta/models/{model}:generateContent` (REST shape verified against
 * ai.google.dev 2026-07-20). Everything Gemini-shaped lives here and only here (§17 isolation):
 * endpoint, auth header, body layout, schema dialect, response digging.
 *
 * JSON mode: `generationConfig.responseMimeType: "application/json"` + `responseSchema`.
 * Gemini's Schema object is a JSON-Schema SUBSET — it has no `additionalProperties`, so that key
 * is stripped before sending (the zod gate in provider.js is the real contract enforcement).
 */
import { AiProviderError, providerHttpError } from "../errors";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";

/** Deep-copy a JSON schema without the keys Gemini's Schema dialect rejects. */
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema === null || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => key !== "additionalProperties")
      .map(([key, value]) => [key, toGeminiSchema(value)]),
  );
}

/**
 * @param {{ apiKey: string, model: string, system: string, prompt: string, jsonSchema: object,
 *   maxOutputTokens: number, signal: AbortSignal }} request
 * @returns {Promise<string>} the model's raw text (expected to be JSON — parsed by the caller)
 */
export async function generate({ apiKey, model, system, prompt, jsonSchema, maxOutputTokens, signal }) {
  // Override exists for the mock round-trip verification + proxies; key goes in a HEADER, never
  // the URL (query-string keys end up in server logs).
  const baseUrl = (process.env.GEMINI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");

  const response = await fetch(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(jsonSchema),
        maxOutputTokens,
      },
    }),
    signal,
  });
  if (!response.ok) throw await providerHttpError("Gemini", response);

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
  if (!text) {
    const reason = candidate?.finishReason ?? data.promptFeedback?.blockReason ?? "no candidates";
    throw new AiProviderError(`Gemini returned no text (${reason})`);
  }
  return text;
}
