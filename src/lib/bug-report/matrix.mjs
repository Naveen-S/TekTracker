/**
 * Bug-report classification + aggregation (gm-bug-report.md (b)) — PURE.
 *
 * No Prisma, no fetch, no clock of its own: every time-dependent function takes an explicit
 * `asOf` (the share-view-export.md precedent). Plain-Node testable — `.mjs` so fixtures can
 * import it without the Next module graph (the seeding.mjs / metrics.mjs precedent).
 *
 * The load-bearing invariant (decision 12): the `BugReportIssue` cache stores RAW JIRA FACTS
 * ONLY. Band, category and SLA breach are computed HERE, at read time, from `(issue, config,
 * asOf)`. So editing a status list or an SLA day count in /admin re-renders the dashboard
 * instantly with no Jira refresh, and the refresh pipeline stays a dumb mirror.
 *
 * Row/column key sentinels — deliberately not null, so snapshot unique constraints stay NULL-free
 * (the bootstrap-seed Postgres NULL-unique lesson):
 *   `__total__`         the Total Open Bugs row (= the union of scope universes)
 *   `__unattributed__`  statuses matching no category AND no fallback configured (decision 9)
 *   `__unbanded__`      priorities matching no band AND no catch-all configured (decision 11)
 *   `__all__`           the per-scope Total column
 */

export const TOTAL_ROW_KEY = "__total__";
export const UNATTRIBUTED_ROW_KEY = "__unattributed__";
export const UNBANDED_BAND_KEY = "__unbanded__";
export const SCOPE_TOTAL_BAND_KEY = "__all__";

export const TOTAL_ROW_LABEL = "Total Open Bugs";
export const UNATTRIBUTED_ROW_LABEL = "Wrong Component / Status";
export const UNBANDED_BAND_LABEL = "No priority";
export const SCOPE_TOTAL_BAND_LABEL = "Total";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Case-insensitive, whitespace-tolerant comparison — Jira status/priority names are free text. */
function norm(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Which band a priority belongs to (decision 11). Never parses the priority string — matches the
 * configured name sets, then the catch-all band if one is configured.
 *
 * @param {string | null | undefined} priority raw Jira priority name, e.g. "P1 - High"
 * @param {Array<{ id: string, label: string, priorityNames: string[], isCatchAll?: boolean }>} bands
 * @returns {string} band id, or `__unbanded__`
 */
export function resolveBand(priority, bands) {
  const target = norm(priority);
  if (target) {
    for (const band of bands) {
      if (band.priorityNames?.some((name) => norm(name) === target)) {
        return band.id;
      }
    }
  }
  const catchAll = bands.find((band) => band.isCatchAll);
  return catchAll ? catchAll.id : UNBANDED_BAND_KEY;
}

/**
 * Which category a status belongs to (decision 8): FIRST match wins in the given order, so rows
 * always partition and the arithmetic always reconciles. Unmatched statuses fall back to the
 * configured fallback category (decision 9 — Naveen: Engineering Team); with no fallback they
 * land in the `__unattributed__` residual row.
 *
 * @param {string | null | undefined} status raw Jira status name
 * @param {Array<{ id: string, name: string, statuses: string[] }>} categories ordered by sortOrder
 * @param {string | null | undefined} fallbackCategoryId
 * @returns {string} category id, or `__unattributed__`
 */
export function resolveCategory(status, categories, fallbackCategoryId) {
  const target = norm(status);
  if (target) {
    for (const category of categories) {
      if (category.statuses?.some((name) => norm(name) === target)) {
        return category.id;
      }
    }
  }
  if (fallbackCategoryId && categories.some((category) => category.id === fallbackCategoryId)) {
    return fallbackCategoryId;
  }
  return UNATTRIBUTED_ROW_KEY;
}

/**
 * SLA breach (decision 6 — app-computed, NOT a Jira filter): breached when
 * `jiraCreatedAt + days(priority) < asOf`. Keyed by Jira PRIORITY NAME, not by band.
 * No target for that priority, or no `jiraCreatedAt`, ⇒ never breached (never guess).
 *
 * @param {{ priority?: string | null, jiraCreatedAt?: Date | string | null }} issue
 * @param {Map<string, number>} slaDaysByPriority normalized priority name → days, for ONE scope
 * @param {Date} asOf
 */
export function isBreached(issue, slaDaysByPriority, asOf) {
  if (!issue?.jiraCreatedAt) return false;
  const days = slaDaysByPriority.get(norm(issue.priority));
  if (!Number.isFinite(days)) return false;
  const created = issue.jiraCreatedAt instanceof Date ? issue.jiraCreatedAt : new Date(issue.jiraCreatedAt);
  if (Number.isNaN(created.getTime())) return false;
  return created.getTime() + days * MS_PER_DAY < asOf.getTime();
}

/** `[{ priorityName, days }]` → normalized lookup map, per scope. */
export function slaMapForScope(slaTargets) {
  return new Map((slaTargets ?? []).map((target) => [norm(target.priorityName), target.days]));
}

function emptyCell() {
  return { count: 0, breachedCount: 0 };
}

function addTo(cell, breached) {
  cell.count += 1;
  if (breached) cell.breachedCount += 1;
}

/**
 * Build the full matrix from the cached issues + config, as of an explicit instant.
 *
 * Shape: `rows[]` — Total first, then categories in `sortOrder`, then the residual row (only when
 * non-empty). Each row carries `cells[scopeId][bandKey]`, with `__all__` as the per-scope total
 * and `grandTotal` across scopes. Column definitions come back as `scopes[]` (each with its
 * ordered `bands[]`), so a renderer never has to re-derive them — and the `__unbanded__` column
 * appears only when something actually landed there.
 *
 * @param {Array<object>} issues cached BugReportIssue rows (raw Jira facts)
 * @param {{
 *   scopes: Array<{ id: string, name: string, slaTargets?: Array<{priorityName: string, days: number}> }>,
 *   bands: Array<{ id: string, label: string, priorityNames: string[], isCatchAll?: boolean }>,
 *   categories: Array<{ id: string, name: string, statuses: string[] }>,
 *   fallbackCategoryId?: string | null,
 * }} config scopes/bands/categories pre-ordered by sortOrder
 * @param {Date} asOf
 */
export function buildMatrix(issues, config, asOf) {
  const { scopes = [], bands = [], categories = [], fallbackCategoryId = null } = config ?? {};

  const slaByScope = new Map(scopes.map((scope) => [scope.id, slaMapForScope(scope.slaTargets)]));
  const bandKeys = [...bands.map((band) => band.id), UNBANDED_BAND_KEY];
  const usedBandKeys = new Set();
  let unattributedUsed = false;

  const rowKeys = [TOTAL_ROW_KEY, ...categories.map((category) => category.id), UNATTRIBUTED_ROW_KEY];
  const cells = new Map(); // `${rowKey}|${scopeId}|${bandKey}` → cell
  const cellFor = (rowKey, scopeId, bandKey) => {
    const mapKey = `${rowKey}|${scopeId}|${bandKey}`;
    let cell = cells.get(mapKey);
    if (!cell) {
      cell = emptyCell();
      cells.set(mapKey, cell);
    }
    return cell;
  };

  for (const issue of issues) {
    const scopeId = issue.scopeId;
    if (!slaByScope.has(scopeId)) continue; // issue from a deleted scope — never invent a column
    const bandKey = resolveBand(issue.priority, bands);
    const rowKey = resolveCategory(issue.jiraStatus, categories, fallbackCategoryId);
    const breached = isBreached(issue, slaByScope.get(scopeId), asOf);

    usedBandKeys.add(bandKey);
    if (rowKey === UNATTRIBUTED_ROW_KEY) unattributedUsed = true;

    for (const key of [rowKey, TOTAL_ROW_KEY]) {
      addTo(cellFor(key, scopeId, bandKey), breached);
      addTo(cellFor(key, scopeId, SCOPE_TOTAL_BAND_KEY), breached);
    }
  }

  // `__unbanded__` only becomes a real column when something landed in it (decision 11).
  const visibleBandKeys = bandKeys.filter(
    (key) => key !== UNBANDED_BAND_KEY || usedBandKeys.has(UNBANDED_BAND_KEY),
  );
  const bandLabel = new Map([
    ...bands.map((band) => [band.id, band.label]),
    [UNBANDED_BAND_KEY, UNBANDED_BAND_LABEL],
  ]);

  const visibleRowKeys = rowKeys.filter(
    (key) => key !== UNATTRIBUTED_ROW_KEY || unattributedUsed,
  );
  const rowLabel = new Map([
    [TOTAL_ROW_KEY, TOTAL_ROW_LABEL],
    ...categories.map((category) => [category.id, category.name]),
    [UNATTRIBUTED_ROW_KEY, UNATTRIBUTED_ROW_LABEL],
  ]);

  const rows = visibleRowKeys.map((rowKey) => {
    const scopeCells = {};
    const grandTotal = emptyCell();
    for (const scope of scopes) {
      const byBand = {};
      for (const bandKey of [...visibleBandKeys, SCOPE_TOTAL_BAND_KEY]) {
        byBand[bandKey] = { ...cellFor(rowKey, scope.id, bandKey) };
      }
      scopeCells[scope.id] = byBand;
      grandTotal.count += byBand[SCOPE_TOTAL_BAND_KEY].count;
      grandTotal.breachedCount += byBand[SCOPE_TOTAL_BAND_KEY].breachedCount;
    }
    return {
      rowKey,
      rowLabel: rowLabel.get(rowKey),
      isTotal: rowKey === TOTAL_ROW_KEY,
      isResidual: rowKey === UNATTRIBUTED_ROW_KEY,
      cells: scopeCells,
      grandTotal,
    };
  });

  return {
    asOf,
    scopes: scopes.map((scope) => ({
      id: scope.id,
      name: scope.name,
      bands: visibleBandKeys.map((bandKey) => ({ key: bandKey, label: bandLabel.get(bandKey) })),
    })),
    rows,
    totalRow: rows.find((row) => row.isTotal) ?? null,
  };
}

/**
 * Flatten a matrix into `BugReportSnapshot` rows — self-describing (decision 15): every dimension
 * carries both its key and the label as it read that day, so renaming or deleting a
 * category/scope/band never rewrites or orphans history.
 */
export function snapshotRows(matrix, reportId, capturedOn) {
  const rows = [];
  for (const row of matrix.rows) {
    for (const scope of matrix.scopes) {
      const byBand = row.cells[scope.id] ?? {};
      const columns = [
        ...scope.bands,
        { key: SCOPE_TOTAL_BAND_KEY, label: SCOPE_TOTAL_BAND_LABEL },
      ];
      for (const column of columns) {
        const cell = byBand[column.key];
        if (!cell) continue;
        rows.push({
          reportId,
          capturedOn,
          rowKey: row.rowKey,
          rowLabel: row.rowLabel,
          scopeKey: scope.id,
          scopeLabel: scope.name,
          bandKey: column.key,
          bandLabel: column.label,
          count: cell.count,
          breachedCount: cell.breachedCount,
        });
      }
    }
  }
  return rows;
}

/**
 * Per-cell deltas against the most recent PRIOR capture (never zero-filled across gaps — the
 * buildTrendSeries rule). `priorRows` should be exactly one day's snapshot rows.
 *
 * @returns {{ priorDate: Date | null, delta: (rowKey: string, scopeKey: string, bandKey: string) => ({count:number,breachedCount:number} | null) }}
 */
export function diffMatrix(matrix, priorRows) {
  if (!priorRows || priorRows.length === 0) {
    return { priorDate: null, delta: () => null };
  }
  const prior = new Map(
    priorRows.map((row) => [
      `${row.rowKey}|${row.scopeKey}|${row.bandKey}`,
      { count: row.count, breachedCount: row.breachedCount },
    ]),
  );
  const priorDate = priorRows[0].capturedOn ?? null;

  return {
    priorDate,
    delta(rowKey, scopeKey, bandKey) {
      const before = prior.get(`${rowKey}|${scopeKey}|${bandKey}`);
      if (!before) return null;
      const row = matrix.rows.find((candidate) => candidate.rowKey === rowKey);
      const cell = row?.cells?.[scopeKey]?.[bandKey];
      if (!cell) return null;
      return {
        count: cell.count - before.count,
        breachedCount: cell.breachedCount - before.breachedCount,
      };
    },
  };
}

export const AGING_BUCKETS = [
  { key: "0-7", label: "0–7 days", maxDays: 7 },
  { key: "8-30", label: "8–30 days", maxDays: 30 },
  { key: "31-90", label: "31–90 days", maxDays: 90 },
  { key: "90+", label: "90+ days", maxDays: Infinity },
];

/** Age distribution by `jiraCreatedAt`. Issues without a created date are excluded, not guessed. */
export function agingBuckets(issues, asOf) {
  const counts = new Map(AGING_BUCKETS.map((bucket) => [bucket.key, 0]));
  let oldest = null;

  for (const issue of issues) {
    if (!issue.jiraCreatedAt) continue;
    const created =
      issue.jiraCreatedAt instanceof Date ? issue.jiraCreatedAt : new Date(issue.jiraCreatedAt);
    if (Number.isNaN(created.getTime())) continue;
    const ageDays = Math.floor((asOf.getTime() - created.getTime()) / MS_PER_DAY);
    const bucket = AGING_BUCKETS.find((candidate) => ageDays <= candidate.maxDays) ?? AGING_BUCKETS.at(-1);
    counts.set(bucket.key, counts.get(bucket.key) + 1);
    if (!oldest || created < oldest.created) {
      oldest = { created, jiraKey: issue.jiraKey, title: issue.title, ageDays };
    }
  }

  return {
    buckets: AGING_BUCKETS.map((bucket) => ({ ...bucket, count: counts.get(bucket.key) })),
    oldest,
  };
}

/** Days a breached issue is past its SLA — for the breach panel's "N days over" copy. */
export function daysOverSla(issue, slaDaysByPriority, asOf) {
  if (!isBreached(issue, slaDaysByPriority, asOf)) return null;
  const days = slaDaysByPriority.get(norm(issue.priority));
  const created =
    issue.jiraCreatedAt instanceof Date ? issue.jiraCreatedAt : new Date(issue.jiraCreatedAt);
  return Math.floor((asOf.getTime() - created.getTime()) / MS_PER_DAY) - days;
}

function quoteJql(value) {
  return `"${String(value).replace(/["\\]/g, "\\$&")}"`;
}

/**
 * Strip a trailing top-level `ORDER BY …`. Saved Jira filters almost always carry one, and
 * `ORDER BY` is only legal at the very END of a query — so `(<jql with ORDER BY>) AND status IN
 * (…)` is a syntax error, not a narrower search. Only strips when the keyword sits outside quotes
 * (a status could legitimately be named "Order by date").
 */
function stripOrderBy(jql) {
  const pattern = /\border\s+by\b/gi;
  let cut = -1;
  for (let match = pattern.exec(jql); match; match = pattern.exec(jql)) {
    const quotesBefore = (jql.slice(0, match.index).match(/(?<!\\)"/g) ?? []).length;
    if (quotesBefore % 2 === 0) cut = match.index; // outside quotes → a real ORDER BY
  }
  return cut === -1 ? jql.trim() : jql.slice(0, cut).trim();
}

/**
 * The scope's universe as a composable JQL fragment.
 *
 * The universe is **inlined** (its full project / type / status / component criteria) rather than
 * referenced as `filter = <id>`. A filter reference produces the right COUNT but is opaque: Jira's
 * navigator can't show the criteria, and anyone without access to that saved filter just gets an
 * error. Inlining also pins the drill-down to exactly the JQL that produced the cached numbers,
 * so the link can't silently diverge from the cell if the filter is edited in Jira between
 * refreshes.
 *
 * `filter = <id>` remains the fallback for a saved-filter scope that has never been resolved
 * (i.e. before the first refresh), where inlining nothing at all would widen the search to the
 * whole instance — far worse than an opaque-but-correct reference.
 */
function scopeClause(scope) {
  const raw = (scope.resolvedJql ?? scope.jql ?? "").trim();
  if (raw) {
    const stripped = stripOrderBy(raw);
    if (stripped) return `(${stripped})`;
  }
  return scope.jiraFilterId ? `filter = ${scope.jiraFilterId}` : "";
}

/**
 * Compose a cell's drill-down JQL: the scope's universe AND the row's statuses AND the column's
 * priorities. `__total__` / `__all__` simply omit their clause; the residual row and the
 * `__unbanded__` column negate the union of everything mapped.
 *
 * @param {{ resolvedJql?: string | null, jql?: string | null, jiraFilterId?: string | null }} scope
 */
export function cellJql(scope, rowKey, bandKey, config) {
  const { bands = [], categories = [], fallbackCategoryId = null } = config ?? {};
  const clauses = [];

  const base = scopeClause(scope);
  if (base) clauses.push(base);

  const mappedStatuses = categories.flatMap((category) => category.statuses ?? []);
  if (rowKey === UNATTRIBUTED_ROW_KEY) {
    if (mappedStatuses.length > 0) {
      clauses.push(`status NOT IN (${mappedStatuses.map(quoteJql).join(", ")})`);
    }
  } else if (rowKey !== TOTAL_ROW_KEY) {
    const category = categories.find((candidate) => candidate.id === rowKey);
    const statuses = category?.statuses ?? [];
    // The fallback category also owns every unmapped status (decision 9).
    if (rowKey === fallbackCategoryId) {
      const others = categories
        .filter((candidate) => candidate.id !== rowKey)
        .flatMap((candidate) => candidate.statuses ?? []);
      clauses.push(
        others.length > 0
          ? `status NOT IN (${others.map(quoteJql).join(", ")})`
          : statuses.length > 0
            ? `status IN (${statuses.map(quoteJql).join(", ")})`
            : "",
      );
    } else if (statuses.length > 0) {
      clauses.push(`status IN (${statuses.map(quoteJql).join(", ")})`);
    }
  }

  const mappedPriorities = bands.flatMap((band) => band.priorityNames ?? []);
  if (bandKey === UNBANDED_BAND_KEY) {
    if (mappedPriorities.length > 0) {
      clauses.push(`(priority IS EMPTY OR priority NOT IN (${mappedPriorities.map(quoteJql).join(", ")}))`);
    }
  } else if (bandKey !== SCOPE_TOTAL_BAND_KEY) {
    const band = bands.find((candidate) => candidate.id === bandKey);
    if (band?.isCatchAll) {
      const others = bands
        .filter((candidate) => candidate.id !== bandKey)
        .flatMap((candidate) => candidate.priorityNames ?? []);
      if (others.length > 0) {
        clauses.push(`priority NOT IN (${others.map(quoteJql).join(", ")})`);
      }
    } else if (band?.priorityNames?.length > 0) {
      clauses.push(`priority IN (${band.priorityNames.map(quoteJql).join(", ")})`);
    }
  }

  return clauses.filter(Boolean).join(" AND ");
}

/**
 * Which of a scope's SLA-targeted priorities belong to a given column (band).
 * - the scope-total column: every priority that has an SLA target
 * - a specific band: the SLA-targeted priorities the band lists (or, for the catch-all band,
 *   the ones no other band lists)
 * - the `__unbanded__` column: SLA-targeted priorities no band lists
 */
function breachablePriorities(bandKey, bands, slaTargets) {
  const targeted = (slaTargets ?? []).map((target) => target.priorityName);
  if (bandKey === SCOPE_TOTAL_BAND_KEY) return targeted;

  const mappedAll = new Set(bands.flatMap((band) => (band.priorityNames ?? []).map(norm)));
  if (bandKey === UNBANDED_BAND_KEY) {
    return targeted.filter((priority) => !mappedAll.has(norm(priority)));
  }
  const band = bands.find((candidate) => candidate.id === bandKey);
  if (band?.isCatchAll) {
    const others = new Set(
      bands.filter((candidate) => candidate.id !== bandKey).flatMap((c) => (c.priorityNames ?? []).map(norm)),
    );
    return targeted.filter((priority) => !others.has(norm(priority)));
  }
  const own = new Set((band?.priorityNames ?? []).map(norm));
  return targeted.filter((priority) => own.has(norm(priority)));
}

/**
 * A cell's SLA-BREACHED drill-down: the cell's JQL AND the per-priority breach condition, so the
 * red `(m)` count opens exactly those m issues in Jira.
 *
 * Breach is `created + days(priority) < now` (decision 6), and the day count differs per priority —
 * so the constraint is an OR of `(priority = P AND created < -{days}d)` over the priorities that
 * (a) belong to this column and (b) have an SLA target. Jira evaluates `-Nd` at click time, so the
 * link tracks "now" while the cached `(m)` is as-of the last render — the same staleness tolerance
 * every drill-down already has. Returns `null` when the column has no SLA-targeted priority (the
 * `(m)` is 0 and there is nothing to link).
 */
export function cellBreachedJql(scope, rowKey, bandKey, config) {
  const { bands = [] } = config ?? {};
  const targetsByPriority = new Map((scope.slaTargets ?? []).map((t) => [t.priorityName, t.days]));
  const priorities = breachablePriorities(bandKey, bands, scope.slaTargets);
  if (priorities.length === 0) return null;

  const base = cellJql(scope, rowKey, bandKey, config);
  const terms = priorities.map(
    (priority) => `(priority = ${quoteJql(priority)} AND created < -${targetsByPriority.get(priority)}d)`,
  );
  const breachClause = terms.length === 1 ? terms[0] : `(${terms.join(" OR ")})`;
  return base ? `${base} AND ${breachClause}` : breachClause;
}

/**
 * Config validation, applied at save time (decision 8) — a typo'd status would otherwise drain
 * issues into the fallback category silently, which is the worst failure mode this dashboard has.
 *
 * Zero catch-all bands is VALID (decision 11); two is not.
 * @returns {string[]} human-readable errors; empty = valid
 */
export function validateConfig({ scopes = [], bands = [], categories = [], fallbackCategoryId = null } = {}) {
  const errors = [];

  if (scopes.length === 0) errors.push("At least one scope (e.g. External / Internal) is required");
  if (bands.length === 0) errors.push("At least one priority band is required");

  const seenStatus = new Map();
  for (const category of categories) {
    for (const status of category.statuses ?? []) {
      const key = norm(status);
      if (!key) continue;
      if (seenStatus.has(key)) {
        errors.push(
          `Status "${status}" is mapped to both "${seenStatus.get(key)}" and "${category.name}" — a status may belong to only one category`,
        );
      } else {
        seenStatus.set(key, category.name);
      }
    }
  }

  const seenPriority = new Map();
  for (const band of bands) {
    for (const priority of band.priorityNames ?? []) {
      const key = norm(priority);
      if (!key) continue;
      if (seenPriority.has(key)) {
        errors.push(
          `Priority "${priority}" is mapped to both "${seenPriority.get(key)}" and "${band.label}" — a priority may belong to only one band`,
        );
      } else {
        seenPriority.set(key, band.label);
      }
    }
  }

  const catchAlls = bands.filter((band) => band.isCatchAll);
  if (catchAlls.length > 1) {
    errors.push(
      `Only one band may be the catch-all — found ${catchAlls.map((band) => `"${band.label}"`).join(", ")}`,
    );
  }

  if (fallbackCategoryId && !categories.some((category) => category.id === fallbackCategoryId)) {
    errors.push("The fallback category no longer exists — pick another or clear it");
  }

  return errors;
}

/** The default five-band config (decision 11) — one column per real Tekion priority. */
export const DEFAULT_BANDS = [
  { label: "P0", priorityNames: ["P0 - Highest"], isCatchAll: false },
  { label: "P1", priorityNames: ["P1 - High"], isCatchAll: false },
  { label: "P2", priorityNames: ["P2 - Medium"], isCatchAll: false },
  { label: "P3", priorityNames: ["P3 - Low"], isCatchAll: false },
  { label: "P4", priorityNames: ["P4 - Lowest"], isCatchAll: false },
];
