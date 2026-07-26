"use client";

/**
 * Jira Components catalog (one-click-sprint-start.md decision 1) — a reusable master list of
 * Jira Component field values, admin-entered one at a time (no bulk import, no live Jira lookup):
 * a Component (name + Jira project key, e.g. "DR_GM" / "GM") has many Sub-components (e.g.
 * "DR_GM-VSR"), each claimed by at most one Team. Creating/editing a Team (`team-config-dialog.jsx`)
 * picks a subset of a Component's sub-components to claim.
 *
 * Self-contained (own transition/status), matching the `bug-report-config.jsx` precedent rather
 * than threading admin-panel's `run`/`busy` through.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boxes, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

function ComponentRow({ component, run, busy }) {
  const [expanded, setExpanded] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [confirmingDeleteComponent, setConfirmingDeleteComponent] = useState(false);
  const [confirmingDeleteSub, setConfirmingDeleteSub] = useState(null);

  const addSubComponent = (event) => {
    event.preventDefault();
    const name = newSubName.trim();
    if (!name) return;
    run(
      () =>
        apiFetch(`/api/jira-components/${component.id}/sub-components`, {
          method: "POST",
          body: { name },
        }),
      `Added ${name}`,
    ).then(() => setNewSubName(""));
  };

  return (
    <li className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors hover:bg-muted/25">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <strong className="truncate text-sm">{component.name}</strong>
          <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {component.projectKey}
          </span>
          <span className="text-xs text-muted-foreground">
            {component.subComponents.length} sub-component
            {component.subComponents.length === 1 ? "" : "s"}
          </span>
        </button>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-strong"
          disabled={busy}
          aria-label={`Delete ${component.name}`}
          onClick={() => setConfirmingDeleteComponent(true)}
        >
          <X className="size-3.5" />
        </button>
      </div>

      {confirmingDeleteComponent && (
        <Dialog
          open
          title={`Delete ${component.name}?`}
          description="This cannot be undone."
          tone="error"
          size="sm"
          onClose={() => setConfirmingDeleteComponent(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingDeleteComponent(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmingDeleteComponent(false);
                  run(
                    () => apiFetch(`/api/jira-components/${component.id}`, { method: "DELETE" }),
                    `Deleted ${component.name}`,
                  );
                }}
              >
                Delete component
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed">
            Deleting <strong>{component.name}</strong> also removes all{" "}
            {component.subComponents.length} of its sub-components, releasing any team&rsquo;s
            claim on them.
          </p>
        </Dialog>
      )}

      {expanded && (
        <div className="border-t bg-muted/20 px-3.5 py-3">
          {component.subComponents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sub-components yet.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {component.subComponents.map((sub) => (
                <li
                  key={sub.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <span className="flex-1 truncate font-mono text-xs">{sub.name}</span>
                  {sub.team ? (
                    <Badge tone="neutral">{sub.team.name}</Badge>
                  ) : (
                    <Badge tone="warn">Unassigned</Badge>
                  )}
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-strong"
                    disabled={busy}
                    aria-label={`Delete ${sub.name}`}
                    onClick={() => setConfirmingDeleteSub(sub)}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {confirmingDeleteSub && (
            <Dialog
              open
              title={`Delete ${confirmingDeleteSub.name}?`}
              description={
                confirmingDeleteSub.team
                  ? `This releases ${confirmingDeleteSub.team.name}'s claim on it. Cannot be undone.`
                  : "This cannot be undone."
              }
              tone="error"
              size="sm"
              onClose={() => setConfirmingDeleteSub(null)}
              footer={
                <>
                  <Button variant="secondary" onClick={() => setConfirmingDeleteSub(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      const sub = confirmingDeleteSub;
                      setConfirmingDeleteSub(null);
                      run(
                        () => apiFetch(`/api/jira-sub-components/${sub.id}`, { method: "DELETE" }),
                        `Deleted ${sub.name}`,
                      );
                    }}
                  >
                    Delete sub-component
                  </Button>
                </>
              }
            />
          )}
          <form className="mt-3 flex gap-2" onSubmit={addSubComponent}>
            <Input
              value={newSubName}
              onChange={(event) => setNewSubName(event.target.value)}
              placeholder="e.g. DR_GM-VSR"
              required
              disabled={busy}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={busy}>
              Add sub-component
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}

export function JiraComponentsConfig({ components }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [newComponent, setNewComponent] = useState({ name: "", projectKey: "" });

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

  const createComponent = (event) => {
    event.preventDefault();
    run(
      () => apiFetch("/api/jira-components", { method: "POST", body: newComponent }),
      `Added ${newComponent.name}`,
    ).then(() => setNewComponent({ name: "", projectKey: "" }));
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-info-soft text-info-strong"
            aria-hidden="true"
          >
            <Boxes className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight font-bold">Jira components</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              The catalog behind One-Click Sprint Start: a Component (a Jira project&rsquo;s
              top-level Component field value) has many Sub-components — the literal Jira Component
              values a scrum team claims when it&rsquo;s created below.
            </p>
          </div>
        </div>
        {components.length > 0 && (
          <span className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground tabular-nums">
            {components.length}
          </span>
        )}
      </header>

      {status && (
        <p
          className={`mb-3 text-xs font-semibold ${
            status.tone === "error" ? "text-danger-strong" : "text-success-strong"
          }`}
        >
          {status.message}
        </p>
      )}

      {components.length === 0 ? (
        <p className="mb-4 rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
          No components yet. Add the first one below — e.g. name &ldquo;DR_GM&rdquo;, project key
          &ldquo;GM&rdquo;.
        </p>
      ) : (
        <ul className="mb-4 divide-y overflow-hidden rounded-lg border">
          {components.map((component) => (
            <ComponentRow key={component.id} component={component} run={run} busy={inFlight} />
          ))}
        </ul>
      )}

      <form className="flex flex-wrap gap-2" onSubmit={createComponent}>
        <div className="flex flex-col gap-1">
          <Label htmlFor="jc-name">Component name</Label>
          <Input
            id="jc-name"
            value={newComponent.name}
            onChange={(event) => setNewComponent((f) => ({ ...f, name: event.target.value }))}
            placeholder="DR_GM"
            required
            disabled={inFlight}
            className="h-8 min-w-40 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="jc-project-key">Jira project key</Label>
          <Input
            id="jc-project-key"
            value={newComponent.projectKey}
            onChange={(event) =>
              setNewComponent((f) => ({ ...f, projectKey: event.target.value.toUpperCase() }))
            }
            placeholder="GM"
            required
            disabled={inFlight}
            className="h-8 w-24 text-xs"
          />
        </div>
        <Button type="submit" size="sm" variant="secondary" disabled={inFlight} className="self-end">
          Add component
        </Button>
      </form>
    </section>
  );
}
