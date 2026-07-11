"use client";

/**
 * Connected-JQL sidebar — port of the prototype's FilterPanel: search, per-filter cards with
 * accent + stats + done-bar, drag-reorder (managers, disabled while searching), remove, collapse.
 * Styling follows the legacy .filter-panel system (src/styles.css :626-842).
 */
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const iconButton =
  "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

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
    // Below xl the workspace stacks, so the rail lies flat; at xl+ it is the legacy vertical rail.
    return (
      <aside className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 xl:sticky xl:top-19 xl:flex-col xl:px-0 xl:py-3">
        <button
          type="button"
          className={iconButton}
          onClick={onToggleCollapse}
          aria-label="Expand filters panel"
          title="Expand filters panel"
        >
          <ChevronRight className="size-4" />
        </button>
        <p className="text-[10px] font-bold tracking-widest uppercase text-accent-foreground xl:[writing-mode:vertical-rl]">
          Connected JQL
        </p>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-3 rounded-xl border bg-card p-4 xl:sticky xl:top-19 xl:max-h-[calc(100vh-6.5rem)] xl:overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold tracking-widest uppercase text-accent-foreground">
            Connected JQL
          </p>
          <h2 className="font-display text-base font-bold">Jira filters</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={iconButton}
            onClick={onToggleCollapse}
            aria-label="Collapse filters panel"
            title="Collapse filters panel"
          >
            <ChevronLeft className="size-4" />
          </button>
          {onAddFilter && (
            <button
              type="button"
              className={iconButton}
              onClick={onAddFilter}
              aria-label="Add filter"
              title="Add Jira filter"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-transparent bg-subtle px-2.5 transition-all focus-within:border-ring focus-within:bg-background focus-within:ring-[3px] focus-within:ring-ring/25">
        <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search filters, assignees, keys"
          aria-label="Search"
          className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto">
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
            const accent = filter.accentColor ?? "#00a892";
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
                  "cursor-pointer rounded-lg border bg-card p-3 transition-all duration-200 ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-xs",
                  dragEnabled && "cursor-grab",
                  dragOver === index && "border-primary bg-accent ring-2 ring-primary/20",
                )}
              >
                <div className="flex items-center gap-2">
                  {dragEnabled && (
                    <GripVertical className="size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  )}
                  <span
                    className="h-2 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden="true"
                  />
                  <strong className="flex-1 truncate font-display text-[13px] font-bold">
                    {filter.name}
                  </strong>
                  {onRemoveFilter && (
                    <button
                      type="button"
                      className="rounded p-1 text-danger-strong/70 transition-colors hover:bg-danger-soft hover:text-danger-strong"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveFilter(filter.id);
                      }}
                      aria-label={`Remove ${filter.name}`}
                      title="Remove filter (stage progress is kept)"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {filter.jql && (
                  <p
                    className="mt-1.5 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                    title={filter.jql}
                  >
                    {filter.jql}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
                    {filter.issues.length} issues
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
                    {totalPts} pts
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-0.75 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: accent }}
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
