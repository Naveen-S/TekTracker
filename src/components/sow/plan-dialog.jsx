"use client";

/**
 * Edit a SOW's whole plan (sow-tracker.md (g)): the phases in order, the ticket kinds each one
 * shows, and each phase's plan items — milestones and non-Jira tasks — with a baseline date (the
 * original commitment), a current date, a status, an optional Jira key and a comment. Saved in
 * one go through the replace-all PUT, so the dialog edits a local copy.
 *
 * `planBody` is also what the page uses for an in-place status change: the same whole-plan PUT.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, errorReference } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, KINDS, KIND_SHORT } from "@/lib/sow/defaults.mjs";

const PHASE_KINDS = KINDS.filter((kind) => kind !== "OTHER");

/** The page's phases → the PUT body (ids dropped: the plan is replaced as a set). */
export function planBody(phases) {
  return {
    phases: phases.map((phase) => ({
      name: phase.name,
      startDate: phase.startDate,
      endDate: phase.endDate,
      kinds: phase.kinds,
      items: phase.items.map((item) => ({
        title: item.title,
        status: item.status,
        baselineDate: item.baselineDate || null,
        currentDate: item.currentDate || null,
        isGate: item.isGate,
        jiraKey: item.jiraKey || null,
        comment: item.comment || null,
      })),
    })),
  };
}

let seq = 0;
const nextKey = (prefix) => `${prefix}-${++seq}`;

const blankItem = (date) => ({
  key: nextKey("item"),
  title: "",
  status: "NOT_STARTED",
  baselineDate: date ?? "",
  currentDate: date ?? "",
  isGate: false,
  jiraKey: "",
  comment: "",
});

const toDraft = (phases) =>
  phases.map((phase) => ({
    key: nextKey("phase"),
    name: phase.name,
    startDate: phase.startDate,
    endDate: phase.endDate,
    kinds: [...phase.kinds],
    items: phase.items.map((item) => ({
      key: nextKey("item"),
      title: item.title,
      status: item.status,
      baselineDate: item.baselineDate ?? "",
      currentDate: item.currentDate ?? "",
      isGate: item.isGate,
      jiraKey: item.jiraKey ?? "",
      comment: item.comment ?? "",
    })),
  }));

const describeError = (caught) => {
  const reference = errorReference(caught);
  return reference ? `${caught.message} (${reference})` : caught.message;
};

function ItemRow({ item, onChange, onRemove, disabled }) {
  const id = (field) => `${item.key}-${field}`;
  return (
    <fieldset className="grid gap-2 rounded-lg border bg-card p-2.5 lg:grid-cols-[minmax(0,1fr)_8.5rem_9.5rem_9.5rem_6.5rem_auto] lg:items-end">
      <legend className="sr-only">{item.title || "New plan item"}</legend>
      <Field label="Plan item" htmlFor={id("title")} eyebrow>
        <Input id={id("title")} size="sm" required maxLength={160} value={item.title} onChange={(event) => onChange("title", event.target.value)} placeholder="PRD sign-off" disabled={disabled} />
      </Field>
      <Field label="Status" htmlFor={id("status")} eyebrow>
        <Select id={id("status")} size="sm" value={item.status} onChange={(event) => onChange("status", event.target.value)} disabled={disabled}>
          {ITEM_STATUSES.map((status) => (
            <option key={status} value={status}>{ITEM_STATUS_LABELS[status]}</option>
          ))}
        </Select>
      </Field>
      <Field label="Baseline" htmlFor={id("baseline")} eyebrow>
        <Input id={id("baseline")} type="date" size="sm" value={item.baselineDate} onChange={(event) => onChange("baselineDate", event.target.value)} disabled={disabled} />
      </Field>
      <Field label="Current" htmlFor={id("current")} eyebrow>
        <Input id={id("current")} type="date" size="sm" value={item.currentDate} onChange={(event) => onChange("currentDate", event.target.value)} disabled={disabled} />
      </Field>
      <Field label="Jira key" htmlFor={id("jira")} eyebrow>
        <Input id={id("jira")} size="sm" value={item.jiraKey} onChange={(event) => onChange("jiraKey", event.target.value)} placeholder="GM-10506" autoCapitalize="characters" spellCheck={false} disabled={disabled} />
      </Field>
      <Button type="button" variant="ghostDestructive" size="icon" className="size-8 justify-self-end" onClick={onRemove} disabled={disabled} aria-label={`Remove ${item.title || "plan item"}`}>
        <Trash2 aria-hidden="true" />
      </Button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:col-span-6">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium">
          <Checkbox checked={item.isGate} onChange={(event) => onChange("isGate", event.target.checked)} disabled={disabled} />
          Gate milestone
        </label>
        <Input size="sm" maxLength={400} value={item.comment} onChange={(event) => onChange("comment", event.target.value)} placeholder="Comment (optional)" aria-label="Comment" disabled={disabled} className="min-w-0 flex-1 basis-56" />
      </div>
    </fieldset>
  );
}

function PhaseEditor({ phase, index, count, onChange, onMove, onRemove, disabled }) {
  const id = (field) => `${phase.key}-${field}`;
  const setItem = (key, field, value) =>
    onChange("items", phase.items.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  const toggleKind = (kind) =>
    onChange("kinds", phase.kinds.includes(kind) ? phase.kinds.filter((value) => value !== kind) : [...phase.kinds, kind]);
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border bg-subtle/60 p-3.5">
      <legend className="sr-only">Phase {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_auto] sm:items-end">
        <Field label={`Phase ${index + 1}`} htmlFor={id("name")}>
          <Input id={id("name")} required maxLength={60} value={phase.name} onChange={(event) => onChange("name", event.target.value)} disabled={disabled} />
        </Field>
        <Field label="Starts" htmlFor={id("start")}>
          <Input id={id("start")} type="date" required value={phase.startDate} onChange={(event) => onChange("startDate", event.target.value)} disabled={disabled} />
        </Field>
        <Field label="Ends" htmlFor={id("end")}>
          <Input id={id("end")} type="date" required min={phase.startDate || undefined} value={phase.endDate} onChange={(event) => onChange("endDate", event.target.value)} disabled={disabled} />
        </Field>
        <div className="flex items-center gap-0.5">
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label="Move phase earlier">
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label="Move phase later">
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghostDestructive" size="icon" onClick={onRemove} disabled={disabled || count === 1} aria-label={`Remove ${phase.name || "phase"}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Tickets shown in this phase</p>
        <div className="flex flex-wrap gap-1.5">
          {PHASE_KINDS.map((kind) => {
            const on = phase.kinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(kind)}
                disabled={disabled}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-subtle",
                )}
              >
                {KIND_SHORT[kind]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {phase.items.map((item) => (
          <ItemRow
            key={item.key}
            item={item}
            disabled={disabled}
            onChange={(field, value) => setItem(item.key, field, value)}
            onRemove={() => onChange("items", phase.items.filter((other) => other.key !== item.key))}
          />
        ))}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange("items", [...phase.items, blankItem(phase.endDate)])} disabled={disabled}>
          <Plus aria-hidden="true" />
          Add plan item
        </Button>
      </div>
    </fieldset>
  );
}

export function PlanDialog({ view, onClose, onSaved }) {
  const router = useRouter();
  const formId = useId();
  const [phases, setPhases] = useState(() => toDraft(view.phases));
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const setPhase = (key, field, value) =>
    setPhases((current) => current.map((phase) => (phase.key === key ? { ...phase, [field]: value } : phase)));
  const movePhase = (index, step) =>
    setPhases((current) => {
      const next = [...current];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  const addPhase = () =>
    setPhases((current) => {
      const last = current.at(-1);
      return [...current, { key: nextKey("phase"), name: "", startDate: last?.endDate ?? "", endDate: last?.endDate ?? "", kinds: [], items: [] }];
    });

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    startSaving(async () => {
      try {
        await apiFetch(`/api/sows/${view.sow.id}/plan`, { method: "PUT", body: planBody(phases) });
        router.refresh();
        onSaved("Plan saved");
      } catch (caught) {
        setError(describeError(caught));
      }
    });
  };

  return (
    <Dialog
      open
      hero="compact"
      size="xl"
      icon={ListChecks}
      title={`${view.sow.name} plan`}
      description="Phases in order, and each phase's milestones and tasks. Keep the baseline as first committed and move only the current date, so a slip stays visible."
      onClose={saving ? undefined : onClose}
      footerStart={
        <Button type="button" variant="outline" size="sm" onClick={addPhase} disabled={saving}>
          <Plus aria-hidden="true" />
          Add phase
        </Button>
      }
      footer={
        <>
          <DialogClose disabled={saving} />
          <Button type="submit" form={formId} disabled={saving}>
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save plan"}
          </Button>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {phases.map((phase, index) => (
          <PhaseEditor
            key={phase.key}
            phase={phase}
            index={index}
            count={phases.length}
            disabled={saving}
            onChange={(field, value) => setPhase(phase.key, field, value)}
            onMove={(step) => movePhase(index, step)}
            onRemove={() => setPhases((current) => current.filter((other) => other.key !== phase.key))}
          />
        ))}
        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
