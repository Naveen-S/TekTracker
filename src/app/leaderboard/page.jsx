/**
 * Velocity / Leaderboard (leaderboard.md) — a gamified, org-wide "healthy competition" screen:
 * teams ranked by points delivered ÷ an admin-entered developer headcount, and individual
 * developers ranked by points delivered across every scrum team — both sprint-scoped (default:
 * active sprint) and all-time (decision 4). Gated to EM/ED/VIEWER + global admin (decision 5);
 * LEAD/MEMBER get a personal, non-competitive "my stats" card on `/` instead (decision 6). No
 * writes, no Sync — matches `/rollup`'s read-only precedent. Only client leaf: LeaderboardTopBar.
 */
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { getLeaderboardData } from "@/lib/leaderboard-data";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { EmptyState } from "@/components/dashboard/empty-state";
import { AppShell } from "@/components/ui/app-shell";
import { LeaderboardTopBar } from "@/components/leaderboard/leaderboard-top-bar";
import { TeamLeaderboard } from "@/components/leaderboard/team-leaderboard";
import { DeveloperLeaderboard } from "@/components/leaderboard/developer-leaderboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leaderboard · Sprint Tracker" };

export default async function LeaderboardPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!(await hasLeaderboardAccess(user))) {
    notFound();
  }

  const { sprint, view } = await searchParams;
  const data = await getLeaderboardData(user, {
    sprintId: typeof sprint === "string" ? sprint : undefined,
    view: view === "allTime" ? "allTime" : "sprint",
  });

  const isAllTime = data.view === "allTime";
  const hasBoardData =
    data.teamBoard.length > 0 || data.developerBoard.length > 0 || data.unconfiguredTeams.length > 0;

  return (
    <AppShell user={data.user} hasBugReport={data.hasBugReport} hasLeaderboardAccess>
      <div className="flex min-h-screen flex-col">
        <LeaderboardTopBar
          user={data.user}
          sprints={data.sprints}
          selectedSprint={data.selectedSprint}
          view={data.view}
          hasBugReport={data.hasBugReport}
        />

        <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
          <HeroShell className="flex flex-wrap items-center justify-between gap-4 px-5 py-6 md:px-8 md:py-7">
            <div>
              <HeroEyebrow>Velocity / Leaderboard</HeroEyebrow>
              <HeroTitle>
                {isAllTime ? "All-time" : (data.selectedSprint?.name ?? "No sprint configured")}
              </HeroTitle>
              <HeroCopy className="mt-2">
                Story points delivered — team velocity-per-developer and the org-wide developer
                board.
              </HeroCopy>
            </div>
          </HeroShell>

          {!isAllTime && !data.selectedSprint ? (
            <EmptyState
              title="No sprint configured"
              body="An admin needs to configure the first sprint (Gate) before the leaderboard can render."
            />
          ) : !hasBoardData ? (
            <EmptyState
              title="No data yet"
              body="Once teams sync their Jira filters and deliver some story points, standings will show up here."
            />
          ) : (
            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <TeamLeaderboard
                rows={data.teamBoard}
                unconfigured={data.unconfiguredTeams}
                viewerIsAdmin={data.user.isAdmin}
              />
              <DeveloperLeaderboard rows={data.developerBoard} />
            </section>
          )}
        </main>
      </div>
    </AppShell>
  );
}
