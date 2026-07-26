import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, UserRound } from "lucide-react";
import { getBugReportData } from "@/lib/bug-report-data";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BugsActions } from "@/components/bugs/bugs-actions";
import { BugKpiCards } from "@/components/bugs/bug-kpi-cards";
import { BugMatrix } from "@/components/bugs/bug-matrix";
import { BugPressureBar } from "@/components/bugs/bug-pressure-bar";
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

  const { report, reports, configured, matrix, diff, trend, aging, breached, issues, jiraBaseUrl } = data;
  const buildHref = (scope, rowKey, bandKey) =>
    `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(data.cellJql(scope, rowKey, bandKey))}`;
  const buildBreachHref = (scope, rowKey, bandKey) => {
    const jql = data.cellBreachedJql(scope, rowKey, bandKey);
    return jql ? `${jiraBaseUrl}/issues/?jql=${encodeURIComponent(jql)}` : null;
  };

  return (
    <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
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
          <BugsActions report={report} reports={reports} canRefresh={configured} />
        </div>
        {configured && issues.length > 0 && (
          <BugPressureBar matrix={matrix} diff={diff} report={report} />
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
          <BugKpiCards matrix={matrix} diff={diff} aging={aging} />
          <BugMatrix
            matrix={matrix}
            diff={diff}
            scopes={matrix.scopes}
            buildHref={buildHref}
            buildBreachHref={buildBreachHref}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <BugTrendPanel trend={trend} />
            <BugBreachPanel breached={breached} jiraBaseUrl={jiraBaseUrl} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <BugPriorityPanel matrix={matrix} />
            <BugCategoryPanel matrix={matrix} />
            <BugAgingPanel aging={aging} />
          </div>

          <BugTicketTable issues={issues} jiraBaseUrl={jiraBaseUrl} asOf={asOf} />
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
    </main>
  );
}
