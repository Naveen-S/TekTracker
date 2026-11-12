"use client";

/**
 * Edit a SOW's risks, blockers and open decisions (sow-tracker.md (g)). One hand-kept list, saved
 * through the replace-all PUT. An open Blocker raises the SOW's health to at least At risk.
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, errorReference } from "@/lib/api-client";
import { RISK_STATUSES, RISK_STATUS_LABELS, RISK_TYPES, RISK_TYPE_LABELS } from "@/lib/sow/defaults.mjs";

let seq = 0;
const toRow = (risk = {}) => ({
  key: `risk-${++seq}`,
  type: risk.type ?? "RISK",
  title: risk.title ?? "",
  ownerName: risk.ownerName ?? "",
  status: risk.status ?? "OPEN",
  note: risk.note ?? "",
  dueDate: risk.dueDate ?? "",
});

const describeError = (caught) => {
  const reference = errorReference(caught);
  return reference ? `${caught.message} (${reference})` : caught.message;
};

export function RisksDialog({ view, onClose, onSaved }) {
  const router = useRouter();
  const formId = useId();
  const [rows, setRows] = useState(() => view.risks.map(toRow));
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const update = (key, field, value) => setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const risks = rows
      .filter((row) => row.title.trim())
      .map(({ type, title, ownerName, status, note, dueDate }) => ({ type, title, ownerName, status, note, dueDate: dueDate || null }));
    startSaving(async () => {
      try {
        await apiFetch(`/api/sows/${view.sow.id}/risks`, { method: "PUT", body: { risks } });
        router.refresh();
        onSaved("Risks saved");
      } catch (caught) {
        setError(describeError(caught));
      }
    });
  };

  return (
    <Dialog
      open
      hero
      size="lg"
      icon={ShieldAlert}
      title="Risks, blockers & decisions"
      description={`What could move ${view.sow.name}'s dates, and what still needs deciding. An open Blocker marks the SOW at risk.`}
      onClose={saving ? undefined : onClose}
      footerStart={
        <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, toRow()])} disabled={saving}>
          <Plus aria-hidden="true" />
          Add
        </Button>
      }
      footer={
        <>
          <DialogClose disabled={saving} />
          <Button type="submit" form={formId} disabled={saving}>
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id={formId} className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">Nothing recorded. Use Add to note a risk, a blocker or an open decision.</p>
        )}
        {rows.map((row, index) => (
          <fieldset key={row.key} className="grid gap-3 rounded-xl border bg-subtle/60 p-3.5 sm:grid-cols-6">
            <legend className="sr-only">Entry {index + 1}</legend>
            <Field label="Type" htmlFor={`${row.key}-type`} className="sm:col-span-2">
              <Select id={`${row.key}-type`} value={row.type} onChange={(event) => update(row.key, "type", event.target.value)} disabled={saving}>
                {RISK_TYPES.map((type) => (
                  <option key={type} value={type}>{RISK_TYPE_LABELS[type]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor={`${row.key}-status`} className="sm:col-span-2">
              <Select id={`${row.key}-status`} value={row.status} onChange={(event) => update(row.key, "status", event.target.value)} disabled={saving}>
                {RISK_STATUSES.map((status) => (
                  <option key={status} value={status}>{RISK_STATUS_LABELS[status]}</option>
                ))}
              </Select>
            </Field>
            <Field label="Due (optional)" htmlFor={`${row.key}-due`} className="sm:col-span-2">
              <Input id={`${row.key}-due`} type="date" value={row.dueDate} onChange={(event) => update(row.key, "dueDate", event.target.value)} disabled={saving} />
            </Field>
            <Field label="What" htmlFor={`${row.key}-title`} className="sm:col-span-4">
              <Input id={`${row.key}-title`} required maxLength={200} value={row.title} onChange={(event) => update(row.key, "title", event.target.value)} placeholder="Private Prod option not confirmed" disabled={saving} />
            </Field>
            <Field label="Owner (optional)" htmlFor={`${row.key}-owner`} className="sm:col-span-2">
              <Input id={`${row.key}-owner`} maxLength={80} value={row.ownerName} onChange={(event) => update(row.key, "ownerName", event.target.value)} disabled={saving} />
            </Field>
            <Field label="Note (optional)" htmlFor={`${row.key}-note`} className="sm:col-span-5">
              <Input id={`${row.key}-note`} maxLength={600} value={row.note} onChange={(event) => update(row.key, "note", event.target.value)} disabled={saving} />
            </Field>
            <div className="flex items-end justify-end">
              <Button type="button" variant="ghostDestructive" size="sm" onClick={() => setRows((current) => current.filter((other) => other.key !== row.key))} disabled={saving}>
                <Trash2 aria-hidden="true" />
                Remove
              </Button>
            </div>
          </fieldset>
        ))}
        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
