"use client";

/**
 * Settings page top bar (claude-connector-analysis.md §Scope e) — the leaderboard bar's chrome
 * without its selectors: brand + cross-page links below lg (the sidebar owns nav at lg+), theme,
 * avatar, logout.
 */
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/ui/brand";
import { NavLink } from "@/components/ui/nav-link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { apiFetch } from "@/lib/api-client";

export function SettingsTopBar({ user, hasBugReport }) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-4 py-2 shadow-xs md:flex-nowrap md:gap-4 md:px-6 md:py-0">
      <div className="flex items-center gap-3 lg:hidden">
        <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
        <span className="hidden h-5.5 w-px bg-border sm:block" aria-hidden="true" />
        <div className="hidden leading-tight sm:block">
          <Wordmark className="block text-sm" />
          <p className="text-[11px] text-muted-foreground">Settings</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" className="lg:hidden" asChild>
          <NavLink href="/">My board</NavLink>
        </Button>
        <Button variant="ghost" size="sm" className="lg:hidden" asChild>
          <NavLink href="/rollup">Roll-up</NavLink>
        </Button>
        {hasBugReport && (
          <Button variant="ghost" size="sm" className="lg:hidden" asChild>
            <NavLink href="/bugs">Bugs</NavLink>
          </Button>
        )}
        <ThemeToggle />
        <AvatarChip name={user.displayName || user.email} title={`${user.displayName} · ${user.email}`} />
        <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out">
          Logout
        </Button>
      </div>
    </header>
  );
}
