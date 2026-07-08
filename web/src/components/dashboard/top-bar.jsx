"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function TopBar({
  user,
  teams,
  selectedTeam,
  sprints,
  selectedSprint,
  onSelect,
  onAddFilter,
  onSync,
  syncing,
  busy,
  canWrite,
  canManage,
  onLogout,
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 border-b bg-card px-5 py-2.5">
      <div className="flex items-center gap-3">
        <Image src="/tekion-logo.svg" alt="Tekion" width={92} height={22} priority />
        <span className="h-6 w-px bg-border" aria-hidden="true" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">Sprint Tracker</p>
          <p className="text-[11px] text-muted-foreground">Engineering · Internal</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {teams.length > 0 && (
          <Select
            aria-label="Scrum team"
            value={selectedTeam?.id ?? ""}
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
            onChange={(event) => onSelect(selectedTeam?.id, event.target.value)}
          >
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} ({sprint.state.toLowerCase()})
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {canManage && onAddFilter && (
          <Button variant="secondary" size="sm" onClick={onAddFilter} disabled={busy}>
            + Add filter
          </Button>
        )}
        {canWrite && (
          <Button size="sm" onClick={onSync} disabled={syncing || busy}>
            <span className={syncing ? "animate-spin" : ""} aria-hidden="true">
              ⟳
            </span>
            {syncing ? "Syncing…" : "Sync Jira"}
          </Button>
        )}
        {user.isAdmin && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin">Admin</Link>
          </Button>
        )}
        <div
          className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
          title={`${user.displayName} · ${user.email}`}
        >
          {initials(user.displayName || user.email)}
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} title="Sign out">
          Logout
        </Button>
      </div>
    </header>
  );
}
