import { Tags, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { IssueKey } from "@/components/dashboard/risk-callouts-panel";
import { formatPoints } from "@/lib/metrics.mjs";

/**
 * "Needs attention" hygiene panel (needs-attention-roster.md) — the always-on track of a team's own
 * work (surfaced by the roster's assignee emails) that is missing a sub-component or a fix version,
 * so it falls through every sub-component-scoped filter and would otherwise be invisible. Server-safe
 * like RiskCalloutsPanel; `track` is the partitioned NEEDS_ATTENTION filter (with its cached issues)
 * or null when the team has no roster — in which case the panel renders nothing.
 *
 * Each row is present only because ONE of the two fields is empty. `fixVersions` is cached, so a
 * missing fix version is named precisely; otherwise the sub-component is the gap. (Precise
 * dual-badging of items missing BOTH is the documented follow-up — it needs Issue.subComponent.)
 */

const MAX_ROWS = 8;

function hygieneGap(issue) {
  return issue.fixVersions == null
    ? { label: "No fix version", tone: "info" }
    : { label: "No sub-component", tone: "warn" };
}

/** Shared panel chrome: top stripe + icon-tile header, so the populated and empty states match. */
function PanelShell({ stripe, children }) {
  return (
    <section
      className="relative flex flex-col overflow-hidden rounded-lg border bg-card p-4 pt-4.5"
      aria-label="Needs attention"
    >
      <span className={`absolute inset-x-0 top-0 h-0.75 ${stripe}`} aria-hidden="true" />
      {children}
    </section>
  );
}

function PanelHeader({ subtitle, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-md bg-warn-soft text-warn-strong"
          aria-hidden="true"
        >
          <Tags className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Needs attention
          </p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

export function NeedsAttentionPanel({ track, jiraBaseUrl, canManage = false }) {
  // No track yet: managers get a one-line "how to turn it on" prompt so the feature is discoverable
  // instead of silently absent; everyone else sees nothing (no clutter). The track only exists once a
  // roster is set AND a sync has run (needs-attention-roster.md — always present, auto-refreshed).
  if (!track) {
    if (!canManage) return null;
    return (
      <PanelShell stripe="bg-border-strong">
        <PanelHeader subtitle="Surface untagged items assigned to your team" />
        <p className="mt-3 text-sm text-secondary-foreground">
          Add your scrum team&rsquo;s member emails in{" "}
          <Link href="/admin" className="font-medium text-primary hover:underline">
            Admin
          </Link>
          , then{" "}
          <strong className="font-medium text-foreground">Sync Jira</strong>
          {" "}to surface their items missing a sub-component or fix version — a hygiene surface no
          other filter catches.
        </p>
        <Link
          href="/admin"
          className="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
        >
          Set team members
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </PanelShell>
    );
  }

  // Bigger, more-impactful gaps first (then stable by key), like the risk call-outs ranking.
  const items = [...(track.issues ?? [])].sort(
    (a, b) => b.storyPoints - a.storyPoints || a.jiraKey.localeCompare(b.jiraKey),
  );
  const shown = items.slice(0, MAX_ROWS);
  const overflow = items.length - shown.length;
  const noFixCount = items.filter((issue) => issue.fixVersions == null).length;
  const noSubCount = items.length - noFixCount;
  const clear = items.length === 0;
  // Same items in Jira's issue navigator — the NA filter's generated JQL, run live in Jira.
  const jiraSearchUrl =
    jiraBaseUrl && track.jql ? `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(track.jql)}` : null;

  return (
    <PanelShell stripe={clear ? "bg-success" : "bg-warn"}>
      <PanelHeader
        subtitle="Assigned to the team but missing a sub-component or fix version"
        right={
          <div className="flex items-center gap-2.5">
            {!clear && (
              <span className="text-xs text-muted-foreground">
                {items.length} item{items.length === 1 ? "" : "s"} · {noSubCount} no sub-component ·{" "}
                {noFixCount} no fix version
              </span>
            )}
            {jiraSearchUrl && (
              <a
                href={jiraSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                View in Jira
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        }
      />

      {clear ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
          All clear — every assigned item has a sub-component and a fix version.
        </div>
      ) : (
        // Subgrid tracks so chip / key / title / pts align across rows (mirrors RiskCalloutsPanel).
        <ul className="mt-2 grid grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-x-2 divide-y divide-border-subtle">
          {shown.map((issue) => {
            const gap = hygieneGap(issue);
            return (
              <li
                key={`${issue.filterId}:${issue.jiraKey}`}
                className="col-span-full grid grid-cols-subgrid items-start py-2"
              >
                <Badge tone={gap.tone} className="justify-self-start">
                  {gap.label}
                </Badge>
                <span className="justify-self-start pt-0.5">
                  <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block min-w-0 truncate text-xs text-secondary-foreground">
                    {issue.title}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {issue.assigneeName ?? "Unassigned"} · {issue.issueType}
                    {issue.jiraStatus ? (
                      <>
                        {" · "}
                        <span className="text-info-strong">{issue.jiraStatus}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                {issue.storyPoints > 0 && (
                  <span className="flex items-center justify-end pt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {formatPoints(issue.storyPoints)} pts
                  </span>
                )}
              </li>
            );
          })}
          {overflow > 0 && (
            <li className="col-span-full py-2 text-xs text-muted-foreground">
              + {overflow} more untagged item{overflow === 1 ? "" : "s"}.
            </li>
          )}
        </ul>
      )}
    </PanelShell>
  );
}
