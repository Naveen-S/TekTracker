"use client";

/**
 * Team create/edit (one-click-sprint-start.md): name/key/description, a Jira Component picker +
 * sub-component claim checklist (backing "One-Click Sprint Start"), and a collapsed "Advanced:
 * Issue Type Overrides" section. Submits team fields first, then the sub-component claim set —
 * mirrors `sprint-config-dialog.jsx`'s create/edit dual-mode shape.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Dialog, DialogError } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";

const parseIssueTypes = (text) =>
  [...new Set(text.split(",").map((v) => v.trim()).filter(Boolean))];

export function TeamConfigDialog({ mode, team, jiraComponents, onClose }) {
  const router = useRouter();
  const [name, setName] = useState(team?.name ?? "");
  const [key, setKey] = useState(team?.key ?? "");
  const [description, setDescription] = useState(team?.description ?? "");
  const [featureIssueTypes, setFeatureIssueTypes] = useState(
    (team?.featureIssueTypes ?? []).join(", "),
  );
  const [techDebtIssueTypes, setTechDebtIssueTypes] = useState(
    (team?.techDebtIssueTypes ?? []).join(", "),
  );
  const [internalBugIssueTypes, setInternalBugIssueTypes] = useState(
    (team?.internalBugIssueTypes ?? []).join(", "),
  );
  const [supportIssueTypes, setSupportIssueTypes] = useState(
    (team?.supportIssueTypes ?? []).join(", "),
  );

  const initialComponentId = team?.subComponents?.[0]?.component?.id ?? jiraComponents[0]?.id ?? "";
  const [selectedComponentId, setSelectedComponentId] = useState(initialComponentId);
  const [claimedIds, setClaimedIds] = useState(
    () => new Set((team?.subComponents ?? []).map((s) => s.id)),
  );
  const [error, setError] = useState("");
  const [saving, startSaving] = useTransition();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const selectedComponent = jiraComponents.find((c) => c.id === selectedComponentId) ?? null;
  const claimedCount = claimedIds.size;

  const toggleSubComponent = (subComponentId) => {
    setClaimedIds((current) => {
      const next = new Set(current);
      if (next.has(subComponentId)) {
        next.delete(subComponentId);
      } else {
        next.add(subComponentId);
      }
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    const body = {
      name: name.trim(),
      key: key.trim(),
      description: description.trim() || null,
      featureIssueTypes: parseIssueTypes(featureIssueTypes),
      techDebtIssueTypes: parseIssueTypes(techDebtIssueTypes),
      internalBugIssueTypes: parseIssueTypes(internalBugIssueTypes),
      supportIssueTypes: parseIssueTypes(supportIssueTypes),
    };
    startSaving(async () => {
      try {
        const savedTeam =
          mode === "create"
            ? await apiFetch("/api/teams", { method: "POST", body })
            : await apiFetch(`/api/teams/${team.id}`, { method: "PATCH", body });
        await apiFetch(`/api/teams/${savedTeam.id}/sub-components`, {
          method: "PATCH",
          body: { subComponentIds: [...claimedIds] },
        });
        startSaving(() => {
          onClose();
          router.refresh();
        });
      } catch (err) {
        setError(err.message);
      }
    });
  };

  return (
    <Dialog
      open
      size="lg"
      title={mode === "create" ? "Create team" : `Edit ${team.name}`}
      description="A scrum team owns its filters, progress, and its claimed Jira sub-components."
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="team-config-form" disabled={saving}>
            {saving && <Spinner />}
            {saving ? "Saving…" : mode === "create" ? "Create team" : "Save changes"}
          </Button>
        </>
      }
    >
      <form id="team-config-form" className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-name">Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. VSR, FE Platform"
              required
              disabled={saving}
              autoFocus={mode === "create"}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="team-key">Key</Label>
            <Input
              id="team-key"
              value={key}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              placeholder="KEY"
              required
              disabled={saving}
              className="w-28"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-description">Description (optional)</Label>
          <Input
            id="team-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this scrum team owns"
            disabled={saving}
          />
        </div>

        <fieldset className="flex flex-col gap-2.5 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <Label>Jira sub-components</Label>
            <Badge tone={claimedCount > 0 ? "brand" : "neutral"}>{claimedCount} claimed</Badge>
          </div>
          {jiraComponents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No Jira components yet — add one in the catalog above first.
            </p>
          ) : (
            <>
              <Select
                value={selectedComponentId}
                onChange={(event) => setSelectedComponentId(event.target.value)}
                disabled={saving}
                className="h-8 text-xs"
              >
                {jiraComponents.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name} · {component.projectKey}
                  </option>
                ))}
              </Select>
              {selectedComponent && (
                <ul className="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
                  {selectedComponent.subComponents.length === 0 ? (
                    <li className="px-2 py-1.5 text-xs text-muted-foreground">
                      This component has no sub-components yet.
                    </li>
                  ) : (
                    selectedComponent.subComponents.map((sub) => {
                      const claimedByOther =
                        sub.team && sub.team.id !== team?.id ? sub.team : null;
                      return (
                        <li
                          key={sub.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50 has-[:disabled]:hover:bg-transparent"
                        >
                          <Checkbox
                            id={`sub-${sub.id}`}
                            checked={claimedIds.has(sub.id)}
                            disabled={saving || Boolean(claimedByOther)}
                            onChange={() => toggleSubComponent(sub.id)}
                          />
                          <label
                            htmlFor={`sub-${sub.id}`}
                            className={`flex-1 truncate font-mono text-xs ${claimedByOther ? "cursor-not-allowed text-muted-foreground" : "cursor-pointer"}`}
                          >
                            {sub.name}
                          </label>
                          {claimedByOther && (
                            <Badge tone="neutral" className="shrink-0 font-normal">
                              claimed by {claimedByOther.name}
                            </Badge>
                          )}
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </>
          )}
        </fieldset>

        <div className="rounded-lg border p-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="flex w-full items-center gap-1.5 text-xs font-semibold"
          >
            {advancedOpen ? (
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            Advanced: Issue Type overrides
          </button>
          {advancedOpen && (
            <>
              <p className="mt-1.5 mb-3 text-xs text-muted-foreground">
                Leave blank to use the global default shown as a placeholder.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="team-feature-issue-types">Roadmap</Label>
                  <Input
                    id="team-feature-issue-types"
                    value={featureIssueTypes}
                    onChange={(event) => setFeatureIssueTypes(event.target.value)}
                    placeholder="Story (default)"
                    disabled={saving}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="team-tech-debt-issue-types">Tech Debt</Label>
                  <Input
                    id="team-tech-debt-issue-types"
                    value={techDebtIssueTypes}
                    onChange={(event) => setTechDebtIssueTypes(event.target.value)}
                    placeholder="Tech Story (default)"
                    disabled={saving}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="team-internal-bug-issue-types">Internal Bug</Label>
                  <Input
                    id="team-internal-bug-issue-types"
                    value={internalBugIssueTypes}
                    onChange={(event) => setInternalBugIssueTypes(event.target.value)}
                    placeholder="Bug (default)"
                    disabled={saving}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="team-support-issue-types">External Bug</Label>
                  <Input
                    id="team-support-issue-types"
                    value={supportIssueTypes}
                    onChange={(event) => setSupportIssueTypes(event.target.value)}
                    placeholder="Tap Ticket (default)"
                    disabled={saving}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                External Bug&rsquo;s project stays fixed (ENG) — only its Issue Type list is
                overridable.
              </p>
            </>
          )}
        </div>

        <DialogError>{error}</DialogError>
      </form>
    </Dialog>
  );
}
