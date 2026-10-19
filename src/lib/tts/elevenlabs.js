/**
 * ElevenLabs text-to-speech — the voice Ask StoryBoard answers in (ask-storyboard.md as-built 15).
 * Every ElevenLabs specific (endpoint, auth header, model, output format) lives in this one module;
 * the API key never leaves the server.
 *
 * Env is read LAZILY, never at module load — `yarn build` must pass with every var unset, and unset
 * is the supported dormant state: Ask then speaks with the browser's own voice, exactly as before.
 *   ELEVENLABS_API_KEY   the account key (text-to-speech permission is enough)
 *   ELEVENLABS_VOICE_ID  the voice to speak in (e.g. one created in the ElevenLabs Voice Lab)
 *   ELEVENLABS_MODEL     optional; default `eleven_flash_v2_5`, the ~75 ms real-time model
 */
import { AppError, ERROR_CODES } from "@/lib/errors";

const API_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL = "eleven_flash_v2_5";
const OUTPUT_FORMAT = "mp3_44100_128";
const TIMEOUT_MS = 15_000;
const DETAIL_MAX_CHARS = 200;

/** No ElevenLabs voice configured. Maps to 503; the client falls back to the browser voice. */
export class TtsNotConfiguredError extends AppError {
  constructor(message = "No answer voice is configured") {
    super(message, { code: ERROR_CODES.TTS_NOT_CONFIGURED, status: 503 });
    this.name = "TtsNotConfiguredError";
  }
}

/** ElevenLabs failed to produce audio. Maps to 502; its own status goes to `details`, never `status`. */
export class TtsProviderError extends AppError {
  constructor(message, { status } = {}) {
    super(message, {
      code: ERROR_CODES.TTS_PROVIDER,
      status: 502,
      details: { stage: "tts-provider", ...(status ? { providerStatus: status } : {}) },
    });
    this.name = "TtsProviderError";
  }
}

/** True when both the key and the voice are set — the answer voice is ElevenLabs. */
export function isTtsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim() && process.env.ELEVENLABS_VOICE_ID?.trim());
}

/** ElevenLabs' own short error message, when it sent one — never the raw payload or headers. */
async function upstreamDetail(response) {
  try {
    const body = await response.json();
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : (detail?.message ?? detail?.[0]?.msg);
    return typeof message === "string" && message.trim() ? ` — ${message.trim().slice(0, DETAIL_MAX_CHARS)}` : "";
  } catch {
    return "";
  }
}

/**
 * Speak `text` in the configured voice.
 * @param {string} text
 * @returns {Promise<ReadableStream<Uint8Array>>} MP3 audio
 */
export async function synthesizeSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!apiKey || !voiceId) throw new TtsNotConfiguredError();
  const model = process.env.ELEVENLABS_MODEL?.trim() || DEFAULT_MODEL;

  let response;
  try {
    response = await fetch(
      `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: model }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new TtsProviderError(`ElevenLabs timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw new TtsProviderError(`Could not reach ElevenLabs (${error?.message ?? "network error"})`);
  }
  if (!response.ok || !response.body) {
    throw new TtsProviderError(`ElevenLabs request failed (${response.status})${await upstreamDetail(response)}`, {
      status: response.status,
    });
  }
  return response.body;
}
