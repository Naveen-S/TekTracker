"use client";

/**
 * Delivery Matrix — port of the prototype's PlannerPanel: per-filter sections, stage columns
 * sized to the workflow, click-to-toggle cells (server-owned cascade), health chip that toggles
 * blocked. Read-only for viewers (cells render but don't respond, ui-port.md gotchas).
 * Chrome follows the legacy .planner-panel system (src/styles.css :847-971): section headers get
 * a color-mix() 6% tint of the filter accent (inline — data-driven), the first column is frozen.
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border-subtle px-5 py-4">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-accent-foreground">
            Delivery matrix
          </p>
          <h2 className="font-display text-base font-bold">Sprint status by delivery stage</h2>
          {canWrite && allFilters.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Click any stage cell to mark it complete or incomplete
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-xs bg-success" /> Done
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-xs bg-info" /> Active
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2.5 rounded-xs bg-border-strong" /> Pending
          </span>
        </div>
      </div>

      <div className="overflow-x-auto" role="region" aria-label="Sprint delivery matrix" tabIndex="0">
        {allFilters.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <h3 className="font-display text-base font-bold text-foreground">No sprint data to display</h3>
            <p>Add a Jira filter to see your sprint delivery matrix</p>
          </div>
        ) : visibleFilters.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <h3 className="font-display text-base font-bold text-foreground">No matching work</h3>
            <p>Clear the search to return to the full sprint matrix</p>
          </div>
        ) : (
          visibleFilters.map((filter) => {
            const workflow = WORKFLOWS[filter.workflowType];
            const accent = filter.accentColor ?? "#00a892";
            return (
              <div key={filter.id} id={`filter-section-${filter.id}`}>
                <div
                  className="flex min-w-225 items-baseline gap-2 border-b border-border-subtle px-4 py-2.5"
                  style={{ backgroundColor: `color-mix(in srgb, ${accent} 6%, white)` }}
                >
                  <span
                    className="size-2 shrink-0 self-center rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  />
                  <span className="font-display text-sm font-bold">{filter.name}</span>
                  <em className="text-xs font-semibold not-italic text-muted-foreground">
                    {filter.issues.length} items · {workflow.name}
                  </em>
                </div>

                <div
                  className="grid min-w-225"
                  style={{
                    gridTemplateColumns: `minmax(230px, 1.4fr) repeat(${workflow.stages.length}, minmax(64px, 1fr)) minmax(110px, 0.7fr)`,
                  }}
                >
                  <div className="sticky left-0 z-1 border-r border-b border-border-subtle bg-subtle px-3 py-2 text-[11px] font-bold tracking-wider uppercase text-muted-foreground shadow-col">
                    Jira issue
                  </div>
                  {workflow.stages.map((stage) => (
                    <div
                      key={stage}
                      className="border-r border-b border-border-subtle bg-subtle px-1 py-2 text-center text-[11px] leading-tight font-bold tracking-wide uppercase text-muted-foreground"
                      title={stage}
                    >
                      {stage}
                    </div>
                  ))}
                  <div className="border-b border-border-subtle bg-subtle px-2 py-2 text-center text-[11px] font-bold tracking-wider uppercase text-muted-foreground">
                    Health
                  </div>
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
