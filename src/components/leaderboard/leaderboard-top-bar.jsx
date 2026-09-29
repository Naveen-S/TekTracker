"use client";

/**
 * The leaderboard page's only client leaf (leaderboard.md): time-scope (This sprint / All-time) and
 * sprint selection travel in `?view=&sprint=` via router.push; everything else on `/leaderboard` is
 * server-rendered and read-only.
 */
import Image from "next/image";
import { Wordmark } from "@/components/ui/brand";
import { useTransition } from "react";
import { NavLink } from "@/components/ui/nav-link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { PageLoader } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";

export function LeaderboardTopBar({ user, sprints, selectedSprint, view, hasBugReport }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const navigate = ({ view: nextView, sprint: nextSprint }) => {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (nextView === "sprint" && nextSprint) params.set("sprint", nextSprint);
    startSwitch(() => router.push(`/leaderboard?${params.toString()}`));
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-4 py-2 shadow-xs md:flex-nowrap md:gap-4 md:px-6 md:py-0">
      <div className="flex items-center gap-3 lg:hidden">
        <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
        <span className="hidden h-5.5 w-px bg-border sm:block" aria-hidden="true" />
        <div className="hidden leading-tight sm:block">
          <Wordmark className="block text-sm" />
          <p className="text-[11px] text-muted-foreground">Leaderboard</p>
        </div>
      </div>

      <Select
        aria-label="Time scope"
        value={view}
        disabled={switching}
        onChange={(event) => navigate({ view: event.target.value, sprint: selectedSprint?.id })}
        className="w-auto"
      >
        <option value="sprint">This sprint</option>
        <option value="allTime">All-time</option>
      </Select>

      {view === "sprint" && sprints.length > 0 && (
        <Select
          aria-label="Sprint"
          value={selectedSprint?.id ?? ""}
          disabled={switching}
          onChange={(event) => navigate({ view: "sprint", sprint: event.target.value })}
        >
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name} ({sprint.state.toLowerCase()})
            </option>
          ))}
        </Select>
      )}

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
        <AvatarChip
          name={user.displayName || user.email}
          title={`${user.displayName} · ${user.email}`}
        />
        <Button variant="ghost" size="sm" onClick={handleLogout} title="Sign out">
          Logout
        </Button>
      </div>
      <PageLoader show={switching} label="Updating…" />
    </header>
  );
}
