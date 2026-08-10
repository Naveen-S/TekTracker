"use client";

import Image from "next/image";
import { NavLink } from "@/components/ui/nav-link";
import { Plus, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AvatarChip } from "@/components/ui/avatar-chip";

export function TopBar({
  user,
  teams,
  selectedTeam,
  sprints,
  selectedSprint,
  onSelect,
  isDefaultView,
  onSetDefault,
  onAddFilter,
  onSync,
  syncing,
  busy,
  canWrite,
  canManage,
  hasBugReport,
  onLogout,
}) {
  return (
    <header className="sticky top-0 z-40 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-card px-4 py-2 shadow-xs md:flex-nowrap md:gap-4 md:px-6 md:py-0">
      <div className="flex items-center gap-3 lg:hidden">
        <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
        <span className="hidden h-5.5 w-px bg-border sm:block" aria-hidden="true" />
        <div className="hidden leading-tight sm:block">
          <p className="font-display text-sm font-bold">StoryBoard</p>
          <p className="text-[11px] text-muted-foreground">Engineering · Internal</p>
        </div>
      </div>

      <div className="flex max-w-full flex-wrap items-center gap-2">
        {teams.length > 0 && (
          <Select
            aria-label="Scrum team"
            value={selectedTeam?.id ?? ""}
            disabled={busy}
            onChange={(event) => onSelect(event.target.value, selectedSprint?.id)}
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.key} · {team.name}
              </option>
            ))}
          </Select>
        )}
        {sprints.length > 0 && (
          <Select
            aria-label="Sprint"
            value={selectedSprint?.id ?? ""}
            disabled={busy}
            onChange={(event) => onSelect(selectedTeam?.id, event.target.value)}
          >
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.state.toLowerCase()})
              </option>
            ))}
          </Select>
        )}
        {selectedTeam && onSetDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSetDefault}
            disabled={busy}
            aria-pressed={isDefaultView}
            title={
              isDefaultView
                ? "This is your default board view — click to clear"
                : "Set this team + release as your default board view"
            }
          >
            <Star className={isDefaultView ? "fill-current text-primary" : ""} />
            <span className="hidden sm:inline">{isDefaultView ? "Default" : "Set default"}</span>
          </Button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {canManage && onAddFilter && (
          <Button variant="secondary" size="sm" onClick={onAddFilter} disabled={busy}>
            <Plus /> Add filter
          </Button>
        )}
        {canWrite && (
          <Button size="sm" onClick={onSync} disabled={syncing || busy}>
            <RefreshCw className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Sync Jira"}
          </Button>
        )}
        {(teams.length >= 2 || user.isAdmin) && (
          <Button variant="ghost" size="sm" className="lg:hidden" asChild>
            <NavLink href="/rollup">Roll-up</NavLink>
          </Button>
        )}
        {hasBugReport && (
          <Button variant="ghost" size="sm" className="lg:hidden" asChild>
            <NavLink href="/bugs">Bugs</NavLink>
          </Button>
        )}
        {user.isAdmin && (
          <Button variant="ghost" size="sm" className="lg:hidden" asChild>
            <NavLink href="/admin">Admin</NavLink>
          </Button>
        )}
        <ThemeToggle />
        <AvatarChip
          name={user.displayName || user.email}
          title={`${user.displayName} · ${user.email}`}
        />
        <Button variant="ghost" size="sm" onClick={onLogout} title="Sign out">
          Logout
        </Button>
      </div>
    </header>
  );
}
