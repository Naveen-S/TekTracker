/**
 * Per-user sliding-window limit for Ask StoryBoard (ask-storyboard.md P4): 30 questions per 10
 * minutes. In-memory on purpose — StoryBoard runs as one container, and a limit that resets on a
 * restart is fine for a cost guard (it is not a security boundary). Each question can cost up to
 * two model calls (P6), so this caps spend at 60 calls / 10 min / user.
 */
import { RateLimitError } from "@/lib/errors";

export const ASK_RATE_LIMIT = 30;
export const ASK_RATE_WINDOW_MS = 10 * 60 * 1000;

/** Spoken answers (ElevenLabs bills per character): every answer plus a replay each, with slack. */
export const SPEECH_RATE_LIMIT = 60;

const questionHits = new Map(); // userId → ascending timestamps inside the window
const speechHits = new Map();

function consume(hits, limit, userId, now, describe) {
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < ASK_RATE_WINDOW_MS);
  if (recent.length >= limit) {
    const retryAfterSeconds = Math.ceil((recent[0] + ASK_RATE_WINDOW_MS - now) / 1000);
    hits.set(userId, recent);
    throw new RateLimitError(
      `${describe} — try again in about ${Math.max(1, Math.ceil(retryAfterSeconds / 60))} min.`,
      { retryAfterSeconds },
    );
  }
  recent.push(now);
  hits.set(userId, recent);
}

/**
 * Record one question for `userId`, or throw {@link RateLimitError} when the window is full.
 * @param {string} userId
 * @param {number} [now]
 */
export function consumeAskQuota(userId, now = Date.now()) {
  consume(questionHits, ASK_RATE_LIMIT, userId, now, `You've asked ${ASK_RATE_LIMIT} questions in 10 minutes`);
}

/**
 * Record one spoken answer (ElevenLabs) for `userId`, or throw {@link RateLimitError}.
 * @param {string} userId
 * @param {number} [now]
 */
export function consumeSpeechQuota(userId, now = Date.now()) {
  consume(speechHits, SPEECH_RATE_LIMIT, userId, now, `${SPEECH_RATE_LIMIT} spoken answers in 10 minutes`);
}
