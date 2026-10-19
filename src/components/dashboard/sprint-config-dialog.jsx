"use client";

/**
 * Sprint (Gate) create/edit — admin-only (§13.3; the API enforces it regardless). Create mode
 * comes from the no-sprint empty state; edit mode from the hero's Configure Sprint.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";

const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : "");

/** Comma/newline-separated text ⇄ a trimmed, deduped array of Jira Fix Version names. */
const parseFixVersions = (text) =>
  [...new Set(text.split(/[,\n]/).map((v) => v.trim()).filter(Boolean))];

export function SprintConfigDialog({ mode, sprint, selectedTeamId, onClose, onSelect, onSaved }) {
  const router = useRouter();
  const [name, setName] = useState(sprint?.name ?? "");
  const [start, setStart] = useState(toDateInput(sprint?.developmentStart));
  const [end, setEnd] = useState(toDateInput(sprint?.developmentEnd));
  const [release, setRelease] = useState(toDateInput(sprint?.releaseDate));
  const [fixVersionsText, setFixVersionsText] = useState((sprint?.fixVersions ?? []).join(", "));
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
      fixVersions: parseFixVersions(fixVersionsText),
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
            onSaved?.();
          });
        } else {
          await apiFetch(`/api/sprints/${sprint.id}`, { method: "PATCH", body });
          startSaving(() => {
            onClose();
            router.refresh();
            onSaved?.();
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
      icon={CalendarRange}
      hero
      title={mode === "create" ? "Create sprint (gate)" : "Configure sprint"}
      description="Sprints are global — one shared cadence for every team, running dev cycle → QA/UAT → release."
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <DialogClose />
          <Button type="submit" form="sprint-config-form" disabled={saving}>
            {saving && <Spinner />}
            {saving ? "Saving…" : mode === "create" ? "Create sprint" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="sprint-config-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <Field label="Name" htmlFor="sprint-name">
          <Input
            id="sprint-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. July 2026 Release"
            required
            disabled={saving}
            autoFocus={mode === "create"}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Development start" htmlFor="sprint-start">
            <Input
              id="sprint-start"
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              required
              disabled={saving}
            />
          </Field>
          <Field label="Development end" htmlFor="sprint-end">
            <Input
              id="sprint-end"
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              required
              disabled={saving}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Release date (optional)" htmlFor="sprint-release">
            <Input
              id="sprint-release"
              type="date"
              value={release}
              onChange={(event) => setRelease(event.target.value)}
              disabled={saving}
            />
          </Field>
          <Field label="State" htmlFor="sprint-state">
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
          </Field>
        </div>
        <Field
          label="Fix version(s)"
          htmlFor="sprint-fix-versions"
          hint="Comma-separated Jira Fix Version names this gate spans — they scope One-Click Sprint Start's generated filters."
        >
          <Input
            id="sprint-fix-versions"
            value={fixVersionsText}
            onChange={(event) => setFixVersionsText(event.target.value)}
            placeholder="e.g. Release-2026.07.1.0, Release-2026.07.1.1"
            disabled={saving}
          />
        </Field>
        <Callout tone="neutral">
          Renaming or re-dating affects every team. Closing a sprint is the supported alternative
          to deleting it.
        </Callout>
        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
