"use client";

/**
 * Bugs by scrum team → developer → issues (enhancing-bug-board.md (e), decisions 3–5).
 *
 * A ranked list of teams (worst-first, the Unassigned bucket last) reusing the same `Bar`
 * grammar as the priority/category/ageing panels — solid slot-1 fill for open count, a `bg-danger`
 * under-rail for the SLA-breached share. Progressive disclosure: click a team to reveal its
 * developers (AvatarChip + bar), click a developer to expand their bugs inline plus a
 * "View all in Jira" link. The developer link uses `key in (…)` over the exact cached keys, so it
 * lands on precisely the bugs shown (no ambiguous assignee-name JQL).
 *
 * A client leaf (expand state); it receives its already-scope-filtered team data as a prop, so the
 * scope toggle drives it for free.
 */
import { useState } from "react";
import { ChevronRight, ExternalLink, Users } from "lucide-react";
import { Panel } from "@/components/bugs/panel";
import { Bar, Legend, SCOPE_FILL, TRACK } from "@/components/bugs/bug-bar";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { cn } from "@/lib/utils";

const OPEN_FILL = SCOPE_FILL[0]; // slot-1 hue — the same identity the other bug bars use

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

/** A `key in (…)` Jira search over the exact bugs shown for one developer. */
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

export function BugTeamSection({ teams, jiraBaseUrl }) {
  const [openTeams, setOpenTeams] = useState(() => new Set());
  const [openDevs, setOpenDevs] = useState(() => new Set());

  const maxTeam = Math.max(...teams.map((team) => team.count), 1);
  const totalBreached = teams.reduce((sum, team) => sum + team.breachedCount, 0);

  return (
    <Panel
      title="Bugs by scrum team"
      subtitle="Open bugs grouped by sub-component → team · click to drill into developers"
      icon={Users}
      tone="info"
      aside={
        <Legend items={[{ label: "Open", fill: OPEN_FILL }, { label: "Past SLA", fill: "bg-danger" }]} />
      }
    >
      {teams.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
          No open bugs to group in this scope.
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {teams.map((team) => {
            const teamOpen = openTeams.has(team.key);
            const maxDev = Math.max(...team.developers.map((dev) => dev.count), 1);
            return (
              <div key={team.key}>
                <button
                  type="button"
                  aria-expanded={teamOpen}
                  onClick={() => toggleIn(setOpenTeams, team.key)}
                  className={cn(
                    "w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
                    team.isUnassigned && "opacity-80",
                  )}
                >
                  <Bar
                    track={TRACK.team}
                    labelNode={
                      <span className="flex min-w-0 items-center gap-1.5">
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 text-muted-foreground transition-transform",
                            teamOpen && "rotate-90",
                          )}
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "truncate text-xs font-semibold",
                            team.isUnassigned && "text-muted-foreground italic",
                          )}
                          title={team.teamName}
                        >
                          {team.teamName}
                        </span>
                        {team.teamKey && (
                          <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {team.teamKey}
                          </span>
                        )}
                      </span>
                    }
                    segments={[{ key: "open", title: "Open", value: team.count, fill: OPEN_FILL }]}
                    under={{ title: "Past SLA", value: team.breachedCount }}
                    total={team.count}
                    caption={team.breachedCount > 0 ? `(${team.breachedCount})` : null}
                    max={maxTeam}
                  />
                </button>

                {teamOpen && (
                  <div className="mt-0.5 mb-1 ml-3.5 flex flex-col gap-0.5 border-l-2 border-border-subtle pl-2.5">
                    {team.developers.map((dev) => {
                      const devKey = `${team.key}::${dev.name}`;
                      const devOpen = openDevs.has(devKey);
                      const href = jiraKeysHref(jiraBaseUrl, dev.issues.map((issue) => issue.jiraKey));
                      return (
                        <div key={devKey}>
                          <button
                            type="button"
                            aria-expanded={devOpen}
                            onClick={() => toggleIn(setOpenDevs, devKey)}
                            className="w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/50"
                          >
                            <Bar
                              track={TRACK.team}
                              labelNode={
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <ChevronRight
                                    className={cn(
                                      "size-3 shrink-0 text-muted-foreground transition-transform",
                                      devOpen && "rotate-90",
                                    )}
                                    aria-hidden="true"
                                  />
                                  <AvatarChip name={dev.name} size="sm" className="size-6 text-[10px]" />
                                  <span className="truncate text-xs" title={dev.name}>
                                    {dev.name}
                                  </span>
                                </span>
                              }
                              segments={[{ key: "open", title: "Open", value: dev.count, fill: OPEN_FILL }]}
                              under={{ title: "Past SLA", value: dev.breachedCount }}
                              total={dev.count}
                              caption={dev.breachedCount > 0 ? `(${dev.breachedCount})` : null}
                              max={maxDev}
                            />
                          </button>

                          {devOpen && (
                            <div className="mt-0.5 mb-1.5 ml-5 flex flex-col gap-1">
                              {dev.issues.map((issue) => (
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
                                      <span className="font-bold text-danger-strong tabular-nums">
                                        +{issue.daysOverSla}d
                                      </span>
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
                                  View all {dev.count} in Jira <ExternalLink className="size-3" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {teams.length} team{teams.length === 1 ? "" : "s"} with open bugs
        {totalBreached > 0 && (
          <>
            {" · "}
            <span className="font-bold text-danger-strong">{totalBreached}</span> past SLA
          </>
        )}
        . The rail under each bar is the SLA-breached share.
      </p>
    </Panel>
  );
}
