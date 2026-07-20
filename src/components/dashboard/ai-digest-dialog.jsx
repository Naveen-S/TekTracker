"use client";

/**
 * AI Digest dialog (ai-insights.md (d)) — on-demand generation via POST …/ai-digest, following
 * the ShareDialog mechanics (Hero button → dialog → action → clipboard + toast). Generation is
 * only ever user-initiated (decision 4 — the v1 cost control); nothing is persisted. Digest text
 * renders as plain React text nodes (escaped) — never HTML; only Jira keys the server already
 * validated against the board data become links.
 */
import { useState } from "react";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";

const SEVERITY_LABEL = { danger: "Danger", warn: "Warning", info: "Info" };

/** Plain-text rendering for the clipboard — the artifact is pasted into Slack/email updates. */
function digestToText(digest) {
  const lines = [digest.headline, "", ...digest.narrative.flatMap((paragraph) => [paragraph, ""])];
  if (digest.callouts.length > 0) {
    lines.push("Risk call-outs:");
    for (const callout of digest.callouts) {
      const keys = callout.jiraKeys.length > 0 ? ` (${callout.jiraKeys.join(", ")})` : "";
      lines.push(`- [${(SEVERITY_LABEL[callout.severity] ?? callout.severity).toUpperCase()}] ${callout.text}${keys}`);
    }
  }
  return lines.join("\n").trim();
}

function JiraKeyChip({ jiraKey, jiraBaseUrl }) {
  if (!jiraBaseUrl) {
    return (
      <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
        {jiraKey}
      </span>
    );
  }
  return (
    <a
      href={`${jiraBaseUrl}/browse/${jiraKey}`}
      target="_blank"
      rel="noreferrer"
      className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground hover:underline"
    >
      {jiraKey}
    </a>
  );
}

export function AiDigestDialog({ base, jiraBaseUrl, onClose, showToast }) {
  const [result, setResult] = useState(null); // { digest, generatedAt, provider, model }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");
    setBusy(true);
    try {
      setResult(await apiFetch(`${base}/ai-digest`, { method: "POST" }));
    } catch (generateError) {
      setError(generateError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(digestToText(result.digest));
      showToast("Digest copied to clipboard");
    } catch {
      setError("Clipboard unavailable — select the text and copy manually.");
    }
  };

  const digest = result?.digest ?? null;

  return (
    <Dialog open title="AI Digest" onClose={busy ? undefined : onClose}>
      <div className="flex flex-col gap-4">
        {!digest && !busy && (
          <p className="text-sm text-muted-foreground">
            Generate a leadership-ready sprint digest — headline, narrative, and risk call-outs —
            written from this board&apos;s current metrics, trend, and worst-health issues. Copy it
            into your weekly update.
          </p>
        )}

        {busy && (
          <div className="flex items-center gap-2.5 rounded-md border border-border-subtle px-3 py-3 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Writing digest…
          </div>
        )}

        {digest && !busy && (
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-base font-bold">{digest.headline}</h3>
            {digest.narrative.map((paragraph, index) => (
              <p key={index} className="text-sm leading-relaxed text-secondary-foreground">
                {paragraph}
              </p>
            ))}
            {digest.callouts.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
                <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                  Risk call-outs
                </p>
                <ul className="flex flex-col divide-y divide-border-subtle">
                  {digest.callouts.map((callout, index) => (
                    <li key={index} className="flex items-start gap-2 py-2">
                      <Badge tone={callout.severity} className="shrink-0">
                        {SEVERITY_LABEL[callout.severity] ?? callout.severity}
                      </Badge>
                      <span className="min-w-0 flex-1 pt-0.5 text-xs text-secondary-foreground">
                        {callout.text}
                        {callout.jiraKeys.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {callout.jiraKeys.map((jiraKey) => (
                              <JiraKeyChip key={jiraKey} jiraKey={jiraKey} jiraBaseUrl={jiraBaseUrl} />
                            ))}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Generated {new Date(result.generatedAt).toLocaleString()} · {result.provider} ·{" "}
              {result.model} — AI-written; verify against the board before sharing.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          {digest && !busy && (
            <>
              <Button variant="secondary" onClick={handleCopy}>
                <Copy /> Copy
              </Button>
              <Button variant="secondary" onClick={handleGenerate}>
                <RefreshCw /> Regenerate
              </Button>
            </>
          )}
          {!digest && (
            <Button onClick={handleGenerate} disabled={busy}>
              <Sparkles /> {busy ? "Generating…" : "Generate digest"}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
