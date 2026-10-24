/**
 * The risk register (security-vulnerability-tracker.md "Risks & blockers") — eight computed signals
 * per program, each with a count, a severity (High / Medium / Low / Clear, always also written as
 * text), the JQL behind it and the five most urgent tickets. Pure; thresholds are admin JSON
 * (`SecurityTrackerSettings.riskThresholds`) merged over the code defaults per key.
 *
 * No AI and no generated free text beyond the fixed sentence templates in `headlines`.
 */
import { DEFAULT_RISK_THRESHOLDS } from "./defaults.mjs";
import { PRIORITY_ORDER } from "./classify.mjs";
import { and, keysJql } from "./jql.mjs";

export const SEVERITY_ORDER = { High: 0, Medium: 1, Low: 2, Clear: 3 };

export const SIGNALS = [
  { id: "S1", key: "noPlan", label: "No plan", short: "No plan", clears: "Slot items into the next two releases", workbench: true },
  { id: "S2", key: "pastSla", label: "Past SLA (P0/P1)", short: "Past SLA", clears: "Ship, or re-slot with an agreed date" },
  { id: "S3", key: "dueSoon", label: "Crossing SLA ≤ 14 d (P0/P1)", short: "SLA ≤ 14 d", clears: "Pull into the current release" },
  { id: "S4", key: "overdue", label: "Overdue", short: "Overdue", clears: "Close, or re-slot into the current/next release", workbench: true },
  { id: "S5", key: "noFixVersion", label: "No fix version", short: "No fix ver.", clears: "Assign a release", workbench: true },
  { id: "S6", key: "untriaged", label: "Untriaged", short: "Untriaged", clears: "Triage in the Vulnerability Tracker", workbench: true },
  { id: "S7", key: "unassigned", label: "Unassigned", short: "Unassigned", clears: "Assign an owner" },
  { id: "S8", key: "stale", label: "Stale", short: "Stale", clears: "Status check with the owner" },
];

/** Admin JSON over the defaults, per signal and per key, so a partial edit never loses a default. */
export function resolveThresholds(stored) {
  const out = {};
  for (const [signal, defaults] of Object.entries(DEFAULT_RISK_THRESHOLDS)) {
    const override = stored && typeof stored[signal] === "object" ? stored[signal] : {};
    out[signal] = { ...defaults };
    for (const [key, value] of Object.entries(override)) {
      if (typeof value === "number" && Number.isFinite(value) && key in defaults) out[signal][key] = value;
    }
  }
  return out;
}

const prioRank = (prio) => {
  const index = PRIORITY_ORDER.indexOf(prio);
  return index === -1 ? PRIORITY_ORDER.length : index;
};

/** P0 first, then the oldest. */
export function mostUrgent(rows, n = 5) {
  return [...rows]
    .sort((a, b) => prioRank(a.prio) - prioRank(b.prio) || (b.age ?? -1) - (a.age ?? -1) || a.key.localeCompare(b.key))
    .slice(0, n)
    .map((row) => ({
      key: row.key,
      priority: row.prio,
      age: row.age,
      fixVersion: row.fixVersions[0] ?? null,
      assignee: row.assigneeName,
    }));
}

const countP0P1 = (rows) => rows.filter((row) => row.prio === "P0" || row.prio === "P1").length;

/**
 * S1–S8 for one program's (or the rollup's) open pipeline.
 * @param {Array<object>} rows classified pipeline rows (aggregate.mjs `classifyRow`)
 * @param {{ baseJql: string, thresholds: object, untriagedClause: string, now: Date|string }} ctx
 */
export function riskSignals(rows, ctx) {
  const thresholds = resolveThresholds(ctx.thresholds);
  const nowTime = new Date(ctx.now).getTime();
  const staleCutoff = nowTime - thresholds.stale.days * 86_400_000;
  const planned = rows.filter((row) => row.onCur || row.onNext).length;

  const pastSla = rows.filter((row) => (row.prio === "P0" || row.prio === "P1") && row.sla.state === "breached");
  const dueSoon = rows.filter((row) => (row.prio === "P0" || row.prio === "P1") && row.sla.state === "due");
  const overdue = rows.filter((row) => row.overdue);
  const noFix = rows.filter((row) => row.fixVersions.length === 0);
  const untriaged = rows.filter((row) => !row.triaged);
  const unassigned = rows.filter((row) => !row.assigneeName);
  const stale = rows.filter((row) => row.updatedTime !== null && row.updatedTime <= staleCutoff);
  const noPlan = rows.length > 0 && planned === 0 ? rows : [];

  const p0Past = pastSla.filter((row) => row.prio === "P0").length;
  const p1Past = pastSla.length - p0Past;
  const pct = (part) => (rows.length ? (part * 100) / rows.length : 0);

  const severity = {
    noPlan: noPlan.length ? "High" : "Clear",
    pastSla: !pastSla.length
      ? "Clear"
      : p0Past >= thresholds.pastSla.highP0 || p1Past >= thresholds.pastSla.highP1
        ? "High"
        : "Medium",
    dueSoon: dueSoon.length ? "Medium" : "Clear",
    overdue: !overdue.length
      ? "Clear"
      : overdue.length >= thresholds.overdue.high || countP0P1(overdue) > 0
        ? "High"
        : "Medium",
    noFixVersion: !noFix.length ? "Clear" : pct(noFix.length) > thresholds.noFixVersion.highPctOfOpen ? "High" : "Medium",
    untriaged: untriaged.length ? "Medium" : "Clear",
    unassigned: !unassigned.length ? "Clear" : countP0P1(unassigned) > 0 ? "Medium" : "Low",
    stale: stale.length ? "Low" : "Clear",
  };

  const keys = (list) => list.map((row) => row.key);
  const jql = {
    noPlan: ctx.baseJql,
    pastSla: keysJql(keys(pastSla), ctx.baseJql),
    dueSoon: keysJql(keys(dueSoon), ctx.baseJql),
    overdue: keysJql(keys(overdue), ctx.baseJql),
    noFixVersion: and(ctx.baseJql, "fixVersion IS EMPTY"),
    untriaged: and(ctx.baseJql, ctx.untriagedClause),
    unassigned: and(ctx.baseJql, "assignee IS EMPTY"),
    stale: and(ctx.baseJql, `updated <= -${thresholds.stale.days}d`),
  };
  const sets = { noPlan, pastSla, dueSoon, overdue, noFixVersion: noFix, untriaged, unassigned, stale };

  return SIGNALS.map((signal) => ({
    ...signal,
    label: signal.key === "stale" ? `Stale (${thresholds.stale.days} d)` : signal.label,
    count: sets[signal.key].length,
    severity: severity[signal.key],
    jql: jql[signal.key],
    top5: mostUrgent(sets[signal.key]),
  }));
}

/** A program's overall level is its worst signal. */
export function overallLevel(signals) {
  return signals.reduce(
    (worst, signal) => (SEVERITY_ORDER[signal.severity] < SEVERITY_ORDER[worst] ? signal.severity : worst),
    "Clear",
  );
}

/** Non-Clear signals ordered High → Low, then by count. */
export function rankedSignals(signals) {
  return signals
    .filter((signal) => signal.severity !== "Clear")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.count - a.count);
}

/** Week-over-week: today minus the capture 7 days earlier; null ("—") when that capture is missing. */
export function riskDelta(today, weekAgo) {
  if (weekAgo === null || weekAgo === undefined || today === null || today === undefined) return null;
  return today - weekAgo;
}

/** S1 is stored 0/1 in snapshots; its displayed count is the open pipeline. */
export const SNAPSHOT_FIELD = {
  noPlan: "noPlan",
  pastSla: "pastSla",
  dueSoon: "dueSoon",
  overdue: "overdue",
  noFixVersion: "noFixVersion",
  untriaged: "untriaged",
  unassigned: "unassigned",
  stale: "stale",
};

const TEMPLATES = {
  noPlan: (p, n) => `${p} — ${n} open, nothing planned in the next two releases`,
  pastSla: (p, n, prev) => `${p} — ${n} P0/P1 past SLA${prev !== null ? ` (${prev} → ${n})` : ""}`,
  dueSoon: (p, n) => `${p} — ${n} P0/P1 cross their SLA within 14 days`,
  overdue: (p, n, prev) =>
    `${p} — ${n} overdue${prev !== null && prev !== n ? `, ${prev < n ? "up" : "down"} from ${prev} last week` : ""}`,
  noFixVersion: (p, n) => `${p} — ${n} open with no fix version`,
  untriaged: (p, n) => `${p} — ${n} untriaged`,
  unassigned: (p, n) => `${p} — ${n} unassigned`,
  stale: (p, n) => `${p} — ${n} not updated recently`,
};

/**
 * The rollup's headline strip: the top `n` High cells as fixed-template sentences, largest first.
 * @param {Array<{ program: { key: string }, risks: Array<object>, weekAgo: object | null }>} programs
 */
export function headlines(programs, n = 3) {
  const cells = [];
  for (const entry of programs) {
    for (const signal of entry.risks) {
      if (signal.severity !== "High") continue;
      const prevRaw = entry.weekAgo ? entry.weekAgo[SNAPSHOT_FIELD[signal.key]] : null;
      const prev = signal.key === "noPlan" ? null : (prevRaw ?? null);
      cells.push({
        programKey: entry.program.key,
        signalId: signal.id,
        count: signal.count,
        jql: signal.jql,
        text: TEMPLATES[signal.key](entry.program.key, signal.count, prev),
      });
    }
  }
  return cells.sort((a, b) => b.count - a.count || a.signalId.localeCompare(b.signalId)).slice(0, n);
}
