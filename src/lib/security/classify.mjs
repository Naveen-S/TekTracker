/**
 * Read-time classification of one mirrored `SecurityIssue` (security-vulnerability-tracker.md
 * (b) classify.mjs). Pure — no Prisma, no fetch — so every rule is fixture-testable and an /admin
 * edit re-renders with no Jira refresh (the BugReportIssue precedent).
 *
 * Rules are ported from the artifact (v32: statusBucket, isDismissed, prioName, slaOf, releaseDay,
 * relYm, parseOligo) except where the spec's clarifications deliberately differ:
 * - C5: the program's excludeLabel (NON_DR_GM) removes an issue from that program EVERYWHERE, by
 *   exact case-insensitive label match (the artifact used a substring test).
 * - C9: isDismissed matches resolution OR status (the artifact checked status only).
 */

export const DAY_MS = 86_400_000;
/** 1 estimate-day = 8 h — Jira's default working day (the artifact's WORKDAY). */
export const WORKDAY_SEC = 8 * 3600;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** IST is UTC+05:30 with no DST — ship deadlines are 23:59:59 Asia/Kolkata (decision 6). */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

export function toTime(value) {
  if (value === null || value === undefined) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

// ── status + priority ────────────────────────────────────────────────────────────────────────────

/** "done" | "inProgress" | "open". `Dev To Do` counts as in progress (team convention). */
export function statusBucket(issue) {
  if (issue.statusCategory === "done") return "done";
  if (issue.statusCategory === "indeterminate") return "inProgress";
  if (String(issue.status ?? "").toLowerCase() === "dev to do") return "inProgress";
  return "open";
}

const DISMISS_RE =
  /not applicable|won'?t\s*do|duplicate|rejected|cancell?ed|not a bug|invalid|declin|risk accepted/;

/** A Done issue closed as dismissed rather than fixed. Still Done; reported separately. */
export function isDismissed(issue) {
  if (statusBucket(issue) !== "done") return false;
  return [issue.resolution, issue.status].some((value) => DISMISS_RE.test(String(value ?? "").toLowerCase()));
}

export const PRIORITY_ORDER = ["P0", "P1", "P2", "P3", "P4"];
export const PRIORITY_LABELS = {
  P0: "P0 - Highest",
  P1: "P1 - High",
  P2: "P2 - Medium",
  P3: "P3 - Low",
  P4: "P4 - Lowest",
};

/** Jira priority name → "P0".."P4" (mapped, not parsed — the artifact's prioName), else "Other". */
export function prioName(priority) {
  const name = String(priority ?? "");
  if (/highest/i.test(name) || /^p0/i.test(name)) return "P0";
  if (/high/i.test(name)) return "P1";
  if (/medium/i.test(name)) return "P2";
  if (/lowest/i.test(name)) return "P4";
  if (/low/i.test(name)) return "P3";
  return "Other";
}

export const isP0P1 = (issue) => ["P0", "P1"].includes(prioName(issue.priority));

/** Whole calendar days since creation. */
export function ageDays(issue, now) {
  const created = toTime(issue.jiraCreatedAt);
  return created === null ? null : Math.floor((toTime(now) - created) / DAY_MS);
}

/**
 * SLA state from creation (decision 5): breached when age > SLA, due within `dueSoonDays`, else ok;
 * "none" when the priority has no SLA (P4) or the age is unknown.
 */
export function slaOf(issue, slaDays, dueSoonDays, now) {
  const prio = prioName(issue.priority);
  const age = ageDays(issue, now);
  const days = slaDays?.[prio];
  if (days === null || days === undefined || age === null) return { prio, age, sla: null, state: "none" };
  const state = age > days ? "breached" : age > days - dueSoonDays ? "due" : "ok";
  return { prio, age, sla: days, state };
}

// ── release window ───────────────────────────────────────────────────────────────────────────────

/** "Release-YYYY.MM.x.y" → year*12 + monthIndex, else null. */
export function relYm(versionName) {
  const match = /^Release-(\d{4})\.(\d{2})\./.exec(versionName ?? "");
  return match ? Number(match[1]) * 12 + (Number(match[2]) - 1) : null;
}

export const ymKey = (ym) => `${Math.floor(ym / 12)}-${String((ym % 12) + 1).padStart(2, "0")}`;
export const ymLabel = (ym) => `${MONTHS[ym % 12]} '${String(Math.floor(ym / 12)).slice(2)}`;
export const ymOf = (time) => {
  const date = new Date(time);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

/**
 * Calendar rows ({ month: "YYYY-MM", shipDate }) → the ship day for any month; months past the
 * last row reuse its day and are flagged estimated.
 */
function shipDayFor(ym, calendar) {
  const byMonth = new Map(calendar.map((row) => [row.month, new Date(row.shipDate).getUTCDate()]));
  const key = ymKey(ym);
  if (byMonth.has(key)) return { day: byMonth.get(key), est: false };
  const last = [...calendar].sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  return { day: last ? new Date(last.shipDate).getUTCDate() : 15, est: true };
}

function describeRelease(ym, calendar) {
  const { day, est } = shipDayFor(ym, calendar);
  const year = Math.floor(ym / 12);
  const month = ym % 12;
  // 23:59:59 IST on the ship day, as a UTC instant.
  const deadline = Date.UTC(year, month, day, 23, 59, 59) - IST_OFFSET_MS;
  return {
    ym,
    month: ymKey(ym),
    name: `Release-${year}.${String(month + 1).padStart(2, "0")}.1.0`,
    label: `${MONTHS_FULL[month]} ${year}`,
    short: ymLabel(ym),
    shipDay: day,
    deadline: new Date(deadline),
    est,
  };
}

/**
 * The rolling window (decision 6): `current` is the first release whose ship deadline has not
 * passed; `next` follows it; `prev` are the three before `current`, oldest first.
 */
export function releaseWindow(calendar, now) {
  const nowTime = toTime(now);
  const ist = new Date(nowTime + IST_OFFSET_MS);
  let ym = ist.getUTCFullYear() * 12 + ist.getUTCMonth();
  for (let guard = 0; guard < 26; guard += 1) {
    if (describeRelease(ym, calendar).deadline.getTime() >= nowTime) break;
    ym += 1;
  }
  return {
    current: describeRelease(ym, calendar),
    next: describeRelease(ym + 1, calendar),
    prev: [3, 2, 1].map((back) => describeRelease(ym - back, calendar)),
  };
}

/** Release year-months on an issue's fix versions (patches of a month all count for that month). */
export function releaseYms(issue) {
  return (issue.fixVersions ?? []).map(relYm).filter((ym) => ym !== null);
}

/**
 * Overdue (decision 6): the earliest Release- month is before the current release month AND the
 * issue has no fix version in the current or next month.
 */
export function isOverdue(issue, window) {
  const yms = releaseYms(issue);
  if (yms.length === 0) return false;
  return (
    Math.min(...yms) < window.current.ym &&
    !yms.includes(window.current.ym) &&
    !yms.includes(window.next.ym)
  );
}

export const COVERAGE_BUCKETS = ["current", "next", "later", "overdue", "none"];

/**
 * Coverage (C6 — the spec's 5 buckets; each open item counted exactly once):
 * overdue → current → next → later (any other fix version) → none (no fix version at all).
 */
export function coverageBucket(issue, window) {
  if (isOverdue(issue, window)) return "overdue";
  const yms = releaseYms(issue);
  if (yms.includes(window.current.ym)) return "current";
  if (yms.includes(window.next.ym)) return "next";
  if ((issue.fixVersions ?? []).length > 0) return "later";
  return "none";
}

// ── membership + labels ──────────────────────────────────────────────────────────────────────────

/** Exact, case-insensitive label membership. */
export function hasLabel(labels, label) {
  if (!label) return false;
  const wanted = label.toUpperCase();
  return (labels ?? []).some((candidate) => String(candidate).toUpperCase() === wanted);
}

/** Excluded from a program by its excludeLabel (C5: everywhere, exact match). */
export const isExcluded = (issue, program) => hasLabel(issue.labels, program.excludeLabel);

/**
 * The open-pipeline program an issue belongs to: the first active program (by sortOrder) whose
 * component is on the issue and whose excludeLabel it does not carry. null ⇒ no program.
 */
export function programOf(issue, programs) {
  const components = new Set(issue.components ?? []);
  return programs.find((program) => components.has(program.component) && !isExcluded(issue, program)) ?? null;
}

/** In a program's Done-inclusive progress universe (its own query returned it, minus exclusions). */
export function inProgressUniverse(issue, program) {
  return (issue.progressProgramKeys ?? []).includes(program.key) && !isExcluded(issue, program);
}

/** Triaged = carries a `<prefix>MMM_YYYY` month label (decision 7). */
export function isTriaged(labels, prefix) {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}[A-Z]{3}_\\d{4}$`, "i");
  return (labels ?? []).some((label) => pattern.test(label));
}

/** Every month label that can exist so far (Jan 2025 → next month) — for the untriaged JQL. */
export function monthLabelsUntil(prefix, now) {
  const out = [];
  const end = ymOf(toTime(now)) + 1;
  for (let ym = 2025 * 12; ym <= end; ym += 1) {
    out.push(`${prefix}${MONTHS[ym % 12].toUpperCase()}_${Math.floor(ym / 12)}`);
  }
  return out;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `*_BREACHED` labels — a per-program convention (trackBreached). */
export const breachLabels = (labels) => (labels ?? []).filter((label) => /BREACHED/i.test(label));

// ── findings (Oligo summaries) ───────────────────────────────────────────────────────────────────

// "Oligo | CVE-2025-58056 - io.netty:netty-codec-http@4.1.33.Final  - drp-integrations-gateway-bifrostint "
const OLIGO_RE = /^\s*Oligo\s*\|\s*(CVE-\d{4}-\d+)\s+-\s+(.+?)@(\S+)\s+-\s+(.+?)\s*$/;

/** Oligo summary → { cve, pkg, version, image }, or null for any other finding format. */
export function parseFinding(summary) {
  const match = OLIGO_RE.exec(summary ?? "");
  return match ? { cve: match[1], pkg: match[2].trim(), version: match[3], image: match[4].trim() } : null;
}

// ── vocabulary ───────────────────────────────────────────────────────────────────────────────────

/** Approved vulnerability labels on an issue, canonical spelling, in label order. */
export function approvedVulnLabels(labels, vocab) {
  return dedupe((labels ?? []).map((label) => vocab.vulnIdx.get(String(label).toUpperCase())).filter(Boolean));
}

/** Approved track labels on an issue (only meaningful where the program uses tracks). */
export function approvedTrackLabels(labels, vocab) {
  return dedupe((labels ?? []).map((label) => vocab.trackIdx.get(String(label).toUpperCase())).filter(Boolean));
}

// Labels plainly meant as a vulnerability label but not on the approved list (moment-vulna, …).
const LOOKS_VULN = /vuln|_upgrade$|next_?js|decomm?is/i;

export function unapprovedVulnLike(labels, vocab) {
  return (labels ?? []).filter((label) => {
    const upper = String(label).toUpperCase();
    return LOOKS_VULN.test(label) && !vocab.vulnIdx.has(upper) && !vocab.trackIdx.has(upper);
  });
}

export const UNAPPROVED_VULN = "⚠ Unapproved label";
export const NO_VULN_LABEL = "No vulnerability label";

/** One vulnerability group per issue: first approved label, else the two derived buckets. */
export function vulnOf(labels, vocab) {
  const approved = approvedVulnLabels(labels, vocab);
  if (approved.length > 0) return approved[0];
  return unapprovedVulnLike(labels, vocab).length > 0 ? UNAPPROVED_VULN : NO_VULN_LABEL;
}

/**
 * Track of an issue (decision 8): an exact approved track label first, then the service→track map
 * on the finding's image. `null` with a reason when the program has no tracks, the service is
 * unmapped, or it maps to two tracks ("[also X]" — flagged, never guessed).
 * @returns {{ track: string | null, source: "label" | "service" | null, status: string, choices?: string[] }}
 */
export function trackOf(issue, vocab, program) {
  if (!program?.usesTrackLabels) return { track: null, source: null, status: "n/a" };
  const labelled = approvedTrackLabels(issue.labels, vocab);
  if (labelled.length > 0) return { track: labelled[0], source: "label", status: "labelled" };
  const finding = parseFinding(issue.summary);
  if (!finding) return { track: null, source: null, status: "noimage" };
  const tracks = vocab.service[finding.image.toLowerCase()];
  if (!tracks) return { track: null, source: null, status: "unmapped" };
  if (tracks.length > 1) return { track: null, source: null, status: "ambiguous", choices: tracks };
  return { track: tracks[0], source: "service", status: "mapped" };
}

function dedupe(list) {
  return [...new Set(list)];
}

// ── effort ───────────────────────────────────────────────────────────────────────────────────────

/**
 * One effort number in days (decision 10): Original Estimate (8 h = 1 day) when set, else story
 * points (1 SP = 1 day), else unsized. `placeholder` flags the 45 d / 110 d sentinel estimates.
 */
export function effortOf(issue, placeholderDays = []) {
  const oe = Number(issue.originalEstimateSec) > 0 ? Number(issue.originalEstimateSec) : 0;
  const sp = Number(issue.storyPoints) > 0 ? Number(issue.storyPoints) : 0;
  const days = oe ? oe / WORKDAY_SEC : sp;
  const source = oe ? "oe" : sp ? "sp" : "none";
  return { days, source, placeholder: source !== "none" && placeholderDays.includes(days) };
}

/** Done date: resolution date, else when the status category last changed (C8). */
export const doneTime = (issue) => toTime(issue.resolvedAt) ?? toTime(issue.statusCategoryChangedAt);
