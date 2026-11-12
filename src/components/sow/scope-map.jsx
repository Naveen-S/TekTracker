"use client";

/**
 * The scope map (sow-tracker.md round 2): every planned ticket as one small square under its
 * epic, so the size of the work and its state read at once — and each square is still one real
 * ticket you can open. Four ordered states; each has its own SHAPE as well as its colour (hollow,
 * dot, solid, check), so the map survives a colour-vision deficiency and a greyscale print.
 * A corner mark flags a ticket another team owns.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUG_KINDS } from "@/lib/sow/defaults.mjs";
import { pctLabel } from "./sow-kit";

export const DETAIL_LABELS = { todo: "Not started", inProgress: "In progress", inReview: "In review", done: "Done" };
const ORDER = { done: 0, inReview: 1, inProgress: 2, todo: 3 };
const SQUARE = {
  todo: "border border-border-strong bg-card",
  inProgress: "bg-info/30",
  inReview: "bg-info",
  done: "bg-success",
};

export function StateSquare({ detail, dependency = false, className }) {
  return (
    <span className={cn("relative grid size-3.5 shrink-0 place-items-center rounded-[3px]", SQUARE[detail], className)} aria-hidden="true">
      {detail === "inProgress" && <span className="size-1.5 rounded-full bg-info-strong" />}
      {detail === "done" && <Check className="size-2.5 text-white" strokeWidth={4} />}
      {dependency && <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-warn ring-1 ring-card" />}
    </span>
  );
}

function Square({ issue, onOpen, onHover }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(issue.key)}
      onMouseEnter={(event) => onHover(issue, event.currentTarget)}
      onFocus={(event) => onHover(issue, event.currentTarget)}
      onMouseLeave={() => onHover(null)}
      onBlur={() => onHover(null)}
      aria-label={`${issue.key}, ${DETAIL_LABELS[issue.detail]}: ${issue.summary}`}
      className="rounded-[4px] p-px outline-none transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <StateSquare detail={issue.detail} dependency={issue.isDependency} />
    </button>
  );
}

function MapRow({ label, sub, pct, issues, onOpenRow, onOpenTicket, onHover }) {
  const sorted = [...issues].sort((a, b) => ORDER[a.detail] - ORDER[b.detail] || a.key.localeCompare(b.key, undefined, { numeric: true }));
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-x-3 gap-y-1.5 py-2 sm:grid-cols-[minmax(0,13rem)_2.75rem_minmax(0,1fr)]">
      <button type="button" onClick={onOpenRow} className="min-w-0 rounded text-left outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="block truncate text-sm font-semibold" title={label}>{label}</span>
        <span className="block text-[11px] text-muted-foreground tabular-nums">{sub}</span>
      </button>
      <span className="text-right text-sm font-bold tabular-nums">{pctLabel(pct)}</span>
      <div className="col-span-2 flex flex-wrap gap-0.5 sm:col-span-1">
        {sorted.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tickets yet</span>
        ) : (
          sorted.map((issue) => <Square key={issue.key} issue={issue} onOpen={onOpenTicket} onHover={onHover} />)
        )}
      </div>
    </li>
  );
}

export function ScopeMap({ view, onOpenEpic, onOpenTicket, onOpenLoose }) {
  const [hover, setHover] = useState(null);
  const planned = view.issues.filter((issue) => issue.kind !== "EPIC" && !BUG_KINDS.includes(issue.kind));
  const loose = planned.filter((issue) => !issue.epicKey);
  const counts = { todo: 0, inProgress: 0, inReview: 0, done: 0 };
  for (const issue of planned) counts[issue.detail] += 1;

  const onHover = (issue, element) => {
    if (!issue) return setHover(null);
    const box = element.getBoundingClientRect();
    return setHover({ issue, left: Math.min(box.left, window.innerWidth - 300), top: box.bottom + 6 });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ul className="divide-y">
        {view.progress.epics.map((epic) => (
          <MapRow
            key={epic.key}
            label={epic.summary.replace(/^Configurator ShopAssist::?\s*/i, "")}
            sub={`${epic.key} · ${epic.done}/${epic.total} done`}
            pct={epic.pct}
            issues={planned.filter((issue) => issue.epicKey === epic.key)}
            onOpenRow={() => onOpenEpic(epic.key)}
            onOpenTicket={onOpenTicket}
            onHover={onHover}
          />
        ))}
        {loose.length > 0 && (
          <MapRow label="Under no epic" sub={`${loose.filter((issue) => issue.state === "done").length}/${loose.length} done`} pct={null} issues={loose} onOpenRow={onOpenLoose} onOpenTicket={onOpenTicket} onHover={onHover} />
        )}
      </ul>
      {planned.length === 0 && <p className="py-3 text-sm text-muted-foreground">No planned tickets yet — they appear after the first Jira refresh.</p>}
      <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
        {["done", "inReview", "inProgress", "todo"].map((detail) => (
          <span key={detail} className="inline-flex items-center gap-1.5">
            <StateSquare detail={detail} />
            {DETAIL_LABELS[detail]} <span className="font-semibold text-foreground tabular-nums">{counts[detail]}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <StateSquare detail="todo" dependency />
          Another team&apos;s ticket
        </span>
      </p>
      {hover && (
        <div className="pointer-events-none fixed z-50 w-72 rounded-md border bg-popover px-3 py-2 text-xs shadow-lg" style={{ left: hover.left, top: hover.top }} role="tooltip">
          <p className="font-mono font-semibold text-primary">{hover.issue.key}</p>
          <p className="mt-0.5 font-medium text-foreground">{hover.issue.summary}</p>
          <p className="mt-1 text-muted-foreground">
            {hover.issue.status} · {hover.issue.assigneeName ?? "Unassigned"}
            {hover.issue.isDependency && ` · owned by ${hover.issue.projectKey}`}
          </p>
        </div>
      )}
    </div>
  );
}
