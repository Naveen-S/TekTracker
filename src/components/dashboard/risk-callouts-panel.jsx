import { AlertTriangle, CheckCircle2, MessageSquarePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateUTC } from "@/lib/metrics.mjs";

/**
 * Risk call-outs (trend-burndown iteration, per Naveen 2026-07-19) — the deterministic
 * forerunner of the §16 Gemini "risk/blocker call-outs" use case: worst issues first
 * (Blocked → Behind → At Risk, bigger points first) off the already-computed per-issue health,
 * led by the sprint-level trend signals (no burn / projected past end) when a projection
 * exists. Server-safe like TrendPanel; fills the right half of the burndown row.
 *
 * `blockedReason`/`riskComment` (risk-comments-rollup-digest.md) ride directly on each `issue`
 * object — `computeSprintMetrics` attaches them per-team (metrics.mjs `resolveProgress`), so this
 * component never needs its own progress lookup and never merges progress across teams (§9).
 * `riskComment` is a known/agreed-risk note (e.g. an intentionally late QA handoff) — its
 * presence renders a "Known" badge so leadership reads it as managed context, not a new alarm.
 * `onEditComment(issue)` is optional — pass it only where writes are allowed (the board, not the
 * read-only roll-up); omitting it renders comments read-only with no affordance.
 */

const STATUS_RANK = { Blocked: 0, Behind: 1, "At Risk": 2 };
const MAX_ISSUE_ROWS = 6;

/**
 * Worst-first filter+sort (Blocked → Behind → At Risk, points desc) — exported so the roll-up's
 * "View all risks" dialog (rollup-risk-section.jsx) lists every risky issue in the SAME order as
 * this panel's capped preview, instead of re-deriving the ranking. Also mirrored in
 * `lib/ai/digest.mjs`'s `buildDigestInput`/`buildRollupDigestInput` — keep the three in lockstep.
 */
export function sortRiskyIssues(issues) {
  return issues
    .filter((issue) => STATUS_RANK[issue.health.status] !== undefined)
    .sort(
      (a, b) =>
        STATUS_RANK[a.health.status] - STATUS_RANK[b.health.status] ||
        b.storyPoints - a.storyPoints,
    );
}

/** Exported so rollup-risk-section.jsx's all-risks dialog links keys identically. */
export function IssueKey({ jiraKey, jiraBaseUrl }) {
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

export function RiskCalloutsPanel({ issues = [], series, jiraBaseUrl, onEditComment, onViewAll }) {
  const risky = sortRiskyIssues(issues);
  const shown = risky.slice(0, MAX_ISSUE_ROWS);
  const overflow = risky.length - shown.length;
  const hasTeamChips = shown.some((issue) => issue.teamKey);
  const blockedCount = risky.filter((issue) => issue.health.status === "Blocked").length;
  const behindCount = risky.filter((issue) => issue.health.status === "Behind").length;
  const atRiskCount = risky.length - blockedCount - behindCount;

  // Sprint-level signals off the same trend series the chart draws (none without a projection).
  const projection = series?.projection ?? null;
  const remaining = series?.points[series.points.length - 1]?.remainingPoints ?? 0;
  const signals = [];
  if (projection && projection.projectedFinishDate === null && remaining > 0) {
    signals.push({
      key: "no-burn",
      label: "No burn",
      body: "No story points completed in the last 7 days.",
    });
  } else if (projection && projection.projectedFinishDate !== null && !projection.onTrack) {
    signals.push({
      key: "off-pace",
      label: "Off pace",
      body: `Projected finish ~${formatDateUTC(projection.projectedFinishDate, { year: false })} — past sprint end.`,
    });
  }

  const allClear = risky.length === 0 && signals.length === 0;
  const stripeTone =
    blockedCount + behindCount > 0
      ? "bg-danger"
      : risky.length > 0 || signals.length > 0
        ? "bg-warn"
        : "bg-success";

  return (
    <section
      className="relative flex flex-col overflow-hidden rounded-lg border bg-card p-4 pt-4.5"
      aria-label="Risk call-outs"
    >
      <span className={`absolute inset-x-0 top-0 h-0.75 ${stripeTone}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-warn-soft text-warn-strong"
            aria-hidden="true"
          >
            <AlertTriangle className="size-4" />
          </span>
          <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
            Risk call-outs
          </p>
        </div>
        {!allClear && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {blockedCount} blocked · {behindCount} behind · {atRiskCount} at risk
            </span>
            {onViewAll && risky.length > 0 && (
              <button
                type="button"
                onClick={onViewAll}
                className="rounded-full border border-border-subtle px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                View all ({risky.length})
              </button>
            )}
          </div>
        )}
      </div>

      {allClear ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
          All clear — nothing blocked, behind, or at risk right now.
        </div>
      ) : (
        // Shared column tracks (subgrid rows) so badge/chip/key/title/pts align across rows —
        // per-row flexboxes left the title column ragged wherever badge widths differed.
        <ul
          className={`mt-2 grid gap-x-2 divide-y divide-border-subtle ${
            hasTeamChips
              ? "grid-cols-[auto_auto_auto_minmax(0,1fr)_auto]"
              : "grid-cols-[auto_auto_minmax(0,1fr)_auto]"
          }`}
        >
          {signals.map((signal) => (
            <li key={signal.key} className="col-span-full grid grid-cols-subgrid items-start py-2">
              <Badge tone="warn" className="justify-self-start">
                ⚠ {signal.label}
              </Badge>
              <span className="col-[2/-1] min-w-0 pt-0.5 text-xs text-secondary-foreground">
                {signal.body}
              </span>
            </li>
          ))}
          {shown.map((issue) => (
            <li
              key={`${issue.teamKey ?? ""}:${issue.filterId}:${issue.jiraKey}`}
              className="col-span-full grid grid-cols-subgrid items-start py-2"
            >
              <Badge tone={issue.health.tone} className="justify-self-start">
                {issue.health.icon} {issue.health.status}
              </Badge>
              {hasTeamChips &&
                (issue.teamKey ? (
                  <Badge tone="neutral" className="justify-self-start">
                    {issue.teamKey}
                  </Badge>
                ) : (
                  <span aria-hidden="true" />
                ))}
              <span className="justify-self-start pt-0.5">
                <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="block min-w-0 truncate text-xs text-secondary-foreground">
                    {issue.title}
                  </span>
                  {issue.riskComment && (
                    <Badge tone="info" className="shrink-0">
                      Known
                    </Badge>
                  )}
                </span>
                {issue.health.status === "Blocked" && issue.blockedReason && (
                  <span className="block truncate text-[11px] text-muted-foreground italic">
                    {issue.blockedReason}
                  </span>
                )}
                {issue.riskComment && (
                  <span className="block truncate text-[11px] text-info-strong italic">
                    {issue.riskComment}
                  </span>
                )}
              </span>
              {(issue.storyPoints > 0 || onEditComment) && (
                <span className="flex items-center justify-end gap-1 pt-0.5">
                  {issue.storyPoints > 0 && (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {issue.storyPoints} pts
                    </span>
                  )}
                  {onEditComment && (
                    <button
                      type="button"
                      onClick={() => onEditComment(issue)}
                      aria-label={issue.riskComment ? "Edit risk comment" : "Add risk comment"}
                      title={issue.riskComment ? "Edit risk comment" : "Add risk comment"}
                      className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <MessageSquarePlus className="size-3.5" />
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
          {overflow > 0 && (
            <li className="col-span-full py-2 text-xs text-muted-foreground">
              {onViewAll ? (
                <button type="button" onClick={onViewAll} className="hover:underline">
                  + {overflow} more at-risk issue{overflow === 1 ? "" : "s"} — view all risks
                </button>
              ) : (
                <>
                  + {overflow} more at-risk issue{overflow === 1 ? "" : "s"} — see the matrix
                  below.
                </>
              )}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
