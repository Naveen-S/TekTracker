/**
 * Dashboard (ui-port.md (c)) — server component: auth gate, Prisma reads + pure metrics via
 * getDashboardData, then hands serializable props to the client shell. Team/sprint selection
 * travels in `?team=&sprint=` (decision 2); mutations happen in the client leaves against the
 * step-4/5 routes, followed by router.refresh() re-running this fetch.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard-data";
import { Dashboard } from "@/components/dashboard/dashboard";

export const dynamic = "force-dynamic";

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

  return <Dashboard {...data} />;
}
