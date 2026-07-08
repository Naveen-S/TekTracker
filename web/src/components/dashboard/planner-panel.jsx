"use client";

/**
 * Delivery Matrix — port of the prototype's PlannerPanel: per-filter sections, stage columns
 * sized to the workflow, click-to-toggle cells (server-owned cascade), health chip that toggles
 * blocked. Read-only for viewers (cells render but don't respond, ui-port.md gotchas).
 */
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { IssueRow } from "./issue-row";

export function PlannerPanel({
  allFilters,
  visibleFilters,
  progressByKey,
  sprint,
  density,
  jiraBaseUrl,
  canWrite,
  busy,
  onToggleStage,
  onToggleBlocked,
}) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Delivery matrix
          </p>
          <h2 className="text-base font-semibold">Sprint status by delivery stage</h2>
          {canWrite && allFilters.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Click any stage cell to mark it complete or incomplete
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded-sm bg-primary" /> Done
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded-sm border-2 border-primary bg-background" /> Active
          </span>
          <span className="flex items-center gap-1">
            <i className="size-2.5 rounded-sm border bg-muted" /> Pending
          </span>
        </div>
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Sprint delivery matrix" tabIndex="0">
        {allFilters.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <h3 className="text-base font-medium text-foreground">No sprint data to display</h3>
            <p>Add a Jira filter to see your sprint delivery matrix</p>
          </div>
        ) : visibleFilters.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <h3 className="text-base font-medium text-foreground">No matching work</h3>
            <p>Clear the search to return to the full sprint matrix</p>
          </div>
        ) : (
          visibleFilters.map((filter) => {
            const workflow = WORKFLOWS[filter.workflowType];
            return (
              <div key={filter.id} id={`filter-section-${filter.id}`} className="mt-4 first:mt-2">
                <div
                  className="flex items-baseline gap-2 border-l-4 pl-2"
                  style={{ borderColor: filter.accentColor ?? "#00a892" }}
                >
                  <span className="text-sm font-semibold">{filter.name}</span>
                  <em className="text-xs not-italic text-muted-foreground">
                    {filter.issues.length} items · {workflow.name}
                  </em>
                </div>

                <div
                  className="mt-1.5 grid min-w-[900px] gap-px rounded-t-md bg-muted text-[11px] font-medium text-muted-foreground"
                  style={{
                    gridTemplateColumns: `minmax(230px, 1.4fr) repeat(${workflow.stages.length}, minmax(64px, 1fr)) minmax(110px, 0.7fr)`,
                  }}
                >
                  <div className="bg-card px-2 py-1.5">Jira issue</div>
                  {workflow.stages.map((stage) => (
                    <div key={stage} className="bg-card px-1 py-1.5 text-center leading-tight" title={stage}>
                      {stage}
                    </div>
                  ))}
                  <div className="bg-card px-2 py-1.5 text-center">Health</div>
                </div>

                {filter.issues.map((issue) => (
                  <IssueRow
                    key={issue.jiraKey}
                    issue={issue}
                    filter={filter}
                    workflow={workflow}
                    progressByKey={progressByKey}
                    sprint={sprint}
                    density={density}
                    jiraBaseUrl={jiraBaseUrl}
                    canWrite={canWrite}
                    busy={busy}
                    onToggleStage={onToggleStage}
                    onToggleBlocked={onToggleBlocked}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
