"use client";

/**
 * The Ask StoryBoard conversation (ask-storyboard.md (e)/(f)) — shared by the desktop slide-over
 * (`variant="panel"`) and the full-screen mobile `/ask` page (`variant="page"`, a big tap-to-talk
 * mic). Answers render as plain React text (never HTML); only Jira keys the server already
 * validated against the data packs become links.
 *
 * Voice: a question asked by voice is answered by voice (unless muted); a typed question is
 * answered on screen only, so a desk full of laptops doesn't start talking. Every answer has a
 * replay button.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Mic, RotateCcw, SendHorizontal, Square, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/ui/brand";
import { DialogError } from "@/components/ui/dialog";
import { useLocalPref } from "@/lib/use-local-pref";
import { useAsk } from "./use-ask";
import { useSpeech } from "./use-speech";

const MUTE_KEY = "sprintTracker_askMuted";

const STARTERS = {
  board: [
    "Is the team on track this sprint?",
    "What's blocked or behind?",
    "How much of the committed roadmap is done?",
  ],
  bugs: [
    "How many bugs have breached SLA?",
    "Which team has the most open bugs?",
    "What changed since yesterday?",
  ],
  leaderboard: [
    "Which team has the best points per developer?",
    "Who delivered the most points this sprint?",
  ],
  default: [
    "Is this sprint on track?",
    "Which team needs attention?",
    "What's blocked right now?",
    "How are we doing versus last sprint?",
  ],
};

function JiraKeyChip({ jiraKey, jiraBaseUrl }) {
  const className = "rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold";
  if (!jiraBaseUrl) return <span className={cn(className, "bg-muted")}>{jiraKey}</span>;
  return (
    <a
      href={`${jiraBaseUrl}/browse/${jiraKey}`}
      target="_blank"
      rel="noreferrer"
      className={cn(className, "bg-accent text-accent-foreground hover:underline")}
    >
      {jiraKey}
    </a>
  );
}

function AnswerCard({ result, large, onReplay, canSpeak }) {
  const { answer, packsUsed, jiraBaseUrl } = result;
  const sources = packsUsed.filter((entry) => entry.available && answer.sources.includes(entry.pack));
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-xs">
      <p className={cn("leading-relaxed text-foreground", large ? "text-lg" : "text-[15px]")}>
        {answer.speech}
      </p>
      {answer.detail.length > 0 && (
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm text-secondary-foreground">
          {answer.detail.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
      {answer.jiraKeys.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {answer.jiraKeys.map((jiraKey) => (
            <JiraKeyChip key={jiraKey} jiraKey={jiraKey} jiraBaseUrl={jiraBaseUrl} />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border-subtle pt-2 text-[11px] text-muted-foreground">
        {!answer.grounded && <Badge tone="warn">Not in StoryBoard data</Badge>}
        {result.provider === "claude-connector" && <span>Answered by your Claude</span>}
        {sources.length > 0 && <span className="min-w-0 truncate">From {sources.map((entry) => entry.label).join(" · ")}</span>}
        {canSpeak && (
          <button
            type="button"
            onClick={() => onReplay(answer.speech)}
            className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium hover:bg-muted hover:text-foreground"
            aria-label="Read this answer aloud"
          >
            <Volume2 className="size-3.5" /> Play
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * `voiceRef` exposes `startVoice()` so the floating button can open Ask AND start listening within
 * one tap — iOS only allows the mic and audio playback from inside a gesture.
 *
 * `userKey` (the signed-in user's email) picks whose stored conversation this is (chat-store.js).
 *
 * @param {{ context: object, contextLabel?: string, variant?: "panel"|"page", autoFocus?: boolean,
 *   voiceRef?: import("react").Ref<{ startVoice: () => void }>, userKey?: string }} props
 */
export function AskChat({ context, contextLabel, variant = "panel", autoFocus = false, voiceRef, userKey }) {
  const isPage = variant === "page";
  const { turns, busy, note, error, ask, reset } = useAsk(context, userKey);
  const [mutedPref, setMutedPref] = useLocalPref(MUTE_KEY, "false");
  const muted = mutedPref === "true";
  const [draft, setDraft] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const speakRef = useRef(null);

  const submit = useCallback(
    async (text, { spoken = false } = {}) => {
      const result = await ask(text);
      if (result && spoken) speakRef.current?.(result.answer.speech, { voice: result.voice });
    },
    [ask],
  );

  const speech = useSpeech({
    muted,
    onFinal: (text) => submit(text, { spoken: true }),
  });

  useEffect(() => {
    speakRef.current = speech.speak;
    // An answer that lands after the panel closed is kept in the chat, but not spoken.
    return () => {
      speakRef.current = null;
    };
  }, [speech.speak]);

  useImperativeHandle(
    voiceRef,
    () => ({
      // No recognition (Firefox, iOS with Dictation off): type instead — the keyboard's own
      // dictation key still works there.
      startVoice: () => (speech.canListen ? speech.listen() : inputRef.current?.focus()),
    }),
    [speech],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, busy]);

  const handleTyped = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    speech.prime();
    submit(text);
  };

  const handleMic = () => {
    if (speech.listening) speech.stopListening();
    else speech.listen();
  };

  const starters = STARTERS[context.page] ?? STARTERS.default;
  const lastAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
  const showStarters = turns.length === 0 && !busy;
  const micLabel = speech.listening ? "Stop listening" : "Ask by voice";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2">
        {contextLabel && (
          <span className="min-w-0 truncate rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            Asking about: {contextLabel}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {speech.canSpeak && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setMutedPref(String(!muted))}
              aria-label={muted ? "Unmute spoken answers" : "Mute spoken answers"}
              title={muted ? "Unmute spoken answers" : "Mute spoken answers"}
            >
              {muted ? <VolumeX /> : <Volume2 />}
            </Button>
          )}
          {turns.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => {
                speech.stopSpeaking();
                reset();
              }}
              disabled={busy}
              aria-label="Start a new conversation"
              title="New conversation"
            >
              <RotateCcw />
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {showStarters && (
          <div className="flex flex-col gap-3">
            <p className={cn("text-muted-foreground", isPage ? "text-base" : "text-sm")}>
              Ask anything about your sprints, teams and bugs. Answers come only from StoryBoard data you can see.
            </p>
            <div className="flex flex-wrap gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => {
                    speech.prime();
                    submit(starter);
                  }}
                  className="rounded-full border bg-card px-3 py-1.5 text-left text-sm text-secondary-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
              {turn.text}
            </div>
          ) : (
            <AnswerCard
              key={turn.id}
              result={turn.result}
              large={isPage && turn === lastAssistant}
              onReplay={(text) => speech.speak(text, { voice: turn.result.voice })}
              canSpeak={speech.canSpeak}
            />
          ),
        )}

        {busy && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground" role="status">
            <BrandLoader tone="light" className="size-6" /> {note || "Checking StoryBoard…"}
          </div>
        )}

        {!busy && lastAssistant && lastAssistant.result.answer.followUps.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {lastAssistant.result.answer.followUps.map((followUp) => (
              <button
                key={followUp}
                type="button"
                onClick={() => {
                  speech.prime();
                  submit(followUp);
                }}
                className="rounded-full border border-dashed bg-card px-3 py-1 text-left text-xs text-secondary-foreground hover:border-primary/40 hover:text-foreground"
              >
                {followUp}
              </button>
            ))}
          </div>
        )}

        <DialogError>{error || speech.speechError}</DialogError>
        <div ref={endRef} />
      </div>

      <div className={cn("border-t border-border-subtle px-4", isPage ? "pb-6 pt-4" : "py-3")}>
        {isPage && speech.canListen && (
          <div className="mb-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleMic}
              disabled={busy}
              aria-label={micLabel}
              aria-pressed={speech.listening}
              className={cn(
                "flex size-20 items-center justify-center rounded-full text-white shadow-brand transition-transform active:scale-95 disabled:opacity-50",
                speech.listening ? "animate-pulse bg-danger" : "bg-primary",
              )}
            >
              {speech.listening ? <Square className="size-7" /> : <Mic className="size-9" />}
            </button>
            <span className="min-h-5 text-center text-sm text-muted-foreground">
              {speech.listening ? speech.interim || "Listening… tap to stop" : busy ? "" : "Tap to ask"}
            </span>
          </div>
        )}

        <form onSubmit={handleTyped} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={speech.listening && !isPage ? speech.interim : draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={speech.listening ? "Listening…" : "Type a question…"}
            aria-label="Your question"
            maxLength={1000}
            disabled={busy || speech.listening}
            autoFocus={autoFocus}
            enterKeyHint="send"
            className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />
          {!isPage && speech.canListen && (
            <Button
              type="button"
              variant={speech.listening ? "destructive" : "secondary"}
              size="icon"
              className="size-10"
              onClick={handleMic}
              disabled={busy}
              aria-label={micLabel}
              aria-pressed={speech.listening}
              title={micLabel}
            >
              {speech.listening ? <Square /> : <Mic />}
            </Button>
          )}
          <Button type="submit" size="icon" className="size-10" disabled={busy || !draft.trim()} aria-label="Send question">
            <SendHorizontal />
          </Button>
        </form>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          AI-written from StoryBoard data — verify before sharing.
          {speech.canListen ? " Voice is processed by your browser's speech service." : " Voice input isn't available in this browser — type instead."}
          {lastAssistant?.result.voice === "elevenlabs" && " Answers are voiced by ElevenLabs."}
        </p>
      </div>
    </div>
  );
}
