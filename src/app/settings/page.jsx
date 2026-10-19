/**
 * Personal settings (claude-connector-analysis.md §Scope e) — today, one card: pairing the
 * StoryBoard Connector that runs "Analyse with Claude" on the user's own Claude Code. Open to every
 * signed-in user; the pairing routes are self-scoped.
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasLeaderboardAccess } from "@/lib/rbac";
import { hasActiveBugReport, serializeUser } from "@/lib/dashboard-data";
import { getAnalysisSettings } from "@/lib/connector/settings";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { AppShell } from "@/components/ui/app-shell";
import { SettingsTopBar } from "@/components/settings/settings-top-bar";
import { ClaudeConnectorCard } from "@/components/settings/claude-connector-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · StoryBoard" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [hasBugReport, leaderboard, analysisSettings] = await Promise.all([
    hasActiveBugReport(),
    hasLeaderboardAccess(user),
    getAnalysisSettings(),
  ]);
  const viewer = serializeUser(user);

  return (
    <AppShell user={viewer} hasBugReport={hasBugReport} hasLeaderboardAccess={leaderboard}>
      <div className="flex min-h-screen flex-col">
        <SettingsTopBar user={viewer} hasBugReport={hasBugReport} />
        <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
          <HeroShell className="px-5 py-6 md:px-8 md:py-7">
            <HeroEyebrow>Settings</HeroEyebrow>
            <HeroTitle>{viewer.displayName || viewer.email}</HeroTitle>
            <HeroCopy className="mt-2">Personal integrations for your StoryBoard account.</HeroCopy>
          </HeroShell>
          <ClaudeConnectorCard analysisEnabled={analysisSettings.enabled} />
        </main>
      </div>
    </AppShell>
  );
}
