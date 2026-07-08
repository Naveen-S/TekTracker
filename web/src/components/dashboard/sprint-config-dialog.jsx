"use client";

/**
 * Sprint (Gate) create/edit — admin-only (§13.3; the API enforces it regardless). Create mode
 * comes from the no-sprint empty state; edit mode from the hero's Configure Sprint.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

export function SprintConfigDialog({ mode, sprint, selectedTeamId, onClose, onSelect }) {
  const router = useRouter();
  const [name, setName] = useState(sprint?.name ?? "");
  const [start, setStart] = useState(toDateInput(sprint?.developmentStart));
  const [end, setEnd] = useState(toDateInput(sprint?.developmentEnd));
  const [release, setRelease] = useState(toDateInput(sprint?.releaseDate));
  const [state, setState] = useState(sprint?.state ?? "PLANNING");
  const [error, setError] = useState("");
  // Transition keeps "Saving…" up until the refreshed server data has rendered — the dialog
  // closes only once the change is actually visible behind it.
  const [saving, startSaving] = useTransition();

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const body = {
      name: name.trim(),
      developmentStart: start,
      developmentEnd: end,
      releaseDate: release || null,
      state,
    };
    startSaving(async () => {
      try {
        if (mode === "create") {
          const created = await apiFetch("/api/sprints", { method: "POST", body });
          startSaving(() => {
            onClose();
            onSelect(selectedTeamId, created.id);
            router.refresh();
          });
        } else {
          await apiFetch(`/api/sprints/${sprint.id}`, { method: "PATCH", body });
          startSaving(() => {
            onClose();
            router.refresh();
          });
        }
      } catch (err) {
        setError(err.message);
      }
    });
  };

  return (
    <Dialog
      open
      title={mode === "create" ? "Create Sprint (Gate)" : "Configure Sprint"}
      onClose={saving ? undefined : onClose}
    >
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sprint-name">Name</Label>
          <Input
            id="sprint-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. July 2026 Release"
            required
            disabled={saving}
            autoFocus={mode === "create"}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-start">Development start</Label>
            <Input
              id="sprint-start"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              required
              disabled={saving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-end">Development end</Label>
            <Input
              id="sprint-end"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              required
              disabled={saving}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-release">Release date (optional)</Label>
            <Input
              id="sprint-release"
              type="date"
              value={release}
              onChange={(event) => setRelease(event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sprint-state">State</Label>
            <Select
              id="sprint-state"
              value={state}
              onChange={(event) => setState(event.target.value)}
              disabled={saving}
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Sprints are global (one shared cadence for all teams) — renaming or re-dating affects
          every team. Closing a sprint is the supported alternative to deleting it.
        </p>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Create Sprint" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
