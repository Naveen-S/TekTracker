"use client";

/**
 * Edit one team's Support on-call POCs for one sprint (support-oncall.md (g)). The whole list is
 * saved at once through the replace-all PUT, so the dialog edits a local copy: rows (person, name,
 * phone, area), a single Primary choice across rows with a "No primary" option, and Add row up to
 * the team's cap. Each row picks from everyone an admin added to the team (roster ∪ members, as-built
 * 15); a pick fills the name and phone from the admin's contact details, still editable. "Someone not
 * on the roster…" falls back to typing the email. The server re-checks every rule (cap, one Primary,
 * unique emails).
 */
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, errorReference } from "@/lib/api-client";
import { cn } from "@/lib/utils";

let rowSeq = 0;
const blankRow = (mode) => ({ key: `row-${++rowSeq}`, mode, email: "", displayName: "", phone: "", area: "" });

// Person picker values besides a member's email.
const UNPICKED = "";
const SOMEONE_ELSE = "__someone-else__";

const describeError = (caught) => {
  const reference = errorReference(caught);
  return reference ? `${caught.message} (${reference})` : caught.message;
};

function PrimaryChoice({ name, checked, onChange, disabled, children }) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[13px] font-medium transition-colors",
        checked ? "border-primary bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-subtle",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="accent-primary"
      />
      {children}
    </label>
  );
}

export function OnCallEditDialog({ team, sprint, onClose, onSaved }) {
  const router = useRouter();
  const formId = useId();
  const suggestions = team.suggestions ?? [];
  const personByEmail = new Map(suggestions.map((person) => [person.email, person]));
  const newRowMode = suggestions.length > 0 ? "member" : "other";
  const [rows, setRows] = useState(() =>
    team.pocs.length > 0
      ? team.pocs.map((poc) => ({
          ...blankRow(personByEmail.has(poc.email) ? "member" : "other"),
          email: poc.email,
          displayName: poc.displayName,
          phone: poc.phone ?? "",
          area: poc.area ?? "",
        }))
      : [blankRow(newRowMode)],
  );
  const [primaryKey, setPrimaryKey] = useState(() => {
    const index = team.pocs.findIndex((poc) => poc.isPrimary);
    return index >= 0 ? rows[index]?.key ?? null : null;
  });
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();

  const atCap = rows.length >= team.cap;

  const update = (key, field, value) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

  // A pick is explicit, so it overwrites the row's email, name and phone; area is the manager's call.
  const pickPerson = (key, value) =>
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        if (value === SOMEONE_ELSE) return { ...row, mode: "other", email: "", displayName: "", phone: "" };
        const person = personByEmail.get(value);
        if (!person) return row;
        return { ...row, mode: "member", email: person.email, displayName: person.displayName, phone: person.phone };
      }),
    );

  const removeRow = (key) => {
    setRows((current) => current.filter((row) => row.key !== key));
    if (primaryKey === key) setPrimaryKey(null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    // A completely blank row is just an unused slot — drop it rather than fail validation.
    const filled = rows.filter((row) => [row.email, row.displayName, row.phone, row.area].some((v) => v.trim()));
    const pocs = filled.map((row) => ({
      email: row.email.trim(),
      displayName: row.displayName.trim(),
      phone: row.phone.trim(),
      area: row.area.trim(),
      isPrimary: row.key === primaryKey,
    }));
    startSaving(async () => {
      try {
        await apiFetch(`/api/teams/${team.id}/sprints/${sprint.id}/oncall`, { method: "PUT", body: { pocs } });
        router.refresh();
        onSaved(pocs.length === 0 ? `Cleared ${team.name}'s on-call POCs` : `Saved ${team.name}'s on-call POCs`);
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
      icon={LifeBuoy}
      title={`${team.name} on-call`}
      description={`Support POCs for ${sprint.name}. Up to ${team.cap}; flag one as Primary — the first contact who pulls people in and keeps the team's bugs moving.`}
      onClose={saving ? undefined : onClose}
      footerStart={
        <span className="text-xs text-muted-foreground tabular-nums">
          {rows.length} of {team.cap}
        </span>
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
      <form id={formId} className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {rows.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            No POCs — saving clears this team for {sprint.name}.
          </p>
        )}

        {rows.map((row, index) => {
          const takenElsewhere = new Set(rows.filter((other) => other.key !== row.key).map((other) => other.email));
          const pickerValue = row.mode === "other" ? SOMEONE_ELSE : row.email || UNPICKED;
          return (
            <fieldset key={row.key} className="flex flex-col gap-3 rounded-xl border bg-subtle/60 p-3.5">
              <legend className="sr-only">POC {index + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {suggestions.length > 0 && (
                  <Field
                    label="Person"
                    htmlFor={`${row.key}-person`}
                    hint={row.mode === "member" && row.email ? row.email : undefined}
                    className="sm:col-span-3"
                  >
                    <Select
                      id={`${row.key}-person`}
                      value={pickerValue}
                      onChange={(event) => pickPerson(row.key, event.target.value)}
                      disabled={saving}
                    >
                      {pickerValue === UNPICKED && (
                        <option value={UNPICKED} disabled>
                          Choose a team member…
                        </option>
                      )}
                      {suggestions.map((person) => (
                        <option
                          key={person.email}
                          value={person.email}
                          hint={person.displayName ? person.email : undefined}
                          disabled={takenElsewhere.has(person.email)}
                        >
                          {person.displayName || person.email}
                        </option>
                      ))}
                      <option value={SOMEONE_ELSE}>Someone not on the roster…</option>
                    </Select>
                  </Field>
                )}
                {row.mode === "other" && (
                  <Field label="Email" htmlFor={`${row.key}-email`} className="sm:col-span-3">
                    <Input
                      id={`${row.key}-email`}
                      type="email"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      required
                      value={row.email}
                      onChange={(event) => update(row.key, "email", event.target.value)}
                      placeholder="name@tekion.com"
                      disabled={saving}
                    />
                  </Field>
                )}
                <Field label="Name" htmlFor={`${row.key}-name`}>
                  <Input
                    id={`${row.key}-name`}
                    required
                    value={row.displayName}
                    onChange={(event) => update(row.key, "displayName", event.target.value)}
                    placeholder="Full name"
                    disabled={saving}
                  />
                </Field>
                <Field label="Phone (optional)" htmlFor={`${row.key}-phone`}>
                  <Input
                    id={`${row.key}-phone`}
                    type="tel"
                    autoComplete="off"
                    value={row.phone}
                    onChange={(event) => update(row.key, "phone", event.target.value)}
                    placeholder="+91 98765 43210"
                    disabled={saving}
                  />
                </Field>
                <Field label="Area (optional)" htmlFor={`${row.key}-area`}>
                  <Input
                    id={`${row.key}-area`}
                    value={row.area}
                    onChange={(event) => update(row.key, "area", event.target.value)}
                    placeholder="BE, FE, SCX…"
                    maxLength={40}
                    disabled={saving}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PrimaryChoice
                  name={`${formId}-primary`}
                  checked={primaryKey === row.key}
                  onChange={() => setPrimaryKey(row.key)}
                  disabled={saving}
                >
                  Primary POC
                </PrimaryChoice>
                <Button
                  type="button"
                  variant="ghostDestructive"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  disabled={saving}
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </fieldset>
          );
        })}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <PrimaryChoice
            name={`${formId}-primary`}
            checked={primaryKey === null}
            onChange={() => setPrimaryKey(null)}
            disabled={saving}
          >
            No primary
          </PrimaryChoice>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows((current) => [...current, blankRow(newRowMode)])}
            disabled={saving || atCap}
            title={atCap ? `This team's cap is ${team.cap} — an admin can change it` : undefined}
          >
            <Plus aria-hidden="true" />
            {atCap ? `Cap of ${team.cap} reached` : "Add POC"}
          </Button>
        </div>

        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
