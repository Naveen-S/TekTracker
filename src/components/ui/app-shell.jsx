"use client";

/**
 * App shell (modern-theme.md Phase B; sidebar promoted to both themes per Naveen 2026-07-26) —
 * wraps the four authenticated pages (`/`, `/rollup`, `/bugs`, `/admin`). It renders the left-nav
 * sidebar alongside the page's existing chrome (top bar + main), passed through as `children`.
 *
 * The sidebar is `hidden lg:flex` (see AppSidebar) — visible in both themes at lg+, and hidden
 * below lg where the top bar's own nav links take over so mobile isn't cramped. `/login` and
 * `/share` deliberately do NOT use the shell.
 *
 * Ask StoryBoard (ask-storyboard.md (e)/(f)) lives here because the shell is the one component on
 * every authenticated page: the sidebar launcher + ⌘/Ctrl+K at lg+, a floating "tap to talk" button
 * on every screen size (as-built 17; was phones only, P7), and the slide-over itself. `askContext`
 * (ids + a label) is what the page is showing. Every Ask affordance is absent when `askEnabled` is
 * false: neither an AI provider (AI_PROVIDER) nor Claude analysis is set up (lib/ask/availability).
 *
 * The floating button is ONE tap: it mounts the panel synchronously (`flushSync`) and starts the
 * mic in the same click handler. iOS only allows recognition and audio playback from inside a
 * gesture, so starting it from an effect after the panel mounts would silently not listen.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Mic } from "lucide-react";
import { AppSidebar } from "./app-sidebar";
import { AskPanel } from "@/components/ask/ask-panel";

export function AppShell({
  user,
  hasBugReport = false,
  hasLeaderboardAccess = false,
  askEnabled = false,
  askContext = null,
  children,
}) {
  const askAvailable = askEnabled && askContext !== null;
  const [askOpen, setAskOpen] = useState(false);
  const [startWithVoice, setStartWithVoice] = useState(false);
  const voiceRef = useRef(null);
  const openAsk = useCallback(() => {
    setStartWithVoice(false);
    setAskOpen(true);
  }, []);
  const closeAsk = useCallback(() => setAskOpen(false), []);
  const talk = useCallback(() => {
    flushSync(() => {
      setStartWithVoice(true);
      setAskOpen(true);
    });
    voiceRef.current?.startVoice();
  }, []);

  useEffect(() => {
    if (!askAvailable) return undefined;
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setStartWithVoice(false);
        setAskOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [askAvailable]);

  const { label: askLabel, ...askIds } = askContext ?? {};

  return (
    <div className="app-shell flex min-h-screen">
      <AppSidebar
        user={user}
        hasBugReport={hasBugReport}
        hasLeaderboardAccess={hasLeaderboardAccess}
        onAsk={askAvailable ? openAsk : null}
      />
      <div className="app-main flex min-w-0 flex-1 flex-col">{children}</div>
      {askAvailable && !askOpen && (
        <button
          type="button"
          onClick={talk}
          aria-label="Ask StoryBoard — tap to talk"
          title="Ask StoryBoard — tap to talk (⌘K to type)"
          className="fixed right-4 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand transition-transform hover:scale-105 active:scale-95 lg:right-6 lg:bottom-6"
        >
          <Mic className="size-6" />
        </button>
      )}
      {askAvailable && askOpen && (
        <AskPanel
          context={askIds}
          contextLabel={askLabel}
          onClose={closeAsk}
          voiceRef={voiceRef}
          startWithVoice={startWithVoice}
          userKey={user?.email}
        />
      )}
    </div>
  );
}
