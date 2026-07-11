"use client";

import { Activity, AlertTriangle, Gauge, Layers, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWeeklyVelocity } from "@/lib/metrics.mjs";
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

export function MetricGrid({ metrics, sprint }) {
  const velocity = getWeeklyVelocity(sprint, metrics.velocityCompletedPoints, metrics.velocityPoints);
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
        <p className="text-xs text-muted-foreground">
          {metrics.featureAheadCount + metrics.featureOnTrackCount}/{metrics.totalFeatureIssues}{" "}
          features on track · {metrics.featureBlockedCount} blocked
        </p>
      </MetricCard>
      <Metric
        label="Issues in scope"
        icon={Layers}
        value={metrics.totalIssues}
        detail={`${metrics.points} total story points`}
      />
      <Metric
        label="Completion"
        icon={Target}
        value={`${metrics.avgProgress}%`}
        detail={`${Math.round(metrics.completedPoints)}/${metrics.points} weighted story points`}
        tone="brand"
      />
      <Metric
        label="Weekly velocity"
        icon={Gauge}
        value={`${velocity.velocity} pts/wk`}
        detail={`week ${Math.min(velocity.weeksElapsed, velocity.totalWeeks)}/${velocity.totalWeeks} · needs ${velocity.weeksNeeded}w more${velocity.onTrack ? " · on pace" : " · off pace"}`}
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
