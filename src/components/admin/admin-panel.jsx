"use client";

/**
 * Admin provisioning forms (§16: admin creates teams and assigns members/roles; users must have
 * signed in with Jira once before they can be added). Every mutation hits a step-4 route, then
 * router.refresh() re-reads the server data.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarRange, Layers, Target, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PageLoader } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import {
  HeroCopy,
  HeroEyebrow,
  HeroShell,
  HeroTitle,
} from "@/components/ui/hero-shell";
import { apiFetch } from "@/lib/api-client";
import { BugReportConfig } from "@/components/admin/bug-report-config";
import { JiraComponentsConfig } from "@/components/admin/jira-components-config";
import { ProgramsConfig } from "@/components/admin/programs-config";
import { RecentErrors } from "@/components/admin/recent-errors";
import { SprintCapacityConfig } from "@/components/admin/sprint-capacity-config";
import { TeamConfigDialog } from "@/components/admin/team-config-dialog";
import { SprintConfigDialog } from "@/components/dashboard/sprint-config-dialog";
import { formatSprintWindow } from "@/lib/metrics.mjs";
import { cn } from "@/lib/utils";

const ROLES = ["ADMIN", "ED", "TPM", "EM", "LEAD", "MEMBER", "VIEWER"];
const SPRINT_STATE_TONE = { PLANNING: "neutral", ACTIVE: "success", CLOSED: "warn" };

const toneTile = {
  brand: "bg-accent text-accent-foreground",
  info: "bg-info-soft text-info-strong",
  warn: "bg-warn-soft text-warn-strong",
  neutral: "bg-muted text-secondary-foreground",
};

/**
 * Section shell for the admin surface. Carries the same icon-tile + display heading treatment as
 * every other panel in the app — admin previously used a bare `text-base font-semibold` heading
 * and no icon, which is why it read like scaffolding next to `/` and `/bugs`.
 */
function SectionCard({ title, subtitle, icon: Icon, tone = "neutral", count, children }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn("grid size-7 shrink-0 place-items-center rounded-md", toneTile[tone])}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base leading-tight font-bold">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {count !== undefined && (
          <span className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground tabular-nums">
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

/** Quiet in-section empty state — a form with nothing above it reads as a broken list. */
function SectionEmpty({ children }) {
  return (
    <p className="rounded-lg border border-dashed px-4 py-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function TeamCard({ team, run, busy, onEdit }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const addMember = (event) => {
    event.preventDefault();
    run(`Add ${email} to ${team.key}`, async () => {
      await apiFetch(`/api/teams/${team.id}/members`, { method: "POST", body: { email, role } });
      setEmail("");
    });
  };

  return (
    // A row in the teams list, not a card inside a card — one border around the list reads as a
    // list; a border per team stacks three levels of rounded box on this page.
    <article className="p-4 transition-colors hover:bg-muted/25">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <strong className="truncate text-sm">{team.name}</strong>
          <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
            {team.key}
          </span>
          {team.program ? (
            <Badge tone="brand">
              <Layers className="size-3" aria-hidden="true" />
              {team.program.name}
            </Badge>
          ) : (
            <Badge tone="neutral" className="font-normal">
              No program
            </Badge>
          )}
          <Badge tone={(team.subComponents?.length ?? 0) > 0 ? "neutral" : "warn"}>
            {team.subComponents?.length ?? 0} sub-component
            {(team.subComponents?.length ?? 0) === 1 ? "" : "s"}
          </Badge>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onEdit(team)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger-strong hover:bg-danger-soft hover:text-danger-strong"
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {confirmingDelete && (
        <Dialog
          open
          title={`Delete team ${team.key}?`}
          description="This cannot be undone."
          tone="error"
          size="sm"
          onClose={() => setConfirmingDelete(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmingDelete(false);
                  run(`Delete ${team.key}`, () => apiFetch(`/api/teams/${team.id}`, { method: "DELETE" }));
                }}
              >
                Delete team
              </Button>
            </>
          }
        >
          <p className="text-sm leading-relaxed">
            Deleting <strong>{team.name}</strong> also removes its filters, cached issues,
            memberships, and all stage progress.
          </p>
        </Dialog>
      )}

      <ul className="mt-3 flex flex-col gap-1.5">
        {team.memberships.length === 0 && (
          <li className="text-xs text-muted-foreground">No members yet.</li>
        )}
        {team.memberships.map((membership) => (
          <li key={membership.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">
              {membership.user.displayName}{" "}
              <span className="text-xs text-muted-foreground">· {membership.user.email}</span>
            </span>
            <Select
              className="h-7 text-xs"
              value={membership.role}
              disabled={busy}
              onChange={(event) =>
                run(`Change ${membership.user.email} role`, () =>
                  apiFetch(`/api/teams/${team.id}/members/${membership.userId}`, {
                    method: "PATCH",
                    body: { role: event.target.value },
                  }),
                )
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger-strong"
              disabled={busy}
              aria-label={`Remove ${membership.user.email}`}
              onClick={() =>
                run(`Remove ${membership.user.email}`, () =>
                  apiFetch(`/api/teams/${team.id}/members/${membership.userId}`, { method: "DELETE" }),
                )
              }
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <form className="mt-3 flex gap-2" onSubmit={addMember}>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@tekion.com (must have signed in once)"
          required
          disabled={busy}
          className="h-8 text-xs"
        />
        <Select className="h-8 text-xs" value={role} onChange={(e) => setRole(e.target.value)} disabled={busy}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Button type="submit" size="sm" variant="secondary" disabled={busy}>
          Add
        </Button>
      </form>
    </article>
  );
}

export function AdminPanel({
  teams,
  programs = [],
  sprints,
  jiraComponents = [],
  capacityRows = [],
  bugReports = [],
  bugConfig = null,
  bugStatusVocabulary = [],
  bugPriorityVocabulary = [],
  recentErrors = [],
}) {
  const router = useRouter();
  // busy spans the API call AND the router.refresh() re-render, so forms stay disabled until
  // the lists actually reflect the change (React 19 transition; post-await updates re-wrapped).
  const [busy, startRun] = useTransition();
  const [error, setError] = useState(null); // failures persist; successes toast
  const [toast, showToast] = useToast();
  const [teamDialog, setTeamDialog] = useState(null); // { mode: "create" } | { mode: "edit", team }
  const [editingSprint, setEditingSprint] = useState(null); // Sprint row being edited, or null
  const [sprintForm, setSprintForm] = useState({
    name: "",
    start: "",
    end: "",
    release: "",
    fixVersions: "",
  });

  /**
   * Run a mutation. Success is a toast (the app's own non-blocking feedback, ui-polish decision 5)
   * rather than a banner at the top of a long page that has usually scrolled out of view by the
   * time it appears; failures stay pinned inline because they need acting on.
   */
  const run = (label, fn) => {
    setError(null);
    startRun(async () => {
      try {
        await fn();
        // The toast fires together with the refreshed lists, not before them.
        startRun(() => {
          router.refresh();
          showToast(`${label} — done`);
        });
      } catch (caught) {
        setError(`${label} — ${caught.message}`);
      }
    });
  };

  const activeSprint = sprints.find((sprint) => sprint.state === "ACTIVE");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 md:p-6">
      <HeroShell className="flex flex-wrap items-start justify-between gap-4 px-5 py-6 md:px-8 md:py-7">
        <div className="min-w-0">
          <HeroEyebrow>Administration</HeroEyebrow>
          <HeroTitle>Workspace configuration</HeroTitle>
          <HeroCopy className="mt-2">
            Teams and membership, the shared sprint (Gate) calendar, and the bug-report dashboards.
          </HeroCopy>
          {/* The counts that tell an admin whether the workspace is actually provisioned. */}
          <ul className="mt-3 flex flex-wrap items-center gap-2">
            {[
              { label: "team", value: teams.length },
              { label: "program", value: programs.length },
              { label: "sprint", value: sprints.length },
              { label: "bug report", value: bugReports.length },
            ].map(({ label, value }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] whitespace-nowrap text-white/65 backdrop-blur-sm"
              >
                <span className="font-bold text-white tabular-nums">{value}</span>
                {value === 1 ? label : `${label}s`}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] whitespace-nowrap text-white/65 backdrop-blur-sm">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  activeSprint ? "bg-on-ink-success" : "bg-on-ink-danger",
                )}
                aria-hidden="true"
              />
              {activeSprint ? `${activeSprint.name} active` : "No active sprint"}
            </li>
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <Button variant="onDark" size="sm" className="lg:hidden" asChild>
            <Link href="/">← Back to dashboard</Link>
          </Button>
        </div>
      </HeroShell>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm font-medium text-danger-strong"
        >
          {error}
        </p>
      )}

      <SectionCard
        title="Teams"
        subtitle="A scrum team owns its filters, progress, memberships, and claimed Jira sub-components."
        icon={Users}
        tone="brand"
        count={teams.length}
      >
        <div className="flex flex-col gap-4">
          {teams.length === 0 ? (
            <SectionEmpty>
              No teams yet. Create the first one below — members can only be added after they have
              signed in with Jira once.
            </SectionEmpty>
          ) : (
            <div className="divide-y overflow-hidden rounded-lg border">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  run={run}
                  busy={busy}
                  onEdit={(t) => setTeamDialog({ mode: "edit", team: t })}
                />
              ))}
            </div>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => setTeamDialog({ mode: "create" })}
          >
            + New team
          </Button>
        </div>
      </SectionCard>

      <ProgramsConfig programs={programs} />

      <JiraComponentsConfig components={jiraComponents} />

      {teamDialog && (
        <TeamConfigDialog
          mode={teamDialog.mode}
          team={teamDialog.team}
          programs={programs}
          jiraComponents={jiraComponents}
          onClose={() => setTeamDialog(null)}
        />
      )}

      <SectionCard
        title="Sprints (Gates)"
        subtitle="Global — one shared cadence for all teams. Close a sprint instead of deleting it."
        icon={CalendarRange}
        tone="info"
        count={sprints.length}
      >
        {sprints.length === 0 ? (
          <SectionEmpty>
            No sprints yet. Create the first Gate below — every filter and all progress is scoped to
            one.
          </SectionEmpty>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border">
            {sprints.map((sprint) => (
              <li
                key={sprint.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5 text-sm transition-colors hover:bg-muted/25"
              >
                {/* Wraps to two lines rather than forcing the row wider than the card: the window
                    string is long and was `whitespace-nowrap` inside a flex-1 track. */}
                <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                  <strong className="truncate">{sprint.name}</strong>
                  <span className="truncate text-xs text-muted-foreground">
                    {formatSprintWindow(sprint)}
                  </span>
                </span>
                <Badge tone={SPRINT_STATE_TONE[sprint.state]}>{sprint.state}</Badge>
                <Select
                  className="h-7 w-28 text-xs"
                  value={sprint.state}
                  disabled={busy}
                  aria-label={`State for ${sprint.name}`}
                  onChange={(event) =>
                    run(`Set ${sprint.name} → ${event.target.value}`, () =>
                      apiFetch(`/api/sprints/${sprint.id}`, {
                        method: "PATCH",
                        body: { state: event.target.value },
                      }),
                    )
                  }
                >
                  <option value="PLANNING">PLANNING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CLOSED">CLOSED</option>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setEditingSprint(sprint)}
                >
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(`Create sprint ${sprintForm.name}`, async () => {
              await apiFetch("/api/sprints", {
                method: "POST",
                body: {
                  name: sprintForm.name,
                  developmentStart: sprintForm.start,
                  developmentEnd: sprintForm.end,
                  releaseDate: sprintForm.release || null,
                  fixVersions: sprintForm.fixVersions
                    .split(/[,\n]/)
                    .map((v) => v.trim())
                    .filter(Boolean),
                },
              });
              setSprintForm({ name: "", start: "", end: "", release: "", fixVersions: "" });
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-sprint-name">Name</Label>
              <Input
                id="admin-sprint-name"
                value={sprintForm.name}
                onChange={(event) => setSprintForm((f) => ({ ...f, name: event.target.value }))}
                placeholder="July 2026 Release"
                required
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-sprint-start">Development start</Label>
              <Input
                id="admin-sprint-start"
                type="date"
                value={sprintForm.start}
                onChange={(event) => setSprintForm((f) => ({ ...f, start: event.target.value }))}
                required
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-sprint-end">Development end</Label>
              <Input
                id="admin-sprint-end"
                type="date"
                value={sprintForm.end}
                onChange={(event) => setSprintForm((f) => ({ ...f, end: event.target.value }))}
                required
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-sprint-release">Release date (optional)</Label>
              <Input
                id="admin-sprint-release"
                type="date"
                value={sprintForm.release}
                onChange={(event) => setSprintForm((f) => ({ ...f, release: event.target.value }))}
                disabled={busy}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-60 flex-1 flex-col gap-1.5">
              <Label htmlFor="admin-sprint-fix-versions">Fix version(s)</Label>
              <Input
                id="admin-sprint-fix-versions"
                value={sprintForm.fixVersions}
                onChange={(event) =>
                  setSprintForm((f) => ({ ...f, fixVersions: event.target.value }))
                }
                placeholder="Release-2026.07.1.0, Release-2026.07.1.1"
                disabled={busy}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Create sprint
            </Button>
          </div>
        </form>
      </SectionCard>

      {editingSprint && (
        <SprintConfigDialog
          mode="edit"
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onSaved={() => setEditingSprint(null)}
        />
      )}

      <SectionCard
        title="Committed Capacity"
        subtitle="The Committed (Roadmap) point target per team, per sprint — compared against actual committed points on the dashboard."
        icon={Target}
        tone="warn"
      >
        <SprintCapacityConfig
          teams={teams}
          sprints={sprints}
          capacityRows={capacityRows}
          run={run}
          busy={busy}
        />
      </SectionCard>

      <SectionCard
        title="Recent errors"
        subtitle="Server-side failures (HTTP 5xx) recorded over the last 14 days. The reference shown to a user in an error dialog is the requestId here."
        icon={AlertTriangle}
        tone="warn"
        count={recentErrors.length}
      >
        <RecentErrors errors={recentErrors} />
      </SectionCard>

      <BugReportConfig
        reports={bugReports}
        config={bugConfig}
        statusVocabulary={bugStatusVocabulary}
        priorityVocabulary={bugPriorityVocabulary}
      />

      <PageLoader show={busy} label="Working…" />
      <Toast toast={toast} />
    </main>
  );
}
