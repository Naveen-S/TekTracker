/**
 * /security — the read-only security vulnerability tracker (security-vulnerability-tracker.md).
 * Any signed-in user (P1, the /bugs precedent); `?program=<KEY>|ALL` picks the view. Next 16:
 * `searchParams` is a Promise and must be awaited.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { isAskEnabled } from "@/lib/ask/availability";
import { AppShell } from "@/components/ui/app-shell";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { SecurityPage } from "@/components/security/security-page";

export const dynamic = "force-dynamic";

export default async function SecurityRoute({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/security");
  }
  const { program } = await searchParams;
  const [canSeeLeaderboard, bugReport, askEnabled] = await Promise.all([
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
      // No security data pack yet (spec OQ-2) — Ask answers here from its general packs.
      askContext={{ page: "other", label: "Security vulnerability tracker" }}
    >
      <div className="flex min-h-screen flex-col">
        <BugsTopBar user={user} subtitle="Security" />
        <SecurityPage user={user} programKey={typeof program === "string" ? program : null} />
      </div>
    </AppShell>
  );
}
