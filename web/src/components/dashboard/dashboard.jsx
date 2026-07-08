"use client";

/**
 * Dashboard client shell — the port of the prototype's App.jsx wiring onto server data. State
 * here is strictly EPHEMERAL UI (search, density/collapse prefs, open modals, in-flight flags);
 * domain state lives on the server and re-enters through router.refresh() after each mutation
 * (ui-port.md decision 1). Density/collapse are the only localStorage keys (§17, decision 8).
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WORKFLOWS } from "@/lib/workflows.mjs";
import { apiFetch } from "@/lib/api-client";
import { useLocalPref } from "@/lib/use-local-pref";
import { ActivityPill } from "@/components/ui/spinner";
import { TopBar } from "./top-bar";
import { Hero } from "./hero";
import { MetricGrid } from "./metric-grid";
import { FilterPanel } from "./filter-panel";
import { PlannerPanel } from "./planner-panel";
import { AddFilterDialog } from "./add-filter-dialog";
import { SprintConfigDialog } from "./sprint-config-dialog";
import { AlertDialog } from "./alert-dialog";
import { EmptyState } from "./empty-state";

const DENSITY_KEY = "sprintTracker_viewDensity";
const COLLAPSED_KEY = "sprintTracker_filtersPanelCollapsed";

function summarizeSync(summary) {
  const lines = summary.filters.map(
    (f) => `${f.name}: ${f.total} issues (+${f.added} / −${f.removed})`,
  );
  if (summary.progressSeeded > 0) lines.push(`${summary.progressSeeded} checklist(s) seeded from Jira status`);
  return lines.join("\n") || "No filters to sync.";
}

export function Dashboard({
  user,
  teams,
  selectedTeam,
  myRole,
  can,
  sprints,
  selectedSprint,
  filters,
  progressByKey,
  metrics,
  jiraBaseUrl,
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState(null);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [sprintDialogMode, setSprintDialogMode] = useState(null); // null | "create" | "edit"
  const [syncing, setSyncing] = useState(false);
  // busy covers the whole round-trip — the API call AND the router.refresh() re-render — so the
  // UI stays visibly in-flight until the new server data is actually on screen. Post-await
  // updates must be re-wrapped in startMutation to stay inside the transition (React 19).
  const [busy, startMutation] = useTransition();

  // The two ephemeral localStorage prefs (§17, decision 8) — SSR-safe via useSyncExternalStore.
  const [density, setDensity] = useLocalPref(DENSITY_KEY, "dense");
  const [collapsedPref, setCollapsedPref] = useLocalPref(COLLAPSED_KEY, "false");
  const collapsed = collapsedPref === "true";
  const toggleDensity = () => setDensity(density === "dense" ? "relaxed" : "dense");
  const toggleCollapsed = () => setCollapsedPref(String(!collapsed));

  const base =
    selectedTeam && selectedSprint
      ? `/api/teams/${selectedTeam.id}/sprints/${selectedSprint.id}`
      : null;

  const select = (teamId, sprintId) => {
    const params = new URLSearchParams();
    if (teamId) params.set("team", teamId);
    if (sprintId) params.set("sprint", sprintId);
    router.push(`/?${params.toString()}`);
  };

  /** Run a mutation, refresh server data, surface failures in the alert modal. */
  const run = (errorTitle, fn) =>
    startMutation(async () => {
      try {
        await fn();
        startMutation(() => router.refresh());
      } catch (error) {
        setAlert({ title: errorTitle, body: error.message, tone: "error" });
      }
    });

  const handleSync = () => {
    if (!base) return;
    setSyncing(true);
    startMutation(async () => {
      try {
        const summary = await apiFetch(`${base}/sync`, { method: "POST" });
        // Alert lands together with the refreshed matrix, not before it.
        startMutation(() => {
          router.refresh();
          setAlert({ title: "Sync completed", body: summarizeSync(summary), tone: "success" });
        });
      } catch (error) {
        setAlert({ title: "Sync failed", body: error.message, tone: "error" });
      } finally {
        setSyncing(false);
      }
    });
  };

  const handleAddFilter = (payload) =>
    startMutation(async () => {
      try {
        await apiFetch(`${base}/filters`, { method: "POST", body: payload });
      } catch (error) {
        setAlert({ title: "Could not add filter", body: error.message, tone: "error" });
        return;
      }
      setShowAddFilter(false);
      // Prototype parity (decision 6): a new filter loads its issues right away.
      setSyncing(true);
      try {
        const summary = await apiFetch(`${base}/sync`, { method: "POST" });
        startMutation(() => {
          router.refresh();
          setAlert({ title: "Filter added", body: summarizeSync(summary), tone: "success" });
        });
      } catch (error) {
        setAlert({ title: "Filter added — sync failed", body: error.message, tone: "error" });
        startMutation(() => router.refresh());
      } finally {
        setSyncing(false);
      }
    });

  const handleToggleStage = (jiraKey, index, completed) =>
    run("Could not update stage", () =>
      apiFetch(`${base}/progress/${encodeURIComponent(jiraKey)}`, {
        method: "PUT",
        body: { stage: { index, completed } },
      }),
    );

  const handleToggleBlocked = (jiraKey, blocked) =>
    run("Could not update blocked flag", () =>
      apiFetch(`${base}/progress/${encodeURIComponent(jiraKey)}`, {
        method: "PUT",
        body: { blocked },
      }),
    );

  const handleRemoveFilter = (filterId) =>
    run("Could not remove filter", () => apiFetch(`${base}/filters/${filterId}`, { method: "DELETE" }));

  const handleReorderFilters = (fromIndex, toIndex) => {
    const ids = filters.map((filter) => filter.id);
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    return run("Could not reorder filters", () =>
      apiFetch(`${base}/filters/order`, { method: "PUT", body: { filterIds: ids } }),
    );
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  // Search filtering — port of useSprintMetrics.visibleFilters onto the new field names.
  const visibleFilters = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filters;
    return filters.reduce((matches, filter) => {
      const filterMatches = [filter.name, filter.jql, WORKFLOWS[filter.workflowType]?.name].some(
        (value) => String(value || "").toLowerCase().includes(query),
      );
      const matchingIssues = filter.issues.filter((issue) =>
        [issue.jiraKey, issue.title, issue.assigneeName, issue.issueType, issue.jiraStatus].some(
          (value) => String(value || "").toLowerCase().includes(query),
        ),
      );
      if (filterMatches) matches.push(filter);
      else if (matchingIssues.length > 0) matches.push({ ...filter, issues: matchingIssues });
      return matches;
    }, []);
  }, [filters, search]);

  const showWelcome = Boolean(selectedTeam && selectedSprint && filters.length === 0);

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <TopBar
        user={user}
        teams={teams}
        selectedTeam={selectedTeam}
        sprints={sprints}
        selectedSprint={selectedSprint}
        onSelect={select}
        onAddFilter={() => setShowAddFilter(true)}
        onSync={handleSync}
        syncing={syncing}
        busy={busy}
        canWrite={can.write && Boolean(base)}
        canManage={can.manage && Boolean(base)}
        onLogout={handleLogout}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 p-5">
        {!selectedTeam ? (
          <EmptyState
            title="You're not on a team yet"
            body={
              user.isAdmin
                ? "Create a team and add members from the Admin page to get started."
                : "Ask an admin to add you to a scrum team — you'll see its sprint board here."
            }
            actionHref={user.isAdmin ? "/admin" : undefined}
            actionLabel={user.isAdmin ? "Open Admin" : undefined}
          />
        ) : !selectedSprint ? (
          <EmptyState
            title="No sprint configured"
            body={
              can.configureSprint
                ? "Create the first sprint (Gate) — filters and progress are scoped to it."
                : "An admin needs to configure the first sprint (Gate) before tracking can start."
            }
            actionLabel={can.configureSprint ? "Configure Sprint" : undefined}
            onAction={can.configureSprint ? () => setSprintDialogMode("create") : undefined}
          />
        ) : (
          <>
            <Hero
              showWelcome={showWelcome}
              sprint={selectedSprint}
              team={selectedTeam}
              density={density}
              onToggleDensity={toggleDensity}
              onConfigureSprint={can.configureSprint ? () => setSprintDialogMode("edit") : null}
              onAddFilter={can.manage ? () => setShowAddFilter(true) : null}
            />

            {!showWelcome && metrics && (
              <>
                <MetricGrid metrics={metrics} sprint={selectedSprint} />
                <section
                  className={`grid flex-1 items-start gap-5 ${collapsed ? "grid-cols-[56px_1fr]" : "grid-cols-[300px_1fr]"}`}
                >
                  <FilterPanel
                    allFilters={filters}
                    visibleFilters={visibleFilters}
                    metricsIssues={metrics.issues}
                    isCollapsed={collapsed}
                    onToggleCollapse={toggleCollapsed}
                    onAddFilter={can.manage ? () => setShowAddFilter(true) : null}
                    onRemoveFilter={can.manage ? handleRemoveFilter : null}
                    onReorderFilters={can.manage ? handleReorderFilters : null}
                    searchQuery={search}
                    onSearchChange={setSearch}
                  />
                  <PlannerPanel
                    allFilters={filters}
                    visibleFilters={visibleFilters}
                    progressByKey={progressByKey}
                    sprint={selectedSprint}
                    density={density}
                    jiraBaseUrl={jiraBaseUrl}
                    canWrite={can.write}
                    busy={busy}
                    onToggleStage={handleToggleStage}
                    onToggleBlocked={handleToggleBlocked}
                  />
                </section>
              </>
            )}
          </>
        )}
      </main>

      <ActivityPill show={busy || syncing} label={syncing ? "Syncing Jira…" : "Updating…"} />
      <AlertDialog alert={alert} onClose={() => setAlert(null)} />
      {showAddFilter && base && (
        <AddFilterDialog onAdd={handleAddFilter} onClose={() => setShowAddFilter(false)} busy={busy} />
      )}
      {sprintDialogMode && (
        <SprintConfigDialog
          mode={sprintDialogMode}
          sprint={sprintDialogMode === "edit" ? selectedSprint : null}
          selectedTeamId={selectedTeam?.id}
          onClose={() => setSprintDialogMode(null)}
          onSelect={select}
        />
      )}
    </div>
  );
}
