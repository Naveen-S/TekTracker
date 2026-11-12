/**
 * /sow — every SOW / program project (sow-tracker.md (f)). Outside the scrum boards: no team, no
 * sprint. Any signed-in user reads (decision 2, the /security audience rule); global admins create.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { isAskEnabled } from "@/lib/ask/availability";
import { getSowList } from "@/lib/sow/data";
import { AppShell } from "@/components/ui/app-shell";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { SowList } from "@/components/sow/sow-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "SOWs · StoryBoard" };

export default async function SowListRoute() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/sow");
  }
  const [data, canSeeLeaderboard, bugReport, askEnabled] = await Promise.all([
    getSowList(),
    hasLeaderboardAccess(user),
    prisma.bugReport.findFirst({ where: { isActive: true }, select: { id: true } }),
    isAskEnabled(),
  ]);

  return (
    <AppShell
      user={user}
      hasBugReport={Boolean(bugReport)}
      hasLeaderboardAccess={canSeeLeaderboard}
      askEnabled={askEnabled}
      askContext={{ page: "sow", label: "SOWs" }}
    >
      <div className="flex min-h-screen flex-col">
        <BugsTopBar user={user} subtitle="SOWs" />
        <SowList cards={data.cards} programs={data.programs} canEdit={user.isAdmin} />
      </div>
    </AppShell>
  );
}
