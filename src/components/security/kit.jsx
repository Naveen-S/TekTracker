import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { browseUrl, jqlUrl } from "@/lib/security/jql.mjs";

/**
 * Shared bits for the /security panels (security-vulnerability-tracker.md (d)). Server-safe.
 *
 * The frame follows the theme (modern-artifact-theme.md (k)): Tekion = the StoryBoard frame (app
 * neutrals, theme-accent pills); Modern = the artifact frame (lavender tints, gradient LIVE pill). The
 * neutral `sec-*` tokens and `sec-accent` are swapped per theme in globals.css; the colourful DATA is
 * the artifact's in both. Titles carry Lucide icon tiles in both themes — no emoji.
 *
 * "Every number links to its Jira JQL" — `JiraCount` is the one way a count is drawn. Severity is
 * ALWAYS written as text as well as shown by colour.
 */

export function SecPanel({ icon: Icon, title, tag, live = true, aside, className, children }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-sec-line bg-card p-5 modern:shadow-xs",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="flex flex-wrap items-center gap-2 font-display text-base leading-tight font-bold text-sec-ink">
          {Icon && (
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
              <Icon className="size-4" />
            </span>
          )}
          {title}
          {live && <LivePill />}
          {tag && <TagPill>{tag}</TagPill>}
        </h2>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

export function LivePill() {
  return (
    <span className="rounded-full bg-sec-accent px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase modern:bg-linear-to-r modern:from-sec-blue modern:to-sec-purple">
      Live
    </span>
  );
}

export function TagPill({ children, className }) {
  return (
    <span className={cn("rounded-full bg-sec-lavender px-2 py-0.5 text-[10px] font-bold tracking-wider text-sec-ink uppercase", className)}>
      {children}
    </span>
  );
}

export function JiraCount({ jiraBaseUrl, jql, children, className, strong = false, title }) {
  const href = jqlUrl(jiraBaseUrl, jql);
  if (!href) return <span className={cn("tabular-nums", className)}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title ?? "Open these issues in Jira"}
      className={cn(
        "tabular-nums underline decoration-dotted decoration-1 underline-offset-3 transition-colors hover:text-sec-accent",
        strong && "font-bold",
        className,
      )}
    >
      {children}
    </a>
  );
}

export function IssueLink({ jiraBaseUrl, issueKey, className }) {
  const href = browseUrl(jiraBaseUrl, issueKey);
  if (!href) return <span className={className}>{issueKey}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("font-semibold text-sec-accent hover:underline", className)}>
      {issueKey}
    </a>
  );
}

/** An artifact-style link chip (lavender, turns into the blue→purple gradient on hover). */
export function JiraLinkText({ jiraBaseUrl, jql, children, className }) {
  const href = jqlUrl(jiraBaseUrl, jql);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-sec-line bg-sec-lavender-soft px-2.5 py-1 text-xs font-medium text-sec-accent transition-colors hover:border-transparent hover:bg-sec-accent hover:text-white modern:hover:bg-linear-to-r modern:hover:from-sec-blue modern:hover:to-sec-purple",
        className,
      )}
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </a>
  );
}

/** Severity → chip / heatmap-cell classes, on the artifact palette. Literal strings for Tailwind. */
export const SEVERITY_CHIP = {
  High: "bg-sec-pink-tint text-sec-pink-text",
  Medium: "bg-sec-amber-tint text-sec-amber-text",
  Low: "bg-sec-blue-tint text-sec-blue-text",
  Clear: "bg-sec-lavender-soft text-sec-muted",
};

export const SEVERITY_CELL = {
  High: "bg-sec-pink/20 text-sec-pink-text",
  Medium: "bg-sec-amber/30 text-sec-amber-text",
  Low: "bg-sec-blue/15 text-sec-blue-text",
  Clear: "bg-sec-lavender-soft text-sec-muted",
};

export function SeverityChip({ severity, className }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        SEVERITY_CHIP[severity] ?? SEVERITY_CHIP.Clear,
        className,
      )}
    >
      {severity}
    </span>
  );
}

/** Remediated-% colour (the artifact's scorecard rule: ≥ 75 teal, ≥ 40 amber, else pink). */
export function pctTone(pct) {
  if (pct >= 75) return { text: "text-sec-teal", bar: "bg-sec-teal" };
  if (pct >= 40) return { text: "text-sec-amber-text", bar: "bg-sec-amber" };
  return { text: "text-sec-pink-text", bar: "bg-sec-pink" };
}

/** A count that is red when > 0 and blue when 0 (the artifact's `miss()`). */
export function MissCount({ value, children }) {
  return <span className={cn("font-bold tabular-nums", value > 0 ? "text-sec-pink-text" : "text-sec-blue-text")}>{children ?? value}</span>;
}

export const fmtDays = (value) => (value ? `${Math.round(value * 10) / 10}` : "—");

export function relativeTime(date, asOf) {
  if (!date) return "never";
  const minutes = Math.round((asOf.getTime() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
