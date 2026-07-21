"use client";

/**
 * Roll-up risk section (risk-comments-rollup-digest.md decision 5) — wraps the shared
 * RiskCalloutsPanel with a "View all risks" dialog listing EVERY risky issue across every team
 * (the panel itself caps at 6 rows and, on `/`, points overflow at "the matrix below" — there is
 * no matrix on `/rollup`, so both the header "View all" chip and the overflow line open this
 * dialog instead). Read-only, like the rest of the roll-up (ed-rollup.md decision 6 — no writes,
 * no Sync here) — no edit affordance is passed to the panel.
 */
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  IssueKey,
  RiskCalloutsPanel,
  sortRiskyIssues,
} from "@/components/dashboard/risk-callouts-panel";

export function RollupRiskSection({ issues, series, jiraBaseUrl }) {
  const [open, setOpen] = useState(false);
  const risky = sortRiskyIssues(issues);

  return (
    <>
      <RiskCalloutsPanel
        issues={issues}
        series={series}
        jiraBaseUrl={jiraBaseUrl}
        onViewAll={risky.length > 0 ? () => setOpen(true) : undefined}
      />

      {open && (
        <Dialog
          open
          title={`All risks (${risky.length})`}
          onClose={() => setOpen(false)}
          className="max-w-2xl"
        >
          <ul className="flex flex-col divide-y divide-border-subtle">
            {risky.map((issue) => (
              <li
                key={`${issue.teamKey ?? ""}:${issue.filterId}:${issue.jiraKey}`}
                className="flex flex-col gap-1 py-2.5 first:pt-0"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={issue.health.tone} className="shrink-0">
                    {issue.health.icon} {issue.health.status}
                  </Badge>
                  {issue.teamKey && (
                    <Badge tone="neutral" className="shrink-0">
                      {issue.teamKey}
                    </Badge>
                  )}
                  <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
                  <span className="min-w-0 flex-1 truncate text-sm text-secondary-foreground">
                    {issue.title}
                  </span>
                  {issue.storyPoints > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {issue.storyPoints} pts
                    </span>
                  )}
                  {issue.riskComment && (
                    <Badge tone="info" className="shrink-0">
                      Known
                    </Badge>
                  )}
                </div>
                {issue.health.status === "Blocked" && issue.blockedReason && (
                  <p className="text-xs text-muted-foreground italic">
                    Blocked: {issue.blockedReason}
                  </p>
                )}
                {issue.riskComment && (
                  <p className="text-xs text-info-strong italic">{issue.riskComment}</p>
                )}
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </>
  );
}
