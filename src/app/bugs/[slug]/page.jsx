/**
 * /bugs/[slug] — a specific bug-report dashboard, so "the same dashboard for Project = Honda" is
 * a config exercise rather than a code change (gm-bug-report.md decision 1). Next 16: `params` is
 * a Promise and must be awaited.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BugsTopBar } from "@/components/bugs/bugs-top-bar";
import { BugsPage } from "@/components/bugs/bugs-page";

export const dynamic = "force-dynamic";

export default async function BugsSlugRoute({ params }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const { slug } = await params;

  return (
    <div className="flex min-h-screen flex-col">
      <BugsTopBar user={user} />
      <BugsPage slug={slug} user={user} />
    </div>
  );
}
