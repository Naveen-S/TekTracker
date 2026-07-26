import { ExternalLink, Link2, ListOrdered, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/bugs/panel";

/**
 * The list panels (gm-bug-report.md (g)8–10): SLA breach call-outs, the ticket table, and the
 * reference links. Server components.
 *
 * As-built deviation from the spec's file list: three small list panels sharing the same row and
 * key-link primitives, so they live together rather than in three near-identical files.
 */
function IssueKey({ jiraKey, jiraBaseUrl }) {
  const className =
    "rounded border border-primary/25 bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground";
  if (!jiraBaseUrl) return <span className={className}>{jiraKey}</span>;
  return (
    <a
      href={`${jiraBaseUrl}/browse/${jiraKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, "hover:underline")}
    >
      {jiraKey}
    </a>
  );
}

const MAX_BREACH_ROWS = 8;

/** Worst-first SLA breaches — the RiskCalloutsPanel treatment applied to bugs. */
export function BugBreachPanel({ breached, jiraBaseUrl }) {
  if (breached.length === 0) {
    return (
      <Panel
        title="SLA breaches"
        subtitle="Bugs past their configured SLA"
        icon={ShieldAlert}
        tone="neutral"
      >
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed py-8 text-center">
          <p className="max-w-70 text-xs text-muted-foreground">
            Every open bug is inside its SLA. If you expected breaches, check that SLA days are set
            per priority in Admin.
          </p>
        </div>
      </Panel>
    );
  }

  const shown = breached.slice(0, MAX_BREACH_ROWS);
  const worst = shown[0].daysOverSla;

  return (
    <Panel
      title="SLA breaches"
      subtitle="Worst first, by days past SLA"
      icon={ShieldAlert}
      tone="danger"
      aside={<Badge tone="danger">{breached.length} breached</Badge>}
    >
      <ul className="flex flex-col gap-1">
        {shown.map((issue) => (
          <li
            key={`${issue.scopeId}-${issue.jiraKey}`}
            className="relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 overflow-hidden rounded-md border border-danger/20 bg-danger-soft/40 py-1.5 pr-2.5 pl-2.5 transition-colors hover:bg-danger-soft/70"
          >
            {/* Severity as magnitude, not as a stripe: the row's tint depth tracks how far past
                SLA it is, so the worst offender reads hottest without a decorative accent bar. */}
            <span
              className="absolute inset-y-0 left-0 bg-danger/10"
              style={{ width: `${Math.round((issue.daysOverSla / worst) * 100)}%` }}
              aria-hidden="true"
            />
            <span className="relative text-[11px] font-bold whitespace-nowrap text-danger-strong tabular-nums">
              +{issue.daysOverSla}d
            </span>
            <span className="relative">
              <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
            </span>
            <span className="relative truncate text-xs" title={issue.title}>
              {issue.title}
            </span>
            <span className="relative text-[11px] whitespace-nowrap text-muted-foreground">
              {issue.priority ?? "—"}
            </span>
          </li>
        ))}
      </ul>
      {breached.length > shown.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          + {breached.length - shown.length} more — see the full list below.
        </p>
      )}
    </Panel>
  );
}

const MAX_TABLE_ROWS = 25;

/**
 * Oldest open bugs — the "what should we actually pick up" list. `asOf` is the page's request-time
 * clock (never `Date.now()` in render: impure, and it would disagree with every other panel).
 */
export function BugTicketTable({ issues, jiraBaseUrl, asOf }) {
  if (issues.length === 0) return null;
  const rows = issues.slice(0, MAX_TABLE_ROWS);

  return (
    <Panel
      title="Oldest open bugs"
      subtitle={`${rows.length} of ${issues.length} open bugs, oldest first`}
      icon={ListOrdered}
      tone="info"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-150 border-collapse text-sm">
          <thead>
            <tr className="border-b text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
              <th className="py-2 pr-3 text-left">Key</th>
              <th className="py-2 pr-3 text-left">Summary</th>
              <th className="py-2 pr-3 text-left">Status</th>
              <th className="py-2 pr-3 text-left">Priority</th>
              <th className="py-2 pr-3 text-left">Assignee</th>
              <th className="py-2 text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((issue) => {
              const ageDays = issue.jiraCreatedAt
                ? Math.floor((asOf.getTime() - new Date(issue.jiraCreatedAt).getTime()) / 86400000)
                : null;
              return (
                <tr
                  key={`${issue.scopeId}-${issue.jiraKey}`}
                  className="border-b transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="py-1.5 pr-3">
                    <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
                  </td>
                  <td className="max-w-100 truncate py-1.5 pr-3" title={issue.title}>
                    {issue.title}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-secondary-foreground">{issue.jiraStatus}</td>
                  <td className="py-1.5 pr-3 text-xs text-secondary-foreground">{issue.priority ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                    {issue.assigneeName ?? "Unassigned"}
                  </td>
                  <td className="py-1.5 text-right text-xs tabular-nums">
                    {ageDays === null ? "—" : `${ageDays}d`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Every configured scope as a Jira link, with the JQL that actually produced the numbers. */
export function BugReferenceLinks({ report, jiraBaseUrl }) {
  if (report.scopes.length === 0) return null;

  return (
    <Panel title="Reference" subtitle="The Jira filters behind these numbers" icon={Link2} tone="neutral">
      <ul className="flex flex-wrap gap-2">
        {report.scopes.map((scope) => {
          const href = scope.jiraFilterId
            ? `${jiraBaseUrl}/issues/?filter=${encodeURIComponent(scope.jiraFilterId)}`
            : `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(scope.resolvedJql ?? scope.jql ?? "")}`;
          return (
            <li key={scope.id}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={scope.resolvedJql ?? scope.jql ?? ""}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
              >
                {scope.name}
                {scope.jiraFilterId && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    #{scope.jiraFilterId}
                  </span>
                )}
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>
            </li>
          );
        })}
      </ul>
      {report.scopes.some((scope) => scope.resolvedAt) && (
        <p className="mt-3 text-xs text-muted-foreground">
          Saved-filter JQL is re-read from Jira on every refresh — hover a chip to see what it
          resolved to.
        </p>
      )}
    </Panel>
  );
}
