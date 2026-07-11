"use client";

/**
 * One Delivery-Matrix row — port of the prototype's IssueRow. Percent/health come from the OWNING
 * workflow's checklist (§9, metrics.mjs); the rendered stage columns follow the DISPLAYING
 * filter's workflow, indexing into the shared checklist (rare cross-workflow keys show its prefix).
 * Styling follows the legacy matrix system (src/styles.css :973-1172): accent left spine, teal
 * key chip, 3-state bordered stage badges with hover glow rings, bordered health pill.
 */
import {
  calculateWeightedCompletion,
  getHealthStatus,
  resolveProgress,
} from "@/lib/metrics.mjs";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { cn } from "@/lib/utils";

/* Legacy getHealthStatus triplets (src/workflows.js :107-175): text 500 / border 600 / bg 50. */
const HEALTH_PILL = {
  danger: "border-danger-strong bg-danger-soft text-danger",
  warn: "border-warn-strong bg-warn-soft text-warn",
  info: "border-info-strong bg-info-soft text-info",
  success: "border-success-strong bg-success-soft text-success",
  neutral: "border-border-strong bg-subtle text-muted-foreground",
};

export function IssueRow({
  issue,
  filter,
  workflow,
  progressByKey,
  sprint,
  density,
  jiraBaseUrl,
  canWrite,
  busy,
  onToggleStage,
  onToggleBlocked,
}) {
  const { workflowType, stageCompletion, blocked } = resolveProgress(
    issue.jiraKey,
    filter.workflowType,
    progressByKey,
  );
  const percent = calculateWeightedCompletion(stageCompletion, WORKFLOWS[workflowType].weights);
  const health = getHealthStatus(percent, blocked, sprint);
  const jiraUrl = jiraBaseUrl ? `${jiraBaseUrl}/browse/${issue.jiraKey}` : null;
  const accent = filter.accentColor ?? "#00a892";
  const pad = density === "dense" ? "py-1.5" : "py-3";

  return (
    <div
      className="group grid min-w-225"
      style={{
        gridTemplateColumns: `minmax(230px, 1.4fr) repeat(${workflow.stages.length}, minmax(64px, 1fr)) minmax(110px, 0.7fr)`,
      }}
    >
      <div
        className={cn(
          "sticky left-0 z-1 flex flex-col gap-1 border-r border-b border-border-subtle bg-card px-3 shadow-col transition-colors group-hover:bg-subtle",
          pad,
        )}
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        <div className="flex items-center justify-between gap-2">
          {jiraUrl ? (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground hover:underline"
              title="Open in Jira"
            >
              {issue.jiraKey}
            </a>
          ) : (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold">
              {issue.jiraKey}
            </span>
          )}
          <span
            className={cn(
              "min-w-11 rounded-md px-1.5 py-0.5 text-center text-[11px] font-bold",
              percent === 100
                ? "bg-success-soft text-success-strong"
                : percent > 0
                  ? "bg-info-soft text-info-strong"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {percent}%
          </span>
        </div>
        <strong className="line-clamp-2 text-[13px] leading-snug font-medium">{issue.title}</strong>
        <p className="text-[11px] font-semibold text-muted-foreground">
          {issue.assigneeName ?? "Unassigned"} · {issue.issueType} · {issue.storyPoints} pts
          {issue.jiraStatus ? (
            <>
              {" · "}
              <span className="text-info-strong">{issue.jiraStatus}</span>
            </>
          ) : null}
        </p>
        {(issue.jiraSprintName || issue.fixVersions) && (
          <p className="flex flex-wrap gap-1">
            {issue.jiraSprintName && (
              <span className="truncate rounded-xs bg-accent px-1 py-px text-[10px] font-semibold text-accent-foreground">
                {issue.jiraSprintName}
              </span>
            )}
            {issue.fixVersions && (
              <span className="truncate rounded-xs bg-muted px-1 py-px text-[10px] font-semibold text-secondary-foreground">
                {issue.fixVersions}
              </span>
            )}
          </p>
        )}
        <div className="mt-auto h-0.75 overflow-hidden rounded-full bg-border/60">
          <span
            className="block h-full rounded-full transition-all duration-300"
            style={{ width: `${percent}%`, backgroundColor: accent }}
          />
        </div>
      </div>

      {workflow.stages.map((stage, index) => {
        const isCompleted = Boolean(stageCompletion[index]);
        const isCurrent = !isCompleted && (index === 0 || Boolean(stageCompletion[index - 1]));
        const clickable = canWrite && !busy;
        return (
          <button
            type="button"
            key={stage}
            disabled={!clickable}
            onClick={clickable ? () => onToggleStage(issue.jiraKey, index, !isCompleted) : undefined}
            title={`${stage}${isCompleted ? " — complete" : canWrite ? " — click to mark complete" : ""}`}
            className={cn(
              "group/cell flex items-center justify-center border-r border-b border-border-subtle bg-card transition-colors duration-150",
              pad,
              isCompleted && !blocked && "bg-success/5",
              clickable && "cursor-pointer hover:bg-accent active:scale-98",
              !clickable && "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex min-h-6 min-w-7 items-center justify-center rounded-md border-[1.5px] px-1 text-xs font-bold transition-all duration-150",
                blocked
                  ? "border-danger/40 bg-danger-soft text-danger-strong ring-4 ring-danger/10"
                  : isCompleted
                    ? "border-success/45 bg-success/15 text-success-strong group-hover/cell:ring-4 group-hover/cell:ring-success/15"
                    : isCurrent
                      ? "border-info/40 bg-info/10 text-info-strong group-hover/cell:ring-4 group-hover/cell:ring-info/15"
                      : "border-border text-border-strong group-hover/cell:border-primary/40 group-hover/cell:bg-accent group-hover/cell:text-accent-foreground",
              )}
              aria-hidden="true"
            >
              {isCompleted ? "✓" : "○"}
            </span>
          </button>
        );
      })}

      <div className={cn("flex items-center justify-center border-b border-border-subtle bg-subtle px-2", pad)}>
        <button
          type="button"
          disabled={!canWrite || busy}
          onClick={canWrite ? () => onToggleBlocked(issue.jiraKey, !blocked) : undefined}
          title={
            `${health.status} · ${percent}%` +
            (canWrite ? (blocked ? " — click to unblock" : " — click to mark blocked") : "")
          }
          className={cn(
            "inline-flex min-w-16 items-center justify-center gap-1 rounded-md border-[1.5px] px-2.5 py-1.5 transition-all duration-200",
            HEALTH_PILL[health.tone] ?? HEALTH_PILL.neutral,
            canWrite && !busy ? "cursor-pointer hover:-translate-y-px hover:shadow-sm" : "cursor-default",
          )}
        >
          <span className="text-[13px] leading-none" aria-hidden="true">
            {health.icon}
          </span>
          <span className="text-[11px] font-bold tracking-wide whitespace-nowrap">{health.status}</span>
        </button>
      </div>
    </div>
  );
}
