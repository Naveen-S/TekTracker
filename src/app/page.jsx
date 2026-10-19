/**
 * Dashboard (ui-port.md (c)) — server component: auth gate, Prisma reads + pure metrics via
 * getDashboardData, then hands serializable props to the client shell. Team/sprint selection
 * travels in `?team=&sprint=` (decision 2); mutations happen in the client leaves against the
 * step-4/5 routes, followed by router.refresh() re-running this fetch.
 */
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { aggregateByDeveloper } from "@/lib/metrics.mjs";
import { getMyAllTimePoints } from "@/lib/leaderboard-data";
import { Dashboard } from "@/components/dashboard/dashboard";
import { AnalysisProvider } from "@/components/analysis/analysis-context";
import { getAnalysisUiState } from "@/lib/connector/ui-state";

export const dynamic = "force-dynamic";

const SELF_STATS_ROLES = [Role.LEAD, Role.MEMBER];

export default async function DashboardPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { team, sprint } = await searchParams;
  const data = await getDashboardData(user, {
    teamId: typeof team === "string" ? team : undefined,
    sprintId: typeof sprint === "string" ? sprint : undefined,
  });

  // Personal "my stats" card (leaderboard.md decision 6) — LEAD/MEMBER never see the full org-wide
  // /leaderboard board, only their own points. Computed here (not in dashboard-data.js) to avoid a
  // circular import with leaderboard-data.js. "This sprint" is free — derived from the issues
  // getDashboardData already fetched; only the all-time figure is a new, single-team-scoped query.
  let myStats = null;
  if (data.selectedTeam && SELF_STATS_ROLES.includes(data.myRole)) {
    const thisSprintRow = data.metrics
      ? aggregateByDeveloper(data.metrics.issues).find(
          (row) => row.assigneeAccountId === user.jiraAccountId,
        )
      : null;
    myStats = {
      thisSprint: thisSprintRow ?? { totalPoints: 0, completedPoints: 0, issueCount: 0 },
      allTime: await getMyAllTimePoints(user.jiraAccountId, data.selectedTeam.id),
    };
  }

  // Claude analysis (claude-connector-analysis.md): feature flag + which board tickets already carry
  // a saved analysis — every track row plus the Needs-attention panel.
  const analysis = await getAnalysisUiState(
    [...data.filters, ...(data.needsAttentionTrack ? [data.needsAttentionTrack] : [])].flatMap(
      (filter) => filter.issues.map((issue) => issue.jiraKey),
    ),
  );

  return (
    <AnalysisProvider enabled={analysis.enabled} analyzedKeys={analysis.analyzedKeys}>
      <Dashboard {...data} myStats={myStats} />
    </AnalysisProvider>
  );
}
