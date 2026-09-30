/**
 * /admin — minimal provisioning page (ui-port.md (c), decision 2): global-admin only (404 for
 * everyone else; the APIs it calls re-check server-side regardless). Thin forms over the step-4
 * routes: teams + members-by-email + sprints. Polish is post-v1.
 */
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminPanel } from "@/components/admin/admin-panel";
import { getBugReportData } from "@/lib/bug-report-data";
import { AppShell } from "@/components/ui/app-shell";
import { getAnalysisSettings } from "@/lib/connector/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · StoryBoard" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    notFound();
  }

  const [teams, programs, sprints, jiraComponents, capacityRows] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        program: { select: { id: true, name: true, key: true } },
        memberships: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
          },
        },
        subComponents: {
          orderBy: { name: "asc" },
          include: { component: { select: { id: true, name: true, projectKey: true } } },
        },
      },
    }),
    // program-rollup.md — the Programs admin section + the per-team Program picker; team counts
    // drive each row's "N teams" badge.
    prisma.program.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { teams: true } } },
    }),
    prisma.sprint.findMany({ orderBy: { developmentStart: "desc" } }),
    prisma.jiraComponent.findMany({
      orderBy: { name: "asc" },
      include: {
        subComponents: {
          orderBy: { name: "asc" },
          include: { team: { select: { id: true, name: true, key: true } } },
        },
      },
    }),
    // committed-unplanned-work.md — every team's committed-capacity rows across every sprint, fed
    // into the new "Committed Capacity" matrix section.
    prisma.sprintCapacity.findMany({ orderBy: { sprintId: "asc" } }),
  ]);

  // Recent server-side failures (observability-and-errors.md). Read here rather than through a new
  // API route: the page is already global-admin-gated, and router.refresh() re-reads it. Guarded
  // because the ErrorLog table only exists once migration 13 has been deployed to this environment
  // — and a missing table must not 500 the whole admin page.
  let recentErrors = [];
  try {
    recentErrors = await prisma.errorLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    recentErrors = [];
  }

  // Bug-report config (gm-bug-report.md (h)). The vocabularies come from the cached issues, so the
  // status/priority pickers offer what the data actually contains instead of free text.
  const bugData = await getBugReportData(undefined, new Date());
  const analysisSettings = await getAnalysisSettings();

  return (
    <AppShell
      user={user}
      hasBugReport={(bugData?.reports?.length ?? 0) > 0}
      hasLeaderboardAccess
    >
      <AdminPanel
        teams={teams}
        programs={programs}
        sprints={sprints}
        jiraComponents={jiraComponents}
        capacityRows={capacityRows}
        bugReports={bugData?.reports ?? []}
        bugConfig={bugData?.report ?? null}
        bugStatusVocabulary={bugData?.statusVocabulary ?? []}
        bugPriorityVocabulary={bugData?.priorityVocabulary ?? []}
        recentErrors={recentErrors}
        analysisSettings={analysisSettings}
      />
    </AppShell>
  );
}
