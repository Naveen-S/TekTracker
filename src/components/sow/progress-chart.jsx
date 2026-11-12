"use client";

/**
 * Progress vs plan (sow-tracker.md round 2): the SOW's weighted progress by day against the
 * straight-line plan for its build phases — "are we behind, and by how much" in one look.
 * One y-axis (0–100%). Two series, so a legend is always shown; the plan is a quiet grey
 * reference and the actual line carries the accent. A dashed line is the projection only.
 * Hovering shows a crosshair with that day's plan and actual. History fills in one point per
 * night, so a new SOW starts as a single dot.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { smoothLinePath } from "@/lib/chart-path.mjs";
import { planPctOn } from "@/lib/sow/charts.mjs";
import { addDays, diffDays, formatDay } from "@/lib/sow/timeline.mjs";

/** Drawn at real pixel size: the viewBox width is the measured container width, so type stays
 *  11–12px however wide the panel is (a scaled viewBox blew the labels up to headline size). */
const H = 210;
const DEFAULT_W = 480;
const PAD = { top: 16, right: 40, bottom: 26, left: 38 };
const PLOT_H = H - PAD.top - PAD.bottom;

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(DEFAULT_W);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function LegendKey({ className, dashed = false, children }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("w-4", dashed ? "h-0 border-t-2 border-dashed" : "h-0.5 rounded-full", className)} aria-hidden="true" />
      {children}
    </span>
  );
}

export function ProgressChart({ chart, axis, today, window }) {
  const [hoverDay, setHoverDay] = useState(null);
  const [boxRef, W] = useWidth();
  const PLOT_W = W - PAD.left - PAD.right;
  const span = Math.max(diffDays(axis.start, axis.end), 1);
  const x = (day) => PAD.left + (Math.min(Math.max(diffDays(axis.start, day), 0), span) / span) * PLOT_W;
  const y = (pct) => PAD.top + (1 - Math.min(Math.max(pct, 0), 100) / 100) * PLOT_H;
  const points = (series) => series.map((point) => [x(point.day), y(point.pct)]);

  const planPath = chart.plan.length >= 2 ? `M${points(chart.plan).map(([px, py]) => `${px},${py}`).join("L")}` : null;
  const actual = points(chart.actual);
  const actualPath = actual.length >= 2 ? smoothLinePath(actual.map(([px, py]) => ({ x: px, y: py }))) : null;
  const last = chart.actual.at(-1) ?? null;
  const projectionEnd = chart.projection && diffDays(chart.projection.finishDay, axis.end) >= 0 ? chart.projection.finishDay : null;
  const hover = hoverDay
    ? { day: hoverDay, plan: planPctOn(hoverDay, window), actual: chart.actual.find((point) => point.day === hoverDay)?.pct ?? null }
    : null;

  const onMove = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = ((event.clientX - box.left) / box.width) * W;
    const offset = Math.round(((ratio - PAD.left) / PLOT_W) * span);
    setHoverDay(offset < 0 || offset > span ? null : addDays(axis.start, offset));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative" ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Weighted progress by day against the plan" onPointerMove={onMove} onPointerLeave={() => setHoverDay(null)}>
          {[0, 50, 100].map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{tick}%</text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="fill-muted-foreground text-[11px]">{formatDay(axis.start)}</text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-muted-foreground text-[11px]">{formatDay(axis.end, { year: true })}</text>

          {/* Today */}
          <line x1={x(today)} x2={x(today)} y1={PAD.top} y2={PAD.top + PLOT_H} className="stroke-border-strong" strokeWidth="1" />
          <text x={x(today)} y={H - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">Today</text>

          {planPath && <path d={planPath} fill="none" className="stroke-muted-foreground" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {chart.plan.length >= 2 && (
            <text x={W - PAD.right + 6} y={y(100) + 4} className="fill-muted-foreground text-[11px] font-semibold">Plan</text>
          )}

          {projectionEnd && last && (
            <line x1={x(last.day)} y1={y(last.pct)} x2={x(projectionEnd)} y2={y(100)} className="stroke-primary" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
          )}
          {actualPath && <path d={actualPath} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {last && (
            <>
              <circle cx={x(last.day)} cy={y(last.pct)} r="5" className="fill-primary stroke-card" strokeWidth="2" />
              <text x={x(last.day) + 9} y={y(last.pct) - 7} className="fill-foreground text-[12px] font-bold tabular-nums">{Math.round(last.pct)}%</text>
            </>
          )}

          {hover && hover.day !== today && (
            <line x1={x(hover.day)} x2={x(hover.day)} y1={PAD.top} y2={PAD.top + PLOT_H} className="stroke-primary/60" strokeWidth="1" />
          )}
        </svg>
        {hover && (
          <div
            className={cn("pointer-events-none absolute top-2 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md", x(hover.day) > W / 2 ? "-translate-x-full" : "")}
            style={{ left: `calc(${(x(hover.day) / W) * 100}% + ${x(hover.day) > W / 2 ? -8 : 8}px)` }}
          >
            <p className="font-semibold">{formatDay(hover.day, { year: true })}</p>
            {hover.plan !== null && <p className="text-muted-foreground tabular-nums">Plan {Math.round(hover.plan)}%</p>}
            <p className="tabular-nums">{hover.actual === null ? "No reading that day" : `Actual ${Math.round(hover.actual)}%`}</p>
          </div>
        )}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <LegendKey className="bg-muted-foreground">Plan (straight line through the build phases)</LegendKey>
        <LegendKey className="bg-primary">Actual</LegendKey>
        {chart.projection && <LegendKey dashed className="border-primary">Projection</LegendKey>}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {chart.projection
          ? `At ${chart.projection.ratePerDay.toFixed(1)} pts a day, scope completes ${formatDay(chart.projection.finishDay, { year: true })}${chart.projection.lateBy > 0 ? `, ${chart.projection.lateBy} days after the build phases end` : ""}.`
          : chart.actual.length < 2
            ? "One reading so far. The line and a projection appear as nightly readings accumulate."
            : "No forward movement recorded yet, so there is no projection."}
      </p>
    </div>
  );
}
