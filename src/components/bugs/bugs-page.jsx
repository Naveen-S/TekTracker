import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, UserRound } from "lucide-react";
import { getBugReportData } from "@/lib/bug-report-data";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BugsActions } from "@/components/bugs/bugs-actions";
import { BugScopeProvider, BugScopeSlot, BugScopeToggle } from "@/components/bugs/bug-scope-view";
import { BugExport } from "@/components/bugs/bug-export-dialog";
import { BugKpiCards } from "@/components/bugs/bug-kpi-cards";
import { BugMatrix } from "@/components/bugs/bug-matrix";
import { BugPressureBar } from "@/components/bugs/bug-pressure-bar";
import { BugSprintOwnershipSection } from "@/components/bugs/bug-sprint-ownership-section";
import { BugTeamSection } from "@/components/bugs/bug-team-section";
import {
  BugAgingPanel,
  BugCategoryPanel,
  BugPriorityPanel,
  BugTrendPanel,
} from "@/components/bugs/bug-charts";
import { BugBreachPanel, BugReferenceLinks, BugTicketTable } from "@/components/bugs/bug-lists";

/**
 * The `/bugs` dashboard body, shared by `/bugs` and `/bugs/[slug]` (gm-bug-report.md (f)).
 * Server component: one request-time `asOf` flows through every read-time computation so a render
 * cannot straddle midnight.
 *
 * The scope lens (enhancing-bug-board.md decision 2) is served instantly: this pre-renders one
 * subtree per scope + an "all" subtree and a `BugScopeProvider` + client slots mount only the
 * selected one, so switching is a client swap with no network round-trip. The hero title + report
 * switcher/Refresh stay static (their state must survive a scope change); the toggle, the pressure
 * bar, and the body below all react to the same context.
 */
function relativeTime(date, asOf) {
  if (!date) return "never";
  const minutes = Math.round((asOf.getTime() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export async function BugsPage({ slug, user }) {
  const asOf = new Date();
  const data = await getBugReportData(slug, asOf);

  if (!data) {
    return (
      <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
        <EmptyState
          title="No bug report configured yet"
          body={
            user.isAdmin
              ? "Create a report in Admin, then add its scopes (the External / Internal Jira filters), priority bands, and category → status mapping."
              : "An admin needs to create and configure a bug report before this dashboard has anything to show."
          }
          actionLabel={user.isAdmin ? "Go to Admin" : null}
          actionHref={user.isAdmin ? "/admin" : null}
        />
      </main>
    );
  }

  const { report, reports, configured, issues, jiraBaseUrl, externalScopeId, scopeOptions, views } = data;
  const hasData = configured && issues.length > 0;

  const buildHref = (scope, rowKey, bandKey) =>
    `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(data.cellJql(scope, rowKey, bandKey))}`;
  const buildBreachHref = (scope, rowKey, bandKey) => {
    const jql = data.cellBreachedJql(scope, rowKey, bandKey);
    return jql ? `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}` : null;
  };

  // Pre-render one subtree per scope + "all"; the client slot mounts the selected one (decision 2).
  const viewKeys = ["all", ...scopeOptions.map((scope) => scope.id)];
  const pressureViews = {};
  const bodyViews = {};
  // Serialisable per-scope data for the PDF export (bug-report-pdf-export.md) — the client Export
  // button reads the active scope and exports that view. `oldest` = the N oldest (issues are asc by
  // created date).
  const exportViews = {};
  for (const key of viewKeys) {
    const view = views[key];
    if (!view) continue;
    exportViews[key] = {
      matrix: view.matrix,
      byTeam: view.byTeam,
      bySprintOwnership: view.bySprintOwnership,
      aging: view.aging,
      trend: view.trend,
      oldest: view.issues.slice(0, 60),
    };
    pressureViews[key] = <BugPressureBar matrix={view.matrix} diff={view.diff} report={report} />;
    bodyViews[key] = (
      <div className="flex flex-1 flex-col gap-5">
        <BugKpiCards
          matrix={view.matrix}
          diff={view.diff}
          aging={view.aging}
          ownership={view.bySprintOwnership}
        />
        <BugMatrix
          matrix={view.matrix}
          diff={view.diff}
          scopes={view.matrix.scopes}
          buildHref={buildHref}
          buildBreachHref={buildBreachHref}
          emphasizeScopeId={key === "all" ? externalScopeId : null}
        />
        <BugSprintOwnershipSection groups={view.bySprintOwnership} jiraBaseUrl={jiraBaseUrl} />
        <div className="grid gap-4 xl:grid-cols-2">
          <BugTrendPanel trend={view.trend} />
          <BugBreachPanel breached={view.breached} jiraBaseUrl={jiraBaseUrl} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <BugPriorityPanel matrix={view.matrix} />
          <BugCategoryPanel matrix={view.matrix} />
          <BugAgingPanel aging={view.aging} />
        </div>
        <BugTeamSection teams={view.byTeam} jiraBaseUrl={jiraBaseUrl} />
        <BugTicketTable issues={view.issues} jiraBaseUrl={jiraBaseUrl} asOf={asOf} />
      </div>
    );
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
      <BugScopeProvider scopeOptions={scopeOptions} externalScopeId={externalScopeId} defaultScope="all">
        <HeroShell className="flex flex-col gap-5 px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <HeroEyebrow>Bug report</HeroEyebrow>
              <HeroTitle>{report.name}</HeroTitle>
              {report.description && <HeroCopy className="mt-2">{report.description}</HeroCopy>}
              {/* Provenance as discrete facts rather than one run-on "a · b · c" sentence: who owns
                  these numbers and how fresh they are are two different questions. */}
              <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/55">
                {report.ownerName && (
                  <li className="flex items-center gap-1.5">
                    <UserRound className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                    {report.ownerName}
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  Updated {relativeTime(report.lastRefreshedAt, asOf)}
                  {report.lastRefreshedByEmail ? ` by ${report.lastRefreshedByEmail}` : ""}
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasData && (
                <BugExport
                  exportViews={exportViews}
                  report={report}
                  jiraBaseUrl={jiraBaseUrl}
                  ownerName={report.ownerName ?? user.displayName ?? user.email}
                />
              )}
              <BugsActions report={report} reports={reports} canRefresh={configured} />
            </div>
          </div>
          {hasData && (
            <div className="flex flex-col gap-4">
              <BugScopeToggle />
              <BugScopeSlot views={pressureViews} />
            </div>
          )}
        </HeroShell>

        {report.lastRefreshError && (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft/50 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-strong" />
            <div className="text-sm">
              <p className="font-semibold text-danger-strong">Last refresh failed — showing the last good data</p>
              <p className="mt-0.5 text-xs text-danger-strong/80">{report.lastRefreshError}</p>
            </div>
          </div>
        )}

        {!configured ? (
          <EmptyState
            title="This report has no scopes yet"
            body="Add at least one scope (a Jira saved-filter id or JQL) and the priority bands in Admin, then refresh."
          />
        ) : issues.length === 0 ? (
          <EmptyState
            title="No data yet — run a refresh"
            body="The report is configured but has never pulled from Jira. Use Refresh above, or wait for the nightly job."
          />
        ) : (
          <>
            <BugScopeSlot views={bodyViews} />
            <BugReferenceLinks report={report} jiraBaseUrl={jiraBaseUrl} />
          </>
        )}

        {/* Under Modern the sidebar owns cross-page nav, so this footer link would be redundant. */}
        <p className="border-t pt-4 text-xs lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to the sprint board
          </Link>
        </p>
      </BugScopeProvider>
    </main>
  );
}
