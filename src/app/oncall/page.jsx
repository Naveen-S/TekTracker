/**
 * /oncall — the Support on-call directory (support-oncall.md). Any signed-in user, Support
 * included (decision 3, the /security audience rule); managers of a team (TEAM_MANAGER_ROLES) and
 * global admins edit that team's POCs. `?sprint=` picks a rotation (default: the one on duty now,
 * decision 6); `?program=` scopes the list to one program (or `none`); `?team=` scrolls to a team. Next 16: `searchParams` is a Promise.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { getOnCallData } from "@/lib/oncall/data";
import { isAskEnabled } from "@/lib/ask/availability";
import { AppShell } from "@/components/ui/app-shell";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { OnCallDirectory } from "@/components/oncall/oncall-directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "On-call · StoryBoard" };

export default async function OnCallPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/oncall");
  }
  const { sprint, team, program } = await searchParams;
  const [data, canSeeLeaderboard, askEnabled] = await Promise.all([
    getOnCallData(user, { sprintId: typeof sprint === "string" ? sprint : undefined }),
    hasLeaderboardAccess(user),
    isAskEnabled(),
  ]);

  return (
    <AppShell
      user={user}
      hasBugReport={data.hasBugReport}
      hasLeaderboardAccess={canSeeLeaderboard}
      askEnabled={askEnabled}
      askContext={{ page: "other", label: "Support on-call" }}
    >
      <div className="flex min-h-screen flex-col">
        <BugsTopBar user={user} subtitle="On-call" />
        <OnCallDirectory
          data={data}
          focusTeamId={typeof team === "string" ? team : null}
          programParam={typeof program === "string" ? program : null}
        />
      </div>
    </AppShell>
  );
}
