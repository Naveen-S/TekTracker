"use client";

/**
 * Claude Connector pairing card (claude-connector-analysis.md §Scope e, decision 9).
 *
 * Generates the personal connector token (shown ONCE — only its hash is stored), hands the user
 * copy-ready commands with this StoryBoard's own origin filled in, and shows live pairing status
 * (re-read every 5 s, so starting the connector flips it to "Online" without a refresh).
 */
import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, PlugZap, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogError } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, errorReference } from "@/lib/api-client";

const STATUS_POLL_MS = 5000;
const START_COMMAND = "node ~/.storyboard/connector.mjs start";

function relative(date) {
  if (!date) return "never";
  const seconds = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

function describeError(caught) {
  const reference = errorReference(caught);
  return reference ? `${caught.message} (${reference})` : caught.message;
}

function CommandBlock({ label, command }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-secondary-foreground">{label}</span>
      <div className="flex items-start gap-2 rounded-lg border bg-subtle p-2.5">
        <code className="min-w-0 flex-1 font-mono text-[11px] leading-relaxed break-all text-foreground">{command}</code>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy: ${label}`}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

export function ClaudeConnectorCard({ analysisEnabled }) {
  const [status, setStatus] = useState(null);
  // The one-time pairing command (holds the plaintext token) — built in the click handler, where
  // `window.location.origin` is this StoryBoard's own public origin.
  const [pairCommand, setPairCommand] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState("");


  useEffect(() => {
    let cancelled = false;
    const readStatus = async () => {
      try {
        const next = await apiFetch("/api/me/connector");
        if (!cancelled) setStatus(next);
      } catch (caught) {
        if (!cancelled) setError(describeError(caught));
      }
    };
    readStatus();
    const timer = setInterval(readStatus, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const generate = async () => {
    setError("");
    setBusy(true);
    try {
      const next = await apiFetch("/api/me/connector", { method: "POST" });
      const { origin } = window.location;
      setPairCommand(
        `mkdir -p ~/.storyboard && curl -fsSL ${origin}/storyboard-connector.mjs -o ~/.storyboard/connector.mjs && node ~/.storyboard/connector.mjs login ${origin} ${next.token}`,
      );
      setStatus(next);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setError("");
    setBusy(true);
    try {
      setStatus(await apiFetch("/api/me/connector", { method: "DELETE" }));
      setPairCommand(null);
      setConfirmRevoke(false);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground" aria-hidden="true">
          <Sparkles className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base leading-tight font-bold">Claude Connector</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Runs <strong className="font-semibold text-foreground">Analyse with Claude</strong> on your own Claude Code —
            your company subscription and your signed-in ORBIT DeepContext — and saves the result in StoryBoard for
            your team. Claude runs read-only: no shell, no files, nothing changed in Jira.
          </p>
        </div>
        {status && (
          <Badge tone={status.online ? "success" : status.paired ? "warn" : "neutral"} className="shrink-0">
            {status.online ? "● Online" : status.paired ? "Offline" : "Not paired"}
          </Badge>
        )}
      </div>

      {!analysisEnabled && (
        <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          An admin has not switched Claude analysis on yet — you can pair now and it will work once they do.
        </p>
      )}

      {status?.paired && (
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Last seen</dt>
          <dd>{relative(status.lastSeenAt)}</dd>
          <dt className="text-muted-foreground">Claude Code</dt>
          <dd>{status.claudeVersion ?? "—"}</dd>
          <dt className="text-muted-foreground">Connector</dt>
          <dd>{status.connectorVersion ?? "—"}</dd>
        </dl>
      )}

      <ol className="mt-5 flex list-decimal flex-col gap-4 pl-5 text-sm">
        <li>
          <span className="font-semibold">Before you start:</span>{" "}
          <span className="text-muted-foreground">
            Claude Code installed and signed in with your company account, and the ORBIT plugin signed in (run{" "}
            <code className="font-mono text-xs">/orbit:warmup</code> once in Claude Code). Node 18 or newer.
          </span>
        </li>
        <li className="flex flex-col gap-2">
          <span>
            <span className="font-semibold">Pair this machine.</span>{" "}
            <span className="text-muted-foreground">
              {pairCommand
                ? "Copy this now — the token is shown only once."
                : status?.paired
                  ? "Already paired. Generate a new token to pair another machine (the old one stops working)."
                  : "Generate a personal token, then run the command it gives you."}
            </span>
          </span>
          {pairCommand ? (
            <CommandBlock label="Download + pair (one time)" command={pairCommand} />
          ) : (
            <div>
              <Button onClick={generate} disabled={busy || !status}>
                {busy ? <Spinner /> : <KeyRound />}
                {status?.paired ? "Generate new token" : "Generate token"}
              </Button>
            </div>
          )}
        </li>
        <li className="flex flex-col gap-2">
          <span>
            <span className="font-semibold">Start it</span>{" "}
            <span className="text-muted-foreground">
              and keep the terminal open while you use analyses. The badge above turns Online.
            </span>
          </span>
          <CommandBlock label="Start" command={START_COMMAND} />
        </li>
      </ol>

      {status?.paired && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
          <PlugZap className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs text-muted-foreground">Lost the machine or token?</span>
          {confirmRevoke ? (
            <>
              <Button variant="destructive" size="sm" onClick={revoke} disabled={busy}>
                {busy ? <Spinner /> : <Trash2 />} Revoke now
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmRevoke(false)} disabled={busy}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmRevoke(true)}>
              Revoke pairing
            </Button>
          )}
        </div>
      )}

      <DialogError className="mt-4">{error}</DialogError>
    </section>
  );
}
