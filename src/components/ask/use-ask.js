"use client";

/**
 * Conversation state for Ask StoryBoard. The conversation lives in the browser (chat-store.js,
 * as-built 19): closing the panel, changing page or reloading keeps it, and follow-ups carry the
 * earlier turns. Each question POSTs the recent transcript to `/api/ask`, which trims it
 * server-side; the page's `context` (ids only) says which data the question starts from.
 *
 * The server routes each question to the asker's own Claude Connector first (the AI provider when
 * it can't); a connector round answers `{ pending: { jobId, note } }`, and the hook re-POSTs the
 * same body with `resume` (the server holds each a few seconds), showing `note` until it lands.
 * That loop runs at page level, not in the panel: close the panel mid-answer and the answer still
 * arrives; reload and the stored `pending.jobId` is resumed.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiFetch, errorReference } from "@/lib/api-client";
import { EMPTY_CHAT, chatKey, getChat, subscribeChat, updateChat } from "./chat-store";

const MAX_SENT_TURNS = 13;
/** Give up on an answer after this long (the server fails a stuck connector job by then anyway). */
const PENDING_DEADLINE_MS = 4 * 60_000;

/**
 * What an earlier answer contributes to the transcript the model sees next time — its Jira keys
 * included, so "which of those are P0?" knows what "those" were.
 */
const answerText = (answer) => {
  const keys = answer.jiraKeys?.length ? ` Keys: ${answer.jiraKeys.join(", ")}.` : "";
  return `${[answer.speech, ...answer.detail].join(" ")}${keys}`.slice(0, 1000);
};

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Questions being driven in this page, by pending id — a remounted panel never starts a second loop. */
const running = new Set();

/**
 * A reload or navigation away cancels the in-flight request ("Failed to fetch"). That isn't a
 * failed question: leave it pending so the next page load resumes it from `pending.jobId`.
 */
let leavingPage = false;
if (typeof window !== "undefined") {
  const leave = () => {
    leavingPage = true;
  };
  window.addEventListener("beforeunload", leave);
  window.addEventListener("pagehide", leave);
  window.addEventListener("pageshow", () => {
    leavingPage = false; // back from the back/forward cache: this page is live again
  });
}

const stillPending = (key, id) => getChat(key).pending?.id === id;

/** Run one stored question to its answer (or error), writing every step to the store. */
async function drive(key, pending) {
  running.add(pending.id);
  const { context, messages } = pending;
  try {
    let result = await apiFetch("/api/ask", {
      method: "POST",
      body: pending.jobId ? { context, messages, resume: pending.jobId } : { context, messages },
    });
    while (result.pending) {
      if (!stillPending(key, pending.id)) return null; // reset, or a newer question
      if (Date.now() - pending.startedAt > PENDING_DEADLINE_MS) {
        throw new Error("Your Claude is taking too long — try again");
      }
      const { jobId, note } = result.pending;
      updateChat(key, (chat) =>
        chat.pending?.id === pending.id ? { ...chat, pending: { ...chat.pending, jobId, note } } : chat,
      );
      result = await apiFetch("/api/ask", { method: "POST", body: { context, messages, resume: jobId } });
    }
    if (!stillPending(key, pending.id)) return null;
    updateChat(key, (chat) => ({
      turns: [...chat.turns, { id: newId(), role: "assistant", text: result.answer.speech, result }],
      pending: null,
      error: "",
    }));
    return result;
  } catch (askError) {
    if (!leavingPage && stillPending(key, pending.id)) {
      const reference = errorReference(askError);
      const message = reference ? `${askError.message} (${reference})` : askError.message;
      updateChat(key, (chat) => ({ ...chat, pending: null, error: message }));
    }
    return null;
  } finally {
    running.delete(pending.id);
  }
}

/**
 * @param {{ page: string, teamId?: string, sprintId?: string, programId?: string,
 *   bugReportSlug?: string, bugScopeId?: string }} context
 * @param {string} [userKey] whose conversation this is (the signed-in user's email)
 */
export function useAsk(context, userKey) {
  const key = chatKey(userKey);
  const chat = useSyncExternalStore(subscribeChat, () => getChat(key), () => EMPTY_CHAT);
  const { turns, pending, error } = chat;
  const busy = Boolean(pending);

  // A question left pending by a closed panel is still being driven; one left by a RELOAD is not.
  useEffect(() => {
    if (!pending || running.has(pending.id)) return;
    if (pending.jobId) {
      drive(key, pending);
      return;
    }
    // The reload cut off the first request before the server named a job — its answer is lost.
    updateChat(key, (current) =>
      current.pending?.id === pending.id
        ? { ...current, pending: null, error: "That question was interrupted — ask it again." }
        : current,
    );
  }, [key, pending]);

  /** Ask one question; resolves to the full result (or null on failure, with `error` set). */
  const ask = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text || busy) return null;
      const history = [...turns, { id: newId(), role: "user", text }];
      // The server keeps the last 12 turns + the question; never send more than it accepts.
      const messages = history.slice(-MAX_SENT_TURNS).map((turn) =>
        turn.role === "user"
          ? { role: "user", text: turn.text.slice(0, 1000) }
          : { role: "assistant", text: answerText(turn.result.answer) },
      );
      const entry = { id: newId(), jobId: null, note: "", context, messages, startedAt: Date.now() };
      updateChat(key, () => ({ turns: history, pending: entry, error: "" }));
      return drive(key, entry);
    },
    [busy, context, key, turns],
  );

  /** Start a new conversation (also stops waiting on any answer still on its way). */
  const reset = useCallback(() => {
    updateChat(key, () => ({ turns: [], pending: null, error: "" }));
  }, [key]);

  return { turns, busy, note: pending?.note ?? "", error, ask, reset };
}
