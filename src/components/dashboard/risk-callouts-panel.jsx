import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateUTC } from "@/lib/metrics.mjs";

/**
 * Risk call-outs (trend-burndown iteration, per Naveen 2026-07-19) — the deterministic
 * forerunner of the §16 Gemini "risk/blocker call-outs" use case: worst issues first
 * (Blocked → Behind → At Risk, bigger points first) off the already-computed per-issue health,
 * led by the sprint-level trend signals (no burn / projected past end) when a projection
 * exists. Server-safe like TrendPanel; fills the right half of the burndown row.
 */

const STATUS_RANK = { Blocked: 0, Behind: 1, "At Risk": 2 };
const MAX_ISSUE_ROWS = 6;

function IssueKey({ jiraKey, jiraBaseUrl }) {
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

export function RiskCalloutsPanel({ issues = [], progressByKey = {}, series, jiraBaseUrl }) {
  const risky = issues
    .filter((issue) => STATUS_RANK[issue.health.status] !== undefined)
    .sort(
      (a, b) =>
        STATUS_RANK[a.health.status] - STATUS_RANK[b.health.status] ||
        b.storyPoints - a.storyPoints,
    );
  const shown = risky.slice(0, MAX_ISSUE_ROWS);
  const overflow = risky.length - shown.length;
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
          <span className="text-xs text-muted-foreground">
            {blockedCount} blocked · {behindCount} behind · {atRiskCount} at risk
          </span>
        )}
      </div>

      {allClear ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
          All clear — nothing blocked, behind, or at risk right now.
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-border-subtle">
          {signals.map((signal) => (
            <li key={signal.key} className="flex items-start gap-2 py-2">
              <Badge tone="warn" className="shrink-0">
                ⚠ {signal.label}
              </Badge>
              <span className="min-w-0 pt-0.5 text-xs text-secondary-foreground">
                {signal.body}
              </span>
            </li>
          ))}
          {shown.map((issue) => {
            const reason = progressByKey[issue.jiraKey]?.blockedReason;
            return (
              <li
                key={`${issue.teamKey ?? ""}:${issue.filterId}:${issue.jiraKey}`}
                className="flex items-start gap-2 py-2"
              >
                <Badge tone={issue.health.tone} className="shrink-0">
                  {issue.health.icon} {issue.health.status}
                </Badge>
                {issue.teamKey && (
                  <Badge tone="neutral" className="shrink-0">
                    {issue.teamKey}
                  </Badge>
                )}
                <span className="shrink-0 pt-0.5">
                  <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span className="block truncate text-xs text-secondary-foreground">
                    {issue.title}
                  </span>
                  {issue.health.status === "Blocked" && reason && (
                    <span className="block truncate text-[11px] text-muted-foreground italic">
                      {reason}
                    </span>
                  )}
                </span>
                {issue.storyPoints > 0 && (
                  <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {issue.storyPoints} pts
                  </span>
                )}
              </li>
            );
          })}
          {overflow > 0 && (
            <li className="py-2 text-xs text-muted-foreground">
              + {overflow} more at-risk issue{overflow === 1 ? "" : "s"} — see the matrix below.
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
