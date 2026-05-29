import {
  calculateWeightedCompletion,
  getHealthStatus,
  getStagesForFilter,
  getWeightsForFilter,
} from '../workflows.js';

// Pure aggregation of sprint metrics over an arbitrary set of filters.
// Used by useSprintMetrics (all filters, dashboard) and by ExportModal
// (the user-selected subset). Return shape must stay identical for both.
export function computeSprintMetrics(filters, issueStages, sprintConfig) {
  const issueFilterMap = new Map();
  filters.forEach((filter) => {
    filter.issues?.forEach((issue) => {
      issueFilterMap.set(issue.key, filter);
    });
  });

  const issues = filters.flatMap((filter) => {
    const filterStages = getStagesForFilter(filter);
    const weights = getWeightsForFilter(filter);

    return filter.issues.map((issue) => {
      const issueStageData = issueStages[issue.key];
      const stageCompletion = issueStageData?.stages ?? new Array(filterStages.length).fill(false);
      const completedStages = stageCompletion.filter(Boolean).length;
      const percent = calculateWeightedCompletion(stageCompletion, weights);

      let status = issue.status;
      if (percent === 100) status = 'Done';
      else if (percent === 0) status = 'New';
      else if (percent > 0) status = 'In Progress';

      return { ...issue, filter: filter.name, accent: filter.accent, percent, status, completedStages, workflow: filter.workflow || 'feature' };
    });
  });

  const points = issues.reduce((sum, issue) => sum + issue.points, 0);
  const avgProgress = issues.length > 0
    ? Math.round(issues.reduce((sum, issue) => sum + issue.percent, 0) / issues.length)
    : 0;
  const completedPoints = issues.reduce((sum, issue) => sum + (issue.points * (issue.percent / 100)), 0);

  const velocityIssues = issues.filter(
    issue => issue.workflow === 'feature' || issue.workflow === 'techdebt'
  );
  const velocityPoints = velocityIssues.reduce((sum, issue) => sum + issue.points, 0);
  const velocityCompletedPoints = velocityIssues.reduce(
    (sum, issue) => sum + issue.points * (issue.percent / 100), 0
  );

  const issueHealthStats = issues.map(issue => {
    const filter = issueFilterMap.get(issue.key) || { workflow: 'feature' };
    const filterStages = getStagesForFilter(filter);
    const weights = getWeightsForFilter(filter);
    const issueStageData = issueStages[issue.key];
    const stageCompletion = issueStageData?.stages ?? new Array(filterStages.length).fill(false);
    const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
    const isBlocked = issueStageData?.blocked ?? false;
    return getHealthStatus(completionPercent, isBlocked, sprintConfig);
  });

  const featureIssues = issues.filter(issue => issueFilterMap.get(issue.key)?.workflow === 'feature');
  const featureHealthStats = featureIssues.map(issue => {
    const filter = issueFilterMap.get(issue.key) || { workflow: 'feature' };
    const filterStages = getStagesForFilter(filter);
    const weights = getWeightsForFilter(filter);
    const issueStageData = issueStages[issue.key];
    const stageCompletion = issueStageData?.stages ?? new Array(filterStages.length).fill(false);
    const completionPercent = calculateWeightedCompletion(stageCompletion, weights);
    const isBlocked = issueStageData?.blocked ?? false;
    return getHealthStatus(completionPercent, isBlocked, sprintConfig);
  });

  const countStatuses = (healthStats) => ({
    blocked: healthStats.filter(h => h.status === 'Blocked').length,
    behind: healthStats.filter(h => h.status === 'Behind').length,
    atRisk: healthStats.filter(h => h.status === 'At Risk').length,
    onTrack: healthStats.filter(h => h.status === 'On Track').length,
    ahead: healthStats.filter(h => h.status === 'Ahead').length,
    done: healthStats.filter(h => h.status === 'Done').length,
  });

  const allHealthCounts = countStatuses(issueHealthStats);
  const featureHealthCounts = countStatuses(featureHealthStats);
  const totalFeatureIssues = featureIssues.length;

  let sprintHealth;
  if (totalFeatureIssues === 0) {
    sprintHealth = { status: 'No Data', color: '#9ca3af', icon: '○' };
  } else if (featureHealthCounts.blocked > 0 || featureHealthCounts.behind > totalFeatureIssues * 0.3) {
    sprintHealth = { status: 'Critical', color: '#dc2626', icon: '⚠️' };
  } else if (featureHealthCounts.atRisk + featureHealthCounts.behind > totalFeatureIssues * 0.2) {
    sprintHealth = { status: 'At Risk', color: '#f59e0b', icon: '⚠' };
  } else if (featureHealthCounts.done === totalFeatureIssues) {
    sprintHealth = { status: 'Complete', color: '#16a34a', icon: '✓' };
  } else if (avgProgress >= 90) {
    sprintHealth = { status: 'Excellent', color: '#16a34a', icon: '🎯' };
  } else if (featureHealthCounts.ahead + featureHealthCounts.onTrack > totalFeatureIssues * 0.7) {
    sprintHealth = { status: 'Healthy', color: '#0891b2', icon: '✓' };
  } else {
    sprintHealth = { status: 'Fair', color: '#0891b2', icon: '→' };
  }

  return {
    issues,
    points,
    avgProgress,
    completedPoints,
    velocityPoints,
    velocityCompletedPoints,
    sprintHealth,
    totalFeatureIssues,
    blockedCount: allHealthCounts.blocked,
    behindCount: allHealthCounts.behind,
    atRiskCount: allHealthCounts.atRisk,
    riskCount: allHealthCounts.blocked + allHealthCounts.behind + allHealthCounts.atRisk,
    featureBlockedCount: featureHealthCounts.blocked,
    featureOnTrackCount: featureHealthCounts.onTrack,
    featureAheadCount: featureHealthCounts.ahead,
  };
}
