"use client";

import { useState } from "react";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorReference, errorDiagnostics } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * App-level alert modal (port of AppAlertModal) — sync summaries render multiline.
 *
 * When the caller passes the original `error` (via `alertFromError`), the dialog also shows the
 * diagnostic reference — `JIRA_API · r7k2q9xf` — and offers to copy the whole envelope
 * (observability-and-errors.md). That reference is the same id in the server log line and in
 * Admin → Recent errors, which is what turns "sync failed" into something traceable.
 */
export function AlertDialog({ alert, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!alert) return null;

  const reference = alert.error ? errorReference(alert.error) : null;
  // A neutral notice gets the info tile — only an explicit success earns the green check.
  const tone = ["error", "warn", "success"].includes(alert.tone) ? alert.tone : "info";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(errorDiagnostics(alert.error));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog
      open
      title={alert.title}
      tone={tone}
      hero
      onClose={onClose}
      size="sm"
      footerStart={
        reference && (
          <Button variant="ghost" onClick={copy}>
            {copied ? "Copied" : "Copy diagnostics"}
          </Button>
        )
      }
      footer={<DialogClose variant="default">OK</DialogClose>}
    >
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-relaxed",
          // A one-line message centres under the hero; a multi-line sync summary reads left-aligned.
          !String(alert.body ?? "").includes("\n") && "text-center text-pretty",
          tone === "error" ? "text-danger-strong" : "text-foreground",
        )}
      >
        {alert.body}
      </p>

      {reference && (
        <p className="mt-3 rounded-md bg-subtle px-2.5 py-1.5 font-mono text-[11px] break-all text-muted-foreground">
          {reference}
        </p>
      )}
    </Dialog>
  );
}

/**
 * Build the alert payload from a caught `apiFetch` error, keeping the original error around so the
 * dialog can show its reference. Every failure path in the dashboard funnels through this, so the
 * reference can never be forgotten at one call site.
 *
 * @param {string} title
 * @param {Error} error
 * @param {{ tone?: "error" | "warn" }} [options]
 */
export function alertFromError(title, error, { tone = "error" } = {}) {
  return { title, body: error?.message ?? "Something went wrong", tone, error };
}
