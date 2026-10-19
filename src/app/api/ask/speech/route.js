/**
 * POST /api/ask/speech — speak one Ask StoryBoard answer in the configured ElevenLabs voice
 * (ask-storyboard.md as-built 15). Returns `audio/mpeg`. The text is what the panel already shows
 * the caller — an answer's `speech` — so the only gate is being signed in; the key stays here.
 *
 * Errors (typed, mapped by withRoute): 400 bad body · 401 unauthenticated · 429 over the speech
 * limit · 503 no voice configured · 502 ElevenLabs failed. On ANY error the panel falls back to the
 * browser's own voice, so a voice problem never costs the user their answer.
 */
import { requireUser } from "@/lib/auth";
import { withRoute, parseJsonBody } from "@/lib/api/route-helpers";
import { askSpeechBodySchema } from "@/lib/schemas/ask";
import { consumeSpeechQuota } from "@/lib/ask/rate-limit";
import { isTtsConfigured, synthesizeSpeech, TtsNotConfiguredError } from "@/lib/tts/elevenlabs";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

export const POST = withRoute("ask.speech", async (request) => {
  const user = await requireUser();
  if (!isTtsConfigured()) throw new TtsNotConfiguredError();
  const { text } = await parseJsonBody(request, askSpeechBodySchema);
  consumeSpeechQuota(user.id);
  const audio = await synthesizeSpeech(text);
  // Like questions (P5), what is spoken is never logged — only its size.
  logger.info("ask.speech", { chars: text.length });
  return new Response(audio, {
    headers: { "content-type": "audio/mpeg", "cache-control": "private, no-store" },
  });
});
