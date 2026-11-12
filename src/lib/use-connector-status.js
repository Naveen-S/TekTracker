"use client";

/**
 * Is the signed-in user's Claude Code connected to StoryBoard right now? Reads the self-scoped
 * `GET /api/me/connector` on mount, then every 20 s while the tab is visible (a connector counts
 * as online for 30 s after its last poll, so this stays truthful without hammering the server).
 * `null` until the first answer, so the sidebar shows no state rather than a wrong one.
 *
 * @returns {null | "connected" | "offline" | "unpaired"}
 */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

const POLL_MS = 20_000;

export function useConnectorStatus(enabled = true) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const read = () => {
      if (document.visibilityState !== "visible") return;
      apiFetch("/api/me/connector")
        .then((next) => live && setStatus(next.online ? "connected" : next.paired ? "offline" : "unpaired"))
        .catch(() => {}); // a failed read keeps the last known state; the settings page reports errors
    };
    read();
    const timer = setInterval(read, POLL_MS);
    document.addEventListener("visibilitychange", read);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", read);
    };
  }, [enabled]);

  return status;
}
