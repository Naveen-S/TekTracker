/**
 * /bugs — the default bug-report dashboard (gm-bug-report.md decision 2). Renders the first
 * active report; `/bugs/[slug]` targets a specific one. Org-level, so any authenticated user may
 * view (decision 18) — there is no team or sprint scoping here by design.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { isAskEnabled } from "@/lib/ask/availability";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { BugsPage } from "@/components/bugs/bugs-page";
import { AppShell } from "@/components/ui/app-shell";

export const dynamic = "force-dynamic";

export default async function BugsRoute() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const canSeeLeaderboard = await hasLeaderboardAccess(user);
  // Ask StoryBoard's context label (ask-storyboard.md) — the same report BugsPage defaults to.
  const report = await prisma.bugReport.findFirst({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  return (
    <AppShell
      user={user}
      hasBugReport
      hasLeaderboardAccess={canSeeLeaderboard}
      askEnabled={await isAskEnabled()}
      askContext={{
        page: "bugs",
        ...(report ? { bugReportSlug: report.slug } : {}),
        label: report ? `${report.name} bug report` : "Bug report",
      }}
    >
      <div className="flex min-h-screen flex-col">
        <BugsTopBar user={user} />
        <BugsPage user={user} />
      </div>
    </AppShell>
  );
}
