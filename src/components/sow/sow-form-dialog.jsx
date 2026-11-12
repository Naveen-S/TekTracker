"use client";

/**
 * Create, duplicate or edit a SOW (sow-tracker.md (g), decision 9).
 *
 * - `mode="create"`: name, program, Jira source, start and launch — the server lays the standard
 *   phases and milestones across those dates. Picking "Copy the plan from" duplicates another SOW
 *   instead (its phases, milestones, kind rules and weights, rescaled onto the new dates).
 * - `mode="edit"`: the same fields plus status, and the classification: the ordered kind rules
 *   (first match wins) and the weight each kind carries. Classification is read-time, so a save
 *   re-renders the page with no Jira refresh.
 */
import { useId, useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, FilePlus2, Plus, Settings2, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, SectionLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorReference } from "@/lib/api-client";
import { DEFAULT_KIND_RULES, KINDS, KIND_SHORT, REFERENCE_KINDS, REFERENCE_KIND_LABELS, SOW_STATUSES, SOW_STATUS_LABELS } from "@/lib/sow/defaults.mjs";

const NO_PROGRAM = "";
const FROM_TEMPLATE = "";
const WEIGHTED_KINDS = KINDS.filter((kind) => kind !== "EPIC");

const describeError = (caught) => {
  const reference = errorReference(caught);
  return reference ? `${caught.message} (${reference})` : caught.message;
};

const splitList = (text) => text.split(",").map((part) => part.trim()).filter(Boolean);

let ruleSeq = 0;
const toRuleRow = (rule) => ({
  key: `rule-${++ruleSeq}`,
  kind: rule.kind,
  projects: (rule.projects ?? []).join(", "),
  issueTypes: (rule.issueTypes ?? []).join(", "),
  labels: (rule.labels ?? []).join(", "),
});

function initialState(sow) {
  return {
    name: sow?.name ?? "",
    description: sow?.description ?? "",
    ownerName: sow?.ownerName ?? "",
    programId: sow?.programId ?? NO_PROGRAM,
    sourceType: sow?.sourceType ?? "JIRA_FILTER",
    jiraFilterId: sow?.jiraFilterId ?? "",
    jql: sow?.jql ?? "",
    homeProjectKeys: (sow?.homeProjectKeys ?? []).join(", "),
    slackChannelId: sow?.slackChannelId ?? "",
    feedChannelIds: (sow?.feedChannelIds ?? []).join(", "),
    startDate: sow?.startDate ?? "",
    launchDate: sow?.launchDate ?? "",
    status: sow?.status ?? "ACTIVE",
  };
}

let refSeq = 0;
const toRefRow = (reference = {}) => ({
  key: `ref-${++refSeq}`,
  group: reference.group ?? "",
  label: reference.label ?? "",
  url: reference.url ?? "",
  kind: reference.kind ?? "CONFLUENCE",
  note: reference.note ?? "",
  primary: Boolean(reference.primary),
});

/** The SOW's reading list: Confluence pages, repositories and links, grouped under headings. */
function ReferencesEditor({ refs, setRefs, disabled }) {
  const update = (key, field, value) => setRefs((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Docs & references</SectionLabel>
      <p className="text-xs leading-relaxed text-muted-foreground">
        What someone joining should read: design pages, API contracts, test reports, repositories. Entries with the same group sit under one heading. A repository may have no link. Notes and the primary source are also what Ask StoryBoard answers from.
      </p>
      {refs.map((row, index) => (
        <fieldset key={row.key} className="grid gap-2 rounded-lg border bg-subtle/60 p-2.5 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
          <legend className="sr-only">Reference {index + 1}</legend>
          <Field label="Kind" htmlFor={`${row.key}-kind`} eyebrow>
            <Select id={`${row.key}-kind`} size="sm" value={row.kind} onChange={(event) => update(row.key, "kind", event.target.value)} disabled={disabled}>
              {REFERENCE_KINDS.map((kind) => (
                <option key={kind} value={kind}>{REFERENCE_KIND_LABELS[kind]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Group" htmlFor={`${row.key}-group`} eyebrow>
            <Input id={`${row.key}-group`} size="sm" value={row.group} onChange={(event) => update(row.key, "group", event.target.value)} placeholder="Start here" disabled={disabled} />
          </Field>
          <Field label="Label" htmlFor={`${row.key}-label`} eyebrow>
            <Input id={`${row.key}-label`} size="sm" value={row.label} onChange={(event) => update(row.key, "label", event.target.value)} placeholder="Overall technical documentation" disabled={disabled} />
          </Field>
          <Button type="button" variant="ghostDestructive" size="icon" className="size-8" onClick={() => setRefs((rows) => rows.filter((other) => other.key !== row.key))} disabled={disabled} aria-label={`Remove ${row.label || "reference"}`}>
            <Trash2 aria-hidden="true" />
          </Button>
          <Input size="sm" className="sm:col-span-4" value={row.url} onChange={(event) => update(row.key, "url", event.target.value)} placeholder="https://…" aria-label="Link" spellCheck={false} disabled={disabled} />
          <Input size="sm" className="sm:col-span-3" value={row.note} maxLength={300} onChange={(event) => update(row.key, "note", event.target.value)} placeholder="What it is, in a line (optional) — shown under the link and given to Ask StoryBoard" aria-label="Note" disabled={disabled} />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium" title="Ask StoryBoard reads this page first when it searches this SOW's documents">
            <Checkbox checked={row.primary} onChange={(event) => update(row.key, "primary", event.target.checked)} disabled={disabled} />
            Primary source
          </label>
        </fieldset>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setRefs((rows) => [...rows, toRefRow({ group: rows.at(-1)?.group })])} disabled={disabled}>
        <Plus aria-hidden="true" />
        Add reference
      </Button>
    </div>
  );
}

function RulesEditor({ rules, setRules, disabled }) {
  const update = (key, field, value) => setRules((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  const move = (index, step) =>
    setRules((rows) => {
      const next = [...rows];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  return (
    <div className="flex flex-col gap-2">
      {rules.map((rule, index) => (
        <fieldset key={rule.key} className="grid gap-2 rounded-lg border bg-subtle/60 p-2.5 sm:grid-cols-[9rem_1fr_1fr_1fr_auto] sm:items-end">
          <legend className="sr-only">Rule {index + 1}</legend>
          <Field label="Kind" htmlFor={`${rule.key}-kind`} eyebrow>
            <Select id={`${rule.key}-kind`} size="sm" value={rule.kind} onChange={(event) => update(rule.key, "kind", event.target.value)} disabled={disabled}>
              {KINDS.filter((kind) => kind !== "OTHER").map((kind) => (
                <option key={kind} value={kind}>{KIND_SHORT[kind]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Projects" htmlFor={`${rule.key}-projects`} eyebrow>
            <Input id={`${rule.key}-projects`} size="sm" value={rule.projects} onChange={(event) => update(rule.key, "projects", event.target.value)} placeholder="RELB" disabled={disabled} />
          </Field>
          <Field label="Issue types" htmlFor={`${rule.key}-types`} eyebrow>
            <Input id={`${rule.key}-types`} size="sm" value={rule.issueTypes} onChange={(event) => update(rule.key, "issueTypes", event.target.value)} placeholder="Bug" disabled={disabled} />
          </Field>
          <Field label="Labels" htmlFor={`${rule.key}-labels`} eyebrow>
            <Input id={`${rule.key}-labels`} size="sm" value={rule.labels} onChange={(event) => update(rule.key, "labels", event.target.value)} placeholder="UAT" disabled={disabled} />
          </Field>
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => move(index, -1)} disabled={disabled || index === 0} aria-label="Move rule up">
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => move(index, 1)} disabled={disabled || index === rules.length - 1} aria-label="Move rule down">
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button type="button" variant="ghostDestructive" size="icon" className="size-8" onClick={() => setRules((rows) => rows.filter((row) => row.key !== rule.key))} disabled={disabled || rules.length === 1} aria-label="Remove rule">
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setRules((rows) => [...rows, toRuleRow({ kind: "STORY" })])} disabled={disabled}>
          <Plus aria-hidden="true" />
          Add rule
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRules(DEFAULT_KIND_RULES.map(toRuleRow))} disabled={disabled}>
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

function Classification({ rules, setRules, weights, setWeights, disabled }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <SectionLabel>Kind rules</SectionLabel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Checked top to bottom; the first rule a ticket matches decides its kind. Within a rule every filled column must match; separate several values with commas. A ticket matching no rule shows as Unclassified.
        </p>
        <RulesEditor rules={rules} setRules={setRules} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <SectionLabel>Weights</SectionLabel>
        <p className="text-xs leading-relaxed text-muted-foreground">
          How much one ticket of each kind counts toward the progress %. Epics are not weighed; they roll up from their tickets.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {WEIGHTED_KINDS.map((kind) => (
            <Field key={kind} label={KIND_SHORT[kind]} htmlFor={`weight-${kind}`} eyebrow>
              <Input
                id={`weight-${kind}`}
                type="number"
                min="0"
                max="100"
                step="0.5"
                size="sm"
                value={weights[kind]}
                onChange={(event) => setWeights((current) => ({ ...current, [kind]: event.target.value }))}
                disabled={disabled}
              />
            </Field>
          ))}
        </div>
      </div>
    </>
  );
}

/** Form state → the request body. Returns `{ body }` or `{ error }`. */
function buildBody(form, { edit, rules, weights, duplicateOf, refs }) {
  const body = {
    name: form.name,
    description: form.description,
    ownerName: form.ownerName,
    programId: form.programId || null,
    sourceType: form.sourceType,
    jiraFilterId: form.sourceType === "JIRA_FILTER" ? form.jiraFilterId : null,
    jql: form.sourceType === "JQL" ? form.jql : null,
    homeProjectKeys: splitList(form.homeProjectKeys),
    slackChannelId: form.slackChannelId,
    startDate: form.startDate,
    launchDate: form.launchDate,
  };
  if (!edit) return { body: { ...body, duplicateOf: duplicateOf || null } };

  const kindWeights = {};
  for (const kind of WEIGHTED_KINDS) {
    const value = Number(weights[kind]);
    if (!Number.isFinite(value) || value < 0) return { error: `The weight for ${KIND_SHORT[kind]} must be a number, 0 or more.` };
    kindWeights[kind] = value;
  }
  const kindRules = rules.map((rule) => ({
    kind: rule.kind,
    projects: splitList(rule.projects),
    issueTypes: splitList(rule.issueTypes),
    labels: splitList(rule.labels),
  }));
  const references = refs
    .filter((row) => row.label.trim() || row.url.trim())
    .map(({ group, label, url, kind, note, primary }) => ({ group: group.trim() || "Other", label, url, kind, note, primary }));
  const feedChannelIds = splitList(form.feedChannelIds).map((id) => id.replace(/^#/, "").toUpperCase());
  return { body: { ...body, status: form.status, kindRules, kindWeights, references, feedChannelIds } };
}

export function SowFormDialog({ mode, sow = null, programs, sows = [], onClose, onSaved }) {
  const router = useRouter();
  const formId = useId();
  const edit = mode === "edit";
  const [form, setForm] = useState(() => initialState(edit ? sow : null));
  const [duplicateOf, setDuplicateOf] = useState(mode === "duplicate" && sow ? sow.id : FROM_TEMPLATE);
  const [rules, setRules] = useState(() => (edit ? sow.kindRules : DEFAULT_KIND_RULES).map(toRuleRow));
  const [weights, setWeights] = useState(() => (edit ? { ...sow.kindWeights } : {}));
  const [refs, setRefs] = useState(() => (edit ? (sow.references ?? []).map(toRefRow) : []));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const set = (field) => (eventOrValue) =>
    setForm((current) => ({ ...current, [field]: eventOrValue?.target ? eventOrValue.target.value : eventOrValue }));

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const built = buildBody(form, { edit, rules, weights, duplicateOf, refs });
    if (built.error) {
      setError(built.error);
      return;
    }
    startSaving(async () => {
      try {
        const saved = edit
          ? await apiFetch(`/api/sows/${sow.id}`, { method: "PATCH", body: built.body })
          : await apiFetch("/api/sows", { method: "POST", body: built.body });
        if (edit) router.refresh();
        onSaved(saved, edit ? `Saved ${saved.name}` : `Created ${saved.name}`);
      } catch (caught) {
        setError(describeError(caught));
      }
    });
  };

  const handleDelete = () => {
    startSaving(async () => {
      try {
        await apiFetch(`/api/sows/${sow.id}`, { method: "DELETE" });
        router.push("/sow");
        router.refresh();
      } catch (caught) {
        setError(describeError(caught));
      }
    });
  };

  return (
    <>
      <Dialog
        open
        hero
        size="xl"
        icon={edit ? Settings2 : FilePlus2}
        title={edit ? `${sow.name} settings` : "New SOW"}
        description={
          edit
            ? "Details, the Jira source, and how tickets are sorted into kinds and weighed."
            : "Give the dates and the Jira source. The standard phases and milestones are laid out across the dates; adjust them afterwards in Edit plan."
        }
        onClose={saving ? undefined : onClose}
        footerStart={
          edit && (
            <Button type="button" variant="ghostDestructive" size="sm" onClick={() => setConfirmingDelete(true)} disabled={saving}>
              <Trash2 aria-hidden="true" />
              Delete SOW
            </Button>
          )
        }
        footer={
          <>
            <DialogClose disabled={saving} />
            <Button type="submit" form={formId} disabled={saving}>
              {saving && <Spinner />}
              {saving ? "Saving…" : edit ? "Save" : "Create SOW"}
            </Button>
          </>
        }
      >
        <form id={formId} className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor={`${formId}-name`}>
              <Input id={`${formId}-name`} required maxLength={80} value={form.name} onChange={set("name")} placeholder="Configurator AI" disabled={saving} />
            </Field>
            <Field label="Program" htmlFor={`${formId}-program`}>
              <Select id={`${formId}-program`} value={form.programId} onChange={set("programId")} disabled={saving}>
                <option value={NO_PROGRAM}>No program</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Start date" htmlFor={`${formId}-start`}>
              <Input id={`${formId}-start`} type="date" required value={form.startDate} onChange={set("startDate")} disabled={saving} />
            </Field>
            <Field label="Launch date" htmlFor={`${formId}-launch`} hint={edit ? "The headline countdown follows the last gate milestone in the plan." : undefined}>
              <Input id={`${formId}-launch`} type="date" required min={form.startDate || undefined} value={form.launchDate} onChange={set("launchDate")} disabled={saving} />
            </Field>
            <Field label="Owner (optional)" htmlFor={`${formId}-owner`}>
              <Input id={`${formId}-owner`} maxLength={80} value={form.ownerName} onChange={set("ownerName")} disabled={saving} />
            </Field>
            {edit ? (
              <Field label="Status" htmlFor={`${formId}-status`} hint="Completed and Archived SOWs stop refreshing nightly.">
                <Select id={`${formId}-status`} value={form.status} onChange={set("status")} disabled={saving}>
                  {SOW_STATUSES.map((status) => (
                    <option key={status} value={status}>{SOW_STATUS_LABELS[status]}</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Plan" htmlFor={`${formId}-copy`} hint="A copy brings that SOW's phases, milestones, rules and weights, rescaled to these dates.">
                <Select id={`${formId}-copy`} value={duplicateOf} onChange={(event) => setDuplicateOf(event.target.value)} disabled={saving}>
                  <option value={FROM_TEMPLATE}>Standard template</option>
                  {sows.map((other) => (
                    <option key={other.id} value={other.id}>Copy of {other.name}</option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Description (optional)" htmlFor={`${formId}-description`} className="sm:col-span-2">
              <Textarea id={`${formId}-description`} maxLength={400} rows={2} value={form.description} onChange={set("description")} disabled={saving} />
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <SectionLabel>Jira source</SectionLabel>
            <Segmented
              aria-label="Source"
              value={form.sourceType}
              onChange={set("sourceType")}
              disabled={saving}
              className="self-start"
              options={[
                { value: "JIRA_FILTER", label: "Filter ID" },
                { value: "JQL", label: "JQL query" },
              ]}
            />
            {form.sourceType === "JIRA_FILTER" ? (
              <Field label="Jira filter ID" htmlFor={`${formId}-filter`} hint="The number in the filter's URL (…/issues/?filter=71390). Re-read on every refresh, so edits in Jira are picked up.">
                <Input id={`${formId}-filter`} inputMode="numeric" required value={form.jiraFilterId} onChange={set("jiraFilterId")} placeholder="71390" disabled={saving} className="sm:max-w-48" />
              </Field>
            ) : (
              <Field label="JQL" htmlFor={`${formId}-jql`}>
                <Textarea id={`${formId}-jql`} required rows={3} value={form.jql} onChange={set("jql")} placeholder='labels = "Configurator_AI"' disabled={saving} className="font-mono text-[13px]" />
              </Field>
            )}
            <Field label="Home projects" htmlFor={`${formId}-home`} hint="Your own Jira projects, comma-separated. A ticket from any other project is flagged as a cross-team dependency.">
              <Input id={`${formId}-home`} value={form.homeProjectKeys} onChange={set("homeProjectKeys")} placeholder="GM" disabled={saving} className="sm:max-w-72" />
            </Field>
          </div>

          <Field
            label="Pre-QA issues channel (optional)"
            htmlFor={`${formId}-slack`}
            hint="The channel ID where issues are raised before the QA hand-off (in Slack: channel details, at the bottom). An admin reads it with Sync Slack, through their own Claude Connector."
          >
            <Input id={`${formId}-slack`} value={form.slackChannelId} onChange={set("slackChannelId")} placeholder="C0CE3GZ6JSD" spellCheck={false} disabled={saving} className="font-mono sm:max-w-48" />
          </Field>

          {edit && (
            <Field
              label="Docs & decisions channels (optional)"
              htmlFor={`${formId}-feed`}
              hint="Slack channel IDs, comma-separated. These are read only for decisions and shared documents — never for issues — and show in the Decision log and Docs & references. Your Claude Code can only read channels you are a member of."
            >
              <Input id={`${formId}-feed`} value={form.feedChannelIds} onChange={set("feedChannelIds")} placeholder="C0BQ6HUJHQE, C0BREF9BP4N" spellCheck={false} disabled={saving} className="font-mono" />
            </Field>
          )}

          {edit && <ReferencesEditor refs={refs} setRefs={setRefs} disabled={saving} />}
          {edit && <Classification rules={rules} setRules={setRules} weights={weights} setWeights={setWeights} disabled={saving} />}
          {edit && sow.resolvedJql && sow.sourceType === "JIRA_FILTER" && (
            <Callout tone="info" title="JQL at the last refresh">
              <code className="font-mono text-xs break-all">{sow.resolvedJql}</code>
            </Callout>
          )}
          <DialogError>{error}</DialogError>
        </form>
      </Dialog>
      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${sow.name}?`}
          description="Its plan, risks, mirrored tickets and share links are removed. Nothing in Jira changes. This cannot be undone."
          confirmLabel="Delete SOW"
          onConfirm={handleDelete}
          onClose={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}
