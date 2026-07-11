"use client";

/**
 * Add-filter modal — port of AddFilterModal onto POST …/filters (the caller then triggers sync,
 * ui-port.md decision 6). Unlike the prototype, a display name is required for BOTH source types
 * (the create API requires it; Jira-filter names are refreshed as jql at sync, not as our name).
 */
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WORKFLOWS } from "@/lib/workflows.mjs";

const WORKFLOW_OPTIONS = ["FEATURE", "TECH_DEBT", "SUPPORT", "INTERNAL_BUG"];

/* Legacy accent palette (src/jiraService.js :236-244, red dropped) — assigned deterministically
   by creation order instead of the prototype's random pick (ui-polish.md decision 7). */
const ACCENT_PALETTE = ["#7c3aed", "#0891b2", "#ea580c", "#16a34a", "#f59e0b"];

export function AddFilterDialog({ onAdd, onClose, busy, existingCount = 0 }) {
  const [workflowType, setWorkflowType] = useState("FEATURE");
  const [sourceType, setSourceType] = useState("JIRA_FILTER");
  const [name, setName] = useState("");
  const [jiraFilterId, setJiraFilterId] = useState("");
  const [jql, setJql] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    if (!name.trim()) return setError("Please give this filter a name");
    if (sourceType === "JIRA_FILTER" && !jiraFilterId.trim())
      return setError("Please enter a filter ID");
    if (sourceType === "JQL" && !jql.trim()) return setError("Please enter a JQL query");
    onAdd({
      name: name.trim(),
      workflowType,
      sourceType,
      accentColor: ACCENT_PALETTE[existingCount % ACCENT_PALETTE.length],
      ...(sourceType === "JIRA_FILTER"
        ? { jiraFilterId: jiraFilterId.trim() }
        : { jql: jql.trim() }),
    });
  };

  return (
    <Dialog open title="Add Jira Source" onClose={busy ? undefined : onClose}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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

        {error && (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Adding + syncing…" : "Add Source"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
