"use client";

/**
 * The issue funnel (sow-tracker.md round 2): where issues are being found as the SOW moves from
 * pre-QA testing (the Slack channel) to internal QA to customer UAT — open and fixed at each
 * stage — over a bars-per-day strip of issues raised and closed. Each stage opens its list.
 * Slack carries no time for a fix, so the "closed" bars count Jira bugs only (said in the legend).
 */
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/sow/timeline.mjs";

const BAR_AREA = 56;

function Stage({ stage, last, onOpen }) {
  const idle = stage.total === 0;
  return (
    <li className="flex min-w-0 flex-1 items-stretch">
      <button
        type="button"
        onClick={() => onOpen(stage.key)}
        title={stage.hint}
        className="group flex min-w-0 flex-1 flex-col rounded-lg border bg-card px-3 py-2.5 text-left outline-none transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{stage.label}</span>
        <span className="mt-1 flex items-baseline gap-1.5">
          <span className={cn("font-display text-2xl leading-none font-extrabold tabular-nums", stage.open > 0 ? "text-danger-strong" : "text-foreground")}>{stage.open}</span>
          <span className="text-xs font-semibold text-secondary-foreground">open</span>
        </span>
        <span className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className="bg-success" style={{ width: `${stage.total > 0 ? (stage.fixed / stage.total) * 100 : 0}%` }} />
        </span>
        <span className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {stage.key === "SLACK" && !stage.tracked ? "No Slack channel set" : idle ? "None raised yet" : `${stage.fixed} fixed of ${stage.total}`}
          {stage.fresh > 0 && <span className="font-semibold text-warn-strong"> · {stage.fresh} not yet acknowledged</span>}
        </span>
      </button>
      {!last && <ChevronRight className="mx-0.5 hidden size-4 shrink-0 self-center text-muted-foreground sm:block" aria-hidden="true" />}
    </li>
  );
}

function FlowStrip({ flow }) {
  const peak = Math.max(1, ...flow.map((day) => Math.max(day.raised, day.closed)));
  const height = (count) => (count === 0 ? 0 : Math.max(3, (count / peak) * BAR_AREA));
  const raised = flow.reduce((sum, day) => sum + day.raised, 0);
  const closed = flow.reduce((sum, day) => sum + day.closed, 0);
  return (
    <div className="mt-4">
      <div className="flex items-end gap-0.5 border-b" style={{ height: BAR_AREA + 4 }}>
        {flow.map((day) => (
          <div key={day.day} className="group relative flex min-w-0 flex-1 items-end justify-center gap-0.5" style={{ height: BAR_AREA }}>
            <span className="w-full max-w-2.5 rounded-t-[3px] bg-danger" style={{ height: height(day.raised) }} />
            <span className="w-full max-w-2.5 rounded-t-[3px] bg-muted-foreground/60" style={{ height: height(day.closed) }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-[11px] whitespace-nowrap shadow-md group-hover:block">
              <span className="font-semibold">{formatDay(day.day)}</span> · {day.raised} raised · {day.closed} closed
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{formatDay(flow[0].day)}</span>
        <span>{formatDay(flow.at(-1).day)}</span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-danger" />Raised per day <span className="font-semibold text-foreground tabular-nums">{raised}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-muted-foreground/60" />Closed per day (Jira bugs) <span className="font-semibold text-foreground tabular-nums">{closed}</span></span>
      </p>
    </div>
  );
}

export function IssueFunnel({ view, onOpenStage }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol className="flex flex-col gap-2 sm:flex-row sm:gap-0">
        {view.funnel.map((stage, index) => (
          <Stage key={stage.key} stage={stage} last={index === view.funnel.length - 1} onOpen={onOpenStage} />
        ))}
      </ol>
      {view.flow.length > 0 ? <FlowStrip flow={view.flow} /> : <p className="mt-4 text-xs text-muted-foreground">No issues raised yet, so there is nothing to chart.</p>}
    </div>
  );
}
