/**
 * /bugs — the default bug-report dashboard (gm-bug-report.md decision 2). Renders the first
 * active report; `/bugs/[slug]` targets a specific one. Org-level, so any authenticated user may
 * view (decision 18) — there is no team or sprint scoping here by design.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { BugsPage } from "@/components/bugs/bugs-page";

export const dynamic = "force-dynamic";

export default async function BugsRoute() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <BugsTopBar user={user} />
      <BugsPage user={user} />
    </div>
  );
}
