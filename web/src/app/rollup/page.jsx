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
import { formatDate, getDaysRemaining } from "@/lib/metrics.mjs";
import { Badge } from "@/components/ui/badge";
import { MetricGrid } from "@/components/dashboard/metric-grid";
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
  const { teams, sprints, selectedSprint, perTeam, combined } = data;
  // Request-time "as of" for the server-rendered staleness labels — deterministic, no client clock.
  const asOf = new Date();
  const daysRemaining = selectedSprint ? getDaysRemaining(selectedSprint) : null;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <RollupTopBar user={data.user} sprints={sprints} selectedSprint={selectedSprint} />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 p-5">
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
            <section className="rounded-xl border bg-gradient-to-br from-[#0b1620] to-[#15303f] px-6 py-5 text-white">
              <p className="text-xs uppercase tracking-wide text-white/60">
                {selectedSprint.name} · {formatDate(selectedSprint.developmentStart)} –{" "}
                {formatDate(selectedSprint.developmentEnd)}
                {selectedSprint.releaseDate
                  ? ` · release ${formatDate(selectedSprint.releaseDate)}`
                  : ""}
              </p>
              <h1 className="mt-1 text-xl font-semibold">
                Multi-team roll-up — {perTeam.length} {perTeam.length === 1 ? "team" : "teams"}
              </h1>
              <div className="mt-2 flex items-center gap-2 text-sm text-white/75">
                <span>Read-only portfolio view across every team you belong to.</span>
                <Badge tone={daysRemaining < 3 ? "danger" : "info"}>
                  {daysRemaining > 0
                    ? `${daysRemaining} days remaining`
                    : daysRemaining === 0
                      ? "Last day!"
                      : "Sprint ended"}
                </Badge>
              </div>
            </section>

            <MetricGrid metrics={combined} sprint={selectedSprint} />
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
