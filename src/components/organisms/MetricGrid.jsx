import React from 'react';
import { AlertTriangle, CheckCircle2, Link2 } from 'lucide-react';
import { Metric } from '../molecules/Metric.jsx';
import { VelocityMetric } from '../molecules/VelocityMetric.jsx';

export function MetricGrid({
  sprintHealth,
  issues,
  points,
  avgProgress,
  completedPoints,
  velocity,
  velocityPoints,
  velocityCompletedPoints,
  riskCount,
  atRiskCount,
  behindCount,
  blockedCount,
  featureBlockedCount,
  featureAheadCount,
  featureOnTrackCount,
  totalFeatureIssues,
}) {
  return (
    <section className="metric-grid" aria-label="Sprint summary metrics">
      <Metric
        tone="success"
        label="Sprint Health"
        value={sprintHealth.status}
        detail={`${featureAheadCount + featureOnTrackCount}/${totalFeatureIssues} features on track · ${featureBlockedCount} blocked`}
        icon={<CheckCircle2 size={16} />}
      />
      <Metric
        label="Issues in scope"
        value={issues.length}
        detail={`${points} total story points`}
        icon={<Link2 size={16} />}
      />
      <Metric
        tone="brand"
        label="Completion"
        value={`${avgProgress}%`}
        detail={`${Math.round(completedPoints)}/${points} weighted story points`}
        icon={<CheckCircle2 size={16} />}
      />
      <VelocityMetric velocity={velocity} totalPoints={velocityPoints} completedPoints={velocityCompletedPoints} />
      <Metric
        tone={riskCount > 0 ? 'warn' : null}
        label="At-risk work"
        value={riskCount}
        detail={`${atRiskCount} at risk · ${behindCount} behind · ${blockedCount} blocked`}
        icon={<AlertTriangle size={16} />}
      />
    </section>
  );
}
