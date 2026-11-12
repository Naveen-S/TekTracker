"use client";

/**
 * Ticket rows for the /sow page (sow-tracker.md (g)): an epic with its rolled-up % and its child
 * tickets behind a disclosure, and a plain capped list for everything else (bugs, RELB, orphans).
 */
import { useState } from "react";
import { ChevronRight, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { IssueKeyLink, JiraStatusChip, KindTag, ProgressBar, StackBar, pctLabel } from "./sow-kit";

const LIST_CAP = 8;
const STATE_ORDER = { inProgress: 0, todo: 1, done: 2 };

const byState = (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.key.localeCompare(b.key, undefined, { numeric: true });

export function TicketRow({ issue, jiraBaseUrl, showKind = false }) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2">
      <IssueKeyLink jiraBaseUrl={jiraBaseUrl} issueKey={issue.key} className="w-24 shrink-0" />
      <span className={cn("min-w-0 flex-1 basis-64 truncate text-sm", issue.state === "done" && "text-muted-foreground")} title={issue.summary}>
        {issue.summary}
      </span>
      <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5">
        {issue.isDependency && (
          <span className="inline-flex items-center gap-1 rounded-md bg-warn-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-warn-strong uppercase" title="Owned by another team">
            <GitBranch className="size-3" aria-hidden="true" />
            {issue.projectKey}
          </span>
        )}
        {showKind && <KindTag kind={issue.kind} />}
        <span className="hidden w-28 truncate text-right text-xs text-muted-foreground lg:block">{issue.assigneeName ?? "Unassigned"}</span>
        <JiraStatusChip status={issue.status} state={issue.state} />
      </span>
    </li>
  );
}

/** A flat list, open work first, showing the first few with a "Show all" toggle. */
export function TicketList({ issues, jiraBaseUrl, showKind = false, emptyLabel = "No tickets yet." }) {
  const [expanded, setExpanded] = useState(false);
  if (issues.length === 0) return <p className="py-2 text-sm text-muted-foreground">{emptyLabel}</p>;
  const sorted = [...issues].sort(byState);
  const shown = expanded ? sorted : sorted.slice(0, LIST_CAP);
  return (
    <>
      <ul className="divide-y">
        {shown.map((issue) => (
          <TicketRow key={issue.key} issue={issue} jiraBaseUrl={jiraBaseUrl} showKind={showKind} />
        ))}
      </ul>
      {sorted.length > LIST_CAP && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary hover:bg-accent">
          {expanded ? "Show fewer" : `Show all ${sorted.length}`}
        </button>
      )}
    </>
  );
}

/** One epic: key, title, rolled-up weighted % and counts; its children behind a disclosure. */
export function EpicRow({ epic, tickets, jiraBaseUrl, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const empty = epic.childCount === 0;
  return (
    <li className="rounded-lg border bg-card">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={empty}
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} tickets under ${epic.key}`}
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40"
        >
          <ChevronRight className={cn("size-4 transition-transform duration-200", open && "rotate-90")} aria-hidden="true" />
        </button>
        <IssueKeyLink jiraBaseUrl={jiraBaseUrl} issueKey={epic.key} className="shrink-0" />
        <span className="min-w-0 flex-1 basis-56 truncate text-sm font-semibold" title={epic.summary}>
          {epic.summary}
        </span>
        <div className="flex w-full shrink-0 items-center gap-3 sm:w-64">
          <ProgressBar pct={epic.pct} className="flex-1" />
          <span className="w-10 text-right text-sm font-bold tabular-nums">{pctLabel(epic.pct)}</span>
        </div>
        <span className="w-full text-xs text-muted-foreground tabular-nums sm:w-auto">
          {empty ? "No tickets yet" : `${epic.done} done · ${epic.inProgress} in progress · ${epic.todo} to do`}
        </span>
      </div>
      {open && !empty && (
        <div className="border-t px-3 pb-2 sm:pl-12">
          <StackBar done={epic.done} inProgress={epic.inProgress} total={epic.total} className="my-2" />
          <TicketList issues={tickets} jiraBaseUrl={jiraBaseUrl} showKind />
        </div>
      )}
    </li>
  );
}
