"use client";

/**
 * The full-screen `/ask` page (ask-storyboard.md (f)) — the phone's way in: home-screen icon or a
 * Siri / Assistant shortcut → this page → tap the mic. Scope (my teams / a program / one team) and
 * sprint live in the URL so a shortcut can be pre-scoped ("Ask StoryBoard — GM"). Changing either
 * starts a fresh conversation (the chat is keyed on the scope).
 */
import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Smartphone } from "lucide-react";
import { BrandMark, Wordmark } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { AskChat } from "./ask-chat";

const noopSubscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

function PhoneSetupDialog({ askUrl, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(askUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Dialog
      open
      icon={Smartphone}
      hero
      title="Use Ask StoryBoard on your phone"
      description="Open the link on your phone once, then ask by voice from the home screen or Siri."
      onClose={onClose}
      size="md"
      footer={<DialogClose>Done</DialogClose>}
    >
      <div className="flex flex-col gap-4 text-sm text-secondary-foreground">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{askUrl}</code>
          <Button type="button" variant="secondary" size="sm" onClick={copy}>
            <Copy /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <section>
          <h3 className="mb-1 font-semibold text-foreground">iPhone</h3>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>Open this link in Safari and sign in once.</li>
            <li>
              <strong>Hey Siri:</strong> open the Shortcuts app → <em>+</em> → <em>Open URLs</em> → paste the link →
              name it <em>“Ask StoryBoard”</em>. Then say “Hey Siri, Ask StoryBoard”.
            </li>
            <li>
              <strong>Home screen:</strong> in that shortcut tap <em>Share → Add to Home Screen</em> for a one-tap icon.
            </li>
            <li>Speech needs Siri &amp; Dictation turned on (Settings → Siri).</li>
          </ol>
        </section>
        <section>
          <h3 className="mb-1 font-semibold text-foreground">Android</h3>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>Open this link in Chrome and sign in once.</li>
            <li>
              Chrome menu → <em>Add to Home screen</em> (or <em>Install app</em>). Long-press the StoryBoard icon for the{" "}
              <em>Ask</em> shortcut.
            </li>
          </ol>
        </section>
        <p className="text-xs text-muted-foreground">
          Tap the mic once each time — phones don&apos;t let a web page switch the microphone on by itself.
        </p>
      </div>
    </Dialog>
  );
}

export function AskMobile({ askEnabled, scopeOptions, scopeValue, sprints, sprintId, context, contextLabel, userKey }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const [showSetup, setShowSetup] = useState(false);
  const origin = useSyncExternalStore(noopSubscribe, getOrigin, getServerOrigin);

  const navigate = ({ scope = scopeValue, sprint = sprintId }) => {
    const params = new URLSearchParams();
    if (scope.startsWith("program:")) params.set("program", scope.slice("program:".length));
    if (scope.startsWith("team:")) params.set("team", scope.slice("team:".length));
    if (sprint) params.set("sprint", sprint);
    const query = params.toString();
    startSwitch(() => router.push(query ? `/ask?${query}` : "/ask"));
  };

  const query = new URLSearchParams(
    Object.entries({
      program: scopeValue.startsWith("program:") ? scopeValue.slice(8) : "",
      team: scopeValue.startsWith("team:") ? scopeValue.slice(5) : "",
    }).filter(([, value]) => value),
  ).toString();
  const askUrl = `${origin}/ask${query ? `?${query}` : ""}`;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b bg-card px-4">
        <BrandMark tone="light" className="size-7" />
        <Wordmark className="text-sm" />
        <div className="ml-auto flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSetup(true)} aria-label="Use on your phone">
            <Smartphone /> <span className="hidden sm:inline">Use on phone</span>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">Board</Link>
          </Button>
        </div>
      </header>

      {askEnabled ? (
        <>
          <div className="flex shrink-0 gap-2 border-b bg-card px-4 py-2">
            <Select
              aria-label="What to ask about"
              className="min-w-0 flex-1"
              value={scopeValue}
              disabled={switching}
              onChange={(event) => navigate({ scope: event.target.value })}
            >
              {scopeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            {sprints.length > 0 && (
              <Select
                aria-label="Sprint"
                className="w-40 shrink-0"
                value={sprintId ?? ""}
                disabled={switching}
                onChange={(event) => navigate({ sprint: event.target.value })}
              >
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
            <AskChat
              key={`${scopeValue}|${sprintId ?? ""}`}
              context={context}
              contextLabel={contextLabel}
              variant="page"
              userKey={userKey}
            />
          </main>
        </>
      ) : (
        <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <h1 className="font-display text-lg font-bold">Ask StoryBoard isn&apos;t switched on</h1>
          <p className="text-sm text-muted-foreground">
            An admin needs to enable Claude analysis (Admin → Claude analysis) or configure an AI provider before
            questions can be answered.
          </p>
        </main>
      )}

      {showSetup && <PhoneSetupDialog askUrl={askUrl} onClose={() => setShowSetup(false)} />}
    </div>
  );
}
