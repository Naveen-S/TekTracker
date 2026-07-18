export function getSprintKey(config) {
  return `${config.startDate}_${config.endDate}`;
}

export function migrateStages(stages) {
  const migrated = {};
  for (const [key, value] of Object.entries(stages)) {
    migrated[key] = Array.isArray(value)
      ? { stages: value, blocked: false }
      : value;
  }
  return migrated;
}

export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getDaysRemaining(sprintConfig) {
  const today = new Date();
  const end = new Date(sprintConfig.endDate);
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

export function getWeeklyVelocity(sprintConfig, completedPoints, points) {
  const start = new Date(sprintConfig.startDate);
  const today = new Date();
  const end = new Date(sprintConfig.endDate);

  const totalDuration = (end - start) / (1000 * 60 * 60 * 24);
  const totalWeeks = Math.ceil(totalDuration / 7);

  const elapsed = Math.max(0, today - start);
  const weeksElapsed = Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60 * 24 * 7)));

  const velocity = weeksElapsed > 0 ? (completedPoints / weeksElapsed).toFixed(1) : 0;
  const remainingPoints = points - completedPoints;
  const weeksNeeded = velocity > 0 ? Math.ceil(remainingPoints / velocity) : 0;

  return {
    velocity: parseFloat(velocity),
    weeksElapsed,
    totalWeeks,
    weeksNeeded,
    onTrack: weeksNeeded <= (totalWeeks - weeksElapsed),
    projectedPoints: parseFloat(velocity) * totalWeeks,
  };
}
