"use client";

/**
 * One Delivery-Matrix row — port of the prototype's IssueRow. Percent/health come from the OWNING
 * workflow's checklist (§9, metrics.mjs); the rendered stage columns follow the DISPLAYING
 * filter's workflow, indexing into the shared checklist (rare cross-workflow keys show its prefix).
 */
import {
  calculateWeightedCompletion,
  getHealthStatus,
  resolveProgress,
} from "@/lib/metrics.mjs";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const pad = density === "dense" ? "py-1.5" : "py-3";

  return (
    <div
      className="grid min-w-[900px] gap-px border-b bg-muted/60"
      style={{
        gridTemplateColumns: `minmax(230px, 1.4fr) repeat(${workflow.stages.length}, minmax(64px, 1fr)) minmax(110px, 0.7fr)`,
      }}
    >
      <div className={cn("flex flex-col gap-0.5 bg-card px-2", pad)}>
        <div className="flex items-center justify-between gap-2">
          {jiraUrl ? (
            <a
              href={jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-semibold text-primary hover:underline"
              title="Open in Jira"
            >
              {issue.jiraKey}
            </a>
          ) : (
            <span className="font-mono text-xs font-semibold">{issue.jiraKey}</span>
          )}
          <Badge tone={percent === 100 ? "success" : percent > 0 ? "info" : "neutral"}>
            {percent}%
          </Badge>
        </div>
        <strong className="text-sm leading-snug">{issue.title}</strong>
        <p className="text-xs text-muted-foreground">
          {issue.assigneeName ?? "Unassigned"} · {issue.issueType} · {issue.storyPoints} pts
          {issue.jiraStatus ? ` · ${issue.jiraStatus}` : ""}
        </p>
        {(issue.jiraSprintName || issue.fixVersions) && (
          <p className="truncate text-[11px] text-muted-foreground/80">
            {[issue.jiraSprintName, issue.fixVersions].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
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
              "flex items-center justify-center bg-card text-sm transition-colors",
              pad,
              isCompleted && "bg-accent text-accent-foreground",
              !isCompleted && isCurrent && "text-primary",
              !isCompleted && !isCurrent && "text-muted-foreground/50",
              clickable && "cursor-pointer hover:bg-accent/60",
              !clickable && "cursor-default",
            )}
          >
            {isCompleted ? "✓" : "○"}
          </button>
        );
      })}

      <div className={cn("flex items-center justify-center bg-card px-2", pad)}>
        <button
          type="button"
          disabled={!canWrite || busy}
          onClick={canWrite ? () => onToggleBlocked(issue.jiraKey, !blocked) : undefined}
          title={
            `${health.status} · ${percent}%` +
            (canWrite ? (blocked ? " — click to unblock" : " — click to mark blocked") : "")
          }
          className={cn("rounded-full", canWrite && !busy ? "cursor-pointer" : "cursor-default")}
        >
          <Badge tone={health.tone}>
            {health.icon} {health.status}
          </Badge>
        </button>
      </div>
    </div>
  );
}
