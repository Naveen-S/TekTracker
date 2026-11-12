/**
 * /sow/[slug] — one SOW's phase journey (sow-tracker.md (f)). Any signed-in user reads; global
 * admins refresh and edit. `?panel=` opens a drill-in (e.g. `epic:GM-10506`). Next 16: `params`
 * and `searchParams` are Promises and must be awaited.
 */
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { isAskEnabled } from "@/lib/ask/availability";
import { getSowData } from "@/lib/sow/data";
import { AppShell } from "@/components/ui/app-shell";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { SowPage } from "@/components/sow/sow-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "SOW · StoryBoard" };

export default async function SowRoute({ params, searchParams }) {
  const { slug } = await params;
  const { panel } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/sow/${slug}`)}`);
  }
  const [view, canSeeLeaderboard, bugReport, askEnabled, programs] = await Promise.all([
    getSowData(slug, new Date(), { includeHidden: user.isAdmin }),
    hasLeaderboardAccess(user),
    prisma.bugReport.findFirst({ where: { isActive: true }, select: { id: true } }),
    isAskEnabled(),
    user.isAdmin ? prisma.program.findMany({ orderBy: { name: "asc" }, select: { id: true, key: true, name: true } }) : [],
  ]);
  if (!view) {
    notFound();
  }

  return (
    <AppShell
      user={user}
      hasBugReport={Boolean(bugReport)}
      hasLeaderboardAccess={canSeeLeaderboard}
      askEnabled={askEnabled}
      askContext={{ page: "sow", sowSlug: view.sow.slug, label: `SOW — ${view.sow.name}` }}
    >
      <div className="flex min-h-screen flex-col">
        <BugsTopBar user={user} subtitle="SOWs" />
        <SowPage view={view} canEdit={user.isAdmin} programs={programs} initialPanel={typeof panel === "string" ? panel : null} />
      </div>
    </AppShell>
  );
}
