"use client";

/**
 * One SOW's page (sow-tracker.md round 2, decision 1): a visual overview that fits a screen —
 * header strip, date-scaled timeline, progress vs plan, the scope map, the issue funnel, people
 * load and a risks / dependencies / docs rail — with a drill-in panel behind every tile for the
 * granular rows. The server hands over one serializable view (lib/sow/data.js); this component
 * holds only which panel and which dialog are open. The open panel is kept in `?panel=` so a
 * drill-in can be linked to.
 *
 * `readOnly` is the public share page: same picture, no actions and no Slack text.
 */
import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ArrowLeft, BookOpen, Bug, Gavel, CalendarRange, ChevronRight, Download, GitBranch, Grid3x3, Link2, ListChecks, MessageSquare, RefreshCw, Settings2, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/spinner";
import { Toast, useToast } from "@/components/ui/toast";
import { Panel } from "@/components/bugs/panel";
import { AlertDialog } from "@/components/dashboard/alert-dialog";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { resolvePanel } from "./drawer-bodies";
import { IssueFunnel } from "./issue-funnel";
import { PeopleLoad } from "./people-load";
import { PlanDialog, planBody } from "./plan-dialog";
import { ProgressChart } from "./progress-chart";
import { RisksDialog } from "./risks-dialog";
import { ScopeMap } from "./scope-map";
import { SowDrawer } from "./sow-drawer";
import { SowExportDialog } from "./sow-export";
import { SowFormDialog } from "./sow-form-dialog";
import { SowHero } from "./sow-hero";
import { relativeTime } from "./sow-kit";
import { formatDay } from "@/lib/sow/timeline.mjs";
import { SowShareDialog } from "./sow-share-dialog";
import { TimelineChart } from "./timeline-chart";

const SLACK_POLL_MS = 3000;

function Notice({ tone = "danger", title, children }) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3", tone === "danger" ? "border-danger/30 bg-danger-soft text-danger-strong" : "border-dashed bg-card text-muted-foreground")}>
      {tone === "danger" && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <div className="text-sm">
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? "mt-0.5 text-xs opacity-80" : undefined}>{children}</p>
      </div>
    </div>
  );
}

/** One row of the right-hand rail: a count, a label, and it opens a panel. */
function RailRow({ icon: Icon, label, value, sub, tone, onClick }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", tone ?? "bg-muted text-secondary-foreground")}><Icon className="size-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>
        </span>
        <span className="font-display text-xl font-extrabold tabular-nums">{value}</span>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Admin "Sync Slack": queues the read on the admin's own connector and polls until it lands. */
function useSlackSync(sowId, onDone, onFail) {
  const [state, setState] = useState(null); // null | { status, progressNote }
  const syncing = Boolean(state);

  useEffect(() => {
    if (!syncing) return undefined;
    let live = true;
    const tick = async () => {
      try {
        const next = await apiFetch(`/api/sows/${sowId}/slack-sync`);
        if (!live) return;
        if (next.status === "QUEUED" || next.status === "RUNNING") {
          setState(next);
          return;
        }
        setState(null);
        if (next.status === "SUCCEEDED") onDone(next.progressNote ?? "Slack read");
        // Some channels may have been read before one failed; show what landed, then the error.
        else onFail(new Error(next.error ?? "The Slack sync did not finish"), next.progressNote);
      } catch (caught) {
        if (!live) return;
        setState(null);
        onFail(caught);
      }
    };
    const timer = setInterval(tick, SLACK_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [syncing, sowId, onDone, onFail]);

  const start = async () => {
    try {
      await apiFetch(`/api/sows/${sowId}/slack-sync`, { method: "POST" });
      setState({ status: "QUEUED" });
    } catch (caught) {
      onFail(caught);
    }
  };
  return { state, start };
}

export function SowPage({ view, canEdit = false, readOnly = false, programs = [], initialPanel = null }) {
  const router = useRouter();
  const [panel, setPanelState] = useState(initialPanel);
  const [dialog, setDialog] = useState(null);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, showToast] = useToast();
  const working = busy || pending;
  const admin = canEdit && !readOnly;

  const setPanel = useCallback((next) => {
    setPanelState(next);
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("panel", next);
    else params.delete("panel");
    const search = params.toString();
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname);
  }, []);
  const open = {
    phase: (id) => setPanel(`phase:${id}`),
    epic: (key) => setPanel(`epic:${key}`),
    ticket: (key) => setPanel(`ticket:${key}`),
    stage: (key) => setPanel(`stage:${key}`),
    person: (name) => setPanel(`person:${name}`),
  };

  const fail = useCallback((title) => (caught) => setAlert({ title, body: caught.message, tone: "error", error: caught }), []);
  const run = async (work, failTitle) => {
    setBusy(true);
    try {
      const message = await work();
      startTransition(() => {
        router.refresh();
        showToast(message);
      });
    } catch (caught) {
      fail(failTitle)(caught);
    } finally {
      setBusy(false);
    }
  };

  const refresh = () =>
    run(async () => {
      const result = await apiFetch(`/api/sows/${view.sow.id}/refresh`, { method: "POST" });
      return `Refreshed — ${result.issues} tickets from Jira`;
    }, "Refresh failed");

  // The whole plan is one replace-all PUT, so an in-place status change sends it all (plan-dialog).
  const changeStatus = (itemId, status) =>
    run(async () => {
      const phases = view.phases.map((phase) => ({ ...phase, items: phase.items.map((item) => (item.id === itemId ? { ...item, status } : item)) }));
      await apiFetch(`/api/sows/${view.sow.id}/plan`, { method: "PUT", body: planBody(phases) });
      return "Status updated";
    }, "Could not update the status");

  const slackDone = useCallback(
    (note) => {
      router.refresh();
      showToast(`Slack synced — ${note}`);
    },
    [router, showToast],
  );
  const slackFail = useCallback(
    (caught, partial) => {
      if (partial) router.refresh();
      fail(partial ? "Some Slack channels could not be read" : "Slack sync could not run")(caught);
    },
    [fail, router],
  );
  const slack = useSlackSync(view.sow.id, slackDone, slackFail);

  const closeWith = (message) => {
    setDialog(null);
    if (message) showToast(message);
  };

  const content = resolvePanel(view, panel, { canEdit: admin, busy: working, onStatusChange: changeStatus, open, onEditRisks: () => setDialog("risks") });
  const openRisks = view.risks.filter((risk) => risk.status === "OPEN");
  const decisions = (view.feed?.decisions ?? []).filter((item) => !item.hidden);
  const slackDocs = (view.feed?.docs ?? []).filter((item) => !item.hidden);
  const blockers = openRisks.filter((risk) => risk.type === "BLOCKER").length;
  const deps = view.issues.filter((issue) => issue.isDependency);
  const openDeps = deps.filter((issue) => issue.state !== "done").length;
  const gap = view.chart.gap === null ? null : Math.round(view.chart.gap);

  return (
    <main className="flex w-full min-w-0 flex-1 flex-col gap-4 p-4 *:min-w-0 md:p-6">
      <SowHero view={view} eyebrow={readOnly ? "SOW · shared view" : "SOW tracker"}>
        {!readOnly && (
          <>
            {canEdit && (
              <Button variant="onDark" size="sm" onClick={refresh} disabled={working}>
                <RefreshCw className={busy ? "animate-spin" : undefined} aria-hidden="true" />
                Refresh Jira
              </Button>
            )}
            {canEdit && view.slack.hasChannels && (
              <Button variant="onDark" size="sm" onClick={slack.start} disabled={working || Boolean(slack.state)} title="Reads the pre-QA Slack channel with your own Claude Connector">
                <MessageSquare className={slack.state ? "animate-pulse" : undefined} aria-hidden="true" />
                {slack.state ? (slack.state.progressNote ?? "Reading Slack…") : "Sync Slack"}
              </Button>
            )}
            <Button variant="onDark" size="sm" onClick={() => setDialog("export")} disabled={working}>
              <Download aria-hidden="true" />
              Export
            </Button>
            {canEdit && (
              <>
                <Button variant="onDark" size="sm" onClick={() => setDialog("share")} disabled={working}><Link2 aria-hidden="true" />Share</Button>
                <Button variant="onDark" size="sm" onClick={() => setDialog("plan")} disabled={working}><ListChecks aria-hidden="true" />Edit plan</Button>
                <Button variant="onDark" size="sm" onClick={() => setDialog("settings")} disabled={working}><Settings2 aria-hidden="true" />Settings</Button>
              </>
            )}
          </>
        )}
      </SowHero>

      {view.meta.lastRefreshError && <Notice title="Last Jira refresh failed — showing the last good data">{view.meta.lastRefreshError}</Notice>}
      {admin && view.slack.syncError && <Notice title="Last Slack sync failed — showing the last good read">{view.slack.syncError}</Notice>}
      {!view.hasData && <Notice tone="quiet">No Jira tickets mirrored yet. {canEdit ? "Use Refresh Jira to pull this SOW's filter now." : "They arrive with the nightly refresh."}</Notice>}

      <Panel icon={CalendarRange} tone="brand" title="Timeline" subtitle="Phases on real dates. Diamonds are gate milestones; a hollow diamond is where a gate was first planned. Select a phase for its plan and tickets.">
        <TimelineChart timeline={view.timeline} phases={view.phases} today={view.today} onOpenPhase={open.phase} />
      </Panel>

      <div className="grid gap-4 *:min-w-0 xl:grid-cols-12">
        <Panel
          className="xl:col-span-5"
          icon={Activity}
          tone={gap !== null && gap < -10 ? "danger" : "brand"}
          title="Progress vs plan"
          subtitle="Weighted progress by day against a straight-line plan."
          aside={gap !== null && <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold tabular-nums", gap < -10 ? "bg-danger-soft text-danger-strong" : gap < 0 ? "bg-warn-soft text-warn-strong" : "bg-success-soft text-success-strong")}>{gap >= 0 ? `${gap} pts ahead` : `${Math.abs(gap)} pts behind`}</span>}
        >
          <ProgressChart chart={view.chart} axis={view.axis} today={view.today} window={view.chart.window} />
        </Panel>
        <Panel className="xl:col-span-7" icon={Grid3x3} tone="brand" title="Scope map" subtitle="One square per planned ticket, grouped by epic. Select a square for the ticket, or an epic for its list.">
          <ScopeMap view={view} onOpenEpic={open.epic} onOpenTicket={open.ticket} onOpenLoose={() => setPanel("loose")} />
        </Panel>
      </div>

      <div className="grid gap-4 *:min-w-0 xl:grid-cols-12">
        <Panel
          className="xl:col-span-6"
          icon={Bug}
          tone={view.funnel.some((stage) => stage.open > 0) ? "danger" : "neutral"}
          title="Issues"
          subtitle={view.slack.tracked ? `Found before QA, in QA and in UAT. Slack read ${relativeTime(view.slack.lastSyncedAt, new Date(view.asOf).getTime())}.` : "Found before QA, in QA and in UAT."}
        >
          <IssueFunnel view={view} onOpenStage={open.stage} />
        </Panel>
        {!readOnly && (
          <Panel className="xl:col-span-3" icon={Users} title="People" subtitle="Open work per person.">
            <PeopleLoad people={view.people} onOpenPerson={open.person} />
          </Panel>
        )}
        <Panel className={readOnly ? "xl:col-span-6" : "xl:col-span-3"} icon={ShieldAlert} tone={blockers > 0 ? "danger" : "neutral"} title="Watch list" subtitle="Risks, dependencies, decisions and reading.">
          <ul className="-mx-2 flex flex-col">
            <RailRow icon={ShieldAlert} label="Risks & blockers" value={openRisks.length} sub={blockers > 0 ? `${blockers} open ${blockers === 1 ? "blocker" : "blockers"}` : `${view.risks.length} recorded`} tone={blockers > 0 ? "bg-danger-soft text-danger-strong" : openRisks.length > 0 ? "bg-warn-soft text-warn-strong" : undefined} onClick={() => setPanel("risks")} />
            <RailRow icon={GitBranch} label="Dependencies" value={openDeps} sub={deps.length ? `open of ${deps.length} with other teams` : "none with other teams"} tone={openDeps > 0 ? "bg-info-soft text-info-strong" : undefined} onClick={() => setPanel("deps")} />
            {!readOnly && view.feed && (view.feed.channels.length > 0 || decisions.length > 0) && (
              <RailRow
                icon={Gavel}
                label="Decisions"
                value={decisions.length}
                sub={decisions[0] ? `Latest ${formatDay(decisions[0].postedDay)} · ${decisions[0].title}` : "None read from Slack yet"}
                tone="bg-muted text-foreground"
                onClick={() => setPanel("decisions")}
              />
            )}
            {!readOnly && <RailRow icon={BookOpen} label="Docs & references" value={view.sow.references.length + slackDocs.length} sub={slackDocs.length ? `${view.sow.references.length} curated · ${slackDocs.length} shared in Slack` : "Design, APIs, test reports, repos"} tone="bg-accent text-accent-foreground" onClick={() => setPanel("docs")} />}
          </ul>
        </Panel>
      </div>

      {!readOnly && (
        <p className="border-t pt-4 text-xs">
          <Link href="/sow" className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> All SOWs
          </Link>
        </p>
      )}

      <SowDrawer open={Boolean(content)} eyebrow={content?.eyebrow} title={content?.title} subtitle={content?.subtitle} footer={content?.footer} onClose={() => setPanel(null)}>
        {content?.body}
      </SowDrawer>

      {dialog === "plan" && <PlanDialog view={view} onClose={() => setDialog(null)} onSaved={closeWith} />}
      {dialog === "risks" && <RisksDialog view={view} onClose={() => setDialog(null)} onSaved={closeWith} />}
      {dialog === "share" && <SowShareDialog sow={view.sow} onClose={() => setDialog(null)} showToast={showToast} />}
      {dialog === "export" && <SowExportDialog view={view} onClose={() => setDialog(null)} />}
      {dialog === "settings" && <SowFormDialog mode="edit" sow={view.sow} programs={programs} onClose={() => setDialog(null)} onSaved={(_saved, message) => closeWith(message)} />}
      <PageLoader show={busy} label="Working…" />
      <AlertDialog alert={alert} onClose={() => setAlert(null)} />
      <Toast toast={toast} />
    </main>
  );
}
