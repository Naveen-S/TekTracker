import { ArrowUpRight, Check, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import { ITEM_STATUS_LABELS, KIND_SHORT } from "@/lib/sow/defaults.mjs";
import { formatDay } from "@/lib/sow/timeline.mjs";

/**
 * Shared bits for the /sow pages (sow-tracker.md (g)). Server-safe, app tokens only, so both
 * themes follow. Status is ALWAYS written as text as well as shown by colour.
 */

export const pctLabel = (pct) => (pct === null || pct === undefined ? "—" : `${Math.round(pct)}%`);

/** "in 10 days" / "today" / "3 days ago" for a signed day count (positive = future). */
export function relativeDays(days) {
  if (days === 0) return "today";
  const count = Math.abs(days);
  const unit = count === 1 ? "day" : "days";
  return days > 0 ? `in ${count} ${unit}` : `${count} ${unit} ago`;
}

export function relativeTime(iso, now = Date.now()) {
  if (!iso) return "never";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
}

const HEALTH_TONE = {
  COMPLETE: "bg-success-soft text-success-strong",
  ON_TRACK: "bg-success-soft text-success-strong",
  AT_RISK: "bg-warn-soft text-warn-strong",
  BEHIND: "bg-danger-soft text-danger-strong",
  NOT_STARTED: "bg-muted text-secondary-foreground",
};

export function HealthChip({ health, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        HEALTH_TONE[health.key] ?? HEALTH_TONE.NOT_STARTED,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {health.label}
    </span>
  );
}

const ITEM_TONE = {
  NOT_STARTED: "bg-muted text-secondary-foreground",
  IN_PROGRESS: "bg-info-soft text-info-strong",
  DONE: "bg-success-soft text-success-strong",
  AT_RISK: "bg-warn-soft text-warn-strong",
};

export function ItemStatusChip({ status, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", ITEM_TONE[status], className)}>
      {status === "DONE" && <Check className="size-3" aria-hidden="true" />}
      {ITEM_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const STATE_TONE = {
  done: "bg-success-soft text-success-strong",
  inProgress: "bg-info-soft text-info-strong",
  todo: "bg-muted text-secondary-foreground",
};

/** A ticket's raw Jira status, toned by its progress state. */
export function JiraStatusChip({ status, state }) {
  return (
    <span className={cn("inline-flex max-w-36 items-center truncate rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", STATE_TONE[state])}>
      {status}
    </span>
  );
}

export function KindTag({ kind }) {
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-secondary-foreground uppercase whitespace-nowrap">
      {KIND_SHORT[kind] ?? kind}
    </span>
  );
}

export function GateMark({ className }) {
  return <Diamond className={cn("size-3 shrink-0 fill-current text-primary", className)} aria-label="Gate milestone" />;
}

/** Done + in-progress shares of a count, as one thin stacked bar. */
export function StackBar({ done, inProgress, total, className }) {
  const share = (count) => (total > 0 ? `${(count / total) * 100}%` : "0%");
  return (
    <div className={cn("flex h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} aria-hidden="true">
      <span className="bg-success transition-[width] duration-500" style={{ width: share(done) }} />
      <span className="bg-info transition-[width] duration-500" style={{ width: share(inProgress) }} />
    </div>
  );
}

/** A weighted-% bar, with an optional tick where a straight-line schedule expects it to be. */
export function ProgressBar({ pct, expectedPct = null, className, barClassName }) {
  const width = Math.min(100, Math.max(0, pct ?? 0));
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-muted", className)} aria-hidden="true">
      <span className={cn("block h-full rounded-full bg-primary transition-[width] duration-700 ease-out", barClassName)} style={{ width: `${width}%` }} />
      {expectedPct !== null && (
        <span
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-foreground/60"
          style={{ left: `${Math.min(100, Math.max(0, expectedPct))}%` }}
        />
      )}
    </div>
  );
}

export function IssueKeyLink({ jiraBaseUrl, issueKey, className }) {
  const classes = cn("font-mono text-xs font-semibold whitespace-nowrap", className);
  if (!jiraBaseUrl) return <span className={classes}>{issueKey}</span>;
  return (
    <a
      href={`${jiraBaseUrl}/browse/${issueKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(classes, "text-primary hover:underline")}
    >
      {issueKey}
    </a>
  );
}

/** "Open in Jira" for a set of keys (capped — a longer list links nowhere rather than truncating). */
export function JiraKeysLink({ jiraBaseUrl, keys, children }) {
  if (!jiraBaseUrl || keys.length === 0 || keys.length > 150) return null;
  const jql = `key in (${keys.join(", ")}) ORDER BY key`;
  return (
    <a
      href={`${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}

/** Baseline → current, with the slip called out. One date when they agree. */
export function PlanDates({ item, className }) {
  const slipped = item.slip !== null && item.slip !== 0;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs tabular-nums", className)}>
      {slipped && <span className="text-muted-foreground line-through">{formatDay(item.baselineDate)}</span>}
      <span className={cn("font-medium", item.overdue && "text-danger-strong")}>{formatDay(item.currentDate)}</span>
      {slipped && (
        <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", item.slip > 0 ? "bg-warn-soft text-warn-strong" : "bg-success-soft text-success-strong")}>
          {item.slip > 0 ? `+${item.slip} d` : `${item.slip} d`}
        </span>
      )}
      {item.overdue && <span className="text-[10px] font-bold tracking-wide text-danger-strong uppercase">past due</span>}
    </span>
  );
}
