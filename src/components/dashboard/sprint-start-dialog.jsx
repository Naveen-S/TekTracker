"use client";

/**
 * "One-Click Sprint Start" dialog (one-click-sprint-start.md decisions 4/6). Picks an EXISTING
 * `PLANNING`/`ACTIVE` Sprint (this action never creates one — only a global admin does, via
 * /admin) and generates the team's missing Roadmap/Tech Debt/Internal Bug/External Bug filters
 * against it. The JQL preview is computed client-side with the same pure `track-jql.mjs` builder
 * the server route uses, so what's shown matches exactly what gets created.
 */
import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, SectionLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { buildAllTrackJql, TRACK_NAMES, SPRINT_START_TRACKS } from "@/lib/sprint-start/track-jql.mjs";
import { formatSprintWindow } from "@/lib/metrics.mjs";

const STARTABLE_STATES = ["PLANNING", "ACTIVE"];

export function SprintStartDialog({
  teamId,
  sprints,
  selectedSprintId,
  sprintStartConfig,
  onClose,
  onSuccess,
}) {
  const startable = useMemo(
    () => sprints.filter((sprint) => STARTABLE_STATES.includes(sprint.state)),
    [sprints],
  );
  const [sprintId, setSprintId] = useState(
    startable.some((sprint) => sprint.id === selectedSprintId) ? selectedSprintId : (startable[0]?.id ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { createdFilters, skippedWorkflowTypes, syncSummary, syncError }

  const { componentGroups = [], issueTypeOverrides = null } = sprintStartConfig ?? {};
  const hasSubComponents = componentGroups.length > 0;
  const selectedSprint = startable.find((sprint) => sprint.id === sprintId) ?? null;

  const preview =
    hasSubComponents && selectedSprint
      ? buildAllTrackJql({
          team: issueTypeOverrides,
          componentGroups,
          fixVersions: selectedSprint.fixVersions ?? [],
        })
      : null;

  const handleSubmit = async () => {
    setError("");
    setBusy(true);
    try {
      setResult(await apiFetch(`/api/teams/${teamId}/sprint-start`, { method: "POST", body: { sprintId } }));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (result) onSuccess?.();
    onClose();
  };

  return (
    <Dialog
      open
      title={result ? "Sprint start complete" : "One-Click Sprint Start"}
      description={
        result
          ? undefined
          : "Generate this team's Roadmap, Tech Debt, Internal Bug, and External Bug filters for a sprint your admin has already created — no hand-typed JQL."
      }
      tone={result ? "success" : undefined}
      icon={Rocket}
      hero
      size="lg"
      onClose={busy ? undefined : handleClose}
      footer={
        result ? (
          <DialogClose variant="default">Done</DialogClose>
        ) : (
          <>
            <DialogClose />
            <Button onClick={handleSubmit} disabled={busy || !hasSubComponents || !sprintId}>
              {busy && <Spinner />}
              {busy ? "Starting…" : "Start filters"}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {!hasSubComponents && (
          <Callout tone="warn" title="No sub-components claimed">
            Ask an admin to assign this team&rsquo;s Jira sub-components on the{" "}
            <a href="/admin" className="font-medium underline underline-offset-2">
              Admin
            </a>{" "}
            page first.
          </Callout>
        )}

        {!result && hasSubComponents && (
          <>
            {startable.length === 0 ? (
              <Callout tone="warn" title="No sprint to start">
                No planning or active sprint exists yet — ask an admin to create one in Admin
                first.
              </Callout>
            ) : (
              <Field label="Sprint" htmlFor="sprint-start-sprint">
                <Select
                  id="sprint-start-sprint"
                  value={sprintId}
                  onChange={(event) => setSprintId(event.target.value)}
                  disabled={busy}
                >
                  {startable.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name} ({sprint.state}) — {formatSprintWindow(sprint)}
                    </option>
                  ))}
                </Select>
                {selectedSprint && selectedSprint.fixVersions.length === 0 && (
                  <Callout tone="warn" className="mt-1">
                    This sprint has no Fix Version(s) set yet — the generated filters won&rsquo;t
                    scope by fixVersion. An admin can add them from Admin.
                  </Callout>
                )}
              </Field>
            )}

            {preview && (
              <div className="flex flex-col gap-2.5">
                <SectionLabel>Filters that will be generated</SectionLabel>
                <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                  {SPRINT_START_TRACKS.map((workflowType) => (
                    <li key={workflowType} className="flex flex-col gap-1.5 px-3.5 py-3">
                      <span className="text-[13px] font-medium">{TRACK_NAMES[workflowType]}</span>
                      <code className="rounded-md bg-subtle px-2.5 py-1.5 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">
                        {preview[workflowType]}
                      </code>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">
                  Any of these that already exist for this sprint are left untouched — nothing is
                  ever duplicated.
                </p>
              </div>
            )}
          </>
        )}

        {result && (
          <div className="flex flex-col gap-3">
            <ul className="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle text-sm">
              {result.createdFilters.map((filter) => (
                <li key={filter.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 truncate">{filter.name}</span>
                  <Badge tone="success">Created</Badge>
                </li>
              ))}
              {result.skippedWorkflowTypes.map((workflowType) => (
                <li key={workflowType} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 truncate">{TRACK_NAMES[workflowType] ?? workflowType}</span>
                  <Badge tone="neutral">Already existed</Badge>
                </li>
              ))}
            </ul>
            {result.syncError ? (
              <Callout tone="warn">
                Filters created, but the follow-up sync failed: {result.syncError}. Use
                &ldquo;Sync Jira&rdquo; on the board to retry.
              </Callout>
            ) : (
              result.syncSummary && (
                <p className="text-xs text-muted-foreground">
                  Synced right away — {result.syncSummary.filters.length} filter
                  {result.syncSummary.filters.length === 1 ? "" : "s"} refreshed.
                </p>
              )
            )}
          </div>
        )}

        <DialogError>{error}</DialogError>
      </div>
    </Dialog>
  );
}
