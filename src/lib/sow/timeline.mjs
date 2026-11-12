/**
 * SOW timeline math (sow-tracker.md decisions 6, 14–16). Pure, and entirely in CALENDAR DAYS:
 * every date is a `YYYY-MM-DD` string, so nothing here can drift across a time zone.
 */
const DAY_MS = 86_400_000;
export const SOW_TIME_ZONE = "Asia/Kolkata";

/** A DB date (UTC midnight of a calendar day) → `YYYY-MM-DD`. */
export function toIsoDay(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → the UTC-midnight Date the DB stores. */
export function fromIsoDay(iso) {
  return iso ? new Date(`${iso}T00:00:00Z`) : null;
}

/** The calendar day an instant falls on in the SOW time zone. */
export function todayIso(asOf = new Date(), timeZone = SOW_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(asOf);
}

const dayNumber = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function diffDays(from, to) {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(iso, days) {
  return new Date((dayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** 0–100 position of a day on a start → end axis. */
export function positionPct(iso, startIso, endIso) {
  const span = diffDays(startIso, endIso);
  return span <= 0 ? 0 : clamp01(diffDays(startIso, iso) / span) * 100;
}

/** `done` once its last day has passed, `active` on any of its days, else `upcoming`. */
export function phaseState(phase, today) {
  if (diffDays(phase.endDate, today) > 0) return "done";
  return diffDays(phase.startDate, today) >= 0 ? "active" : "upcoming";
}

/** Fraction of a window elapsed by the end of `today` (inclusive days). */
export function elapsedFraction(startIso, endIso, today) {
  const span = diffDays(startIso, endIso) + 1;
  return span <= 0 ? 1 : clamp01((diffDays(startIso, today) + 1) / span);
}

/**
 * Phases with their state and which ones the page opens: every active phase; when the day falls
 * in a gap, the next upcoming one; when all are done, the last.
 */
export function buildJourney(phases, today) {
  const withState = phases.map((phase) => ({ ...phase, state: phaseState(phase, today) }));
  let focus = withState.filter((phase) => phase.state === "active").map((phase) => phase.id);
  if (focus.length === 0) {
    const next = withState.find((phase) => phase.state === "upcoming") ?? withState[withState.length - 1];
    focus = next ? [next.id] : [];
  }
  return withState.map((phase) => ({
    ...phase,
    isFocus: focus.includes(phase.id),
    daysToStart: diffDays(today, phase.startDate),
    daysToEnd: diffDays(today, phase.endDate),
  }));
}

/** Days an item moved from its baseline (positive = later). Null when either date is missing. */
export function slipDays(item) {
  return item.baselineDate && item.currentDate ? diffDays(item.baselineDate, item.currentDate) : null;
}

export const isOverdue = (item, today) =>
  item.status !== "DONE" && Boolean(item.currentDate) && diffDays(item.currentDate, today) > 0;

/** The final gate (by current date) — the launch milestone the headline slip is read from. */
export function launchGate(items) {
  const gates = items.filter((item) => item.isGate && item.currentDate);
  return gates.sort((a, b) => diffDays(b.currentDate, a.currentDate)).at(-1) ?? null;
}

const HEALTH_LABELS = {
  COMPLETE: "Complete",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  BEHIND: "Behind",
  NOT_STARTED: "Not started",
};

/** The window the planned scope is built in: the phases that own scope kinds. */
export function scopeWindow(phases, scopeKinds) {
  const owners = phases.filter((phase) => phase.kinds.some((kind) => scopeKinds.includes(kind)));
  if (owners.length === 0) return null;
  return { start: owners.map((phase) => phase.startDate).sort()[0], end: owners.map((phase) => phase.endDate).sort().at(-1) };
}

/** Scope progress vs time elapsed in the scope window (the board's −10 / −25 bands). */
function scheduleBand(scopePct, window, today) {
  if (scopePct === null || !window) return { key: null, expectedPct: null };
  if (diffDays(window.start, today) < 0) return { key: scopePct > 0 ? "ON_TRACK" : "NOT_STARTED", expectedPct: 0 };
  const expectedPct = elapsedFraction(window.start, window.end, today) * 100;
  if (scopePct >= 100) return { key: "ON_TRACK", expectedPct };
  if (diffDays(window.end, today) > 0) return { key: scopePct >= 90 ? "AT_RISK" : "BEHIND", expectedPct };
  const delta = scopePct - expectedPct;
  if (delta >= -10) return { key: "ON_TRACK", expectedPct };
  return { key: delta >= -25 ? "AT_RISK" : "BEHIND", expectedPct };
}

/**
 * Derived SOW health (decision 15), with the reasons behind it and the scope % a straight-line
 * schedule would expect by today.
 * @param {{ sowStatus: string, scopePct: number | null, phases: object[], items: object[],
 *   risks: object[], scopeKinds: string[], today: string }} input
 */
export function deriveHealth({ sowStatus, scopePct, phases, items, risks, scopeKinds, today }) {
  if (sowStatus === "COMPLETED") return { key: "COMPLETE", label: HEALTH_LABELS.COMPLETE, reasons: [], expectedPct: null };
  const band = scheduleBand(scopePct, scopeWindow(phases, scopeKinds), today);
  const reasons = [];
  let key = band.key ?? "ON_TRACK";
  if (key === "AT_RISK" || key === "BEHIND") {
    reasons.push(`Planned scope is at ${Math.round(scopePct)}% against ${Math.round(band.expectedPct)}% of its time elapsed`);
  }

  const overdue = items.filter((item) => isOverdue(item, today)).length;
  const atRisk = items.filter((item) => item.status === "AT_RISK").length;
  const blockers = risks.filter((risk) => risk.type === "BLOCKER" && risk.status === "OPEN").length;
  if (overdue > 0) reasons.push(`${overdue} plan ${overdue === 1 ? "item is" : "items are"} past due`);
  if (atRisk > 0) reasons.push(`${atRisk} plan ${atRisk === 1 ? "item is" : "items are"} marked at risk`);
  if (blockers > 0) reasons.push(`${blockers} open ${blockers === 1 ? "blocker" : "blockers"}`);
  if (overdue + atRisk + blockers > 0 && (key === "ON_TRACK" || key === "NOT_STARTED")) key = "AT_RISK";

  return { key, label: HEALTH_LABELS[key], reasons, expectedPct: band.expectedPct };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Dec 18" (or "Jan 20, 2027" with the year). Pure string math — no Date, no time zone. */
export function formatDay(iso, { year = false } = {}) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return year ? `${MONTHS[m - 1]} ${d}, ${y}` : `${MONTHS[m - 1]} ${d}`;
}
