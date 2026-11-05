/**
 * Support on-call rotation helpers (support-oncall.md (b)). Pure and plain-Node loadable (`.mjs`,
 * relative imports only) so the fixtures can run without the app.
 *
 * The Confluence POC pages define a rotation as one Gate's DEV CYCLE (`developmentStart →
 * developmentEnd`), and the people on it stay on duty until the next Gate's dev cycle starts —
 * even when that Gate hasn't been created yet (decision 6).
 */
/**
 * Cap used when an admin hasn't set `Team.onCallHeadcount` (decision 8): one FE + one BE, the
 * Confluence page's shape.
 */
export const DEFAULT_ONCALL_HEADCOUNT = 2;

/** The per-team nomination cap: the admin value, else the default. */
export function onCallCap(team) {
  return team?.onCallHeadcount ?? DEFAULT_ONCALL_HEADCOUNT;
}

/**
 * The sprint whose rotation is current at `now`: the latest `developmentStart` that is ≤ now.
 * Returns null when every sprint starts in the future (or there are none).
 *
 * @param {{ developmentStart: Date|string }[]} sprints
 * @param {Date|string|number} [now]
 */
export function resolveOnCallSprint(sprints, now = new Date()) {
  const at = new Date(now).getTime();
  let current = null;
  let currentStart = -Infinity;
  for (const sprint of sprints) {
    const start = new Date(sprint.developmentStart).getTime();
    if (start <= at && start > currentStart) {
      current = sprint;
      currentStart = start;
    }
  }
  return current;
}

// Local-time, like the board's `formatDate` / `formatSprintWindow`: sprint dates are entered as a
// local (IST) midnight and stored as 18:30Z, so a UTC-pinned label would read one day early.
const monthDay = (value) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "Sep 17 → Oct 15 · dev cycle of November 2026 Release". */
export function formatRotationWindow(sprint) {
  return `${monthDay(sprint.developmentStart)} → ${monthDay(sprint.developmentEnd)} · dev cycle of ${sprint.name}`;
}
