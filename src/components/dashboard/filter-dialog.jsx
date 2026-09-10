"use client";

/**
 * Add / edit a board track — one dialog for both (editable-filters.md decision 1). Created as the
 * port of AddFilterModal onto POST …/filters (the caller then triggers sync, ui-port.md decision 6);
 * it grew the edit mode when PATCH …/filters/[filterId] finally got a UI. Unlike the prototype, a
 * display name is required for BOTH source types (the create API requires it; Jira-filter names are
 * refreshed as jql at sync, not as our name).
 *
 * `filter` null ⇒ create; otherwise every control seeds from that row and the caller PATCHes.
 */
import { useState } from "react";
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { ACCENT_PALETTE, accentColorForIndex } from "@/lib/accent-palette.mjs";
import { cn } from "@/lib/utils";

const WORKFLOW_OPTIONS = ["FEATURE", "TECH_DEBT", "SUPPORT", "INTERNAL_BUG"];

export function FilterDialog({ filter = null, onSubmit, onClose, busy, existingCount = 0 }) {
  const editing = Boolean(filter);
  const [workflowType, setWorkflowType] = useState(filter?.workflowType ?? "FEATURE");
  const [sourceType, setSourceType] = useState(filter?.sourceType ?? "JIRA_FILTER");
  const [name, setName] = useState(filter?.name ?? "");
  const [jiraFilterId, setJiraFilterId] = useState(filter?.jiraFilterId ?? "");
  const [jql, setJql] = useState(filter?.jql ?? "");
  const [accentColor, setAccentColor] = useState(
    filter?.accentColor ?? accentColorForIndex(existingCount),
  );
  const [error, setError] = useState("");

  // Changing a track's workflow changes its stage COUNT, and sync re-shapes every progress row to
  // the new length (reshapeStageCompletion) — shrinking drops the checks past the last stage. Say so
  // before the save, not after.
  const fromStages = editing ? WORKFLOWS[filter.workflowType]?.stages.length ?? 0 : 0;
  const toStages = WORKFLOWS[workflowType].stages.length;
  const shrinks = editing && workflowType !== filter.workflowType && toStages < fromStages;

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please give this filter a name");
    if (sourceType === "JIRA_FILTER" && !jiraFilterId.trim())
      return setError("Please enter a filter ID");
    if (sourceType === "JQL" && !jql.trim()) return setError("Please enter a JQL query");
    onSubmit({ name, workflowType, sourceType, jql, jiraFilterId, accentColor });
  };

  return (
    <Dialog
      open
      title={editing ? "Edit Jira Source" : "Add Jira Source"}
      description={
        editing
          ? "Rename this track, repoint it at a different Jira filter or JQL, or change how it is tracked."
          : "Point this board at a saved Jira filter or a JQL query. Its issues load right away."
      }
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="filter-form" disabled={busy}>
            {busy && <Spinner />}
            {busy
              ? editing
                ? "Saving…"
                : "Adding + syncing…"
              : editing
                ? "Save changes"
                : "Add Source"}
          </Button>
        </>
      }
    >
      <form id="filter-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-1.5">
          <Label>Workflow Type</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {WORKFLOW_OPTIONS.map((type) => (
              <label
                key={type}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${workflowType === type ? "border-ring bg-accent" : "hover:border-border-strong"}`}
              >
                <input
                  type="radio"
                  name="workflowType"
                  value={type}
                  checked={workflowType === type}
                  onChange={() => setWorkflowType(type)}
                  disabled={busy}
                />
                <span>
                  {WORKFLOWS[type].name}
                  <span className="block text-xs text-muted-foreground">
                    {WORKFLOWS[type].stages.length} stages
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {WORKFLOWS[workflowType].stages.join(" → ")}
          </p>
          {shrinks && (
            <p className="rounded-md border border-warn/35 bg-warn-soft px-2.5 py-1.5 text-xs text-warn-strong">
              Stage checklists are re-shaped on the next sync — {WORKFLOWS[filter.workflowType].name}{" "}
              ({fromStages} stages) → {WORKFLOWS[workflowType].name} ({toStages} stages) drops every
              check past stage {toStages}.
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <Label>Source Type</Label>
          <div className="flex gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="sourceType"
                checked={sourceType === "JIRA_FILTER"}
                onChange={() => setSourceType("JIRA_FILTER")}
                disabled={busy}
              />
              Filter ID
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="sourceType"
                checked={sourceType === "JQL"}
                onChange={() => setSourceType("JQL")}
                disabled={busy}
              />
              JQL Query
            </label>
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-name">Filter Name</Label>
          <Input
            id="filter-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Roadmap · GM"
            disabled={busy}
            autoFocus
          />
        </div>

        {sourceType === "JIRA_FILTER" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-id">Jira Filter ID</Label>
            <Input
              id="filter-id"
              value={jiraFilterId}
              onChange={(event) => setJiraFilterId(event.target.value)}
              placeholder="e.g. 65834"
              disabled={busy}
            />
            <p className="text-xs text-muted-foreground">
              The numeric id from your Jira filter URL — its current JQL is used at every sync
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-jql">JQL Query</Label>
            <Textarea
              id="filter-jql"
              rows={4}
              value={jql}
              onChange={(event) => setJql(event.target.value)}
              placeholder="e.g. project = GM AND status != Done"
              disabled={busy}
            />
          </div>
        )}

        <fieldset className="flex flex-col gap-1.5">
          <Label>Accent Colour</Label>
          <div className="flex items-center gap-2">
            {ACCENT_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAccentColor(color)}
                disabled={busy}
                aria-label={`Use accent colour ${color}`}
                aria-pressed={accentColor === color}
                className={cn(
                  "size-6 cursor-pointer rounded-full transition-transform hover:scale-110",
                  accentColor === color
                    ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                    : "opacity-70",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </fieldset>

        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
