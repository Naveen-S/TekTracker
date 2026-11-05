"use client";

/**
 * The /oncall directory (support-oncall.md (f)): find the right Support POC by team, module or
 * name in a couple of seconds, on a phone or a laptop. The hero carries the sprint picker, the
 * rotation window, the program picker and the search box; teams group by program with "No program"
 * last. The program picker filters instantly on the client (every team is already loaded) and is
 * kept in `?program=`; it opens on the viewer's own program when all their teams share one.
 * Search is client-side over team name/key, program, module (sub-component) names and POC
 * names/emails, and always spans EVERY program — Support rarely knows which program owns a module.
 * `?team=` selects that team's program, scrolls to its card and rings it briefly.
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Search } from "lucide-react";
import { HeroCopy, HeroEyebrow, HeroShell, HeroTitle } from "@/components/ui/hero-shell";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";
import { formatRotationWindow } from "@/lib/oncall/rotation.mjs";
import { TeamCard } from "./team-card";
import { OnCallEditDialog } from "./oncall-edit-dialog";

const HIGHLIGHT_MS = 2400;
const ALL_PROGRAMS = "";
const NO_PROGRAM = "none";

const programOf = (team) => team.program?.id ?? NO_PROGRAM;

const haystack = (team) =>
  [
    team.name,
    team.key,
    team.program?.name,
    team.program?.key,
    ...team.modules,
    ...team.pocs.flatMap((poc) => [poc.displayName, poc.email, poc.area]),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

/** Teams grouped by program (alphabetical), with unassigned teams last. */
function groupByProgram(teams) {
  const groups = new Map();
  for (const team of teams) {
    const id = programOf(team);
    if (!groups.has(id)) groups.set(id, { id, name: team.program?.name ?? "No program", teams: [] });
    groups.get(id).teams.push(team);
  }
  return [...groups.values()].sort((a, b) =>
    a.id === NO_PROGRAM ? 1 : b.id === NO_PROGRAM ? -1 : a.name.localeCompare(b.name),
  );
}

/** Distinct programs across the teams, by name, plus whether any team has none. */
function programOptions(teams) {
  const programs = new Map();
  for (const team of teams) if (team.program) programs.set(team.program.id, team.program);
  return {
    programs: [...programs.values()].sort((a, b) => a.name.localeCompare(b.name)),
    hasUnassigned: teams.some((team) => !team.program),
  };
}

/** `?team=` wins (its card must be on screen), then a valid `?program=`, then the viewer's default. */
function initialProgram({ teams, defaultProgramId }, programs, focusTeamId, programParam) {
  const focusTeam = focusTeamId && teams.find((team) => team.id === focusTeamId);
  if (focusTeam) return programOf(focusTeam);
  if (programParam === NO_PROGRAM || programs.some((program) => program.id === programParam)) return programParam;
  return defaultProgramId ?? ALL_PROGRAMS;
}

export function OnCallDirectory({ data, focusTeamId, programParam }) {
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const { programs, hasUnassigned } = useMemo(() => programOptions(data.teams), [data.teams]);
  const showProgramPicker = programs.length + (hasUnassigned ? 1 : 0) > 1;
  const [programId, setProgramId] = useState(() => initialProgram(data, programs, focusTeamId, programParam));
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const [toast, showToast] = useToast();
  const { selectedSprint: sprint } = data;

  const indexed = useMemo(() => data.teams.map((team) => ({ team, text: haystack(team) })), [data.teams]);
  const needle = query.trim().toLowerCase();
  const scoped = programId === ALL_PROGRAMS ? data.teams : data.teams.filter((team) => programOf(team) === programId);
  const visible = needle ? indexed.filter(({ text }) => text.includes(needle)).map(({ team }) => team) : scoped;
  const groups = groupByProgram(visible);

  useEffect(() => {
    if (!focusTeamId) return undefined;
    const card = document.getElementById(`team-${focusTeamId}`);
    if (!card) return undefined;
    card.scrollIntoView({ block: "start", behavior: "smooth" });
    // Deferred so the ring isn't a synchronous setState inside the effect body.
    const on = setTimeout(() => setHighlighted(focusTeamId), 0);
    const off = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [focusTeamId]);

  const programQuery = programId === ALL_PROGRAMS ? "" : `&program=${encodeURIComponent(programId)}`;
  const pickSprint = (sprintId) =>
    startSwitch(() => router.push(`/oncall?sprint=${encodeURIComponent(sprintId)}${programQuery}`));

  // Instant, client-side: keep the URL shareable without a server round-trip.
  const pickProgram = (nextId) => {
    setProgramId(nextId);
    const params = new URLSearchParams(window.location.search);
    if (nextId === ALL_PROGRAMS) params.delete("program");
    else params.set("program", nextId);
    params.delete("team");
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  };

  return (
    <main className="flex w-full flex-1 flex-col gap-5 p-4 md:p-6">
      <HeroShell className="flex flex-col gap-5 px-5 py-6 md:px-8 md:py-7 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <div className="min-w-0">
          <HeroEyebrow>Support on-call</HeroEyebrow>
          <HeroTitle>{sprint?.name ?? "No rotation yet"}</HeroTitle>
          <HeroCopy className="mt-2">
            {sprint ? (
              <>
                {formatRotationWindow(sprint)}
                {data.isCurrentRotation && <span className="font-semibold text-on-hero"> · on duty now</span>}
                {!data.sprintOpen && <span className="font-semibold text-on-hero"> · closed, read-only</span>}
              </>
            ) : (
              "Who to call for each team's production issues, rotation by rotation."
            )}
          </HeroCopy>
        </div>

        {sprint && (
          <div className="grid w-full shrink-0 gap-2 sm:grid-cols-2 xl:w-[36rem]">
            <div className={cn("min-w-0", !showProgramPicker && "sm:col-span-2")}>
              <Select
                variant="onDark"
                aria-label="Rotation (sprint)"
                value={sprint.id}
                disabled={switching}
                onChange={(event) => pickSprint(event.target.value)}
              >
                {data.sprints.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.state.toLowerCase()})
                  </option>
                ))}
              </Select>
            </div>
            {showProgramPicker && (
              <div className="min-w-0">
                <Select
                  variant="onDark"
                  aria-label="Program"
                  value={programId}
                  onChange={(event) => pickProgram(event.target.value)}
                >
                  <option value={ALL_PROGRAMS}>All programs</option>
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.key} · {program.name}
                    </option>
                  ))}
                  {hasUnassigned && <option value={NO_PROGRAM}>No program</option>}
                </Select>
              </div>
            )}
            <div className="relative min-w-0 sm:col-span-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/75 modern:text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                aria-label="Search teams, modules or people"
                placeholder="Team, module or person"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="border-white/15 bg-white/10 pl-9 text-white backdrop-blur-sm placeholder:text-white/55 focus-visible:border-white/40 focus-visible:ring-white/25 modern:border-input modern:bg-card modern:text-foreground modern:backdrop-blur-none modern:placeholder:text-muted-foreground modern:focus-visible:border-ring modern:focus-visible:ring-ring/50"
              />
            </div>
          </div>
        )}
      </HeroShell>

      {!sprint ? (
        <EmptyState
          title="No rotation yet"
          body="Rotations follow each release's dev cycle. Once an admin creates a sprint whose dev cycle has started, its Support POCs show up here."
        />
      ) : groups.length === 0 ? (
        needle ? (
          <EmptyState title="No matches" body={`No team, module or person matches “${query.trim()}”.`} />
        ) : (
          <EmptyState title="No teams in this program" body="Pick another program, or All programs." />
        )
      ) : (
        <>
          {needle && programId !== ALL_PROGRAMS && (
            <p className="-mt-1 text-xs text-muted-foreground">Search covers every program.</p>
          )}
          {groups.map((group) => (
            <section key={group.id} aria-labelledby={`program-${group.id}`} className="flex flex-col gap-3">
              <h2
                id={`program-${group.id}`}
                className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-muted-foreground uppercase"
              >
                <Layers className={cn("size-3.5", group.id !== NO_PROGRAM && "text-primary")} aria-hidden="true" />
                {group.name}
                <span className="font-medium tracking-normal normal-case tabular-nums">
                  · {group.teams.length} {group.teams.length === 1 ? "team" : "teams"}
                </span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {group.teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    sprint={sprint}
                    highlighted={highlighted === team.id}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {editing && (
        <OnCallEditDialog
          team={editing}
          sprint={sprint}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            showToast(message);
          }}
        />
      )}
      <Toast toast={toast} />
      <PageLoader show={switching} label="Loading rotation…" />
    </main>
  );
}
