import { ExternalLink, GitFork, Link2, Repeat, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { JiraCount, JiraLinkText, MissCount, SecPanel, fmtDays, pctTone } from "@/components/security/kit";

/**
 * Planning panels for /security, styled after the source artifact: release plans, fix-once
 * campaigns, effort, the 1.0 vs 2.0 split, reference links. Server components. There are no write
 * controls anywhere — the only hand-off is the admin workbench link (P6).
 *
 * The triage queue was removed from the page (Naveen 2026-10-20: "not important for now"); its pure
 * logic stays in lib/security/triage.mjs, unused, for when it returns.
 */

const th = "py-2 pr-3 text-[11px] font-semibold tracking-wide text-sec-muted uppercase";
const td = "py-1.5 pr-3";

export function ReleasePlanPanel({ icon, title, plan, jiraBaseUrl }) {
  return (
    <SecPanel icon={icon} title={title} tag={`${plan.count} issues`}>
      {plan.count === 0 ? (
        <p className="text-sm text-sec-muted">No open issues carry this release yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-sec-line text-left">
                <th className={th}>Vulnerability</th>
                <th className={th}>Track</th>
                <th className={`${th} text-right`}>Issues</th>
                <th className={`${th} text-right`}>Days</th>
                <th className={`${th} pr-0 text-right`}>No SP</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr key={`${row.vuln}-${row.track}`} className="border-b border-sec-lavender">
                  <td className={td}>{row.vuln}</td>
                  <td className={cn(td, "text-sec-muted")}>{row.track}</td>
                  <td className={cn(td, "text-right font-bold tabular-nums")}>{row.n}</td>
                  <td className={cn(td, "text-right tabular-nums")}>{fmtDays(row.days)}</td>
                  <td className={cn(td, "pr-0 text-right")}><MissCount value={row.unsized} /></td>
                </tr>
              ))}
              {plan.others && (
                <tr className="border-b border-sec-lavender text-sec-muted">
                  <td className={td} colSpan={2}>Others ({plan.others.groups} groups)</td>
                  <td className={cn(td, "text-right font-bold tabular-nums")}>{plan.others.n}</td>
                  <td className={cn(td, "text-right tabular-nums")}>{fmtDays(plan.others.days)}</td>
                  <td className={cn(td, "pr-0 text-right")}><MissCount value={plan.others.unsized} /></td>
                </tr>
              )}
              <tr className="font-extrabold">
                <td className={td} colSpan={2}>TOTAL</td>
                <td className={cn(td, "text-right")}><JiraCount jiraBaseUrl={jiraBaseUrl} jql={plan.jql}>{plan.total.n}</JiraCount></td>
                <td className={cn(td, "text-right tabular-nums")}>{fmtDays(plan.total.days)}</td>
                <td className={cn(td, "pr-0 text-right")}>
                  <JiraCount jiraBaseUrl={jiraBaseUrl} jql={plan.total.unsizedJql} className={plan.total.unsized ? "text-sec-pink-text" : "text-sec-blue-text"}>
                    {plan.total.unsized}
                  </JiraCount>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </SecPanel>
  );
}

const EFFORT_SWATCH = { current: "bg-sec-blue", next: "bg-sec-purple", overdue: "bg-sec-pink", none: "bg-sec-orange", all: "bg-sec-ink" };

export function EffortPanel({ view, jiraBaseUrl }) {
  const all = view.effort.find((scope) => scope.key === "all");
  return (
    <SecPanel icon={Timer} title="Story point coverage + effort" tag="1 SP = 1 day">
      <div className="overflow-x-auto">
        <table className="w-full min-w-150 text-[13px]">
          <thead>
            <tr className="border-b border-sec-line text-left">
              <th className={th}>Scope</th>
              <th className={`${th} text-right`}>Issues</th>
              <th className={`${th} text-right`}>Realistic days</th>
              <th className={`${th} text-right`}>Placeholder</th>
              <th className={`${th} text-right`}>No SP</th>
              <th className={`${th} pr-0 text-right`}>Pointed</th>
            </tr>
          </thead>
          <tbody>
            {view.effort.map((scope) => (
              <tr key={scope.key} className={cn("border-b border-sec-lavender", scope.key === "all" && "bg-sec-lavender-soft font-extrabold")}>
                <td className={cn(td, scope.key === "all" && "pl-1")}>
                  <span className={cn("mr-2 inline-block size-2.5 rounded-[3px] align-middle", EFFORT_SWATCH[scope.key])} aria-hidden="true" />
                  {scope.label}
                </td>
                <td className={cn(td, "text-right")}><JiraCount jiraBaseUrl={jiraBaseUrl} jql={scope.jql}>{scope.n}</JiraCount></td>
                <td className={cn(td, "text-right tabular-nums")}>{fmtDays(scope.realisticDays)}</td>
                <td className={cn(td, "text-right text-sec-muted tabular-nums")}>
                  {scope.placeholders ? `${scope.placeholders} · ${fmtDays(scope.placeholderDays)} d` : "—"}
                </td>
                <td className={cn(td, "text-right")}>
                  <JiraCount jiraBaseUrl={jiraBaseUrl} jql={scope.unsizedJql} className={cn("font-bold", scope.unsized ? "text-sec-pink-text" : "text-sec-blue-text")}>
                    {scope.unsized}
                  </JiraCount>
                </td>
                <td className={cn(td, "pr-0 text-right font-bold tabular-nums", pctTone(scope.pctSized).text)}>{scope.pctSized}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {all && (
        <p className="mt-2 text-xs text-sec-muted">
          <strong className="text-sec-ink">{all.sized} of {all.n}</strong> open issues are pointed ({all.fromOe} from Original Estimate at
          8 h = 1 day, {all.fromSp} from story points). Estimates of exactly {view.placeholderDays.join(" d or ")} d are placeholders:
          flagged and left out of the realistic total.
        </p>
      )}
    </SecPanel>
  );
}

const LEGACY_FILL = ["bg-sec-amber text-sec-ink", "bg-sec-blue text-white"];

export function LegacySplitPanel({ legacy, jiraBaseUrl }) {
  if (!legacy) return null;
  const total = legacy.sides.reduce((sum, side) => sum + side.total, 0);
  return (
    <SecPanel icon={GitFork} title="1.0 vs 2.0 bifurcation" tag={`${legacy.sides[0].total} legacy · ${legacy.sides[1].total} current`}>
      {total > 0 && (
        <div className="mb-3 flex h-8 gap-0.5 overflow-hidden rounded-full border border-sec-line bg-sec-lavender-soft">
          {legacy.sides.map((side, index) =>
            side.total > 0 ? (
              <span
                key={side.name}
                className={cn("flex h-full items-center justify-center text-[11px] font-bold", LEGACY_FILL[index])}
                style={{ width: `${Math.max(side.pct, 4)}%` }}
              >
                {side.pct >= 12 ? `${index === 0 ? "1.0" : "2.0"} · ${side.total}` : side.total}
              </span>
            ) : null,
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-sec-line text-left">
              <th className={th}>Bucket</th>
              <th className={`${th} text-right`}>Open</th>
              <th className={`${th} text-right`}>In progress</th>
              <th className={`${th} text-right`}>Planned</th>
              <th className={`${th} pr-0 text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {legacy.sides.map((side, index) => (
              <tr key={side.name} className="border-b border-sec-lavender last:border-0">
                <td className={td}>
                  <span className={cn("mr-2 inline-block size-2.5 rounded-[3px] align-middle", LEGACY_FILL[index])} aria-hidden="true" />
                  {side.name}
                </td>
                <td className={cn(td, "text-right font-bold text-sec-pink-text tabular-nums")}>{side.open}</td>
                <td className={cn(td, "text-right font-bold text-sec-orange-text tabular-nums")}>{side.inProgress}</td>
                <td className={cn(td, "text-right tabular-nums")}>{side.planned}</td>
                <td className={cn(td, "pr-0 text-right")}>
                  <JiraCount jiraBaseUrl={jiraBaseUrl} jql={side.jql} className="font-extrabold">{side.total}</JiraCount>
                  <span className="ml-1 text-xs text-sec-muted">{side.pct}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SecPanel>
  );
}

export function CampaignsPanel({ view, jiraBaseUrl }) {
  const { list, packages, top5Coverage, oligoTotal } = view.campaigns;
  return (
    <SecPanel icon={Repeat} title="Fix-once campaigns" tag={`${packages} packages · top 5 cover ${top5Coverage} of ${oligoTotal}`}>
      {list.length === 0 ? (
        <p className="text-sm text-sec-muted">No open Oligo issues in this view.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-150 text-[13px]">
            <thead>
              <tr className="border-b border-sec-line text-left">
                <th className={th}>Package</th>
                <th className={`${th} text-right`}>Open issues</th>
                <th className={`${th} text-right`}>CVEs</th>
                <th className={`${th} text-right`}>Services</th>
                <th className={th}>Programs</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 12).map((entry) => (
                <tr key={entry.pkg} className="border-b border-sec-lavender align-top">
                  <td className={td}>
                    <span className="font-bold break-all text-sec-ink">{entry.pkg}</span>
                    <span className="block text-xs text-sec-muted">versions {entry.versions.join(", ")}</span>
                  </td>
                  <td className={cn(td, "text-right")}>
                    <JiraCount jiraBaseUrl={jiraBaseUrl} jql={entry.jql} className="font-bold text-sec-accent">{entry.keys.length}</JiraCount>
                  </td>
                  <td className={cn(td, "text-right tabular-nums")}>{entry.cves}</td>
                  <td className={cn(td, "text-right tabular-nums")}>{entry.services}</td>
                  <td className={cn(td, "text-xs text-sec-body")}>{entry.programs.map((program) => `${program.key} ${program.n}`).join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-sec-muted">
        Open Oligo issues grouped by the vulnerable package. A package with many CVEs and services is usually one dependency upgrade (or
        one base-image rebuild) away from closing all of them.
      </p>
    </SecPanel>
  );
}

export function ReferenceLinks({ view, jiraBaseUrl }) {
  const links = [
    ["Open pipeline", view.jql.base],
    ["This release", view.jql.current],
    ["Next release", view.jql.next],
    ["Progress universe (incl. done)", view.progress.jql],
  ];
  return (
    <SecPanel icon={Link2} title="Reference links" tag="live Jira filters">
      <div className="flex flex-wrap gap-2">
        {links.map(([label, jql]) => (
          <JiraLinkText key={label} jiraBaseUrl={jiraBaseUrl} jql={jql}>{label}</JiraLinkText>
        ))}
      </div>
    </SecPanel>
  );
}

export function WorkbenchCard({ workbenchUrl }) {
  if (!workbenchUrl) return null;
  return (
    <a
      href={workbenchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-dashed border-sec-accent/40 bg-sec-lavender-soft px-4 py-3 text-sm transition-colors hover:border-sec-accent hover:bg-sec-lavender"
    >
      <ExternalLink className="size-4 shrink-0 text-sec-accent" aria-hidden="true" />
      <span>
        <span className="font-bold text-sec-ink">Triage & apply in the Vulnerability Tracker</span>
        <span className="block text-xs text-sec-muted">Admins only · triage, labels and Jira writes stay in the artifact for now</span>
      </span>
    </a>
  );
}
