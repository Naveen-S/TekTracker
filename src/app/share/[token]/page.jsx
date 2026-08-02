/**
 * Public shared view (share-view-export.md (c)) — the app's first session-less page: the token in
 * the URL is the bearer capability (decision 2), so there is deliberately NO auth gate, no
 * redirect to /login, and no session chrome (no TopBar, no user, no `can` flags — nothing to
 * leak). Unknown, expired, revoked, and all-filters-deleted tokens all render the same generic
 * invalid state. Read-only reuse of the dashboard leaves: MetricGrid + PlannerPanel with null
 * write handlers (the 6a VIEWER path); density comes from the share, not the local pref.
 * Frozen shares pass `asOf = capturedAt` down so health/velocity can't drift (decision 6).
 */
import Image from "next/image";
import { getShareData } from "@/lib/dashboard-data";
import { formatSprintWindow } from "@/lib/metrics.mjs";
import { Badge } from "@/components/ui/badge";
import {
  DaysRemainingPill,
  HeroCopy,
  HeroEyebrow,
  HeroShell,
  HeroTitle,
} from "@/components/ui/hero-shell";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { StoryPointsHighlight } from "@/components/dashboard/story-points-highlight";
import { PlannerPanel } from "@/components/dashboard/planner-panel";

export const dynamic = "force-dynamic";

// Capability URLs must never be indexed or followed.
export const metadata = {
  title: "Shared sprint view — StoryBoard",
  robots: { index: false, follow: false },
};

function formatDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ShareChrome({ children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-card px-4 py-2 md:px-6">
        <div className="flex items-center gap-3">
          <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
          <div className="hidden border-l border-border-subtle pl-3 sm:block">
            <p className="font-display text-sm leading-tight font-extrabold">StoryBoard</p>
          </div>
        </div>
        <Badge tone="neutral">Shared view · read-only</Badge>
      </header>
      {children}
      <footer className="border-t border-border-subtle px-4 py-3 text-center text-[11px] text-muted-foreground">
        Engineering Internal Tool @ Tekion Corp.
      </footer>
    </div>
  );
}

function ShareInvalid() {
  return (
    <ShareChrome>
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-[11px] font-bold tracking-widest uppercase text-accent-foreground">
          StoryBoard
        </p>
        <h1 className="font-display text-2xl font-extrabold">
          This share link is invalid or has expired
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ask the person who sent it to create a fresh link from their sprint board.
        </p>
      </main>
    </ShareChrome>
  );
}

export default async function SharePage({ params }) {
  const { token } = await params;
  const data = await getShareData(token);
  if (!data) {
    return <ShareInvalid />;
  }

  const {
    sprint,
    filters,
    progressByKey,
    metrics,
    capacity,
    isLive,
    asOf,
    lastSyncedAt,
    viewDensity,
    jiraBaseUrl,
  } = data;
  const freshness = isLive
    ? lastSyncedAt
      ? `Live view · data as of last Jira sync, ${formatDateTime(lastSyncedAt)}`
      : "Live view · not synced with Jira yet"
    : `Snapshot frozen ${formatDateTime(asOf)} — numbers won't change`;

  return (
    <ShareChrome>
      <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
        <HeroShell className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8 md:py-7">
          <div>
            <HeroEyebrow>
              {sprint.name} · {formatSprintWindow(sprint)}
            </HeroEyebrow>
            <HeroTitle>Shared sprint view</HeroTitle>
            <HeroCopy className="mt-2">{freshness}</HeroCopy>
          </div>
          {/* The live-clock pill only makes sense on live shares; frozen views are as-of capture. */}
          {isLive ? (
            <DaysRemainingPill sprint={sprint} />
          ) : (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold whitespace-nowrap text-white/80">
              Frozen snapshot
            </span>
          )}
        </HeroShell>

        <StoryPointsHighlight
          completedPoints={metrics.completedPoints}
          totalPoints={metrics.points}
          breakdown={{
            committed: {
              points: metrics.committedPoints,
              completedPoints: metrics.committedCompletedPoints,
            },
            techDebt: {
              points: metrics.techDebtPoints,
              completedPoints: metrics.techDebtCompletedPoints,
            },
            unplanned: {
              points: metrics.unplannedPoints,
              completedPoints: metrics.unplannedCompletedPoints,
            },
          }}
          capacity={capacity}
        />

        <MetricGrid metrics={metrics} sprint={sprint} asOf={asOf ?? undefined} />

        <PlannerPanel
          allFilters={filters}
          visibleFilters={filters}
          progressByKey={progressByKey}
          sprint={sprint}
          density={viewDensity}
          jiraBaseUrl={jiraBaseUrl}
          canWrite={false}
          busy={false}
          asOf={asOf ?? undefined}
        />
      </main>
    </ShareChrome>
  );
}
