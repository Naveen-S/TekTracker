"use client";

/**
 * Per-ticket Claude analysis dialog (claude-connector-analysis.md §Scope e).
 *
 * One GET (`/api/analyses/[jiraKey]`) returns everything: the saved latest-only analysis, the job
 * in flight (or the caller's own last failure), the admin's allowed models, and the caller's
 * connector status. While a job is QUEUED/RUNNING the dialog re-reads every 2 s and shows the live
 * progress line the connector posts. "Run" is disabled unless the caller's connector is online
 * (decision 10 — no hidden queue). Model output renders as escaped React text; only https URLs the
 * server already sanitized become links.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, PlugZap, RefreshCw, Sparkles } from "lucide-react";
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { BrandLoader } from "@/components/ui/brand";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, errorReference } from "@/lib/api-client";
import { KIND_LABELS } from "@/lib/ai/issue-analysis.mjs";
import { useAnalysis } from "@/components/analysis/analysis-context";

const POLL_MS = 2000;
const START_COMMAND = "node ~/.storyboard/connector.mjs start";
const CONFIDENCE_TONE = { high: "success", medium: "info", low: "warn" };

function isActive(job) {
  return job?.status === "QUEUED" || job?.status === "RUNNING";
}

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
      <h4 className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <p className="text-xs text-secondary-foreground">
      <span className="font-semibold text-foreground">{label}:</span> {value}
    </p>
  );
}

function KeyChip({ jiraKey, jiraBaseUrl }) {
  const className = "rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground";
  if (!jiraBaseUrl) return <span className={className}>{jiraKey}</span>;
  return (
    <a href={`${jiraBaseUrl}/browse/${jiraKey}`} target="_blank" rel="noreferrer" className={`${className} hover:underline`}>
      {jiraKey}
    </a>
  );
}

function analysisToText(jiraKey, analysis) {
  const { result } = analysis;
  const lines = [`${KIND_LABELS[analysis.kind] ?? "Claude analysis"} — ${jiraKey}`, "", result.summary];
  if (result.rootCause?.hypothesis) lines.push("", `Root cause / approach: ${result.rootCause.hypothesis}`);
  for (const loc of result.rootCause?.locations ?? []) {
    lines.push(`- ${[loc.repo, loc.path, loc.symbol].filter(Boolean).join(" · ")}${loc.why ? ` — ${loc.why}` : ""}`);
  }
  if (result.security) lines.push("", `Security: ${[result.security.cve, result.security.affectedComponent, result.security.fixPath].filter(Boolean).join(" · ")}`);
  if (result.hygiene) lines.push("", `Suggested fix: sub-component ${result.hygiene.suggestedSubComponent ?? "—"}, fix version ${result.hygiene.suggestedFixVersion ?? "—"}`);
  if (result.similarTickets.length) lines.push("", `Similar: ${result.similarTickets.map((t) => t.key ?? t.title).join(", ")}`);
  if (result.nextSteps.length) lines.push("", "Next steps:", ...result.nextSteps.map((step) => `- ${step}`));
  return lines.join("\n");
}

function AnalysisBody({ jiraKey, analysis, jiraBaseUrl }) {
  const { result } = analysis;
  const isDelivery = analysis.kind === "DELIVERY";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{KIND_LABELS[analysis.kind] ?? "Claude analysis"}</Badge>
        <Badge tone={CONFIDENCE_TONE[result.confidence] ?? "neutral"}>{result.confidence} confidence</Badge>
      </div>
      <p className="text-sm leading-relaxed text-secondary-foreground">{result.summary}</p>

      {result.rootCause && (
        <Section title={isDelivery ? "Implementation areas" : "Root cause"}>
          {result.rootCause.hypothesis && (
            <p className="text-xs leading-relaxed text-secondary-foreground">{result.rootCause.hypothesis}</p>
          )}
          {result.rootCause.locations.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {result.rootCause.locations.map((loc, index) => (
                <li key={index} className="rounded-md border border-border-subtle bg-subtle px-2.5 py-1.5">
                  <p className="font-mono text-[11px] font-semibold break-all text-foreground">
                    {[loc.repo, loc.path, loc.symbol].filter(Boolean).join(" · ")}
                    {loc.url && (
                      <a href={loc.url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex align-middle text-primary">
                        <ExternalLink className="size-3" aria-label="Open source" />
                      </a>
                    )}
                  </p>
                  {loc.why && <p className="text-xs text-muted-foreground">{loc.why}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {result.security && (
        <Section title="Security">
          <Field label="Advisory" value={result.security.cve} />
          <Field label="Affected component" value={result.security.affectedComponent} />
          {result.security.usages.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-secondary-foreground">
              {result.security.usages.map((usage, index) => (
                <li key={index}>{usage}</li>
              ))}
            </ul>
          )}
          <Field label="Exploitability" value={result.security.exploitability} />
          <Field label="Fix path" value={result.security.fixPath} />
        </Section>
      )}

      {result.hygiene && (
        <Section title="Suggested hygiene fix">
          <div className="flex flex-wrap gap-1.5">
            {result.hygiene.suggestedSubComponent && (
              <Badge tone="info">Sub-component: {result.hygiene.suggestedSubComponent}</Badge>
            )}
            {result.hygiene.suggestedFixVersion && (
              <Badge tone="info">Fix version: {result.hygiene.suggestedFixVersion}</Badge>
            )}
          </div>
          {result.hygiene.rationale && <p className="text-xs text-muted-foreground">{result.hygiene.rationale}</p>}
          <p className="text-[11px] text-muted-foreground italic">A suggestion only — update the ticket in Jira.</p>
        </Section>
      )}

      {result.similarTickets.length > 0 && (
        <Section title="Similar tickets">
          <ul className="flex flex-col divide-y divide-border-subtle">
            {result.similarTickets.map((ticket, index) => (
              <li key={index} className="flex flex-col gap-0.5 py-1.5 first:pt-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  {ticket.key && <KeyChip jiraKey={ticket.key} jiraBaseUrl={jiraBaseUrl} />}
                  {ticket.title && <span className="truncate text-xs text-secondary-foreground">{ticket.title}</span>}
                </span>
                {(ticket.resolution || ticket.why) && (
                  <span className="text-[11px] text-muted-foreground">
                    {[ticket.why, ticket.resolution && `Resolved: ${ticket.resolution}`].filter(Boolean).join(" · ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(result.triage || result.sizing) && (
        <Section title="Triage & sizing">
          <Field label="Team" value={result.triage?.team} />
          <Field label="Sub-component" value={result.triage?.subComponent} />
          <Field label="Priority" value={result.triage?.priority} />
          <Field label="Assignee" value={result.triage?.assignee} />
          <Field label="Size" value={result.sizing?.estimate} />
          {result.triage?.rationale && <p className="text-xs text-muted-foreground">{result.triage.rationale}</p>}
          {result.sizing?.basis && <p className="text-xs text-muted-foreground">{result.sizing.basis}</p>}
        </Section>
      )}

      {result.nextSteps.length > 0 && (
        <Section title="Next steps">
          <ol className="list-decimal pl-4 text-xs text-secondary-foreground">
            {result.nextSteps.map((step, index) => (
              <li key={index} className="py-0.5">
                {step}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {result.citations.length > 0 && (
        <Section title="Sources">
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {result.citations.map((citation, index) => (
              <li key={index}>
                <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  {citation.label} <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="border-t border-border-subtle pt-3 text-[11px] text-muted-foreground">
        {jiraKey} · analysed by {analysis.analyzedBy ?? "a former user"} ·{" "}
        {new Date(analysis.analyzedAt).toLocaleString()} · {analysis.model}
        {typeof analysis.costUsd === "number" ? ` · ~$${analysis.costUsd.toFixed(2)}` : ""} — AI-written;
        verify before acting.
      </p>
    </div>
  );
}

function ConnectorNotice({ connector }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warn/35 bg-warn-soft px-3 py-2.5 text-xs text-warn-strong">
      <PlugZap className="mt-px size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {connector.paired ? (
          <>
            <span className="font-semibold">Your StoryBoard Connector is offline.</span>
            <span>
              Start it in a terminal, then run the analysis:{" "}
              <code className="rounded-sm bg-card px-1 py-px font-mono text-[11px] text-foreground">{START_COMMAND}</code>
            </span>
          </>
        ) : (
          <span>
            <span className="font-semibold">Connect your Claude Code first.</span> Analyses run on your own Claude Code
            subscription through the StoryBoard Connector —{" "}
            <Link href="/settings" className="font-semibold underline">
              set it up in Settings
            </Link>
            .
          </span>
        )}
      </div>
    </div>
  );
}

export function IssueAnalysisDialog({ jiraKey, source, title, jiraBaseUrl, onClose }) {
  const { markAnalyzed } = useAnalysis();
  const [data, setData] = useState(null);
  const [model, setModel] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef(null);

  const load = useCallback(async () => {
    try {
      const next = await apiFetch(`/api/analyses/${encodeURIComponent(jiraKey)}`);
      setData(next);
      setModel((current) => current || next.settings.defaultModel);
      if (next.analysis && !isActive(next.job)) markAnalyzed(jiraKey);
      return next;
    } catch (loadError) {
      const reference = errorReference(loadError);
      setError(reference ? `${loadError.message} (${reference})` : loadError.message);
      return null;
    }
  }, [jiraKey, markAnalyzed]);

  // One poll loop: re-read every POLL_MS while a job is in flight; stops when it lands or the
  // dialog unmounts (`alive`), so a closed dialog never keeps fetching.
  const alive = useRef(true);
  const poll = useCallback(async () => {
    const step = async () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
      const next = await load();
      if (alive.current && isActive(next?.job)) pollTimer.current = setTimeout(step, POLL_MS);
    };
    await step();
  }, [load]);

  useEffect(() => {
    alive.current = true;
    poll();
    return () => {
      alive.current = false;
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [poll]);

  const handleRun = async () => {
    setError("");
    setStarting(true);
    try {
      await apiFetch("/api/analyses", { method: "POST", body: { jiraKey, source, model } });
      await poll();
    } catch (runError) {
      const reference = errorReference(runError);
      setError(reference ? `${runError.message} (${reference})` : runError.message);
      await load();
    } finally {
      setStarting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(analysisToText(jiraKey, data.analysis));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard unavailable — select the text and copy manually.");
    }
  };

  const running = isActive(data?.job);
  const failedJob = data?.job?.status === "FAILED" ? data.job : null;
  const connector = data?.connector;
  const canRun = Boolean(data?.settings.enabled && connector?.online && !running && !starting);

  return (
    <Dialog
      open
      title={`Claude analysis · ${jiraKey}`}
      description={title}
      onClose={onClose}
      size="lg"
      footer={
        <>
          {data?.analysis && !running && (
            <Button variant="secondary" onClick={handleCopy}>
              <Copy /> {copied ? "Copied" : "Copy"}
            </Button>
          )}
          {data && data.settings.allowedModels.length > 1 && (
            <Select
              aria-label="Model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              disabled={running || starting}
              className="h-9 w-32"
            >
              {data.settings.allowedModels.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          )}
          <Button
            onClick={handleRun}
            disabled={!canRun}
            title={data?.analysis ? "Replaces the saved analysis for everyone" : undefined}
          >
            {starting ? <Spinner /> : data?.analysis ? <RefreshCw /> : <Sparkles />}
            {data?.analysis ? "Re-run" : "Analyse"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!data && !error && (
          <div className="flex flex-col gap-2" role="status" aria-label="Loading analysis">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        )}

        {data && !data.settings.enabled && (
          <p className="text-xs text-muted-foreground">Claude analysis is turned off by an admin.</p>
        )}

        {data?.settings.enabled && connector && !connector.online && !running && (
          <ConnectorNotice connector={connector} />
        )}

        {running && (
          <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-subtle px-3 py-3" role="status">
            <BrandLoader tone="light" className="size-8 shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">
                {data.job.status === "QUEUED" ? "Waiting for the connector…" : "Claude is analysing…"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {data.job.progressNote ?? "Starting Claude Code…"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Requested by {data.job.requestedBy ?? "someone"} · {data.job.model} · usually 1–5 minutes. You can
                close this dialog; the result is saved.
              </span>
            </div>
          </div>
        )}

        {failedJob && !running && <DialogError>Last attempt failed: {failedJob.error ?? "unknown error"}</DialogError>}

        {data?.analysis && <AnalysisBody jiraKey={jiraKey} analysis={data.analysis} jiraBaseUrl={jiraBaseUrl} />}

        {data && !data.analysis && !running && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Claude reads this ticket through ORBIT DeepContext, looks for the likely root cause (or the code this work
            touches) and similar past tickets, and suggests triage and sizing. It runs on <em>your</em> Claude Code via
            the StoryBoard Connector — read-only, nothing is changed in Jira — and the result is saved here for
            everyone who can see this ticket.
          </p>
        )}

        <DialogError>{error}</DialogError>
      </div>
    </Dialog>
  );
}
