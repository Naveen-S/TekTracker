"use client";

/**
 * Ask StoryBoard's conversation, kept in the BROWSER (ask-storyboard.md as-built 19; amends
 * decision 4, "ephemeral"). Closing the panel, moving between pages or reloading keeps the chat,
 * and its follow-ups keep their context. It is never sent to or stored on the server.
 *
 * - One conversation per signed-in user (keyed by email), in localStorage, dropped after
 *   CHAT_TTL_MS without use ("a session"), and cleared on logout (`clearAskChats`).
 * - A question still being answered (`pending`) is stored too, so a reopened panel shows its status
 *   and picks the answer up when it lands (lib/ask/connector.js keeps the job for a while).
 * - Read through `useSyncExternalStore`: the server snapshot is empty, so `/ask` hydrates cleanly.
 * - Storage can throw or be absent (private mode, blocked site data); an in-memory copy then keeps
 *   the chat for this page's lifetime instead.
 */

const PREFIX = "sprintTracker_askChat:";
const CHAT_TTL_MS = 12 * 60 * 60 * 1000;
/** Turns kept on device — the server only ever reads the last 13. */
const MAX_TURNS = 40;

export const EMPTY_CHAT = Object.freeze({ turns: [], pending: null, error: "" });

const memory = new Map(); // key → raw JSON, when localStorage is unusable
const cache = new Map(); // key → { raw, value }, so getSnapshot returns a stable object
const listeners = new Set();

export const chatKey = (userKey) => `${PREFIX}${userKey ?? "anonymous"}`;

function readRaw(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

function parse(raw) {
  if (!raw) return EMPTY_CHAT;
  try {
    const stored = JSON.parse(raw);
    if (!stored || !Array.isArray(stored.turns)) return EMPTY_CHAT;
    if (Date.now() - (stored.updatedAt ?? 0) > CHAT_TTL_MS) return EMPTY_CHAT;
    return { turns: stored.turns, pending: stored.pending ?? null, error: stored.error ?? "" };
  } catch {
    return EMPTY_CHAT;
  }
}

/** The stored chat for `key` — the same object until it changes. */
export function getChat(key) {
  if (typeof window === "undefined") return EMPTY_CHAT;
  const raw = readRaw(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  const value = parse(raw);
  cache.set(key, { raw, value });
  return value;
}

const notify = () => listeners.forEach((listener) => listener());

/**
 * Replace the chat for `key` with `update(current)`.
 * @param {string} key
 * @param {(chat: { turns: object[], pending: object | null, error: string }) =>
 *   { turns: object[], pending: object | null, error?: string }} update
 */
export function updateChat(key, update) {
  const next = update(getChat(key));
  const raw = JSON.stringify({
    turns: next.turns.slice(-MAX_TURNS),
    pending: next.pending,
    error: next.error ?? "",
    updatedAt: Date.now(),
  });
  try {
    window.localStorage.setItem(key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw);
  }
  notify();
}

/** Forget every stored Ask conversation on this device (logout). */
export function clearAskChats() {
  memory.clear();
  cache.clear();
  try {
    const keys = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage unavailable: the in-memory copies above were the only ones.
  }
  notify();
}

/** `useSyncExternalStore` subscribe: same-page writes, plus other tabs via the storage event. */
export function subscribeChat(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
