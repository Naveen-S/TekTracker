"use client";

import { Badge } from "@/components/ui/badge";
import { getWeeklyVelocity } from "@/lib/metrics.mjs";

function Metric({ label, value, detail, tone }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {tone && <span className={`size-2 rounded-full ${toneDot[tone] ?? ""}`} aria-hidden="true" />}
      </div>
      <p className="mt-1.5 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

const toneDot = {
  success: "bg-emerald-500",
  info: "bg-blue-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
  neutral: "bg-slate-400",
};

export function MetricGrid({ metrics, sprint }) {
  const velocity = getWeeklyVelocity(sprint, metrics.velocityCompletedPoints, metrics.velocityPoints);
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Sprint summary metrics">
      <article className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sprint Health</p>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge tone={metrics.sprintHealth.tone}>
            {metrics.sprintHealth.icon} {metrics.sprintHealth.status}
          </Badge>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {metrics.featureAheadCount + metrics.featureOnTrackCount}/{metrics.totalFeatureIssues}{" "}
          features on track · {metrics.featureBlockedCount} blocked
        </p>
      </article>
      <Metric
        label="Issues in scope"
        value={metrics.totalIssues}
        detail={`${metrics.points} total story points`}
      />
      <Metric
        label="Completion"
        value={`${metrics.avgProgress}%`}
        detail={`${Math.round(metrics.completedPoints)}/${metrics.points} weighted story points`}
        tone="info"
      />
      <Metric
        label="Weekly velocity"
        value={`${velocity.velocity} pts/wk`}
        detail={`week ${Math.min(velocity.weeksElapsed, velocity.totalWeeks)}/${velocity.totalWeeks} · needs ${velocity.weeksNeeded}w more${velocity.onTrack ? " · on pace" : " · off pace"}`}
        tone={velocity.onTrack ? "success" : "warn"}
      />
      <Metric
        label="At-risk work"
        value={metrics.riskCount}
        detail={`${metrics.atRiskCount} at risk · ${metrics.behindCount} behind · ${metrics.blockedCount} blocked`}
        tone={metrics.riskCount > 0 ? "warn" : "success"}
      />
    </section>
  );
}
