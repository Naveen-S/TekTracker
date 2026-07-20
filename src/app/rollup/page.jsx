/**
 * Multi-team roll-up (ed-rollup.md, migration step 6b) — server component: auth gate, batched
 * Prisma reads + per-team metrics + pure aggregateRollup via getRollupData, rendered read-only.
 * Access is membership-derived, any role (decision 2) — the set of teams the caller belongs to
 * (admin: all) for one global sprint selected via `?sprint=` (decision 1). No writes, no Sync
 * (decision 6 — staleness per team instead); the only client leaf is the top bar.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getRollupData } from "@/lib/dashboard-data";
import {
  buildTrendSeries,
  formatDate,
  getDaysRemaining,
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
import { RiskCalloutsPanel } from "@/components/dashboard/risk-callouts-panel";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RollupTopBar } from "@/components/rollup/rollup-top-bar";
import { TeamSummaryTable } from "@/components/rollup/team-summary-table";

export const dynamic = "force-dynamic";

export default async function RollupPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { sprint } = await searchParams;
  const data = await getRollupData(user, {
    sprintId: typeof sprint === "string" ? sprint : undefined,
  });
  const { teams, sprints, selectedSprint, perTeam, combinedSnapshots, combined } = data;
  // Request-time "as of" for the server-rendered staleness labels — deterministic, no client clock.
  const asOf = new Date();
  const daysRemaining = selectedSprint ? getDaysRemaining(selectedSprint) : null;
  // Combined burndown over the per-day summed snapshots (trend-burndown.md decisions 6–7).
  const trend = selectedSprint ? buildTrendSeries(combinedSnapshots, selectedSprint, asOf) : null;
  const velocityOverride = trend ? snapshotVelocity(trend.points, selectedSprint, asOf) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <RollupTopBar user={data.user} sprints={sprints} selectedSprint={selectedSprint} />

      <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
        {teams.length === 0 ? (
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
        ) : !selectedSprint ? (
          <EmptyState
            title="No sprint configured"
            body="An admin needs to configure the first sprint (Gate) before roll-ups can render."
          />
        ) : (
          <>
            <HeroShell className="px-5 py-6 md:px-8 md:py-7">
              <HeroEyebrow>
                {selectedSprint.name} · {formatDate(selectedSprint.developmentStart)} –{" "}
                {formatDate(selectedSprint.developmentEnd)}
                {selectedSprint.releaseDate
                  ? ` · release ${formatDate(selectedSprint.releaseDate)}`
                  : ""}
              </HeroEyebrow>
              <HeroTitle>
                Multi-team roll-up — {perTeam.length} {perTeam.length === 1 ? "team" : "teams"}
              </HeroTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <HeroCopy>Read-only portfolio view across every team you belong to.</HeroCopy>
                <DaysRemainingPill days={daysRemaining} />
              </div>
            </HeroShell>

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
              <RiskCalloutsPanel
                issues={perTeam.flatMap((entry) =>
                  entry.metrics.issues.map((issue) => ({ ...issue, teamKey: entry.team.key })),
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
  );
}
