"use client";

/**
 * Admin "Security tracker" (security-vulnerability-tracker.md (d); lean forms, C4): the settings
 * singleton + release calendar (one PUT), and the security programs (create / edit / remove —
 * removal deactivates a program with snapshot history). `slaDays` and `riskThresholds` are JSON text
 * areas validated server-side by zod. Takes `run`/`busy` from AdminPanel so saves ride the page's
 * toast-on-success / inline-error convention (the AnalysisSettingsConfig idiom).
 *
 * Classification is read-time: a save re-renders /security instantly, no Jira refresh needed.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-client";

const TEXT_FIELDS = [
  ["openPipelineJql", "Open pipeline JQL", "filter = 32995"],
  ["priorityJql", "Priority JQL", "(priority = 1 OR …)"],
  ["vulnLabelsPageId", "Vulnerability labels page id", "6317540178"],
  ["trackLabelsPageId", "Track labels page id", "6317671628"],
  ["serviceTrackPageId", "Service → track page id", "6317179805"],
  ["monthLabelPrefix", "Triaged month-label prefix", "DRP_SECURITY_"],
  ["storyPointsField", "Story points field", "customfield_14539"],
  ["sprintField", "Sprint field", "customfield_10003"],
  ["subComponentField", "Sub-component field", "customfield_13108"],
];

function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function parseJson(text, name) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

function SettingsForm({ settings, releases: initialReleases, run, busy }) {
  const [form, setForm] = useState(() => Object.fromEntries(TEXT_FIELDS.map(([key]) => [key, settings[key] ?? ""])));
  const [dueSoonDays, setDueSoonDays] = useState(String(settings.dueSoonDays));
  const [placeholders, setPlaceholders] = useState(settings.placeholderEstimateDays.join(", "));
  const [workbenchUrl, setWorkbenchUrl] = useState(settings.workbenchUrl ?? "");
  const [slaText, setSlaText] = useState(JSON.stringify(settings.slaDays, null, 2));
  const [thresholdText, setThresholdText] = useState(JSON.stringify(settings.riskThresholds, null, 2));
  const [releases, setReleases] = useState(initialReleases);

  const setRelease = (index, patch) =>
    setReleases((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const save = (event) => {
    event.preventDefault();
    run("Save security tracker settings", () =>
      apiFetch("/api/security/settings", {
        method: "PUT",
        body: {
          settings: {
            ...form,
            dueSoonDays: Number(dueSoonDays),
            placeholderEstimateDays: placeholders.split(",").map((value) => Number(value.trim())).filter((value) => value > 0),
            workbenchUrl: workbenchUrl.trim() || null,
            slaDays: parseJson(slaText, "SLA days"),
            riskThresholds: parseJson(thresholdText, "Risk thresholds"),
          },
          releases: releases.map((row) => ({ month: row.month, shipDate: row.shipDate, note: row.note || null })),
        },
      }),
    );
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <p className="-mb-2 text-sm font-semibold">Settings</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEXT_FIELDS.map(([key, label, placeholder]) => (
          <Field key={key} id={`sec-${key}`} label={label}>
            <Input
              id={`sec-${key}`}
              value={form[key]}
              disabled={busy}
              placeholder={placeholder}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </Field>
        ))}
        <Field id="sec-due" label="Due-soon window (days)">
          <Input id="sec-due" type="number" min="0" value={dueSoonDays} disabled={busy} onChange={(event) => setDueSoonDays(event.target.value)} />
        </Field>
        <Field id="sec-placeholder" label="Placeholder estimates (days)" hint="Flagged and left out of realistic effort.">
          <Input id="sec-placeholder" value={placeholders} disabled={busy} onChange={(event) => setPlaceholders(event.target.value)} />
        </Field>
        <Field id="sec-workbench" label="Workbench URL" hint="Admins only — the artifact for triage + Jira writes.">
          <Input id="sec-workbench" value={workbenchUrl} disabled={busy} placeholder="https://claude.ai/artifact/…" onChange={(event) => setWorkbenchUrl(event.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field id="sec-sla" label="SLA days by priority (JSON)" hint='Calendar days from creation; leave a priority out for "no SLA".'>
          <Textarea id="sec-sla" rows={6} className="font-mono text-xs" value={slaText} disabled={busy} onChange={(event) => setSlaText(event.target.value)} />
        </Field>
        <Field id="sec-thresholds" label="Risk thresholds (JSON)" hint="pastSla.highP0/highP1 · overdue.high · noFixVersion.highPctOfOpen · stale.days">
          <Textarea id="sec-thresholds" rows={6} className="font-mono text-xs" value={thresholdText} disabled={busy} onChange={(event) => setThresholdText(event.target.value)} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Release calendar</p>
        <div className="flex flex-col gap-2">
          {releases.map((row, index) => (
            <div key={index} className="grid grid-cols-[6.5rem_9.5rem_1fr_auto] items-center gap-2">
              <Input aria-label="Month (YYYY-MM)" value={row.month} disabled={busy} placeholder="2027-01" onChange={(event) => setRelease(index, { month: event.target.value })} />
              <Input aria-label="Ship date" type="date" value={row.shipDate} disabled={busy} onChange={(event) => setRelease(index, { shipDate: event.target.value })} />
              <Input aria-label="Note" value={row.note ?? ""} disabled={busy} placeholder="note (optional)" onChange={(event) => setRelease(index, { note: event.target.value })} />
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setReleases((rows) => rows.filter((_, i) => i !== index))}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={busy}
          onClick={() => setReleases((rows) => [...rows, { month: "", shipDate: "", note: "" }])}
        >
          Add month
        </Button>
        <p className="mt-1 text-[11px] text-muted-foreground">Months after the last row reuse its day and show as “est.”.</p>
      </div>

      <div>
        <Button type="submit" disabled={busy}>Save settings + calendar</Button>
      </div>
    </form>
  );
}

const EMPTY_PROGRAM = {
  key: "",
  name: "",
  component: "",
  sortOrder: "0",
  isActive: true,
  progressJql: "",
  excludeLabel: "",
  trackBreached: false,
  usesTrackLabels: false,
  legacyLabel: "",
  note: "",
  programId: "",
};

function ProgramForm({ initial, linkPrograms, busy, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_PROGRAM, ...initial, sortOrder: String(initial?.sortOrder ?? 0) }));
  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      ...form,
      sortOrder: Number(form.sortOrder),
      excludeLabel: form.excludeLabel || null,
      legacyLabel: form.legacyLabel || null,
      note: form.note || null,
      programId: form.programId || null,
    });
  };
  const id = (key) => `sec-prog-${initial?.id ?? "new"}-${key}`;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={id("key")} label="Key"><Input id={id("key")} value={form.key} disabled={busy} onChange={set("key")} placeholder="DR_GM" /></Field>
        <Field id={id("name")} label="Name"><Input id={id("name")} value={form.name} disabled={busy} onChange={set("name")} /></Field>
        <Field id={id("component")} label="Jira component"><Input id={id("component")} value={form.component} disabled={busy} onChange={set("component")} /></Field>
        <Field id={id("order")} label="Order"><Input id={id("order")} type="number" min="0" value={form.sortOrder} disabled={busy} onChange={set("sortOrder")} /></Field>
      </div>
      <Field id={id("jql")} label="Progress JQL (Done-inclusive)">
        <Input id={id("jql")} value={form.progressJql} disabled={busy} onChange={set("progressJql")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id={id("exclude")} label="Exclude label" hint="Another team's work — excluded everywhere.">
          <Input id={id("exclude")} value={form.excludeLabel ?? ""} disabled={busy} onChange={set("excludeLabel")} placeholder="NON_DR_GM" />
        </Field>
        <Field id={id("legacy")} label="Legacy label" hint="Enables the 1.0 vs 2.0 split.">
          <Input id={id("legacy")} value={form.legacyLabel ?? ""} disabled={busy} onChange={set("legacyLabel")} />
        </Field>
        <Field id={id("link")} label="StoryBoard program (optional)">
          <Select id={id("link")} value={form.programId ?? ""} disabled={busy} onChange={set("programId")}>
            <option value="">— none —</option>
            {linkPrograms.map((program) => (
              <option key={program.id} value={program.id}>{program.name} ({program.key})</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id={id("note")} label="Context note" hint="Shown first on the risk register, e.g. an agreed, known risk.">
        <Textarea id={id("note")} rows={2} value={form.note ?? ""} disabled={busy} onChange={set("note")} />
      </Field>
      <div className="flex flex-wrap gap-4 text-sm">
        {[
          ["isActive", "Active"],
          ["usesTrackLabels", "Uses track labels"],
          ["trackBreached", "Tracks *_BREACHED labels"],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <Checkbox checked={Boolean(form[key])} disabled={busy} onChange={set(key)} />
            {label}
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{submitLabel}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function ProgramsList({ programs, linkPrograms, run, busy }) {
  const [editing, setEditing] = useState(null); // program id | "new" | null
  const [removing, setRemoving] = useState(null); // program row awaiting confirmation
  const save = (label, request) =>
    run(label, async () => {
      await request();
      setEditing(null);
    });
  return (
    <div className="flex flex-col gap-2">
      {programs.map((program) =>
        editing === program.id ? (
          <ProgramForm
            key={program.id}
            initial={program}
            linkPrograms={linkPrograms}
            busy={busy}
            submitLabel="Save program"
            onCancel={() => setEditing(null)}
            onSubmit={(body) =>
              save(`Save ${program.key}`, () => apiFetch(`/api/security/programs/${program.id}`, { method: "PATCH", body }))
            }
          />
        ) : (
          <div key={program.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
            <span className="font-semibold">{program.key}</span>
            <span className="text-muted-foreground">{program.name}</span>
            {!program.isActive && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">inactive</span>}
            {program.excludeLabel && <code className="text-xs">excl. {program.excludeLabel}</code>}
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(program.id)}>Edit</Button>
              <Button
                size="sm"
                variant="ghostDestructive"
                disabled={busy}
                onClick={() => setRemoving(program)}
              >
                Remove
              </Button>
            </span>
          </div>
        ),
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${removing.key}?`}
          description="A program with snapshot history is deactivated instead, so its history stays. One without history is deleted."
          confirmLabel="Remove"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            const program = removing;
            setRemoving(null);
            run(`Remove ${program.key}`, () => apiFetch(`/api/security/programs/${program.id}`, { method: "DELETE" }));
          }}
        />
      )}
      {editing === "new" ? (
        <ProgramForm
          initial={{ sortOrder: programs.length }}
          linkPrograms={linkPrograms}
          busy={busy}
          submitLabel="Add program"
          onCancel={() => setEditing(null)}
          onSubmit={(body) => save("Add security program", () => apiFetch("/api/security/programs", { method: "POST", body }))}
        />
      ) : (
        <div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing("new")}>Add program</Button>
          <p className="mt-1 text-[11px] text-muted-foreground">Removing a program with snapshot history deactivates it instead, so its history stays.</p>
        </div>
      )}
    </div>
  );
}

export function SecurityConfig({ config, linkPrograms, run, busy }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-semibold">Programs</p>
        <ProgramsList programs={config.programs} linkPrograms={linkPrograms} run={run} busy={busy} />
      </div>
      <SettingsForm settings={config.settings} releases={config.releases} run={run} busy={busy} />
    </div>
  );
}
