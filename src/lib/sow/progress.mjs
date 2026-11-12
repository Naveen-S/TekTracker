/**
 * SOW progress (sow-tracker.md decision 5). Pure functions over CLASSIFIED rows.
 *
 * `% = Σ(weight × credit) ÷ Σ weight`, where the weight comes from the ticket's kind and the
 * credit from its Jira status (by name where known, else by status category). Epics are never weighed: an epic's % is its descendants'.
 * A bug weighs little, so a wave of QA bugs barely moves the headline.
 */
import { BUG_KINDS, DEFAULT_KIND_WEIGHTS, KINDS, SCOPE_KINDS, STATUS_CREDIT, STATUS_NAME_CREDIT } from "./defaults.mjs";

export function normalizeWeights(weights) {
  const source = weights && typeof weights === "object" ? weights : {};
  const result = {};
  for (const kind of KINDS) {
    if (kind === "EPIC") continue;
    const value = Number(source[kind]);
    result[kind] = Number.isFinite(value) && value >= 0 ? value : DEFAULT_KIND_WEIGHTS[kind];
  }
  return result;
}

/** 0–1 credit for a ticket: by status name where known, else by Jira status category. */
export function creditOf(row) {
  const byName = STATUS_NAME_CREDIT[String(row.status ?? "").trim().toLowerCase()];
  return byName ?? STATUS_CREDIT[row.statusCategory] ?? 0;
}

/** `done` at full credit, `todo` at none, anything between is in progress. */
export function progressState(row) {
  const credit = creditOf(row);
  if (credit >= 1) return "done";
  return credit > 0 ? "inProgress" : "todo";
}

/** The four-step state the scope map draws: review is in progress at 0.7 credit or more. */
export function detailState(row) {
  const credit = creditOf(row);
  if (credit >= 1) return "done";
  if (credit >= 0.7) return "inReview";
  return credit > 0 ? "inProgress" : "todo";
}

function countStates(rows) {
  const counts = { done: 0, inProgress: 0, todo: 0 };
  for (const row of rows) counts[progressState(row)] += 1;
  return counts;
}

/** Weighted progress of a set of rows (epic rows are skipped). `pct` is null when nothing weighs. */
export function weightedProgress(rows, weights) {
  const tally = { total: 0, done: 0, inProgress: 0, todo: 0, weight: 0, earned: 0 };
  for (const row of rows) {
    if (row.kind === "EPIC") continue;
    const weight = weights[row.kind] ?? 0;
    tally.total += 1;
    tally.weight += weight;
    tally.earned += weight * creditOf(row);
    tally[progressState(row)] += 1;
  }
  return { ...tally, pct: tally.weight > 0 ? (tally.earned / tally.weight) * 100 : null };
}

/** The Epic-kind ancestor of a row within the mirror, or null. Guards against parent cycles. */
function epicOf(row, byKey) {
  const seen = new Set([row.jiraKey]);
  let parent = row.parentKey ? byKey.get(row.parentKey) : null;
  while (parent && !seen.has(parent.jiraKey)) {
    if (parent.kind === "EPIC") return parent;
    seen.add(parent.jiraKey);
    parent = parent.parentKey ? byKey.get(parent.parentKey) : null;
  }
  return null;
}

/** Epics with their descendant tickets and rolled-up progress, plus the tickets under no epic. */
export function buildEpicTree(rows, weights) {
  const byKey = new Map(rows.map((row) => [row.jiraKey, row]));
  const children = new Map();
  const orphans = [];
  for (const row of rows) {
    if (row.kind === "EPIC") continue;
    const epic = epicOf(row, byKey);
    if (!epic) orphans.push(row);
    else children.set(epic.jiraKey, [...(children.get(epic.jiraKey) ?? []), row]);
  }
  const epics = rows
    .filter((row) => row.kind === "EPIC")
    .map((epic) => {
      const kids = children.get(epic.jiraKey) ?? [];
      return { epic, children: kids, progress: weightedProgress(kids, weights) };
    });
  return { epics, orphans };
}

function kindBreakdown(rows, weights) {
  return KINDS.map((kind) => {
    const members = rows.filter((row) => row.kind === kind);
    if (kind === "EPIC") {
      return { kind, total: members.length, ...countStates(members), pct: null, weight: 0 };
    }
    const { total, done, inProgress, todo, pct } = weightedProgress(members, weights);
    return { kind, total, done, inProgress, todo, pct, weight: weights[kind] };
  }).filter((entry) => entry.total > 0);
}

/**
 * Everything the page reads about progress.
 * @param {Array<object>} rows classified rows
 * @param {unknown} rawWeights `Sow.kindWeights`
 */
export function summarizeProgress(rows, rawWeights) {
  const weights = normalizeWeights(rawWeights);
  const bugs = rows.filter((row) => BUG_KINDS.includes(row.kind));
  const tree = buildEpicTree(rows, weights);
  return {
    weights,
    overall: weightedProgress(rows, weights),
    scope: weightedProgress(rows.filter((row) => SCOPE_KINDS.includes(row.kind)), weights),
    byKind: kindBreakdown(rows, weights),
    epics: tree.epics,
    orphans: tree.orphans,
    bugs: { total: bugs.length, open: bugs.length - countStates(bugs).done },
    dependencies: rows.filter((row) => row.isDependency),
    totalIssues: rows.length,
  };
}

/** The numbers one daily `SowSnapshot` row stores. */
export function snapshotValues(summary) {
  const byKind = {};
  for (const entry of summary.byKind) {
    byKind[entry.kind] = { total: entry.total, done: entry.done, inProgress: entry.inProgress };
  }
  return {
    progressPct: Math.round((summary.overall.pct ?? 0) * 10) / 10,
    totalIssues: summary.totalIssues,
    doneIssues: summary.byKind.reduce((sum, entry) => sum + entry.done, 0),
    openBugs: summary.bugs.open,
    byKind,
  };
}
