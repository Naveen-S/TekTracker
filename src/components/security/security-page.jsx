import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, PlaneTakeoff, Rocket, UserRound } from "lucide-react";
import { getSecurityData } from "@/lib/security/data";
import { Callout } from "@/components/ui/callout";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { SecurityActions } from "@/components/security/security-actions";
import { SecurityLook, SecurityLookToggle } from "@/components/security/look";
import { relativeTime } from "@/components/security/kit";
import { RiskRegister } from "@/components/security/risk-register";
import {
  CoverageBar,
  PathToZeroPanel,
  PriorityStatusTable,
  ProgramScorecard,
  ProgressPanel,
  SecurityKpis,
  VulnMixChart,
} from "@/components/security/overview-panels";
import {
  CampaignsPanel,
  EffortPanel,
  LegacySplitPanel,
  ReferenceLinks,
  ReleasePlanPanel,
  WorkbenchCard,
} from "@/components/security/work-panels";

/**
 * The /security body (security-vulnerability-tracker.md (d)). Server component; one request-time
 * `asOf` flows through every read-time computation. READ-ONLY: no approve / apply / move / edit
 * controls anywhere — the only hand-off is the admin workbench link (P6).
 *
 * Layout (Naveen 2026-10-20): progress + Path to zero first, the risk register last and collapsed,
 * no triage queue. Two looks (look.jsx): the StoryBoard frame by default (ink hero, app neutrals)
 * and the artifact frame on toggle (white gradient-title header, lavender→peach page). Both headers
 * are rendered and the look shows one, so switching never re-fetches.
 */
const DAY_MS = 86_400_000;

function vocabLine(meta, asOf) {
  const stale = Object.entries(meta.vocabLive)
    .filter(([, live]) => !live)
    .map(([kind]) => kind);
  if (stale.length) return `vocabulary: 30 Sep snapshot for ${stale.join(", ")}`;
  return `vocabulary live from Confluence (${relativeTime(meta.vocabFetchedAt, asOf)})`;
}

function DeadlineCard({ release, asOf, onDark = false }) {
  const days = Math.max(0, Math.ceil((release.deadline.getTime() - asOf.getTime()) / DAY_MS));
  const month = release.label.split(" ")[0].slice(0, 3);
  if (onDark) {
    return (
      <div className="relative min-w-44 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-5 pt-4 pb-3 text-center">
        <span className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sec-amber to-sec-orange" aria-hidden="true" />
        <p className="font-display text-[30px] leading-tight font-extrabold text-white tabular-nums">
          {days}
          <span className="ml-1 text-[13px] font-bold text-sec-amber">days</span>
        </p>
        <p className="text-[10.5px] tracking-wider text-white/60 uppercase">
          to {month} {release.shipDay} release{release.est ? " (est.)" : ""}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold text-white/70">{release.name}</p>
      </div>
    );
  }
  return (
    <div className="relative min-w-44 overflow-hidden rounded-xl border border-sec-gold-line bg-white px-5 pt-4 pb-3 text-center shadow-sec-gold">
      <span className="absolute inset-x-0 top-0 h-1.25 bg-linear-to-r from-sec-amber to-sec-orange" aria-hidden="true" />
      <p className="text-[30px] leading-tight font-extrabold text-sec-ink tabular-nums">
        {days}
        <span className="ml-1 text-[13px] font-bold text-sec-gold-text">days</span>
      </p>
      <p className="text-[10.5px] tracking-wider text-sec-muted uppercase">
        to {month} {release.shipDay} release{release.est ? " (est.)" : ""}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold text-sec-muted">{release.name}</p>
    </div>
  );
}

export async function SecurityPage({ user, programKey }) {
  const asOf = new Date();
  const data = await getSecurityData(programKey === "ALL" ? null : programKey, asOf);
  const { view, meta, window, jiraBaseUrl, selectedKey, programs } = data;
  const isRollup = selectedKey === "ALL";
  const workbenchUrl = user.isAdmin ? meta.workbenchUrl : null;

  const title = isRollup ? "Programs Team Vulnerability Tracker" : `${view.program.name} Security Vulnerabilities`;
  const subtitle = isRollup ? "Rollup across every program" : `Program: ${view.program.key} vulnerability remediation`;

  return (
    <SecurityLook>
      <main className="flex w-full min-w-0 flex-1 flex-col gap-4 p-4 text-sec-body *:min-w-0 md:p-6 sec-artifact:bg-linear-to-b sec-artifact:from-sec-paper sec-artifact:to-sec-peach">
        {/* StoryBoard look: the app's ink hero, like /bugs and /rollup. */}
        <HeroShell className="flex flex-wrap items-start justify-between gap-4 px-5 py-6 md:px-8 md:py-7 sec-artifact:hidden">
          <div className="min-w-0 flex-[1_1_280px]">
            <HeroEyebrow>Security vulnerabilities · read-only</HeroEyebrow>
            <HeroTitle>{title}</HeroTitle>
            <HeroCopy className="mt-2">
              {subtitle} · P0–P4 open pipeline · triage & Jira writes stay in the Vulnerability Tracker
            </HeroCopy>
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/60">
              <li className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                Updated {relativeTime(meta.lastRefreshedAt, asOf)}
              </li>
              {meta.lastRefreshedByEmail && (
                <li className="flex items-center gap-1.5">
                  <UserRound className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                  {meta.lastRefreshedByEmail}
                </li>
              )}
              <li>{vocabLine(meta, asOf)}</li>
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SecurityActions
                programs={programs}
                selectedKey={selectedKey}
                explicit={programKey !== null}
                canRefresh={user.isAdmin}
                onDark
                remember
              />
              <SecurityLookToggle onDark />
            </div>
          </div>
          <DeadlineCard release={window.current} asOf={asOf} onDark />
        </HeroShell>

        {/* Artifact look: the white header with the gradient title. */}
        <header className="hidden flex-wrap items-start justify-between gap-4 rounded-2xl border border-sec-line bg-white/80 px-5 py-5 shadow-xs md:px-6 sec-artifact:flex">
          <div className="min-w-0 flex-[1_1_280px]">
            <h1 className="text-[22px] leading-tight font-extrabold tracking-tight text-balance">
              {/* Emoji outside the gradient clip, so it keeps its own colours. */}
              <span aria-hidden="true">🔐 </span>
              <span className="bg-linear-to-r from-sec-purple via-sec-pink to-sec-orange bg-clip-text text-transparent">
                {title}
              </span>
            </h1>
            <p className="mt-1 text-[13px] text-sec-muted">
              {subtitle} · P0–P4 open pipeline · read-only (triage & Jira writes stay in the Vulnerability Tracker)
            </p>
            <p className="mt-1 text-xs text-sec-muted">
              Last refreshed {relativeTime(meta.lastRefreshedAt, asOf)}
              {meta.lastRefreshedByEmail ? ` by ${meta.lastRefreshedByEmail}` : ""} · {vocabLine(meta, asOf)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SecurityActions
                programs={programs}
                selectedKey={selectedKey}
                explicit={programKey !== null}
                canRefresh={user.isAdmin}
              />
              <SecurityLookToggle />
            </div>
          </div>
          <DeadlineCard release={window.current} asOf={asOf} />
        </header>

        {meta.lastRefreshError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-sec-pink/30 bg-sec-pink-tint px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sec-pink-text" />
            <div className="text-sm">
              <p className="font-semibold text-sec-pink-text">Last refresh failed — showing the last good data</p>
              <p className="mt-0.5 text-xs text-sec-pink-text/80">{meta.lastRefreshError}</p>
            </div>
          </div>
        )}
        {meta.vocabError && (
          <Callout tone="warn" title="Some vocabulary pages couldn't be read">
            {meta.vocabError} — the previous lists are still in use.
          </Callout>
        )}

        {!data.hasData ? (
          <EmptyState
            title="No data yet — run a refresh"
            body={
              user.isAdmin
                ? "Use Refresh above to pull the vocabulary and the Jira mirror, or wait for the nightly job."
                : "The tracker hasn't pulled from Jira yet. It refreshes nightly; an admin can refresh it now."
            }
          />
        ) : (
          <>
            {/* Large screens: progress and Path to zero side by side, equal height; stacked below. */}
            <div className="grid gap-4 *:min-w-0 2xl:grid-cols-2">
              <ProgressPanel view={view} jiraBaseUrl={jiraBaseUrl} />
              <PathToZeroPanel view={view} window={window} jiraBaseUrl={jiraBaseUrl} />
            </div>
            {isRollup && <ProgramScorecard view={view} window={window} jiraBaseUrl={jiraBaseUrl} />}
            <SecurityKpis view={view} window={window} jiraBaseUrl={jiraBaseUrl} />

            <CoverageBar view={view} jiraBaseUrl={jiraBaseUrl} />
            <div className="grid items-start gap-4 *:min-w-0 lg:grid-cols-2">
              <PriorityStatusTable view={view} jiraBaseUrl={jiraBaseUrl} />
              <VulnMixChart view={view} jiraBaseUrl={jiraBaseUrl} />
            </div>

            <div className="grid items-start gap-4 *:min-w-0 xl:grid-cols-2">
              <ReleasePlanPanel
                icon={Rocket}
                emoji="🚀"
                title={`This release — ${window.current.label}`}
                plan={view.releasePlans.current}
                jiraBaseUrl={jiraBaseUrl}
              />
              <ReleasePlanPanel
                icon={PlaneTakeoff}
                emoji="🛫"
                title={`Next release — ${window.next.label}`}
                plan={view.releasePlans.next}
                jiraBaseUrl={jiraBaseUrl}
              />
            </div>

            {/* Wide screens: campaigns (tall) beside effort + the 1.0/2.0 split (stacked), so neither
              runs a table across the full width nor leaves an empty half. */}
            <div className="grid items-start gap-4 *:min-w-0 2xl:grid-cols-2">
              <CampaignsPanel view={view} jiraBaseUrl={jiraBaseUrl} />
              <div className="flex flex-col gap-4 *:min-w-0">
                <EffortPanel view={view} jiraBaseUrl={jiraBaseUrl} />
                {view.legacy && <LegacySplitPanel legacy={view.legacy} jiraBaseUrl={jiraBaseUrl} />}
              </div>
            </div>
            <ReferenceLinks view={view} jiraBaseUrl={jiraBaseUrl} />

            <WorkbenchCard workbenchUrl={workbenchUrl} />
            <RiskRegister view={view} isRollup={isRollup} jiraBaseUrl={jiraBaseUrl} workbenchUrl={workbenchUrl} />
          </>
        )}

        <p className="border-t border-sec-line pt-4 text-xs lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-sec-muted transition-colors hover:text-sec-ink"
          >
            <ArrowLeft className="size-3.5" /> Back to the sprint board
          </Link>
        </p>
      </main>
    </SecurityLook>
  );
}
