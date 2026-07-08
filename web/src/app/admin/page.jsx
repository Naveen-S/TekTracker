/**
 * /admin — minimal provisioning page (ui-port.md (c), decision 2): global-admin only (404 for
 * everyone else; the APIs it calls re-check server-side regardless). Thin forms over the step-4
 * routes: teams + members-by-email + sprints. Polish is post-v1.
 */
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AdminPanel } from "@/components/admin/admin-panel";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Sprint Tracker" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    notFound();
  }

  const [teams, sprints] = await Promise.all([
    prisma.team.findMany({
      orderBy: { name: "asc" },
      include: {
        memberships: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { id: true, email: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    }),
    prisma.sprint.findMany({ orderBy: { developmentStart: "desc" } }),
  ]);

  return <AdminPanel teams={teams} sprints={sprints} />;
}
