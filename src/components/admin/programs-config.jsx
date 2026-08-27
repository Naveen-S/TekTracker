"use client";

/**
 * Programs (program-rollup.md) — an admin-managed grouping ONE LEVEL ABOVE the scrum team (e.g.
 * "GM" → AI Agentic, Configurator & Website Setup, DX & SCX, PCX…; other programs are Honda, AEP…).
 * A Program has a name + short key and groups many Teams; a leadership/admin user then scopes the
 * /rollup page to a program. A team is assigned to its program when it's created/edited
 * (team-config-dialog.jsx) — NOT here; this section only CRUDs the program list itself. Deleting a
 * program un-assigns its teams (Team.programId is SetNull), it never deletes the teams or their data.
 *
 * Self-contained (own transition/status), matching the jira-components-config.jsx precedent rather
 * than threading admin-panel's run/busy through.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner, ProgressBar } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";

function ProgramRow({ program, run, busy }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: program.name, key: program.key });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const teamCount = program._count?.teams ?? 0;

  const saveEdit = (event) => {
    event.preventDefault();
    setSavingEdit(true);
    run(
      () => apiFetch(`/api/programs/${program.id}`, { method: "PATCH", body: draft }),
      `Updated ${draft.name}`,
    )
      .then(() => setEditing(false))
      .finally(() => setSavingEdit(false));
  };

  const cancelEdit = () => {
    setDraft({ name: program.name, key: program.key });
    setEditing(false);
  };

  return (
    <li className="border-b last:border-b-0">
      {editing ? (
        <form className="flex flex-wrap items-end gap-2 px-3.5 py-2.5" onSubmit={saveEdit}>
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <Label htmlFor={`prog-name-${program.id}`}>Name</Label>
            <Input
              id={`prog-name-${program.id}`}
              value={draft.name}
              onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
              required
              disabled={busy}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`prog-key-${program.id}`}>Key</Label>
            <Input
              id={`prog-key-${program.id}`}
              value={draft.key}
              onChange={(event) => setDraft((d) => ({ ...d, key: event.target.value.toUpperCase() }))}
              required
              disabled={busy}
              className="h-8 w-24 text-xs"
            />
          </div>
          <Button type="submit" size="sm" variant="secondary" disabled={busy}>
            {savingEdit && <Spinner />}
            {savingEdit ? "Saving…" : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={cancelEdit}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors hover:bg-muted/25">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <strong className="truncate text-sm">{program.name}</strong>
            <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
              {program.key}
            </span>
            <Badge tone={teamCount > 0 ? "neutral" : "warn"}>
              {teamCount} team{teamCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-strong focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              aria-label={`Delete ${program.name}`}
              title={`Delete ${program.name}`}
              onClick={() => setConfirmingDelete(true)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {confirmingDelete && (
        <Dialog
          open
          title={`Delete ${program.name}?`}
          description="This cannot be undone."
          tone="error"
          size="sm"
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmingDelete(false);
                  run(
                    () => apiFetch(`/api/programs/${program.id}`, { method: "DELETE" }),
                    `Deleted ${program.name}`,
                  );
                }}
              >
                Delete program
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed">
            {teamCount > 0 ? (
              <>
                Deleting <strong>{program.name}</strong> un-assigns its {teamCount} team
                {teamCount === 1 ? "" : "s"} from the program. The team{teamCount === 1 ? "" : "s"}{" "}
                and all their data are <strong>not</strong> affected.
              </>
            ) : (
              <>
                Deleting <strong>{program.name}</strong> removes the program. No teams are assigned
                to it.
              </>
            )}
          </p>
        </Dialog>
      )}
    </li>
  );
}

export function ProgramsConfig({ programs }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newProgram, setNewProgram] = useState({ name: "", key: "" });

  const inFlight = busy || pending;

  const run = async (fn, successMessage) => {
    setBusy(true);
    setStatus(null);
    try {
      const result = await fn();
      startTransition(() => {
        router.refresh();
        setStatus({ tone: "success", message: successMessage });
      });
      return result;
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const createProgram = (event) => {
    event.preventDefault();
    setCreating(true);
    run(
      () => apiFetch("/api/programs", { method: "POST", body: newProgram }),
      `Added ${newProgram.name}`,
    )
      .then(() => setNewProgram({ name: "", key: "" }))
      .finally(() => setCreating(false));
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      {/* Instant non-blocking feedback: the top sweep appears the moment any create/rename/delete
          fires and stays up through the router.refresh() re-render (house async vocabulary). */}
      <ProgressBar show={inFlight} />
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-info-soft text-info-strong"
            aria-hidden="true"
          >
            <Layers className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight font-bold">Programs</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              A grouping above the scrum team — e.g. GM groups AI Agentic, DX &amp; SCX, PCX. Leaders
              scope the roll-up to a program; assign a team to its program from its Edit dialog above.
            </p>
          </div>
        </div>
        {programs.length > 0 && (
          <span className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground tabular-nums">
            {programs.length}
          </span>
        )}
      </header>

      {status && (
        <p
          role={status.tone === "error" ? "alert" : "status"}
          aria-live={status.tone === "error" ? "assertive" : "polite"}
          className={`mb-3 text-xs font-semibold ${
            status.tone === "error" ? "text-danger-strong" : "text-success-strong"
          }`}
        >
          {status.message}
        </p>
      )}

      {programs.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No programs yet. Add the first one below — e.g. name &ldquo;GM&rdquo;, key &ldquo;GM&rdquo;.
        </p>
      ) : (
        <ul className="mb-4 divide-y overflow-hidden rounded-lg border">
          {programs.map((program) => (
            <ProgramRow key={program.id} program={program} run={run} busy={inFlight} />
          ))}
        </ul>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={createProgram}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="prog-new-name">Program name</Label>
          <Input
            id="prog-new-name"
            value={newProgram.name}
            onChange={(event) => setNewProgram((f) => ({ ...f, name: event.target.value }))}
            placeholder="GM"
            required
            disabled={inFlight}
            className="h-8 min-w-40 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="prog-new-key">Key</Label>
          <Input
            id="prog-new-key"
            value={newProgram.key}
            onChange={(event) =>
              setNewProgram((f) => ({ ...f, key: event.target.value.toUpperCase() }))
            }
            placeholder="GM"
            required
            disabled={inFlight}
            className="h-8 w-24 text-xs"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={inFlight} className="self-end">
          {creating && <Spinner />}
          {creating ? "Adding…" : "Add program"}
        </Button>
      </form>
    </section>
  );
}
