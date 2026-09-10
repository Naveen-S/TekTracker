"use client";

/**
 * Route-level error boundary (observability-and-errors.md pillar 5).
 *
 * Without this file, a throw inside a server component — `getDashboardData` has no error handling
 * of its own, so any Prisma failure qualifies — renders Next's unstyled default screen, which in
 * production shows nothing but a digest hash. The user then reports "the dashboard is broken" and
 * the digest, the one string that ties their report to a server log line, is never captured.
 *
 * So: show the digest, make it copyable, and offer the two actions that actually help (retry, go
 * back to a known-good page). The real error is logged server-side by `onRequestError` in
 * src/instrumentation.js, keyed by the same digest.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }) {
  const [copied, setCopied] = useState(false);
  const reference = error?.digest ?? null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `StoryBoard error\nreference: ${reference ?? "(none)"}\npage: ${window.location.pathname}\nwhen: ${new Date().toISOString()}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-125 rounded-2xl border bg-card p-8 shadow-md">
        <h1 className="font-display text-xl font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This page failed to load. The failure has been recorded on the server — an admin can find
          it in <span className="font-medium text-foreground">Admin → Recent errors</span> using the
          reference below.
        </p>

        {reference && (
          <div className="mt-5 rounded-lg border bg-muted/40 px-3 py-2.5">
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Reference
            </div>
            <code className="font-mono text-[13px] break-all text-foreground">{reference}</code>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={copy}>
            {copied ? "Copied" : "Copy reference"}
          </Button>
          <Button variant="ghost" onClick={() => window.location.assign("/")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
