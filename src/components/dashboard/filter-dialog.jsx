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
import { ListFilter } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
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
      icon={ListFilter}
      hero
      title={editing ? "Edit Jira source" : "Add Jira source"}
      description={
        editing
          ? "Rename this track, repoint it at a different Jira filter or JQL, or change how it is tracked."
          : "Point this board at a saved Jira filter or a JQL query. Its issues load right away."
      }
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <DialogClose />
          <Button type="submit" form="filter-form" disabled={busy}>
            {busy && <Spinner />}
            {busy
              ? editing
                ? "Saving…"
                : "Adding + syncing…"
              : editing
                ? "Save changes"
                : "Add source"}
          </Button>
        </>
      }
    >
      <form id="filter-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <Field label="Workflow" hint={WORKFLOWS[workflowType].stages.join(" → ")}>
          <RadioCardGroup aria-label="Workflow">
            {WORKFLOW_OPTIONS.map((type) => (
              <RadioCard
                key={type}
                name="workflowType"
                value={type}
                checked={workflowType === type}
                onChange={() => setWorkflowType(type)}
                disabled={busy}
                title={WORKFLOWS[type].name}
                description={`${WORKFLOWS[type].stages.length} stages`}
              />
            ))}
          </RadioCardGroup>
        </Field>
        {shrinks && (
          <Callout tone="warn" className="-mt-2">
            Stage checklists are re-shaped on the next sync — {WORKFLOWS[filter.workflowType].name}{" "}
            ({fromStages} stages) → {WORKFLOWS[workflowType].name} ({toStages} stages) drops every
            check past stage {toStages}.
          </Callout>
        )}

        <Field label="Source">
          <Segmented
            aria-label="Source"
            value={sourceType}
            onChange={setSourceType}
            disabled={busy}
            className="self-start"
            options={[
              { value: "JIRA_FILTER", label: "Filter ID" },
              { value: "JQL", label: "JQL query" },
            ]}
          />
        </Field>

        <Field label="Name" htmlFor="filter-name">
          <Input
            id="filter-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Roadmap · GM"
            disabled={busy}
            autoFocus
          />
        </Field>

        {sourceType === "JIRA_FILTER" ? (
          <Field
            label="Jira filter ID"
            htmlFor="filter-id"
            hint="The numeric id from your Jira filter URL — its current JQL is used at every sync."
          >
            <Input
              id="filter-id"
              value={jiraFilterId}
              onChange={(event) => setJiraFilterId(event.target.value)}
              placeholder="e.g. 65834"
              inputMode="numeric"
              disabled={busy}
            />
          </Field>
        ) : (
          <Field label="JQL query" htmlFor="filter-jql">
            <Textarea
              id="filter-jql"
              rows={4}
              value={jql}
              onChange={(event) => setJql(event.target.value)}
              placeholder="e.g. project = GM AND status != Done"
              className="font-mono text-[13px]"
              disabled={busy}
            />
          </Field>
        )}

        <Field label="Accent colour">
          <div className="flex items-center gap-2.5">
            {ACCENT_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setAccentColor(color)}
                disabled={busy}
                aria-label={`Use accent colour ${color}`}
                aria-pressed={accentColor === color}
                className={cn(
                  "size-6 cursor-pointer rounded-full ring-1 ring-ink/10 ring-inset transition-transform duration-150 outline-offset-2 hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring",
                  accentColor === color && "outline-2 outline-foreground/70",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </Field>

        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
