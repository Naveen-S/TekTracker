"use client";

/**
 * Bugs by sprint ownership → sprint → issues (bug-sprint-ownership.md (e)).
 *
 * The callout the whole feature exists for: within the active scope, which open bugs are OURS
 * (their Jira sprint matches the report's pattern), which are DEPENDENCIES on other teams' sprints,
 * and which carry no sprint at all. A ranked drill reusing the same `Bar` grammar as the
 * priority/category/team panels — solid fill for open count, a `bg-danger` under-rail for the
 * SLA-breached share. Progressive disclosure: a bucket opens to its sprints (or, for "No sprint",
 * straight to its bugs), a sprint opens to its bugs inline plus a "View all in Jira" link
 * (`key in (…)` over the exact cached keys, so it lands on precisely the bugs shown).
 *
 * A client leaf (expand state); it receives its already-scope-filtered ownership data as a prop, so
 * the scope toggle drives it for free.
 */
import { useState } from "react";
import { ChevronRight, ExternalLink, GitBranch } from "lucide-react";
import { Panel } from "@/components/bugs/panel";
import { Bar, Legend, TRACK } from "@/components/bugs/bug-bar";
import { cn } from "@/lib/utils";

/** Bar fill per ownership bucket — literal classes so Tailwind can see them. */
const BUCKET_FILL = {
  ours: "bg-chart-cat-1",
  dependency: "bg-warn",
  none: "bg-border-strong",
};

/** Callout-tile treatment per bucket. */
const TILE_TONE = {
  ours: "border-primary/30 bg-accent text-accent-foreground",
  dependency: "border-warn/40 bg-warn-soft text-warn-strong",
  none: "border bg-muted/40 text-muted-foreground",
};

/** Small mirror of bug-lists.jsx's IssueKey, kept local so this client bundle stays lean. */
function IssueKey({ jiraKey, jiraBaseUrl }) {
  const className =
    "rounded border border-primary/25 bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground";
  if (!jiraBaseUrl) return <span className={className}>{jiraKey}</span>;
  return (
    <a
      href={`${jiraBaseUrl}/browse/${jiraKey}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, "hover:underline")}
    >
      {jiraKey}
    </a>
  );
}

/** A `key in (…)` Jira search over an exact set of bugs. */
function jiraKeysHref(jiraBaseUrl, keys) {
  if (!jiraBaseUrl || keys.length === 0) return null;
  return `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(`key in (${keys.join(", ")})`)}`;
}

function toggleIn(setter, key) {
  setter((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
}

function IssueList({ issues, jiraBaseUrl }) {
  const href = jiraKeysHref(jiraBaseUrl, issues.map((issue) => issue.jiraKey));
  return (
    <div className="mt-0.5 mb-1.5 ml-5 flex flex-col gap-1">
      {issues.map((issue) => (
        <div
          key={`${issue.scopeId}-${issue.jiraKey}`}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border bg-muted/30 px-2 py-1"
        >
          <IssueKey jiraKey={issue.jiraKey} jiraBaseUrl={jiraBaseUrl} />
          <span className="truncate text-xs" title={issue.title}>
            {issue.title}
          </span>
          <span className="flex items-center gap-2 text-[11px] whitespace-nowrap text-muted-foreground">
            <span>{issue.priority ?? "—"}</span>
            <span className="hidden sm:inline">{issue.jiraStatus}</span>
            {issue.daysOverSla !== null && (
              <span className="font-bold text-danger-strong tabular-nums">+{issue.daysOverSla}d</span>
            )}
          </span>
        </div>
      ))}
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          View all {issues.length} in Jira <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}

/** A compact callout tile: bucket count + breach, coloured by ownership. */
function CalloutTile({ tone, label, count, breachedCount }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-lg border px-3 py-2", TILE_TONE[tone])}>
      <span className="text-[11px] font-bold tracking-wider uppercase opacity-80">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl leading-none font-extrabold tabular-nums">{count}</span>
        {breachedCount > 0 && (
          <span className="text-[11px] font-bold text-danger-strong">{breachedCount} past SLA</span>
        )}
      </span>
    </div>
  );
}

export function BugSprintOwnershipSection({ groups, jiraBaseUrl }) {
  const [openBuckets, setOpenBuckets] = useState(() => new Set());
  const [openSprints, setOpenSprints] = useState(() => new Set());

  if (!groups?.configured) return null;

  const present = groups.buckets.filter((bucket) => bucket.count > 0);
  const byKind = Object.fromEntries(groups.buckets.map((bucket) => [bucket.kind, bucket]));
  const maxBucket = Math.max(...present.map((bucket) => bucket.count), 1);

  return (
    <Panel
      title="Bugs by sprint ownership"
      subtitle={
        <>
          Ours = sprint matches <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{groups.pattern}</code>
          {" · everything else is a dependency to raise with the owning team"}
        </>
      }
      icon={GitBranch}
      tone="info"
      aside={
        <Legend
          items={[
            { label: "Ours", fill: BUCKET_FILL.ours },
            { label: "Dependency", fill: BUCKET_FILL.dependency },
            { label: "Past SLA", fill: "bg-danger" },
          ]}
        />
      }
    >
      {groups.total === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
          No open bugs to group in this scope.
        </p>
      ) : (
        <>
          {/* The callout: ours vs dependencies vs no-sprint, at a glance. */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <CalloutTile tone="ours" label="Ours" count={groups.oursCount} breachedCount={byKind.ours?.breachedCount ?? 0} />
            <CalloutTile
              tone="dependency"
              label="Dependencies"
              count={groups.dependencyCount}
              breachedCount={byKind.dependency?.breachedCount ?? 0}
            />
            <CalloutTile tone="none" label="No sprint" count={groups.noSprintCount} breachedCount={byKind.none?.breachedCount ?? 0} />
          </div>

          <div className="flex flex-col gap-0.5">
            {present.map((bucket) => {
              const bucketOpen = openBuckets.has(bucket.key);
              const bucketHref = jiraKeysHref(jiraBaseUrl, bucket.keys);
              const maxSprint = Math.max(...bucket.sprints.map((sprint) => sprint.count), 1);
              return (
                <div key={bucket.key}>
                  <button
                    type="button"
                    aria-expanded={bucketOpen}
                    onClick={() => toggleIn(setOpenBuckets, bucket.key)}
                    className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <Bar
                      track={TRACK.team}
                      labelNode={
                        <span className="flex min-w-0 items-center gap-1.5">
                          <ChevronRight
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground transition-transform",
                              bucketOpen && "rotate-90",
                            )}
                            aria-hidden="true"
                          />
                          <span className={cn("size-2.5 shrink-0 rounded-[3px]", BUCKET_FILL[bucket.kind])} aria-hidden="true" />
                          <span className="truncate text-xs font-semibold" title={bucket.label}>
                            {bucket.label}
                          </span>
                        </span>
                      }
                      segments={[{ key: "open", title: "Open", value: bucket.count, fill: BUCKET_FILL[bucket.kind] }]}
                      under={{ title: "Past SLA", value: bucket.breachedCount }}
                      total={bucket.count}
                      caption={bucket.breachedCount > 0 ? `(${bucket.breachedCount})` : null}
                      max={maxBucket}
                    />
                  </button>

                  {bucketOpen && (
                    <div className="mt-0.5 mb-1 ml-3.5 flex flex-col gap-0.5 border-l-2 border-border-subtle pl-2.5">
                      {bucketHref && (
                        <a
                          href={bucketHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mb-0.5 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          View all {bucket.count} in Jira <ExternalLink className="size-3" />
                        </a>
                      )}

                      {bucket.kind === "none" ? (
                        // No sprint → one implicit group; skip the sprint level, list bugs directly.
                        <IssueList issues={bucket.sprints[0]?.issues ?? []} jiraBaseUrl={jiraBaseUrl} />
                      ) : (
                        bucket.sprints.map((sprint) => {
                          const sprintKey = `${bucket.key}::${sprint.name}`;
                          const sprintOpen = openSprints.has(sprintKey);
                          return (
                            <div key={sprintKey}>
                              <button
                                type="button"
                                aria-expanded={sprintOpen}
                                onClick={() => toggleIn(setOpenSprints, sprintKey)}
                                className="w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/50"
                              >
                                <Bar
                                  track={TRACK.team}
                                  labelNode={
                                    <span className="flex min-w-0 items-center gap-1.5">
                                      <ChevronRight
                                        className={cn(
                                          "size-3 shrink-0 text-muted-foreground transition-transform",
                                          sprintOpen && "rotate-90",
                                        )}
                                        aria-hidden="true"
                                      />
                                      <span
                                        className="truncate rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium"
                                        title={sprint.name}
                                      >
                                        {sprint.name}
                                      </span>
                                    </span>
                                  }
                                  segments={[{ key: "open", title: "Open", value: sprint.count, fill: BUCKET_FILL[bucket.kind] }]}
                                  under={{ title: "Past SLA", value: sprint.breachedCount }}
                                  total={sprint.count}
                                  caption={sprint.breachedCount > 0 ? `(${sprint.breachedCount})` : null}
                                  max={maxSprint}
                                />
                              </button>
                              {sprintOpen && <IssueList issues={sprint.issues} jiraBaseUrl={jiraBaseUrl} />}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{groups.oursCount}</span> ours ·{" "}
            <span className="font-bold text-foreground">{groups.dependencyCount}</span> dependency ·{" "}
            <span className="font-bold text-foreground">{groups.noSprintCount}</span> no sprint
            {groups.breachedTotal > 0 && (
              <>
                {" · "}
                <span className="font-bold text-danger-strong">{groups.breachedTotal}</span> past SLA
              </>
            )}
            . The rail under each bar is the SLA-breached share.
          </p>
        </>
      )}
    </Panel>
  );
}
