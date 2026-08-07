"use client";

/**
 * Bug-report admin (gm-bug-report.md (h)) — the surface that makes EVERY filter, mapping and SLA
 * value config rather than code: scope universes (saved Jira filter id or JQL), SLA days per
 * priority per scope, priority bands, and the ordered category → status mapping.
 *
 * Status and priority inputs are PICKERS over the vocabulary actually observed in the cache, not
 * free text (spec (h)). A typo'd status would otherwise fail silently — those issues would drain
 * into the fallback category and the row would simply be wrong with nothing to notice.
 *
 * The whole config saves as ONE document (`PUT …/config`) so cross-field validation — a status in
 * two categories, a priority in two bands, two catch-alls — is applied atomically, using the same
 * `validateConfig` the server runs.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bug, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api-client";
import { validateConfig, DEFAULT_BANDS } from "@/lib/bug-report/matrix.mjs";

/**
 * A labelled group inside the bug-report card. Deliberately NOT another bordered box: this panel
 * already sits inside a card, and each scope/band/category row below carries its own border, so a
 * third rounded container stacked three deep. A rule and a heading do the same grouping job.
 */
function Section({ title, hint, children }) {
  return (
    <div className="border-t pt-4 first:border-t-0 first:pt-0">
      <h4 className="font-display text-sm font-bold">{title}</h4>
      {hint && <p className="mt-0.5 mb-3 max-w-2xl text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

/** Multi-select over observed values, with an escape hatch for values not yet seen. */
function VocabularyPicker({ selected, vocabulary, onChange, placeholder }) {
  const [custom, setCustom] = useState("");
  const has = (value) => selected.some((item) => item.toLowerCase() === value.toLowerCase());

  const toggle = (value) =>
    onChange(has(value) ? selected.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...selected, value]);

  const addCustom = () => {
    const value = custom.trim();
    if (value && !has(value)) onChange([...selected, value]);
    setCustom("");
  };

  const unlisted = selected.filter(
    (item) => !vocabulary.some((entry) => entry.value.toLowerCase() === item.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {vocabulary.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => toggle(entry.value)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              has(entry.value)
                ? "border-primary bg-accent font-semibold text-accent-foreground"
                : "bg-card text-muted-foreground hover:bg-muted"
            }`}
          >
            {entry.value}
            <span className="ml-1 text-[10px] opacity-60">{entry.count}</span>
          </button>
        ))}
        {unlisted.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => toggle(value)}
            className="rounded-full border border-warn bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn-strong"
            title="Not present in the current data"
          >
            {value} <span className="text-[10px]">unseen</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addCustom();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-xs"
        />
        <Button type="button" variant="secondary" onClick={addCustom} className="h-8">
          Add
        </Button>
      </div>
    </div>
  );
}

export function BugReportConfig({ reports, config, statusVocabulary, priorityVocabulary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const [newReport, setNewReport] = useState({ name: "", slug: "" });
  const [scopes, setScopes] = useState(() =>
    (config?.scopes ?? []).map((scope) => ({
      id: scope.id,
      name: scope.name,
      sourceType: scope.sourceType,
      jql: scope.jql ?? "",
      jiraFilterId: scope.jiraFilterId ?? "",
      slaTargets: scope.slaTargets.map((target) => ({ ...target })),
    })),
  );
  const [bands, setBands] = useState(() =>
    (config?.bands ?? []).map((band) => ({
      id: band.id,
      label: band.label,
      priorityNames: [...band.priorityNames],
      isCatchAll: band.isCatchAll,
    })),
  );
  const [categories, setCategories] = useState(() =>
    (config?.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      statuses: [...category.statuses],
    })),
  );
  const [fallbackName, setFallbackName] = useState(
    () => config?.categories.find((category) => category.id === config.fallbackCategoryId)?.name ?? "",
  );
  const [sprintPattern, setSprintPattern] = useState(() => config?.sprintOwnershipPattern ?? "");

  const inFlight = busy || pending;

  // Same rules the server applies — surfaced live so a bad mapping never reaches Save.
  const errors = config
    ? validateConfig({
        scopes: scopes.map((scope, i) => ({ ...scope, id: scope.id ?? `new-${i}` })),
        bands: bands.map((band, i) => ({ ...band, id: band.id ?? `new-${i}` })),
        categories: categories.map((category, i) => ({ ...category, id: category.id ?? `new-${i}` })),
        fallbackCategoryId: null,
      })
    : [];

  const mappedStatuses = new Set(categories.flatMap((c) => c.statuses.map((s) => s.toLowerCase())));
  const unmappedStatuses = statusVocabulary.filter((entry) => !mappedStatuses.has(entry.value.toLowerCase()));

  /**
   * Priorities arrive sorted by how often they occur — right for statuses, wrong here: it renders
   * the SLA inputs as "P2, P1, P0, P4, P3", which nobody can fill in without re-reading each label.
   * The configured bands already ARE the severity order, so order by owning band and fall back to
   * frequency for anything not yet banded.
   */
  const bandRank = new Map();
  bands.forEach((band, index) =>
    band.priorityNames.forEach((name) => {
      const key = name.toLowerCase();
      if (!bandRank.has(key)) bandRank.set(key, index);
    }),
  );
  const orderedPriorities = [...priorityVocabulary].sort(
    (a, b) =>
      (bandRank.get(a.value.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
      (bandRank.get(b.value.toLowerCase()) ?? Number.MAX_SAFE_INTEGER),
  );

  const run = async (fn, successMessage) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      startTransition(() => {
        router.refresh();
        setStatus({ tone: "success", message: successMessage });
      });
    } catch (error) {
      setStatus({ tone: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  };

  const createReport = (event) => {
    event.preventDefault();
    run(
      () => apiFetch("/api/bug-reports", { method: "POST", body: newReport }),
      `Created "${newReport.name}" — now add its scopes and categories.`,
    ).then(() => setNewReport({ name: "", slug: "" }));
  };

  const saveConfig = () =>
    run(
      () =>
        apiFetch(`/api/bug-reports/${config.id}/config`, {
          method: "PUT",
          body: {
            scopes: scopes.map((scope, index) => ({
              id: scope.id,
              name: scope.name,
              sortOrder: index,
              sourceType: scope.sourceType,
              jql: scope.sourceType === "JQL" ? scope.jql : null,
              jiraFilterId: scope.sourceType === "JIRA_FILTER" ? scope.jiraFilterId : null,
              slaTargets: scope.slaTargets.filter((target) => target.priorityName && target.days >= 0),
            })),
            bands: bands.map((band, index) => ({ ...band, sortOrder: index })),
            categories: categories.map((category, index) => ({ ...category, sortOrder: index })),
            fallbackCategoryName: fallbackName || null,
            sprintOwnershipPattern: sprintPattern.trim() || null,
          },
        }),
      "Configuration saved — the dashboard reflects it immediately, no refresh needed.",
    );

  const refreshNow = () =>
    run(
      () => apiFetch(`/api/bug-reports/${config.id}/refresh`, { method: "POST" }),
      "Refreshed from Jira.",
    );

  return (
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-md bg-warn-soft text-warn-strong"
            aria-hidden="true"
          >
            <Bug className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight font-bold">Bug report dashboards</h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              Every filter, mapping and SLA value here is configuration — nothing is hardcoded.
              Duplicate a report to stand up a new one (e.g. Honda) without a code change.
            </p>
          </div>
        </div>
        {reports.length > 0 && (
          <span className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground tabular-nums">
            {reports.length}
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

      <form onSubmit={createReport} className="mb-5 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="br-name">New report name</Label>
          <Input
            id="br-name"
            value={newReport.name}
            onChange={(event) => setNewReport((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="GM Daily Bug Report"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="br-slug">Slug</Label>
          <Input
            id="br-slug"
            value={newReport.slug}
            onChange={(event) => setNewReport((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="gm"
            required
          />
        </div>
        <Button type="submit" disabled={inFlight} className="self-end">
          Create report
        </Button>
      </form>

      {reports.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {reports.map((report) => (
            <Badge key={report.id} tone={report.id === config?.id ? "info" : "neutral"}>
              {report.name} · /bugs/{report.slug}
            </Badge>
          ))}
        </div>
      )}

      {!config ? (
        <p className="text-xs text-muted-foreground">Create a report above to configure it.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {errors.length > 0 && (
            <ul className="rounded-lg border border-danger/30 bg-danger-soft/40 p-3 text-xs text-danger-strong">
              {errors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          )}

          <Section
            title="Scopes — the bug universes"
            hint="Each scope is one column group (External / Internal). Point it at a saved Jira filter id or raw JQL."
          >
            <div className="flex flex-col gap-3">
              {scopes.map((scope, index) => (
                <div key={scope.id ?? index} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <Label>Name</Label>
                      <Input
                        value={scope.name}
                        onChange={(event) =>
                          setScopes((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                          )
                        }
                        className="h-8 w-32 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Source</Label>
                      <Select
                        value={scope.sourceType}
                        onChange={(event) =>
                          setScopes((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, sourceType: event.target.value } : item,
                            ),
                          )
                        }
                        className="h-8 text-xs"
                      >
                        <option value="JIRA_FILTER">Saved filter id</option>
                        <option value="JQL">Raw JQL</option>
                      </Select>
                    </div>
                    <div className="flex min-w-60 flex-1 flex-col gap-1">
                      <Label>{scope.sourceType === "JQL" ? "JQL" : "Filter id"}</Label>
                      <Input
                        value={scope.sourceType === "JQL" ? scope.jql : scope.jiraFilterId}
                        onChange={(event) =>
                          setScopes((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? {
                                    ...item,
                                    [scope.sourceType === "JQL" ? "jql" : "jiraFilterId"]: event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                        placeholder={scope.sourceType === "JQL" ? "project = GM AND …" : "68840"}
                        className="h-8 text-xs"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setScopes((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove scope ${scope.name || index + 1}`}
                      className="h-8"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="mt-3 border-t pt-3">
                    <Label className="text-[11px]">SLA days by priority</Label>
                    {/* A labelled cell per priority, in severity order, so the row scans as a
                        table of thresholds instead of a wrapping run of inline pairs. */}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {orderedPriorities.map((entry) => {
                        const target = scope.slaTargets.find((item) => item.priorityName === entry.value);
                        return (
                          <span
                            key={entry.value}
                            className="flex items-center gap-1.5 rounded-md border bg-muted/30 py-1 pr-1 pl-2 text-xs"
                          >
                            <span className="whitespace-nowrap text-muted-foreground">{entry.value}</span>
                            <Input
                              type="number"
                              min="0"
                              aria-label={`SLA days for ${entry.value} in ${scope.name || "this scope"}`}
                              value={target?.days ?? ""}
                              placeholder="—"
                              onChange={(event) => {
                                const raw = event.target.value;
                                setScopes((prev) =>
                                  prev.map((item, i) => {
                                    if (i !== index) return item;
                                    const rest = item.slaTargets.filter(
                                      (candidate) => candidate.priorityName !== entry.value,
                                    );
                                    return raw === ""
                                      ? { ...item, slaTargets: rest }
                                      : {
                                          ...item,
                                          slaTargets: [
                                            ...rest,
                                            { priorityName: entry.value, days: Number(raw) },
                                          ],
                                        };
                                  }),
                                );
                              }}
                              className="h-7 w-14 bg-card text-xs"
                            />
                          </span>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Blank = no SLA for that priority (never counted as breached).
                    </p>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setScopes((prev) => [
                    ...prev,
                    { name: "", sourceType: "JIRA_FILTER", jql: "", jiraFilterId: "", slaTargets: [] },
                  ])
                }
                className="self-start"
              >
                <Plus className="size-3.5" /> Add scope
              </Button>
            </div>
          </Section>

          <Section
            title="Priority bands — the columns"
            hint="One column per band. Default is one per real priority (P0–P4). At most one band may be the catch-all; with none, unmatched priorities get their own column."
          >
            <div className="flex flex-col gap-2">
              {bands.map((band, index) => (
                <div key={band.id ?? index} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={band.label}
                      onChange={(event) =>
                        setBands((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)),
                        )
                      }
                      className="h-8 w-24 text-xs"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={band.isCatchAll}
                        onChange={(event) =>
                          setBands((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, isCatchAll: event.target.checked }
                                : { ...item, isCatchAll: event.target.checked ? false : item.isCatchAll },
                            ),
                          )
                        }
                      />
                      catch-all
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setBands((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove band ${band.label || index + 1}`}
                      className="ml-auto h-8"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <VocabularyPicker
                      selected={band.priorityNames}
                      vocabulary={orderedPriorities}
                      placeholder="Priority not in the data yet…"
                      onChange={(next) =>
                        setBands((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, priorityNames: next } : item)),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setBands((prev) => [...prev, { label: "", priorityNames: [], isCatchAll: false }])}
                >
                  <Plus className="size-3.5" /> Add band
                </Button>
                {bands.length === 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setBands(DEFAULT_BANDS.map((band) => ({ ...band })))}
                  >
                    Use default P0–P4
                  </Button>
                )}
              </div>
            </div>
          </Section>

          <Section
            title="Categories — the rows"
            hint="Each category is a set of Jira statuses. First match wins, top to bottom. Anything unmatched goes to the fallback category."
          >
            <div className="flex flex-col gap-2">
              {categories.map((category, index) => (
                <div key={category.id ?? index} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={category.name}
                      onChange={(event) =>
                        setCategories((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                        )
                      }
                      placeholder="Engineering Team"
                      className="h-8 w-48 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() =>
                        setCategories((prev) => {
                          const next = [...prev];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          return next;
                        })
                      }
                      aria-label={`Move ${category.name || "category"} up`}
                      className="h-8"
                    >
                      <ChevronUp className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === categories.length - 1}
                      onClick={() =>
                        setCategories((prev) => {
                          const next = [...prev];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          return next;
                        })
                      }
                      aria-label={`Move ${category.name || "category"} down`}
                      className="h-8"
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCategories((prev) => prev.filter((_, i) => i !== index))}
                      aria-label={`Remove category ${category.name || index + 1}`}
                      className="ml-auto h-8"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <VocabularyPicker
                      selected={category.statuses}
                      vocabulary={statusVocabulary}
                      placeholder="Status not in the data yet…"
                      onChange={(next) =>
                        setCategories((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, statuses: next } : item)),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCategories((prev) => [...prev, { name: "", statuses: [] }])}
                className="self-start"
              >
                <Plus className="size-3.5" /> Add category
              </Button>

              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="br-fallback">Fallback category</Label>
                  <Select
                    id="br-fallback"
                    value={fallbackName}
                    onChange={(event) => setFallbackName(event.target.value)}
                    className="h-8 text-xs"
                  >
                    <option value="">(none — unmapped statuses get their own row)</option>
                    {categories
                      .filter((category) => category.name)
                      .map((category) => (
                        <option key={category.name} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                  </Select>
                </div>
                {unmappedStatuses.length > 0 && (
                  <p className="text-xs text-warn-strong">
                    {unmappedStatuses.length} status
                    {unmappedStatuses.length === 1 ? "" : "es"} in the data map nowhere:{" "}
                    {unmappedStatuses.slice(0, 4).map((entry) => entry.value).join(", ")}
                    {unmappedStatuses.length > 4 ? "…" : ""}
                  </p>
                )}
              </div>
            </div>
          </Section>

          <Section
            title="Sprint ownership"
            hint="Group bugs by their Jira Sprint into 'ours' vs 'dependencies on other teams'. A bug whose sprint name matches this pattern counts as ours; everything else is a dependency. `*` is a wildcard; a value with no `*` is a prefix; separate several patterns with commas. Leave blank to hide the grouping. Applies at read time — no Jira refresh needed."
          >
            <div className="flex flex-col gap-1">
              <Label htmlFor="br-sprint-pattern">Sprint pattern</Label>
              <Input
                id="br-sprint-pattern"
                value={sprintPattern}
                onChange={(event) => setSprintPattern(event.target.value)}
                placeholder="GM-*"
                className="h-8 max-w-xs text-xs"
              />
            </div>
          </Section>

          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={inFlight || errors.length > 0}>
              {inFlight ? "Saving…" : "Save configuration"}
            </Button>
            <Button variant="secondary" onClick={refreshNow} disabled={inFlight}>
              Refresh from Jira
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
