"use client";

/**
 * The SOW timeline (sow-tracker.md round 2): phases as bars on a real date axis, concurrent phases
 * on separate lanes, a "today" line, and gate milestones as diamonds — with a hollow ghost at the
 * baseline wherever a gate has slipped. A phase bar or a gate opens that phase's drill-in.
 * HTML rather than SVG so text stays crisp; scrolls sideways inside its own box on a phone.
 * State is written on every bar ("done", "now"), never carried by colour alone.
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDay } from "@/lib/sow/timeline.mjs";

const LANE_H = 34;
const GATE_ROW_H = 20;
/** Rough label width as a share of a ~1000px axis, for keeping gate labels from overlapping. */
const labelSpan = (text) => Math.min(30, (text.length * 6.4 + 22) / 10);

const BAR_TONE = {
  done: "bg-success-soft text-success-strong",
  overrun: "bg-warn-soft text-warn-strong",
  active: "bg-accent text-accent-foreground ring-1 ring-primary/40",
  upcoming: "bg-muted text-secondary-foreground",
};

/**
 * Rows for gate labels. Every label runs to the RIGHT of its diamond (the chart keeps a margin
 * for the last ones). A gate sits one row below every later gate that falls inside its label, so
 * a leader line never has to cross a label: the labels form a staircase down to the left.
 */
function gateRows(gates) {
  const placed = [];
  for (const gate of [...gates].reverse()) {
    const label = `${formatDay(gate.currentDate)} ${gate.title}${gate.slip > 0 ? "  +00 d" : ""}`;
    const end = gate.pct + labelSpan(label);
    const under = placed.filter((later) => later.pct < end + 0.6).map((later) => later.row);
    placed.push({ ...gate, row: under.length > 0 ? Math.max(...under) + 1 : 0 });
  }
  return placed.reverse();
}

/** Lanes for phase bars in % space; a bar too narrow for its name reserves room beside it. */
function barLanes(bars) {
  const laneEnds = [];
  return bars.map((bar) => {
    const narrow = bar.width < labelSpan(bar.name) - 0.6;
    const end = bar.left + bar.width + (narrow ? labelSpan(bar.name) : 0);
    let lane = laneEnds.findIndex((laneEnd) => bar.left >= laneEnd - 0.05);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    return { ...bar, lane, narrow };
  });
}

function PhaseBar({ bar, overrun, today, onOpen }) {
  const tone = overrun ? "overrun" : bar.state;
  const { narrow } = bar;
  const state = bar.state === "done" ? (overrun ? "open items" : "done") : bar.state === "active" ? "now" : null;
  const elapsed = bar.state === "active" ? Math.min(100, Math.max(0, ((Date.parse(today) - Date.parse(bar.startDate)) / (Date.parse(bar.endDate) - Date.parse(bar.startDate) + 86_400_000)) * 100)) : 0;
  const Tag = onOpen ? "button" : "div";
  return (
    <div className="absolute" style={{ left: `${bar.left}%`, width: `${bar.width}%`, top: bar.lane * LANE_H, height: LANE_H - 8 }}>
      <Tag
        {...(onOpen ? { type: "button", onClick: () => onOpen(bar.id) } : {})}
        title={`${bar.name} · ${formatDay(bar.startDate)} – ${formatDay(bar.endDate, { year: true })}`}
        className={cn(
          "relative flex size-full items-center gap-1 overflow-hidden rounded-md px-2 text-left text-xs font-semibold outline-none",
          BAR_TONE[tone],
          onOpen && "transition-transform hover:-translate-y-px hover:shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50",
        )}
      >
        {elapsed > 0 && <span className="absolute inset-y-0 left-0 bg-primary/20" style={{ width: `${elapsed}%` }} aria-hidden="true" />}
        {!narrow && (
          <>
            {bar.state === "done" && !overrun && <Check className="relative size-3 shrink-0" strokeWidth={3} aria-hidden="true" />}
            <span className="relative truncate">{bar.name}</span>
            {state && bar.width > labelSpan(bar.name) + 9 && <span className="relative ml-auto shrink-0 text-[10px] font-bold tracking-wide uppercase opacity-80">{state}</span>}
          </>
        )}
      </Tag>
      {narrow && (
        <span className="pointer-events-none absolute top-1/2 left-full ml-1.5 -translate-y-1/2 text-xs font-semibold whitespace-nowrap text-secondary-foreground">
          {bar.name}
        </span>
      )}
    </div>
  );
}

function Gate({ gate, top, onOpen }) {
  const done = gate.status === "DONE";
  const colour = done ? "bg-success" : gate.overdue ? "bg-danger" : "bg-primary";
  const Tag = onOpen ? "button" : "div";
  return (
    <>
      {gate.baselinePct !== null && (
        <>
          <span className="absolute h-px bg-warn" style={{ left: `${Math.min(gate.baselinePct, gate.pct)}%`, width: `${Math.abs(gate.pct - gate.baselinePct)}%`, top: 5 }} aria-hidden="true" />
          <span className="absolute size-2.5 -translate-x-1/2 rotate-45 border-2 border-warn bg-card" style={{ left: `${gate.baselinePct}%`, top: 0 }} title={`Baseline ${formatDay(gate.baselineDate, { year: true })}`} />
        </>
      )}
      <span className="absolute w-px bg-border-strong" style={{ left: `${gate.pct}%`, top: 10, height: top + 4 }} aria-hidden="true" />
      <span className={cn("absolute size-2.5 -translate-x-1/2 rotate-45 ring-2 ring-card", colour)} style={{ left: `${gate.pct}%`, top: 0 }} aria-hidden="true" />
      <Tag
        {...(onOpen ? { type: "button", onClick: () => onOpen(gate.phaseId) } : {})}
        className={cn(
          "absolute flex items-center gap-1 rounded pr-1 pl-2 text-[11px] leading-5 whitespace-nowrap outline-none",
          onOpen && "hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
          gate.overdue && !done ? "text-danger-strong" : "text-secondary-foreground",
        )}
        style={{ left: `${gate.pct}%`, top: 14 + top }}
        title={`${gate.title} — ${formatDay(gate.currentDate, { year: true })}${gate.slip ? ` (baseline ${formatDay(gate.baselineDate)})` : ""}`}
      >
        <span className="font-bold tabular-nums">{formatDay(gate.currentDate)}</span>
        <span>{gate.title}</span>
        {done && <span className="font-bold text-success-strong">done</span>}
        {gate.slip > 0 && <span className="rounded-full bg-warn-soft px-1 font-bold text-warn-strong">+{gate.slip} d</span>}
        {gate.overdue && !done && <span className="font-bold uppercase">past due</span>}
      </Tag>
    </>
  );
}

export function TimelineChart({ timeline, phases = [], today, onOpenPhase, compact = false }) {
  const bars = compact ? timeline.bars.map((bar) => ({ ...bar, narrow: false })) : barLanes(timeline.bars);
  const lanes = Math.max(...bars.map((bar) => bar.lane), 0) + 1;
  const gates = compact ? [] : gateRows(timeline.gates);
  const gateRowCount = gates.length > 0 ? Math.max(...gates.map((gate) => gate.row)) + 1 : 0;
  const overrunIds = new Set(phases.filter((phase) => phase.state === "done" && phase.items.some((item) => item.status !== "DONE")).map((phase) => phase.id));
  const barsHeight = lanes * LANE_H;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className={cn("relative", compact ? "min-w-[420px]" : "mr-44 min-w-[760px]")}>
        {/* Month axis */}
        <div className="relative h-6 border-b">
          {timeline.ticks.map((tick) => (
            <span key={tick.day} className="absolute bottom-1 border-l border-border-strong pl-1.5 text-[11px] font-semibold text-muted-foreground" style={{ left: `${tick.pct}%` }}>
              {tick.label}
            </span>
          ))}
        </div>

        <div className="relative mt-2" style={{ height: barsHeight }}>
          {timeline.ticks.map((tick) => (
            <span key={tick.day} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${tick.pct}%` }} aria-hidden="true" />
          ))}
          {bars.map((bar) => (
            <PhaseBar key={bar.id} bar={bar} overrun={overrunIds.has(bar.id)} today={today} onOpen={onOpenPhase} />
          ))}
        </div>

        {gates.length > 0 && (
          <div className="relative mt-1" style={{ height: 16 + gateRowCount * GATE_ROW_H }}>
            {gates.map((gate) => (
              <Gate key={gate.id} gate={gate} top={gate.row * GATE_ROW_H} onOpen={onOpenPhase} />
            ))}
          </div>
        )}

        {timeline.todayPct !== null && (
          <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: `${timeline.todayPct}%` }}>
            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" />
            {!compact && (
              <span className={cn("absolute top-0 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-background", timeline.todayPct > 85 ? "right-1" : "left-1")}>
                Today · {formatDay(today)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
