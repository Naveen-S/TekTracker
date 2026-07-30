"use client";

/**
 * Admin "Committed Capacity" matrix (committed-unplanned-work.md decision 6) — a per-sprint,
 * per-team Committed (Roadmap) point target, edited one sprint at a time in one batched save.
 * Mirrors bug-report-config.jsx's SLA-days-per-priority matrix idiom (a labelled Input cell per
 * row), but takes `run`/`busy` as props from AdminPanel (like TeamCard) rather than owning its own
 * `useTransition`, since this is a new top-level SectionCard riding the page's existing
 * toast-on-success / pinned-inline-error convention.
 *
 * `key={selectedSprintId}` on the inner matrix remounts it whenever the sprint switches (or a
 * save/duplicate completes and `router.refresh()` lands fresh `capacityRows`) — resetting the
 * local input buffer to server truth with no manual sync-`useEffect`.
 */
import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";

function CapacityMatrix({ teams, sprintId, rowsByTeam, run, busy }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(teams.map((team) => [team.id, rowsByTeam.get(team.id) ?? ""])),
  );

  const save = () =>
    run("Save committed capacity", () =>
      apiFetch(`/api/sprints/${sprintId}/capacity`, {
        method: "PUT",
        body: {
          rows: teams.map((team) => ({
            teamId: team.id,
            committedPoints: values[team.id] === "" ? null : Number(values[team.id]),
          })),
        },
      }),
    );

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y overflow-hidden rounded-lg border">
        {teams.map((team) => (
          <li
            key={team.id}
            className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
          >
            <span className="min-w-0 truncate">{team.name}</span>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={values[team.id]}
              placeholder="—"
              aria-label={`Committed capacity for ${team.name}`}
              disabled={busy}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, [team.id]: event.target.value }))
              }
              className="h-8 w-24 text-right text-xs"
            />
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Blank = no committed-capacity target for that team this sprint.
      </p>
      <Button size="sm" variant="secondary" className="self-end" disabled={busy} onClick={save}>
        Save capacity
      </Button>
    </div>
  );
}

export function SprintCapacityConfig({ teams, sprints, capacityRows, run, busy }) {
  const activeSprint = sprints.find((sprint) => sprint.state === "ACTIVE") ?? sprints[0] ?? null;
  const [selectedSprintId, setSelectedSprintId] = useState(activeSprint?.id ?? "");
  const [duplicateFromId, setDuplicateFromId] = useState("");
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);

  if (teams.length === 0 || sprints.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
        Create at least one team and one sprint before configuring committed capacity.
      </p>
    );
  }

  const rowsByTeam = new Map(
    capacityRows
      .filter((row) => row.sprintId === selectedSprintId)
      .map((row) => [row.teamId, row.committedPoints]),
  );
  const otherSprints = sprints.filter((sprint) => sprint.id !== selectedSprintId);
  const targetHasRows = rowsByTeam.size > 0;

  const duplicate = () =>
    run("Copy committed capacity", () =>
      apiFetch(`/api/sprints/${selectedSprintId}/capacity/duplicate`, {
        method: "POST",
        body: { sourceSprintId: duplicateFromId },
      }),
    );

  const requestDuplicate = () => {
    if (!duplicateFromId) return;
    if (targetHasRows) {
      setConfirmingOverwrite(true);
    } else {
      duplicate();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="capacity-sprint" className="text-xs font-medium text-muted-foreground">
            Sprint
          </label>
          <Select
            id="capacity-sprint"
            className="h-8 w-56 text-xs"
            value={selectedSprintId}
            disabled={busy}
            onChange={(event) => setSelectedSprintId(event.target.value)}
          >
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.state})
              </option>
            ))}
          </Select>
        </div>

        {otherSprints.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="capacity-duplicate-from"
                className="text-xs font-medium text-muted-foreground"
              >
                Duplicate from
              </label>
              <Select
                id="capacity-duplicate-from"
                className="h-8 w-56 text-xs"
                value={duplicateFromId}
                disabled={busy}
                onChange={(event) => setDuplicateFromId(event.target.value)}
              >
                <option value="">Select a sprint…</option>
                {otherSprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name} ({sprint.state})
                  </option>
                ))}
              </Select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy || !duplicateFromId}
              onClick={requestDuplicate}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        )}
      </div>

      {confirmingOverwrite && (
        <Dialog
          open
          title="Overwrite this sprint's capacity?"
          description="This cannot be undone."
          tone="error"
          size="sm"
          onClose={() => setConfirmingOverwrite(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingOverwrite(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmingOverwrite(false);
                  duplicate();
                }}
              >
                Overwrite
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed">
            This sprint already has committed-capacity numbers configured. Copying will replace
            them with the selected sprint&apos;s numbers.
          </p>
        </Dialog>
      )}

      {selectedSprintId ? (
        <CapacityMatrix
          key={selectedSprintId}
          teams={teams}
          sprintId={selectedSprintId}
          rowsByTeam={rowsByTeam}
          run={run}
          busy={busy}
        />
      ) : (
        <p className="text-xs text-muted-foreground">Select a sprint to configure its capacity.</p>
      )}
    </div>
  );
}
