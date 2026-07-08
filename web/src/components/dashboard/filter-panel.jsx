"use client";

/**
 * Connected-JQL sidebar — port of the prototype's FilterPanel: search, per-filter cards with
 * accent + stats + done-bar, drag-reorder (managers, disabled while searching), remove, collapse.
 */
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FilterPanel({
  allFilters,
  visibleFilters,
  metricsIssues,
  isCollapsed,
  onToggleCollapse,
  onAddFilter,
  onRemoveFilter,
  onReorderFilters,
  searchQuery,
  onSearchChange,
}) {
  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const statsFor = (filter) => {
    const rows = metricsIssues.filter((issue) => issue.filterId === filter.id);
    const totalPts = rows.reduce((sum, issue) => sum + issue.storyPoints, 0);
    const donePts = rows.reduce(
      (sum, issue) => sum + (issue.percent === 100 ? issue.storyPoints : 0),
      0,
    );
    return { totalPts, pct: totalPts > 0 ? Math.round((donePts / totalPts) * 100) : 0 };
  };

  const dragEnabled = Boolean(onReorderFilters) && !searchQuery;

  if (isCollapsed) {
    return (
      <aside className="flex flex-col items-center gap-2 rounded-xl border bg-card py-3">
        <button
          type="button"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onToggleCollapse}
          aria-label="Expand filters panel"
          title="Expand filters panel"
        >
          →
        </button>
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
          Connected JQL
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Connected JQL
          </p>
          <h2 className="text-base font-semibold">Jira filters</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onToggleCollapse}
            aria-label="Collapse filters panel"
            title="Collapse filters panel"
          >
            ←
          </button>
          {onAddFilter && (
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={onAddFilter}
              aria-label="Add filter"
              title="Add Jira filter"
            >
              +
            </button>
          )}
        </div>
      </div>

      <Input
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search filters, assignees, keys"
        aria-label="Search"
      />

      <div className="flex flex-col gap-2">
        {allFilters.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No filters added yet.
            {onAddFilter ? " Click + above to get started." : ""}
          </p>
        ) : visibleFilters.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No matches — try a filter name, assignee, issue key, or Jira status.
          </p>
        ) : (
          visibleFilters.map((filter, index) => {
            const { totalPts, pct } = statsFor(filter);
            return (
              <article
                key={filter.id}
                draggable={dragEnabled}
                onDragStart={dragEnabled ? () => (dragFrom.current = index) : undefined}
                onDragOver={
                  dragEnabled
                    ? (event) => {
                        event.preventDefault();
                        setDragOver(index);
                      }
                    : undefined
                }
                onDrop={
                  dragEnabled
                    ? (event) => {
                        event.preventDefault();
                        setDragOver(null);
                        const from = dragFrom.current;
                        dragFrom.current = null;
                        if (from !== null && from !== index) onReorderFilters(from, index);
                      }
                    : undefined
                }
                onDragEnd={dragEnabled ? () => setDragOver(null) : undefined}
                onClick={() =>
                  document
                    .getElementById(`filter-section-${filter.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className={cn(
                  "cursor-pointer rounded-lg border bg-background p-3 transition-colors hover:border-ring/60",
                  dragEnabled && "cursor-grab",
                  dragOver === index && "border-ring ring-2 ring-ring/30",
                )}
              >
                <div className="flex items-center gap-2">
                  {dragEnabled && (
                    <span className="text-muted-foreground/60" aria-hidden="true">
                      ⋮⋮
                    </span>
                  )}
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: filter.accentColor ?? "#00a892" }}
                    aria-hidden="true"
                  />
                  <strong className="flex-1 truncate text-sm">{filter.name}</strong>
                  {onRemoveFilter && (
                    <button
                      type="button"
                      className="rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveFilter(filter.id);
                      }}
                      aria-label={`Remove ${filter.name}`}
                      title="Remove filter (stage progress is kept)"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {filter.jql && (
                  <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={filter.jql}>
                    {filter.jql}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{filter.issues.length} issues</span>
                  <span>{totalPts} pts</span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
