"use client";

/**
 * Ask StoryBoard slide-over (ask-storyboard.md (e)). NON-modal on purpose: the board, roll-up or
 * bug report stays visible and scrollable beside it, because the answer is usually about what's on
 * screen. Below `sm` it takes the full screen (the phone case). Escape closes it; focus returns to
 * whatever opened it.
 */
import { useEffect, useRef } from "react";
import { AudioLines, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskChat } from "./ask-chat";

/**
 * @param {{ context: object, contextLabel?: string, onClose: () => void, voiceRef?: object,
 *   startWithVoice?: boolean, userKey?: string }} props `startWithVoice`: opened by the floating button, which starts
 *   the mic itself — so the text box must not grab focus (on a phone that would pop the keyboard).
 */
export function AskPanel({ context, contextLabel, onClose, voiceRef, startWithVoice = false, userKey }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const onKeyDown = (event) => {
      // Focus inside the panel, or dropped to <body> (a clicked starter chip unmounts) — but never
      // while a board dialog has focus, so Escape there still closes only that dialog.
      const focus = document.activeElement;
      const ours = !focus || focus === document.body || panelRef.current?.contains(focus);
      if (event.key === "Escape" && ours) {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="ask-panel-title"
      className="fixed inset-0 z-50 flex flex-col bg-background shadow-2xl animate-in fade-in slide-in-from-right-8 duration-200 ease-out sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[440px] sm:border-l"
    >
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b bg-card px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <AudioLines className="size-4" />
        </span>
        <h2 id="ask-panel-title" className="font-display text-base font-bold">
          Ask StoryBoard
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          onClick={onClose}
          aria-label="Close Ask StoryBoard"
        >
          <X />
        </Button>
      </header>
      <AskChat
        context={context}
        contextLabel={contextLabel}
        autoFocus={!startWithVoice}
        voiceRef={voiceRef}
        userKey={userKey}
      />
    </aside>
  );
}
