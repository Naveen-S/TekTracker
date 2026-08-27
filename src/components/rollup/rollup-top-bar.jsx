"use client";

/**
 * The roll-up page's only client leaf (ed-rollup.md decision 7): sprint selection travels in
 * `?sprint=` via router.push; everything else on /rollup is server-rendered and read-only.
 */
import Image from "next/image";
import { useTransition } from "react";
import { NavLink } from "@/components/ui/nav-link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AvatarChip } from "@/components/ui/avatar-chip";
import { PageLoader } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";

export function RollupTopBar({
  user,
  programs = [],
  selectedProgram,
  sprints,
  selectedSprint,
  hasBugReport,
}) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();

  // Both selects re-scope the same page; each preserves the OTHER's current value so switching
  // program keeps the sprint and vice versa (program-rollup.md). "My teams" clears ?program=.
  const navigate = ({ programId, sprintId }) => {
    const params = new URLSearchParams();
    const nextProgram = programId !== undefined ? programId : (selectedProgram?.id ?? "");
    const nextSprint = sprintId !== undefined ? sprintId : (selectedSprint?.id ?? "");
    if (nextProgram) params.set("program", nextProgram);
    if (nextSprint) params.set("sprint", nextSprint);
    const query = params.toString();
    startSwitch(() => router.push(query ? `/rollup?${query}` : "/rollup"));
  };

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
          <p className="font-display text-sm font-bold">StoryBoard</p>
          <p className="text-[11px] text-muted-foreground">Multi-team roll-up</p>
        </div>
      </div>

      {programs.length > 0 && (
        <Select
          aria-label="Program scope"
          title="Scope the roll-up to a program"
          className="sm:w-56"
          value={selectedProgram?.id ?? ""}
          disabled={switching}
          onChange={(event) => navigate({ programId: event.target.value })}
        >
          <option value="">My teams</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.key} · {program.name}
            </option>
          ))}
        </Select>
      )}

      {sprints.length > 0 && (
        <Select
          aria-label="Sprint"
          title="Select the sprint (Gate) to roll up"
          className="sm:w-56"
          value={selectedSprint?.id ?? ""}
          disabled={switching}
          onChange={(event) => navigate({ sprintId: event.target.value })}
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
