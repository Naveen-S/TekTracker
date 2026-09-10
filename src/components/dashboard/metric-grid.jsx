"use client";

import { Activity, AlertTriangle, Gauge, Layers, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPoints, getWeeklyVelocity } from "@/lib/metrics.mjs";
import { cn } from "@/lib/utils";

/* Legacy metric-card tone system (src/styles.css :557-581): 3px top stripe + tinted icon tile. */
const toneStripe = {
  brand: "bg-primary",
  success: "bg-success",
  info: "bg-info",
  warn: "bg-warn",
  danger: "bg-danger",
  neutral: "bg-border-strong",
};

const toneTile = {
  brand: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success-strong",
  info: "bg-info-soft text-info-strong",
  warn: "bg-warn-soft text-warn-strong",
  danger: "bg-danger-soft text-danger-strong",
  neutral: "bg-muted text-secondary-foreground",
};

function MetricCard({ label, icon: Icon, tone = "neutral", children }) {
  return (
    <article className="relative flex flex-col gap-1.5 overflow-hidden rounded-lg border bg-card p-4 pt-4.5 transition-all duration-200 ease-out hover:-translate-y-px hover:shadow-sm">
      <span className={cn("absolute inset-x-0 top-0 h-0.75", toneStripe[tone] ?? toneStripe.neutral)} aria-hidden="true" />
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-md",
            toneTile[tone] ?? toneTile.neutral,
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground">{label}</p>
      </div>
      {children}
    </article>
  );
}

/**
 * Full delivery-health breakdown, worst-first (mirrors rollup/team-summary-table.jsx's BANDS so
 * the same icon/label vocabulary reads identically everywhere in the app). Replaces the old
 * "X/Y delivery on track" line, which only ever surfaced the on-track count and hid Done/At
 * Risk/Behind entirely — the reason a sprint at "2/7 on track" could still badge "Excellent".
 */
const DELIVERY_BANDS = [
  { key: "blocked", icon: "⊗", label: "Blocked", className: "text-danger-strong" },
  { key: "behind", icon: "↓", label: "Behind", className: "text-danger-strong" },
  { key: "atRisk", icon: "⚠", label: "At Risk", className: "text-warn-strong" },
  { key: "onTrack", icon: "→", label: "On Track", className: "text-info-strong" },
  { key: "ahead", icon: "↗", label: "Ahead", className: "text-success-strong" },
  { key: "done", icon: "✓", label: "Done", className: "text-success-strong" },
];

function Metric({ label, icon, value, detail, tone }) {
  return (
    <MetricCard label={label} icon={icon} tone={tone}>
      <p className="mt-1 font-display text-[26px] leading-none font-extrabold tracking-tight">
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </MetricCard>
  );
}

/**
 * `asOf` (optional) pins the velocity clock — frozen shared views pass their capture time.
 * `velocityOverride` (optional) swaps the naive velocity for snapshot-based actuals
 * (trend-burndown.md decision 5 — `/` and `/rollup` pass `snapshotVelocity(...)` when ≥ 2 daily
 * snapshots exist); absent → the naive model computes exactly as before, so share/export paths
 * are untouched. Override `weeksNeeded` may be null: work remains but there was no burn.
 */
export function MetricGrid({ metrics, sprint, asOf, velocityOverride }) {
  const velocity =
    velocityOverride ??
    getWeeklyVelocity(sprint, metrics.velocityCompletedPoints, metrics.velocityPoints, asOf);
  const velocityDetail = [
    `week ${Math.min(velocity.weeksElapsed, velocity.totalWeeks)}/${velocity.totalWeeks}`,
    velocity.weeksNeeded === null ? "no burn this week" : `needs ${velocity.weeksNeeded}w more`,
    velocity.onTrack ? "on pace" : "off pace",
    ...(velocity.fromSnapshots ? ["from daily snapshots"] : []),
  ].join(" · ");
  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      aria-label="Sprint summary metrics"
    >
      <MetricCard label="Sprint Health" icon={Activity} tone={metrics.sprintHealth.tone}>
        <div className="mt-1">
          <Badge tone={metrics.sprintHealth.tone}>
            {metrics.sprintHealth.icon} {metrics.sprintHealth.status}
          </Badge>
        </div>
        {metrics.totalDeliveryIssues === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">no delivery issues yet</p>
        ) : (
          <>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold tabular-nums">
              {DELIVERY_BANDS.filter((band) => metrics.deliveryHealthCounts[band.key] > 0).map(
                (band) => (
                  <span key={band.key} className={band.className} title={band.label}>
                    {band.icon} {metrics.deliveryHealthCounts[band.key]}
                  </span>
                ),
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {metrics.totalDeliveryIssues} delivery issue
              {metrics.totalDeliveryIssues === 1 ? "" : "s"} tracked
            </p>
          </>
        )}
      </MetricCard>
      <Metric
        label="Issues in scope"
        icon={Layers}
        value={metrics.totalIssues}
        detail={`${formatPoints(metrics.points)} total story points · all work`}
      />
      <Metric
        label="Completion"
        icon={Target}
        value={`${metrics.deliveryAvgProgress}%`}
        detail={`${Math.round(metrics.deliveryCompletedPoints)}/${Math.round(metrics.deliveryPoints)} delivery story points`}
        tone="brand"
      />
      <Metric
        label="Weekly velocity"
        icon={Gauge}
        value={`${velocity.velocity} pts/wk`}
        detail={velocityDetail}
        tone={velocity.onTrack ? "success" : "warn"}
      />
      <Metric
        label="At-risk work"
        icon={AlertTriangle}
        value={metrics.riskCount}
        detail={`${metrics.atRiskCount} at risk · ${metrics.behindCount} behind · ${metrics.blockedCount} blocked`}
        tone={metrics.riskCount > 0 ? "warn" : "success"}
      />
    </section>
  );
}
