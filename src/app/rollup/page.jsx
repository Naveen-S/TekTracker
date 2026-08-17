/**
 * Multi-team roll-up (ed-rollup.md, migration step 6b) — server component: auth gate, batched
 * Prisma reads + per-team metrics + pure aggregateRollup via getRollupData, rendered read-only.
 * Access is membership-derived, any role (decision 2) — the set of teams the caller belongs to
 * (admin: all) for one global sprint selected via `?sprint=` (decision 1). No writes, no Sync
 * (decision 6 — staleness per team instead); the only client leaf is the top bar.
 */
import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getRollupData } from "@/lib/dashboard-data";
import {
  buildTrendSeries,
  formatSprintWindow,
  snapshotVelocity,
} from "@/lib/metrics.mjs";
import {
  DaysRemainingPill,
  HeroCopy,
  HeroEyebrow,
  HeroShell,
  HeroTitle,
} from "@/components/ui/hero-shell";
import { MetricGrid } from "@/components/dashboard/metric-grid";
import { TrendPanel } from "@/components/dashboard/trend-panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RollupTopBar } from "@/components/rollup/rollup-top-bar";
import { TeamSummaryTable } from "@/components/rollup/team-summary-table";
import { RollupRiskSection } from "@/components/rollup/rollup-risk-section";
import { RollupDigestButton } from "@/components/rollup/rollup-digest-button";
import { RollupStoryPoints } from "@/components/rollup/rollup-story-points";
import { compositionBreakdown } from "@/components/dashboard/story-points-highlight";
import { AppShell } from "@/components/ui/app-shell";

export const dynamic = "force-dynamic";

export default async function RollupPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { sprint, program } = await searchParams;
  const data = await getRollupData(user, {
    sprintId: typeof sprint === "string" ? sprint : undefined,
    programId: typeof program === "string" ? program : undefined,
  });
  const {
    teams,
    programs,
    selectedProgram,
    sprints,
    selectedSprint,
    perTeam,
    combinedSnapshots,
    combinedCapacity,
    combined,
  } = data;
  // Request-time "as of" for the server-rendered staleness labels — deterministic, no client clock.
  const asOf = new Date();
  // Combined burndown over the per-day summed snapshots (trend-burndown.md decisions 6–7).
  const trend = selectedSprint ? buildTrendSeries(combinedSnapshots, selectedSprint, asOf) : null;
  const velocityOverride = trend ? snapshotVelocity(trend.points, selectedSprint, asOf) : null;

  return (
    <AppShell
      user={data.user}
      hasBugReport={data.hasBugReport}
      hasLeaderboardAccess={data.hasLeaderboardAccess}
    >
      <div className="flex min-h-screen flex-col">
      <RollupTopBar
        user={data.user}
        programs={programs}
        selectedProgram={selectedProgram}
        sprints={sprints}
        selectedSprint={selectedSprint}
        hasBugReport={data.hasBugReport}
      />

      <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
        {teams.length === 0 ? (
          selectedProgram ? (
            <EmptyState
              title={`No teams in ${selectedProgram.name} yet`}
              body={
                data.user.isAdmin
                  ? `Assign scrum teams to the ${selectedProgram.key} program from the Admin page, then their sprint roll-up appears here.`
                  : `No scrum teams are assigned to the ${selectedProgram.key} program yet. Ask an admin to associate teams, or switch back to your own teams.`
              }
              actionHref={data.user.isAdmin ? "/admin" : undefined}
              actionLabel={data.user.isAdmin ? "Open Admin" : undefined}
            />
          ) : (
            <EmptyState
              title="You're not on a team yet"
              body={
                data.user.isAdmin
                  ? "Create a team and add members from the Admin page to get started."
                  : "Ask an admin to add you to a scrum team — you'll see its sprint board here."
              }
              actionHref={data.user.isAdmin ? "/admin" : undefined}
              actionLabel={data.user.isAdmin ? "Open Admin" : undefined}
            />
          )
        ) : !selectedSprint ? (
          <EmptyState
            title="No sprint configured"
            body="An admin needs to configure the first sprint (Gate) before roll-ups can render."
          />
        ) : (
          <>
            <HeroShell className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8 md:py-7">
              <div>
                {selectedProgram && (
                  <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-on-ink-accent ring-1 ring-white/15">
                    <Layers className="size-3" aria-hidden="true" /> Program
                  </span>
                )}
                <HeroEyebrow>
                  {selectedSprint.name} · {formatSprintWindow(selectedSprint)}
                </HeroEyebrow>
                <HeroTitle>
                  {selectedProgram ? selectedProgram.name : "Multi-team roll-up"} — {perTeam.length}{" "}
                  {perTeam.length === 1 ? "team" : "teams"}
                </HeroTitle>
                <HeroCopy className="mt-2">
                  {selectedProgram
                    ? `Read-only roll-up across every team in the ${selectedProgram.name} program.`
                    : "Read-only portfolio view across every team you belong to."}
                </HeroCopy>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <DaysRemainingPill sprint={selectedSprint} asOf={asOf} />
                {data.aiEnabled && combined && combined.totalIssues > 0 && (
                  <RollupDigestButton
                    sprintId={selectedSprint.id}
                    programId={selectedProgram?.id}
                    jiraBaseUrl={data.jiraBaseUrl}
                  />
                )}
              </div>
            </HeroShell>

            <RollupStoryPoints
              completedPoints={combined.completedPoints}
              totalPoints={combined.points}
              scope={`this sprint · ${perTeam.length} ${perTeam.length === 1 ? "team" : "teams"}`}
              breakdown={compositionBreakdown(combined)}
              capacity={combinedCapacity}
              teams={perTeam}
            />
            <MetricGrid
              metrics={combined}
              sprint={selectedSprint}
              velocityOverride={velocityOverride}
            />
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <TrendPanel
                series={trend}
                sprint={selectedSprint}
                asOf={asOf}
                totalTeams={perTeam.length}
              />
              <RollupRiskSection
                issues={perTeam.flatMap((entry) =>
                  entry.metrics.deliveryIssues.map((issue) => ({
                    ...issue,
                    teamKey: entry.team.key,
                  })),
                )}
                series={trend}
                jiraBaseUrl={data.jiraBaseUrl}
              />
            </section>
            <TeamSummaryTable
              perTeam={perTeam}
              selectedSprint={selectedSprint}
              asOf={asOf}
              viewerIsAdmin={data.user.isAdmin}
            />
          </>
        )}
      </main>
      </div>
    </AppShell>
  );
}
