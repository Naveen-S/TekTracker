import Link from "next/link";
import { ChevronDown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout } from "@/components/ui/callout";
import { SIGNALS, overallLevel, rankedSignals } from "@/lib/security/risks.mjs";
import { IssueLink, JiraCount, JiraLinkText, LivePill, SEVERITY_CELL, SeverityChip } from "@/components/security/kit";

/**
 * The risk register (security-vulnerability-tracker.md "Risks & blockers"; design reference
 * context/features/security-risk-register-mockup.html). Eight computed signals per program: a
 * heatmap + headline strip in the rollup, ranked cards in a program view.
 *
 * Placement (Naveen 2026-10-20): at the BOTTOM of /security, COLLAPSED by default — a native
 * <details>, so it opens with no client JS and stays keyboard-accessible. The closed summary still
 * says the worst level, so nothing is hidden silently. Severity is always written as text.
 */

function Headlines({ headlines, jiraBaseUrl }) {
  if (headlines.length === 0) return null;
  return (
    <ul className="mb-4 grid gap-2.5 md:grid-cols-3">
      {headlines.map((headline) => (
        <li key={`${headline.programKey}-${headline.signalId}`} className="rounded-xl border border-sec-pink/25 bg-sec-pink-tint/60 px-3.5 py-3">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] text-sec-muted">
            <SeverityChip severity="High" />
            {headline.signalId} · {SIGNALS.find((signal) => signal.id === headline.signalId)?.label}
          </p>
          <JiraCount jiraBaseUrl={jiraBaseUrl} jql={headline.jql} className="text-sm font-bold text-sec-ink">
            {headline.text}
          </JiraCount>
        </li>
      ))}
    </ul>
  );
}

const programHref = (key) => `/security?program=${encodeURIComponent(key)}`;

function Heatmap({ heatmap, jiraBaseUrl }) {
  const totals = SIGNALS.map((signal) =>
    heatmap.reduce((sum, row) => sum + (row.risks.find((risk) => risk.key === signal.key)?.count ?? 0), 0),
  );
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-190 border-separate border-spacing-0.75 text-center">
          <thead>
            <tr>
              <th className="sr-only">Program</th>
              {SIGNALS.map((signal) => (
                <th key={signal.id} className="px-1 pb-1 align-bottom text-[11px] font-semibold text-sec-muted">
                  {signal.id}
                  <br />
                  {signal.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.map((row) => (
              <tr key={row.program.key}>
                <th scope="row" className="pr-3 text-left align-middle whitespace-nowrap">
                  <Link href={programHref(row.program.key)} className="text-sm font-bold text-sec-ink hover:text-sec-accent hover:underline">
                    {row.program.key}
                  </Link>{" "}
                  <SeverityChip severity={row.level} />
                  <span className="block text-[11px] font-normal text-sec-muted">{row.pipeline} open</span>
                </th>
                {row.risks.map((risk) => (
                  <td key={risk.key} className={cn("rounded-lg p-0", SEVERITY_CELL[risk.severity])}>
                    <JiraCount
                      jiraBaseUrl={jiraBaseUrl}
                      jql={risk.jql}
                      title={`${row.program.key} · ${risk.label}: ${risk.count} (${risk.severity})`}
                      className="block rounded-lg px-1 py-2 no-underline hover:text-inherit focus-visible:outline-2 focus-visible:outline-sec-accent"
                    >
                      <span className="block text-[15px] font-bold">{risk.count}</span>
                      <span className="block text-[10px] opacity-85">{risk.severity}</span>
                    </JiraCount>
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="border-t border-sec-line pt-2 pr-3 text-left text-sm font-bold">Total</th>
              {totals.map((total, index) => (
                <td key={SIGNALS[index].id} className="border-t border-sec-line pt-2 text-sm font-bold text-sec-muted tabular-nums">
                  {total}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Phone width: one program per row with its High and Medium chips. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {heatmap.map((row) => {
          const hits = rankedSignals(row.risks).filter((risk) => risk.severity === "High" || risk.severity === "Medium");
          return (
            <li key={row.program.key} className="rounded-xl border border-sec-line px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Link href={programHref(row.program.key)} className="text-sm font-bold hover:underline">{row.program.key}</Link>
                <SeverityChip severity={row.level} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hits.length === 0 ? (
                  <SeverityChip severity="Clear" />
                ) : (
                  hits.map((risk) => (
                    <JiraCount
                      key={risk.key}
                      jiraBaseUrl={jiraBaseUrl}
                      jql={risk.jql}
                      className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold no-underline", SEVERITY_CELL[risk.severity])}
                    >
                      {risk.id} {risk.short} · {risk.count} ({risk.severity})
                    </JiraCount>
                  ))
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Delta({ delta }) {
  if (delta === null || delta === undefined) return <span className="text-xs font-medium text-sec-muted">— vs last week</span>;
  if (delta === 0) return <span className="text-xs font-medium text-sec-muted">= no change vs last week</span>;
  return (
    <span className={cn("text-xs font-bold", delta > 0 ? "text-sec-pink-text" : "text-sec-blue-text")}>
      {delta > 0 ? `▲${delta}` : `▼${-delta}`} vs last week
    </span>
  );
}

function Cards({ view, jiraBaseUrl, workbenchUrl }) {
  const live = rankedSignals(view.risks);
  return (
    <>
      {view.program.note && (
        <Callout tone="info" title="Context" className="mb-4">
          {view.program.note}
        </Callout>
      )}
      {live.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sec-line py-8 text-center text-sm text-sec-muted">No open risks.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {live.map((risk) => (
            <article key={risk.key} className="rounded-xl border border-sec-line bg-white p-4">
              <header className="mb-2 flex items-center gap-2">
                <SeverityChip severity={risk.severity} />
                <h3 className="text-sm font-bold text-sec-ink">{risk.label}</h3>
                <span className="ml-auto text-xs text-sec-muted">{risk.id}</span>
              </header>
              <p className="flex flex-wrap items-baseline gap-2">
                <JiraCount jiraBaseUrl={jiraBaseUrl} jql={risk.jql} className="text-2xl font-extrabold text-sec-ink">
                  {risk.count}
                </JiraCount>
                <Delta delta={risk.delta} />
              </p>
              <p className="mt-1 mb-3 text-xs text-sec-muted">
                <span className="font-semibold text-sec-ink">Clears it:</span> {risk.clears}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-sec-line text-left text-sec-muted">
                      <th className="py-1 pr-2 font-semibold">Key</th>
                      <th className="py-1 pr-2 font-semibold">Pri</th>
                      <th className="py-1 pr-2 font-semibold">Age</th>
                      <th className="py-1 pr-2 font-semibold">Fix version</th>
                      <th className="py-1 font-semibold">Assignee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {risk.top5.map((ticket) => (
                      <tr key={ticket.key} className="border-b border-sec-lavender last:border-0">
                        <td className="py-1.5 pr-2 whitespace-nowrap"><IssueLink jiraBaseUrl={jiraBaseUrl} issueKey={ticket.key} /></td>
                        <td className="py-1.5 pr-2">{ticket.priority}</td>
                        <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums">{ticket.age ?? "—"} d</td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">{ticket.fixVersion?.replace(/^Release-/, "") ?? "—"}</td>
                        <td className="py-1.5">{ticket.assignee ?? "Unassigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <JiraLinkText jiraBaseUrl={jiraBaseUrl} jql={risk.jql}>View all {risk.count} in Jira</JiraLinkText>
                {workbenchUrl && risk.workbench && (
                  <a href={workbenchUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-sec-accent hover:underline">
                    Triage & apply in the Vulnerability Tracker ↗
                  </a>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

/** The whole register as one collapsed section. */
export function RiskRegister({ view, isRollup, jiraBaseUrl, workbenchUrl }) {
  const signals = isRollup ? view.heatmap.flatMap((row) => row.risks) : view.risks;
  const level = isRollup ? overallLevel(view.heatmap.map((row) => ({ severity: row.level }))) : view.level;
  const highs = signals.filter((signal) => signal.severity === "High").length;
  const mediums = signals.filter((signal) => signal.severity === "Medium").length;
  return (
    <details className="group min-w-0 rounded-xl border border-sec-line bg-card modern:shadow-xs">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-xl px-5 py-4 select-none hover:bg-sec-paper [&::-webkit-details-marker]:hidden">
        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground" aria-hidden="true">
          <ShieldAlert className="size-4" />
        </span>
        <span className="font-display text-base font-bold text-sec-ink">Risks & blockers</span>
        <LivePill />
        <SeverityChip severity={level} />
        <span className="text-xs text-sec-muted">
          {highs} High · {mediums} Medium {isRollup ? "across all programs" : "signals"}
        </span>
        <ChevronDown className="ml-auto size-4 text-sec-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-sec-line px-5 pt-4 pb-5">
        {isRollup ? (
          <>
            <Headlines headlines={view.headlines} jiraBaseUrl={jiraBaseUrl} />
            <Heatmap heatmap={view.heatmap} jiraBaseUrl={jiraBaseUrl} />
            <p className="mt-3 text-xs text-sec-muted">Click a program to see its ranked cards · each cell opens its Jira list · thresholds are set in Admin.</p>
          </>
        ) : (
          <Cards view={view} jiraBaseUrl={jiraBaseUrl} workbenchUrl={workbenchUrl} />
        )}
      </div>
    </details>
  );
}
