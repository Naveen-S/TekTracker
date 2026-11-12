/**
 * The numbers behind the SOW overview's visuals (sow-tracker.md round 2). Pure; every date is a
 * `YYYY-MM-DD` calendar day. Geometry (pixels) stays in the components — these return data and
 * 0–100 positions only.
 */
import { BUG_KINDS } from "./defaults.mjs";
import { addDays, diffDays, positionPct } from "./timeline.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month boundaries inside the axis, as labelled ticks with a 0–100 position. */
export function monthTicks(axis) {
  const ticks = [];
  let [year, month] = axis.start.split("-").map(Number);
  for (let guard = 0; guard < 60; guard += 1) {
    const day = `${year}-${String(month).padStart(2, "0")}-01`;
    if (diffDays(axis.end, day) > 0) break;
    if (diffDays(axis.start, day) >= 0) ticks.push({ day, label: MONTHS[month - 1], pct: positionPct(day, axis.start, axis.end) });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return ticks;
}

/**
 * Put each phase on the first lane where it does not overlap the previous bar, so concurrent
 * phases (Internal QA and UAT) sit on separate rows. Adds `lane`, `left`, `width` (0–100).
 */
export function layoutPhases(phases, axis) {
  const laneEnds = [];
  return phases.map((phase) => {
    let lane = laneEnds.findIndex((end) => diffDays(end, phase.startDate) > 0);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = phase.endDate;
    const left = positionPct(phase.startDate, axis.start, axis.end);
    const right = positionPct(addDays(phase.endDate, 1), axis.start, addDays(axis.end, 1));
    return { ...phase, lane, left, width: Math.max(right - left, 0.8) };
  });
}

/** Gate milestones with their position, and the baseline position when the date moved. */
export function layoutGates(phases, axis) {
  return phases
    .flatMap((phase) => phase.items.filter((item) => item.isGate && item.currentDate).map((item) => ({ ...item, phaseId: phase.id })))
    .map((gate) => ({
      ...gate,
      pct: positionPct(gate.currentDate, axis.start, axis.end),
      baselinePct: gate.slip ? positionPct(gate.baselineDate, axis.start, axis.end) : null,
    }))
    .sort((a, b) => a.pct - b.pct);
}

/** The straight-line plan: 0 until the scope window opens, 100 from its last day on. */
export function planPctOn(day, window) {
  if (!window) return null;
  if (diffDays(window.start, day) < 0) return 0;
  const span = diffDays(window.start, window.end) + 1;
  return Math.min(100, ((diffDays(window.start, day) + 1) / span) * 100);
}

/**
 * The progress-vs-plan series.
 * @param {{ history: Array<{ day: string, pct: number }>, today: string, todayPct: number | null,
 *   window: { start: string, end: string } | null, axis: { start: string, end: string } }} input
 */
export function buildProgressSeries({ history, today, todayPct, window, axis }) {
  const byDay = new Map(history.filter((point) => diffDays(point.day, today) >= 0).map((point) => [point.day, point.pct]));
  if (todayPct !== null) byDay.set(today, todayPct);
  const actual = [...byDay.entries()].map(([day, pct]) => ({ day, pct })).sort((a, b) => diffDays(b.day, a.day));
  const plan = window
    ? [axis.start, window.start, window.end, axis.end]
        .filter((day, index, days) => days.indexOf(day) === index && diffDays(axis.start, day) >= 0 && diffDays(day, axis.end) >= 0)
        .sort((a, b) => diffDays(b, a))
        .map((day) => ({ day, pct: day === window.start ? 0 : planPctOn(day, window) }))
    : [];
  const expected = planPctOn(today, window);
  const gap = todayPct !== null && expected !== null ? todayPct - expected : null;

  // Projection: the average daily gain over the recorded days, carried forward to 100%.
  let projection = null;
  if (actual.length >= 2) {
    const first = actual[0];
    const last = actual.at(-1);
    const days = diffDays(first.day, last.day);
    const rate = days > 0 ? (last.pct - first.pct) / days : 0;
    if (rate > 0 && last.pct < 100) {
      const finishDay = addDays(last.day, Math.ceil((100 - last.pct) / rate));
      projection = { ratePerDay: rate, finishDay, lateBy: window ? diffDays(window.end, finishDay) : null };
    }
  }
  return { actual, plan, expected, gap, projection, window };
}

/** Per-day counts of issues raised and closed, over the days from the first one to today (≤ 45). */
export function issueFlow(events, today, maxDays = 45) {
  const days = events.flatMap((event) => [event.raisedDay, event.closedDay]).filter(Boolean).sort();
  if (days.length === 0) return [];
  const span = Math.min(diffDays(days[0], today), maxDays - 1);
  const start = addDays(today, -Math.max(span, 6));
  const series = [];
  for (let offset = 0; diffDays(addDays(start, offset), today) >= 0; offset += 1) {
    const day = addDays(start, offset);
    series.push({
      day,
      raised: events.filter((event) => event.raisedDay === day).length,
      closed: events.filter((event) => event.closedDay === day).length,
    });
  }
  return series;
}

/**
 * Open work per person: planned tickets, bugs and pre-QA Slack issues that mention them.
 * "Unassigned" is always first; the rest by total, descending.
 */
export function peopleLoad(issues, slackPosts = []) {
  const people = new Map();
  const entry = (name) => {
    if (!people.has(name)) people.set(name, { name, planned: 0, bugs: 0, slack: 0 });
    return people.get(name);
  };
  for (const issue of issues) {
    if (issue.kind === "EPIC" || issue.state === "done") continue;
    const row = entry(issue.assigneeName ?? "Unassigned");
    if (BUG_KINDS.includes(issue.kind)) row.bugs += 1;
    else row.planned += 1;
  }
  for (const post of slackPosts) {
    if (post.status !== "NEW" && post.status !== "ACKNOWLEDGED") continue;
    for (const name of post.mentions) entry(name).slack += 1;
  }
  return [...people.values()]
    .map((row) => ({ ...row, total: row.planned + row.bugs + row.slack }))
    .filter((row) => row.total > 0)
    .sort((a, b) => (a.name === "Unassigned" ? -1 : b.name === "Unassigned" ? 1 : b.total - a.total || a.name.localeCompare(b.name)));
}
