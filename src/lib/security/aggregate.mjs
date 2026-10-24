/**
 * Every /security panel's data, built from the raw-fact mirror at read time
 * (security-vulnerability-tracker.md (b) aggregate.mjs). Pure.
 *
 * Shape of the work:
 * 1. `buildContext` resolves settings, the release window, vocabulary and the untriaged clause once.
 * 2. `pipelineRows` classifies every open-pipeline issue ONCE (program, SLA, coverage, effort…).
 * 3. `aggregateProgram` builds one program's panels from its rows + its progress universe.
 * 4. `aggregateRollup` is the per-program SUM for every count (never a re-query). Its list panels
 *    (coverage, mix, plans, campaigns) are computed over the union of the programs' rows —
 *    the same thing, because an open issue belongs to exactly one program.
 */
import {
  IST_OFFSET_MS,
  NO_VULN_LABEL,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  UNAPPROVED_VULN,
  approvedTrackLabels,
  ageDays,
  coverageBucket,
  doneTime,
  effortOf,
  hasLabel,
  inProgressUniverse,
  isDismissed,
  isOverdue,
  isTriaged,
  monthLabelsUntil,
  prioName,
  programOf,
  releaseYms,
  releaseWindow,
  slaOf,
  statusBucket,
  toTime,
  unapprovedVulnLike,
  vulnOf,
  ymLabel,
} from "./classify.mjs";
import {
  and,
  keysJql,
  noEstimateClause,
  notLabel,
  programBaseJql,
  programProgressJql,
  quote,
  rollupBaseJql,
  rollupProgressJql,
  versionsClause,
} from "./jql.mjs";
import { overallLevel, riskSignals } from "./risks.mjs";
import { campaigns } from "./triage.mjs";

const DAY_MS = 86_400_000;
const istYm = (time) => {
  const date = new Date(time + IST_OFFSET_MS);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};
const round1 = (value) => Math.round(value * 10) / 10;
const pctOf = (part, whole) => (whole ? Math.round((part * 1000) / whole) / 10 : 0);

/**
 * @param {{ settings: object, programs: Array<object>, calendar: Array<object>, vocab: object,
 *   now: Date }} input — `programs` are SecurityProgram rows; inactive ones are dropped here.
 */
export function buildContext({ settings, programs, calendar, vocab, now }) {
  const active = programs.filter((program) => program.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const monthLabels = monthLabelsUntil(settings.monthLabelPrefix, now);
  return {
    settings,
    programs: active,
    window: releaseWindow(calendar, now),
    vocab,
    now,
    nowTime: toTime(now),
    untriagedClause: `(labels IS EMPTY OR labels NOT IN (${monthLabels.map(quote).join(", ")}))`,
  };
}

/** Classify one open-pipeline issue for its program. */
export function classifyRow(issue, program, ctx) {
  const { settings, window, vocab, now } = ctx;
  const yms = releaseYms(issue);
  return {
    issue,
    program,
    key: issue.jiraKey,
    prio: prioName(issue.priority),
    priorityName: issue.priority ?? null,
    age: ageDays(issue, now),
    sla: slaOf(issue, settings.slaDays, settings.dueSoonDays, now),
    bucket: statusBucket(issue),
    onCur: yms.includes(window.current.ym),
    onNext: yms.includes(window.next.ym),
    overdue: isOverdue(issue, window),
    coverage: coverageBucket(issue, window),
    triaged: isTriaged(issue.labels, settings.monthLabelPrefix),
    fixVersions: issue.fixVersions ?? [],
    assigneeName: issue.assigneeName ?? null,
    updatedTime: toTime(issue.jiraUpdatedAt),
    effort: effortOf(issue, settings.placeholderEstimateDays),
    vuln: vulnOf(issue.labels, vocab),
    trackLabel: program?.usesTrackLabels ? (approvedTrackLabels(issue.labels, vocab)[0] ?? "—") : "—",
  };
}

/** Every open-pipeline issue that belongs to an active program, classified once. */
export function pipelineRows(issues, ctx) {
  const rows = [];
  for (const issue of issues) {
    if (!issue.inOpenPipeline) continue;
    const program = programOf(issue, ctx.programs);
    if (program) rows.push(classifyRow(issue, program, ctx));
  }
  return rows;
}

// ── panels over a set of rows ────────────────────────────────────────────────────────────────────

export function kpis(rows) {
  const current = rows.filter((row) => row.onCur);
  return {
    pipeline: rows.length,
    open: rows.filter((row) => row.bucket !== "inProgress").length,
    inProgress: rows.filter((row) => row.bucket === "inProgress").length,
    overdue: rows.filter((row) => row.overdue).length,
    plannedCurrent: current.length,
    plannedNext: rows.filter((row) => row.onNext).length,
    noFixVersion: rows.filter((row) => row.fixVersions.length === 0).length,
    noStoryPoints: current.filter((row) => row.effort.source === "none").length,
  };
}

/** Version names actually observed in a month — patches (.1.1, .1.2) count for that month. */
function observedVersions(rows, ym) {
  return rows.flatMap((row) => row.fixVersions.filter((name) => releaseYms({ fixVersions: [name] })[0] === ym));
}

export function releaseClauses(rows, window) {
  return {
    current: versionsClause(observedVersions(rows, window.current.ym), window.current.name),
    next: versionsClause(observedVersions(rows, window.next.ym), window.next.name),
  };
}

const COVERAGE_LABELS = {
  current: (w) => `This release — ${w.current.label}`,
  next: (w) => `Next release — ${w.next.label}`,
  later: () => "Later / other release",
  overdue: () => "Overdue — past release, still open",
  none: () => "No fix version",
};

/** Coverage (C6): every open item in exactly one of five buckets, each linked to Jira. */
export function coverage(rows, ctx, baseJql, clauses) {
  const keysIn = (bucket) => rows.filter((row) => row.coverage === bucket).map((row) => row.key);
  const jql = {
    current: and(baseJql, clauses.current),
    next: and(baseJql, `${clauses.next} AND NOT (${clauses.current})`),
    // Computed sets; past the link cap fall back to the closest semantic query.
    overdue: keysJql(keysIn("overdue"), and(baseJql, `fixVersion < ${quote(ctx.window.current.name)}`)),
    later: keysJql(keysIn("later"), and(baseJql, "fixVersion IS NOT EMPTY")),
    none: and(baseJql, "fixVersion IS EMPTY"),
  };
  return ["current", "next", "later", "overdue", "none"].map((bucket) => {
    const count = keysIn(bucket).length;
    return { key: bucket, label: COVERAGE_LABELS[bucket](ctx.window), count, pct: pctOf(count, rows.length), jql: jql[bucket] };
  });
}

export function priorityTable(rows, baseJql) {
  const groups = new Map();
  for (const row of rows) {
    const entry = groups.get(row.prio) ?? { prio: row.prio, open: 0, inProgress: 0, names: new Set() };
    if (row.bucket === "inProgress") entry.inProgress += 1;
    else entry.open += 1;
    if (row.priorityName) entry.names.add(row.priorityName);
    groups.set(row.prio, entry);
  }
  const order = [...PRIORITY_ORDER, "Other"];
  return [...groups.values()]
    .sort((a, b) => order.indexOf(a.prio) - order.indexOf(b.prio))
    .map((entry) => ({
      prio: entry.prio,
      label: PRIORITY_LABELS[entry.prio] ?? "Other",
      open: entry.open,
      inProgress: entry.inProgress,
      total: entry.open + entry.inProgress,
      jql: entry.names.size ? and(baseJql, `priority IN (${[...entry.names].sort().map(quote).join(", ")})`) : null,
    }));
}

/** Open + in progress by approved vulnerability label (top 10 + Others), each with its JQL. */
export function vulnMix(rows, ctx, baseJql, top = 10) {
  const counts = new Map();
  const unapprovedSeen = new Set();
  for (const row of rows) {
    counts.set(row.vuln, (counts.get(row.vuln) ?? 0) + 1);
    if (row.vuln === UNAPPROVED_VULN) unapprovedVulnLike(row.issue.labels, ctx.vocab).forEach((label) => unapprovedSeen.add(label));
  }
  const noApproved = `(labels IS EMPTY OR labels NOT IN (${ctx.vocab.vuln.map(quote).join(", ")}))`;
  const unapproved = [...unapprovedSeen].map(quote).join(", ");
  const clause = (name) => {
    if (name === UNAPPROVED_VULN) return unapproved ? `labels IN (${unapproved}) AND ${noApproved}` : null;
    if (name === NO_VULN_LABEL) return unapproved ? `${noApproved} AND (labels IS EMPTY OR labels NOT IN (${unapproved}))` : noApproved;
    return `labels = ${quote(name)}`;
  };
  const groupJql = (names) => {
    const parts = names.map(clause).filter(Boolean).map((part) => `(${part})`);
    return parts.length ? and(baseJql, `(${parts.join(" OR ")})`) : null;
  };
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = entries.slice(0, top).map(([label, count]) => ({ label, count, jql: groupJql([label]) }));
  const rest = entries.slice(top);
  if (rest.length) {
    shown.push({
      label: `Others (${rest.length} labels)`,
      count: rest.reduce((sum, [, count]) => sum + count, 0),
      jql: groupJql(rest.map(([label]) => label)),
      others: true,
    });
  }
  return { total: rows.length, entries: shown };
}

function sumEffort(rows) {
  const out = { n: rows.length, days: 0, realisticDays: 0, fromOe: 0, fromSp: 0, unsized: 0, placeholders: 0, placeholderDays: 0 };
  for (const row of rows) {
    const { days, source, placeholder } = row.effort;
    if (source === "none") out.unsized += 1;
    else {
      out.days += days;
      if (source === "oe") out.fromOe += 1;
      else out.fromSp += 1;
      if (placeholder) {
        out.placeholders += 1;
        out.placeholderDays += days;
      } else out.realisticDays += days;
    }
  }
  out.days = round1(out.days);
  out.realisticDays = round1(out.realisticDays);
  out.placeholderDays = round1(out.placeholderDays);
  out.sized = out.n - out.unsized;
  out.pctSized = pctOf(out.sized, out.n);
  return out;
}

/** This / next release plan: vulnerability × track with effort and the unsized count (top 12). */
export function releasePlan(rows, scopeJql, storyPointsField, top = 12) {
  const groups = new Map();
  for (const row of rows) {
    const id = `${row.vuln}||${row.trackLabel}`;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  const entries = [...groups.entries()]
    .map(([id, list]) => {
      const [vuln, track] = id.split("||");
      const effort = sumEffort(list);
      return { vuln, track, n: list.length, days: effort.days, unsized: effort.unsized };
    })
    .sort((a, b) => b.n - a.n || a.vuln.localeCompare(b.vuln));
  const rest = entries.slice(top);
  const total = sumEffort(rows);
  return {
    count: rows.length,
    jql: scopeJql,
    rows: entries.slice(0, top),
    others: rest.length
      ? { groups: rest.length, n: rest.reduce((s, e) => s + e.n, 0), days: round1(rest.reduce((s, e) => s + e.days, 0)), unsized: rest.reduce((s, e) => s + e.unsized, 0) }
      : null,
    total: { n: total.n, days: total.days, unsized: total.unsized, unsizedJql: and(scopeJql, noEstimateClause(storyPointsField)) },
  };
}

/** Story point coverage + effort per scope; placeholder (45 d / 110 d) estimates split out. */
export function effortPanel(rows, scopes, storyPointsField) {
  const noEst = noEstimateClause(storyPointsField);
  return scopes.map((scope) => {
    const list = rows.filter(scope.match);
    const effort = sumEffort(list);
    return { key: scope.key, label: scope.label, jql: scope.jql, unsizedJql: scope.jql ? and(scope.jql, noEst) : null, ...effort };
  });
}

/** 1.0 vs 2.0 split — only for a program with a legacy label. */
export function legacySplit(rows, program, baseJql) {
  if (!program?.legacyLabel) return null;
  const side = (list, name, jql) => ({
    name,
    jql,
    open: list.filter((row) => row.bucket !== "inProgress").length,
    inProgress: list.filter((row) => row.bucket === "inProgress").length,
    planned: list.filter((row) => row.fixVersions.length > 0).length,
    total: list.length,
    pct: pctOf(list.length, rows.length),
  });
  const legacy = rows.filter((row) => hasLabel(row.issue.labels, program.legacyLabel));
  const current = rows.filter((row) => !hasLabel(row.issue.labels, program.legacyLabel));
  return {
    label: program.legacyLabel,
    sides: [
      side(legacy, `Legacy (${program.legacyLabel})`, and(baseJql, `labels = ${quote(program.legacyLabel)}`)),
      side(current, "Current", and(baseJql, notLabel(program.legacyLabel))),
    ],
  };
}

// ── progress (Done-inclusive universe) ───────────────────────────────────────────────────────────

const PROGRESS_MONTHS = 14;

/** The last three COMPLETE calendar months (C8), oldest first. */
export function lastThreeMonths(nowTime) {
  const current = istYm(nowTime);
  return [3, 2, 1].map((back) => ({ ym: current - back, label: ymLabel(current - back) }));
}

/** One program's progress universe → remediated %, dismissed, 3-month closures, 14-month series. */
export function progressOf(issues, program, ctx) {
  const universe = issues.filter((issue) => inProgressUniverse(issue, program));
  const months = lastThreeMonths(ctx.nowTime);
  const startYm = istYm(ctx.nowTime) - (PROGRESS_MONTHS - 1);
  const out = {
    total: universe.length, done: 0, dismissed: 0, inProgress: 0, open: 0,
    byMonth: [0, 0, 0], closed7d: 0, approxDates: 0, noDate: 0,
    inflow: new Array(PROGRESS_MONTHS + 1).fill(0), fixed: new Array(PROGRESS_MONTHS + 1).fill(0),
  };
  const slot = (time) => (time === null ? null : Math.max(0, istYm(time) - startYm + 1)); // 0 = "earlier"

  for (const issue of universe) {
    const bucket = statusBucket(issue);
    const created = slot(toTime(issue.jiraCreatedAt));
    if (created !== null) out.inflow[created] += 1;
    if (bucket !== "done") {
      out[bucket] += 1;
      continue;
    }
    out.done += 1;
    if (isDismissed(issue)) out.dismissed += 1;
    const finished = doneTime(issue);
    if (finished === null) {
      out.noDate += 1;
      continue;
    }
    if (!issue.resolvedAt) out.approxDates += 1;
    out.fixed[slot(finished)] += 1;
    const monthIndex = months.findIndex((month) => month.ym === istYm(finished));
    if (monthIndex !== -1) out.byMonth[monthIndex] += 1;
    if (finished >= ctx.nowTime - 7 * DAY_MS) out.closed7d += 1;
  }
  return finishProgress(out, months, startYm);
}

function finishProgress(out, months, startYm) {
  const labels = ["earlier", ...Array.from({ length: PROGRESS_MONTHS }, (_, i) => ymLabel(startYm + i))];
  let running = 0;
  const backlog = labels.map((_, i) => (running += out.inflow[i] - out.fixed[i]));
  return {
    total: out.total,
    done: out.done,
    dismissed: out.dismissed,
    fixed: out.done - out.dismissed,
    inProgress: out.inProgress,
    open: out.open,
    remaining: out.total - out.done,
    pct: out.total ? Math.round((out.done * 100) / out.total) : 0,
    fixedPct: out.total ? Math.round(((out.done - out.dismissed) * 100) / out.total) : 0,
    months: months.map((month) => month.label),
    byMonth: out.byMonth,
    last3: out.byMonth.reduce((sum, value) => sum + value, 0),
    closed7d: out.closed7d,
    approxDates: out.approxDates,
    noDate: out.noDate,
    monthly: { labels, inflow: out.inflow, fixed: out.fixed, backlog },
  };
}

/** Sum progress blocks (the rollup is each program's own universe, summed — artifact parity). */
export function sumProgress(blocks) {
  const sum = (key) => blocks.reduce((total, block) => total + block[key], 0);
  const sumArray = (pick) => blocks[0] ? pick(blocks[0]).map((_, i) => blocks.reduce((t, b) => t + pick(b)[i], 0)) : [];
  const total = sum("total");
  const done = sum("done");
  const dismissed = sum("dismissed");
  const inflow = sumArray((b) => b.monthly.inflow);
  const fixed = sumArray((b) => b.monthly.fixed);
  const byMonth = sumArray((b) => b.byMonth);
  let running = 0;
  return {
    total, done, dismissed,
    fixed: done - dismissed,
    inProgress: sum("inProgress"),
    open: sum("open"),
    remaining: total - done,
    pct: total ? Math.round((done * 100) / total) : 0,
    fixedPct: total ? Math.round(((done - dismissed) * 100) / total) : 0,
    months: blocks[0]?.months ?? [],
    byMonth,
    last3: byMonth.reduce((s, v) => s + v, 0),
    closed7d: sum("closed7d"),
    approxDates: sum("approxDates"),
    noDate: sum("noDate"),
    monthly: {
      labels: blocks[0]?.monthly.labels ?? [],
      inflow,
      fixed,
      backlog: inflow.map((_, i) => (running += inflow[i] - fixed[i])),
    },
  };
}

/**
 * "Path to zero" (Naveen 2026-10-20: the engaging half beside the progress chart). Pure arithmetic
 * over numbers already computed — no new query:
 * - pace = closures and new inflow per month over the last 3 COMPLETE months (C8's window);
 * - ETA = open backlog ÷ net burn, in calendar months from now; null when new work keeps pace or
 *   outpaces fixes (the card then says so instead of inventing a date);
 * - release ladder = remediated % today, then if the current / next release ship everything
 *   planned (an upper bound: planned items are counted as if all close).
 */
export function pathToZero(progress, kpis, nowTime) {
  const inflowLast3 = progress.months.reduce((sum, label) => {
    const index = progress.monthly.labels.indexOf(label);
    return sum + (index === -1 ? 0 : progress.monthly.inflow[index]);
  }, 0);
  const fixedPerMonth = Math.round((progress.last3 / 3) * 10) / 10;
  const newPerMonth = Math.round((inflowLast3 / 3) * 10) / 10;
  const netBurn = Math.round((fixedPerMonth - newPerMonth) * 10) / 10;
  const remaining = progress.remaining;
  const monthsToZero = remaining === 0 ? 0 : netBurn > 0 ? Math.ceil(remaining / netBurn) : null;
  const pct = (done) => (progress.total ? Math.min(100, Math.round((done * 100) / progress.total)) : 0);
  return {
    remaining,
    fixedPerMonth,
    newPerMonth,
    netBurn,
    monthsToZero,
    etaLabel: monthsToZero === null ? null : ymLabel(istYm(nowTime) + monthsToZero),
    ladder: [
      { key: "today", pct: progress.pct },
      { key: "current", pct: pct(progress.done + kpis.plannedCurrent), adds: kpis.plannedCurrent },
      { key: "next", pct: pct(progress.done + kpis.plannedCurrent + kpis.plannedNext), adds: kpis.plannedNext },
    ],
  };
}

// ── program + rollup ─────────────────────────────────────────────────────────────────────────────

/** The panels shared by a program view and the rollup, over a set of rows. */
function panels(rows, ctx, { baseJql, program }) {
  const { window, settings } = ctx;
  const clauses = releaseClauses(rows, window);
  const curJql = and(baseJql, clauses.current);
  const nextJql = and(baseJql, clauses.next);
  return {
    jql: { base: baseJql, current: curJql, next: nextJql },
    kpis: kpis(rows),
    coverage: coverage(rows, ctx, baseJql, clauses),
    priority: priorityTable(rows, baseJql),
    vulnMix: vulnMix(rows, ctx, baseJql),
    releasePlans: {
      current: releasePlan(rows.filter((row) => row.onCur), curJql, settings.storyPointsField),
      next: releasePlan(rows.filter((row) => row.onNext), nextJql, settings.storyPointsField),
    },
    effort: effortPanel(rows, [
      { key: "current", label: `This release — ${window.current.label}`, match: (row) => row.onCur, jql: curJql },
      { key: "next", label: `Next release — ${window.next.label}`, match: (row) => row.onNext, jql: nextJql },
      { key: "overdue", label: "Overdue — past releases", match: (row) => row.overdue, jql: keysJql(rows.filter((r) => r.overdue).map((r) => r.key)) },
      { key: "none", label: "No fix version", match: (row) => row.fixVersions.length === 0, jql: and(baseJql, "fixVersion IS EMPTY") },
      { key: "all", label: "All open + in progress", match: () => true, jql: baseJql },
    ], settings.storyPointsField),
    legacy: legacySplit(rows, program, baseJql),
    placeholderDays: settings.placeholderEstimateDays,
    campaigns: campaigns(rows),
  };
}

/**
 * One program's full read model.
 * @param {object} program SecurityProgram row
 * @param {Array<object>} rows `pipelineRows` output (all programs; filtered here)
 * @param {Array<object>} issues the whole mirror (for the progress universes)
 */
export function aggregateProgram(program, rows, issues, ctx) {
  const mine = rows.filter((row) => row.program.key === program.key);
  const baseJql = programBaseJql(program, ctx.settings);
  const risks = riskSignals(mine, { baseJql, thresholds: ctx.settings.riskThresholds, untriagedClause: ctx.untriagedClause, now: ctx.now });
  const shared = panels(mine, ctx, { baseJql, program });
  const progress = { ...progressOf(issues, program, ctx), jql: programProgressJql(program) };
  return {
    program: describeProgram(program),
    ...shared,
    progress,
    pathToZero: pathToZero(progress, shared.kpis, ctx.nowTime),
    risks,
    level: overallLevel(risks),
  };
}

/**
 * The "All programs" view: per-program aggregates + rollup panels. Every COUNT is the sum of the
 * programs (fixture-checked); list panels run over the union of rows, which is the same set.
 */
export function aggregateRollup(programAggs, rows, issues, ctx) {
  const programs = ctx.programs;
  const baseJql = rollupBaseJql(programs, ctx.settings);
  const rollupPanels = panels(rows, ctx, { baseJql, program: null });
  const summed = Object.fromEntries(
    Object.keys(rollupPanels.kpis).map((key) => [key, programAggs.reduce((sum, agg) => sum + agg.kpis[key], 0)]),
  );
  const rollupProgress = { ...sumProgress(programAggs.map((agg) => agg.progress)), jql: rollupProgressJql(programs) };
  return {
    program: { key: "ALL", name: "All programs" },
    ...rollupPanels,
    kpis: summed,
    progress: rollupProgress,
    pathToZero: pathToZero(rollupProgress, summed, ctx.nowTime),
    scorecard: programAggs
      .map((agg) => ({
        key: agg.program.key,
        name: agg.program.name,
        pct: agg.progress.pct,
        done: agg.progress.done,
        total: agg.progress.total,
        remaining: agg.progress.remaining,
        byMonth: agg.progress.byMonth,
        last3: agg.progress.last3,
        plannedCurrent: agg.kpis.plannedCurrent,
        plannedNext: agg.kpis.plannedNext,
        progressJql: agg.progress.jql,
        currentJql: agg.jql.current,
        nextJql: agg.jql.next,
      }))
      .sort((a, b) => b.total - a.total),
    heatmap: programAggs.map((agg) => ({ program: agg.program, pipeline: agg.kpis.pipeline, level: agg.level, risks: agg.risks })),
  };
}

function describeProgram(program) {
  return {
    key: program.key,
    name: program.name,
    component: program.component,
    note: program.note ?? null,
    excludeLabel: program.excludeLabel ?? null,
    legacyLabel: program.legacyLabel ?? null,
    usesTrackLabels: Boolean(program.usesTrackLabels),
  };
}

// ── snapshots ────────────────────────────────────────────────────────────────────────────────────

const risk = (agg, key) => agg.risks.find((signal) => signal.key === key)?.count ?? 0;

/** One SecuritySnapshot row's values for a program aggregate (movedToSecVal7d comes from Jira). */
export function snapshotValues(agg, { movedToSecVal7d = 0, currentReleaseName }) {
  return {
    programLabel: agg.program.name,
    total: agg.progress.total,
    done: agg.progress.done,
    dismissed: agg.progress.dismissed,
    inProgress: agg.progress.inProgress,
    open: agg.progress.open,
    pipeline: agg.kpis.pipeline,
    overdue: agg.kpis.overdue,
    noFixVersion: agg.kpis.noFixVersion,
    plannedCurrent: agg.kpis.plannedCurrent,
    plannedNext: agg.kpis.plannedNext,
    noStoryPoints: agg.kpis.noStoryPoints,
    noPlan: risk(agg, "noPlan") > 0 ? 1 : 0,
    pastSla: risk(agg, "pastSla"),
    dueSoon: risk(agg, "dueSoon"),
    untriaged: risk(agg, "untriaged"),
    unassigned: risk(agg, "unassigned"),
    stale: risk(agg, "stale"),
    closed7d: agg.progress.closed7d,
    movedToSecVal7d,
    currentReleaseName,
  };
}

/** The "__all__" row: the sum of the program rows (noPlan = how many programs have no plan). */
export function rollupSnapshotValues(programRows, currentReleaseName) {
  const numeric = Object.keys(programRows[0] ?? {}).filter((key) => typeof programRows[0][key] === "number");
  const out = { programLabel: "All programs", currentReleaseName };
  for (const key of numeric) out[key] = programRows.reduce((sum, row) => sum + row[key], 0);
  return out;
}

