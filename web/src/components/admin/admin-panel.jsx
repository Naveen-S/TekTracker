"use client";

/**
 * Admin provisioning forms (§16: admin creates teams and assigns members/roles; users must have
 * signed in with Jira once before they can be added). Every mutation hits a step-4 route, then
 * router.refresh() re-reads the server data.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ActivityPill } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api-client";
import { formatDate } from "@/lib/metrics.mjs";

const ROLES = ["ADMIN", "ED", "TPM", "EM", "LEAD", "MEMBER", "VIEWER"];
const SPRINT_STATE_TONE = { PLANNING: "neutral", ACTIVE: "success", CLOSED: "warn" };

function SectionCard({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </section>
  );
}

function TeamCard({ team, run, busy }) {
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
    <article className="rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <strong className="text-sm">{team.name}</strong>{" "}
          <span className="font-mono text-xs text-muted-foreground">({team.key})</span>
        </div>
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

      {confirmingDelete && (
        <Dialog
          open
          title={`Delete team ${team.key}?`}
          tone="error"
          onClose={() => setConfirmingDelete(false)}
        >
          <p className="text-sm">
            This removes the team&apos;s filters, cached issues, memberships, and stage progress.
            It cannot be undone.
          </p>
          <div className="mt-4 flex justify-end gap-2">
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
          </div>
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

export function AdminPanel({ teams, sprints }) {
  const router = useRouter();
  // busy spans the API call AND the router.refresh() re-render, so forms stay disabled until
  // the lists actually reflect the change (React 19 transition; post-await updates re-wrapped).
  const [busy, startRun] = useTransition();
  const [status, setStatus] = useState(null); // { ok, text }
  const [teamName, setTeamName] = useState("");
  const [teamKey, setTeamKey] = useState("");
  const [sprintForm, setSprintForm] = useState({ name: "", start: "", end: "", release: "" });

  /** Run a mutation; surface the outcome inline and refresh server data. */
  const run = (label, fn) => {
    setStatus(null);
    startRun(async () => {
      try {
        await fn();
        // "— done" commits together with the refreshed lists, not before them.
        startRun(() => {
          router.refresh();
          setStatus({ ok: true, text: `${label} — done` });
        });
      } catch (error) {
        setStatus({ ok: false, text: `${label} — ${error.message}` });
      }
    });
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 md:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Admin</h1>
          <p className="text-sm text-muted-foreground">Teams, members, and sprint (Gate) configuration</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/">← Back to dashboard</Link>
        </Button>
      </header>

      {status && (
        <p
          className={`rounded-md border px-3 py-2 text-sm font-medium ${status.ok ? "border-success/35 bg-success-soft text-success-strong" : "border-danger/30 bg-danger-soft text-danger-strong"}`}
        >
          {status.text}
        </p>
      )}

      <SectionCard title="Teams" subtitle="A scrum team owns its filters, progress, and memberships.">
        <div className="flex flex-col gap-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} run={run} busy={busy} />
          ))}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              run(`Create team ${teamKey}`, async () => {
                await apiFetch("/api/teams", { method: "POST", body: { name: teamName, key: teamKey } });
                setTeamName("");
                setTeamKey("");
              });
            }}
          >
            <Input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="Team name (e.g. Growth & Monetization)"
              required
              disabled={busy}
            />
            <Input
              value={teamKey}
              onChange={(event) => setTeamKey(event.target.value.toUpperCase())}
              placeholder="KEY"
              required
              disabled={busy}
              className="w-28"
            />
            <Button type="submit" disabled={busy}>
              Create team
            </Button>
          </form>
        </div>
      </SectionCard>

      <SectionCard
        title="Sprints (Gates)"
        subtitle="Global — one shared cadence for all teams. Close a sprint instead of deleting it."
      >
        <ul className="flex flex-col gap-1.5">
          {sprints.map((sprint) => (
            <li key={sprint.id} className="flex items-center gap-3 text-sm">
              <span className="flex-1 truncate">
                <strong>{sprint.name}</strong>{" "}
                <span className="text-xs text-muted-foreground">
                  {formatDate(sprint.developmentStart)} – {formatDate(sprint.developmentEnd)}
                  {sprint.releaseDate ? ` · release ${formatDate(sprint.releaseDate)}` : ""}
                </span>
              </span>
              <Badge tone={SPRINT_STATE_TONE[sprint.state]}>{sprint.state}</Badge>
              <Select
                className="h-7 text-xs"
                value={sprint.state}
                disabled={busy}
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
            </li>
          ))}
        </ul>
        <form
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]"
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
                },
              });
              setSprintForm({ name: "", start: "", end: "", release: "" });
            });
          }}
        >
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
          <Button type="submit" disabled={busy} className="self-end">
            Create sprint
          </Button>
        </form>
      </SectionCard>

      <ActivityPill show={busy} label="Working…" />
    </main>
  );
}
