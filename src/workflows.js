export const WORKFLOWS = {
  feature: {
    name: 'Feature Development',
    priority: 1,
    stages: [
      'PM clarification',
      'HLD/LLD',
      'API contracts',
      'Working APIs',
      'FE integration',
      'E2E testing',
      'QA/PM demo',
      'PR approved',
      'Release ready',
      '1st Stage Env deployment',
    ],
    weights: [15, 20, 15, 15, 15, 8, 5, 3, 2, 2],
  },
  support: {
    name: 'Support Bugs',
    priority: 2,
    stages: [
      'Triaged',
      'In Progress',
      'Code Review',
      'In QA',
    ],
    weights: [20, 60, 15, 5],
  },
  techdebt: {
    name: 'Tech Debt',
    priority: 3,
    stages: [
      'Triaged',
      'In Progress',
      'Code Review',
      'In QA',
    ],
    weights: [15, 65, 15, 5],
  },
};

export const stages = WORKFLOWS.feature.stages;

export const SPRINT_GATES = {
  'June-26': {
    name: 'June 2026 Release',
    developmentStart: '2026-04-23',
    developmentEnd: '2026-05-21',
    releaseDate: '2026-06-10',
  },
  'July-26': {
    name: 'July 2026 Release',
    developmentStart: '2026-05-28',
    developmentEnd: '2026-06-25',
    releaseDate: '2026-07-15',
  },
  'Aug-26': {
    name: 'August 2026 Release',
    developmentStart: '2026-06-25',
    developmentEnd: '2026-07-23',
    releaseDate: '2026-08-12',
  },
  'Sep-26': {
    name: 'September 2026 Release',
    developmentStart: '2026-07-23',
    developmentEnd: '2026-08-20',
    releaseDate: '2026-09-09',
  },
  'Oct-26': {
    name: 'October 2026 Release',
    developmentStart: '2026-08-20',
    developmentEnd: '2026-09-17',
    releaseDate: '2026-10-07',
  },
};

export function getStagesForFilter(filter) {
  const workflow = filter.workflow || 'feature';
  return WORKFLOWS[workflow].stages;
}

export function getWeightsForFilter(filter) {
  const workflow = filter.workflow || 'feature';
  return WORKFLOWS[workflow].weights;
}

export function calculateWeightedCompletion(stageCompletion, weights) {
  if (!weights || weights.length !== stageCompletion.length) {
    return Math.round((stageCompletion.filter(Boolean).length / stageCompletion.length) * 100);
  }

  let totalWeight = 0;
  let completedWeight = 0;

  stageCompletion.forEach((completed, index) => {
    const weight = weights[index] || 0;
    totalWeight += weight;
    if (completed) {
      completedWeight += weight;
    }
  });

  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
}

export function getHealthStatus(completionPercent, isBlocked, sprintConfig) {
  if (isBlocked) {
    return {
      status: 'Blocked',
      color: '#ef4444',
      borderColor: '#dc2626',
      bgColor: '#fef2f2',
      icon: '⊗',
    };
  }

  const today = new Date();
  const startDate = new Date(sprintConfig.startDate);
  const endDate = new Date(sprintConfig.endDate);
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
  const elapsedDays = (today - startDate) / (1000 * 60 * 60 * 24);
  const expectedProgress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
  const progressDelta = completionPercent - expectedProgress;

  if (completionPercent === 100) {
    return {
      status: 'Done',
      color: '#10b981',
      borderColor: '#059669',
      bgColor: '#ecfdf5',
      icon: '✓',
    };
  } else if (completionPercent === 0 && expectedProgress < 5) {
    return {
      status: 'Not Started',
      color: '#6b7280',
      borderColor: '#9ca3af',
      bgColor: '#f9fafb',
      icon: '○',
    };
  } else if (progressDelta >= 10) {
    return {
      status: 'Ahead',
      color: '#10b981',
      borderColor: '#059669',
      bgColor: '#ecfdf5',
      icon: '↗',
    };
  } else if (progressDelta >= -10) {
    return {
      status: 'On Track',
      color: '#3b82f6',
      borderColor: '#2563eb',
      bgColor: '#eff6ff',
      icon: '→',
    };
  } else if (progressDelta >= -25) {
    return {
      status: 'At Risk',
      color: '#f59e0b',
      borderColor: '#d97706',
      bgColor: '#fffbeb',
      icon: '⚠',
    };
  }

  return {
    status: 'Behind',
    color: '#ef4444',
    borderColor: '#dc2626',
    bgColor: '#fef2f2',
    icon: '↓',
  };
}
