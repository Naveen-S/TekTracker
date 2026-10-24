/**
 * Security tracker refresh (security-vulnerability-tracker.md (b) refresh.js) — mirrors every
 * vulnerability in the open pipeline or any program's progress universe into `SecurityIssue`, then
 * writes today's `SecuritySnapshot` rows. Called by POST /api/security/refresh and the daily cron.
 *
 * Invariants (the bug-report refresh precedent):
 * - READ-ONLY against Atlassian: GET (Confluence) and the existing POST /search/jql only.
 * - Calls are SERIAL (decision 11) — one query at a time, never Promise.all.
 * - Fetch everything first; a failure aborts BEFORE the first write, records `lastRefreshError`
 *   and keeps the previous mirror (bug-report decision 17). A zeroed leadership number is a lie.
 * - The mirror holds RAW FACTS ONLY; every classification is read-time (classify.mjs).
 * - The vocabulary refresh is isolated: its failure is a warning, never an aborted refresh.
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";
import { ConflictError, ERROR_CODES, ValidationError } from "@/lib/errors";
import { searchIssues } from "@/lib/jira/client";
import { extractSubComponent } from "@/lib/bug-report/sub-component-field.mjs";
import { ALL_PROGRAMS_KEY, SECURITY_SETTINGS_ID, settingsCreatePayload } from "@/lib/security/defaults.mjs";
import { loadSecurityConfig } from "@/lib/security/settings";
import { refreshVocabulary } from "@/lib/security/vocab-refresh";
import { quote } from "@/lib/security/jql.mjs";
import {
  aggregateProgram,
  buildContext,
  pipelineRows,
  rollupSnapshotValues,
  snapshotValues,
} from "@/lib/security/aggregate.mjs";

/** ~1,400 issues today; the global 2,000 sprint-track cap stays untouched (spec (b)). */
const SECURITY_MAX_ISSUES = 5000;
const WRITE_CHUNK = 500;

const BASE_FIELDS = [
  "summary", "issuetype", "status", "resolution", "priority", "assignee", "components", "labels",
  "fixVersions", "created", "updated", "resolutiondate", "statuscategorychangedate",
  "timeoriginalestimate", "project",
];

/** One refresh at a time per process — an admin click during the nightly run gets a clear 409. */
let inFlight = null;

export function utcMidnight(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The active sprint, else the latest one. */
function pickSprint(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.find((sprint) => sprint?.state?.toLowerCase() === "active") ?? raw[raw.length - 1];
}

/** Raw Jira issue → `SecurityIssue` columns (minus the membership flags the caller owns). */
export function toSecurityIssueRow(raw, settings) {
  const fields = raw.fields ?? {};
  const sprint = pickSprint(fields[settings.sprintField]);
  const points = fields[settings.storyPointsField];
  const estimate = fields.timeoriginalestimate;
  return {
    jiraKey: raw.key,
    projectKey: fields.project?.key ?? raw.key.split("-")[0],
    summary: fields.summary ?? "(no summary)",
    issueType: fields.issuetype?.name ?? "Unknown",
    status: fields.status?.name ?? "Unknown",
    statusCategory: fields.status?.statusCategory?.key ?? "new",
    resolution: fields.resolution?.name ?? null,
    priority: fields.priority?.name ?? null,
    assigneeName: fields.assignee?.displayName ?? null,
    components: (fields.components ?? []).map((component) => component?.name).filter(Boolean),
    subComponent: extractSubComponent(fields[settings.subComponentField]),
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    fixVersions: (fields.fixVersions ?? []).map((version) => version?.name).filter(Boolean),
    sprintName: sprint?.name ?? null,
    sprintState: sprint?.state ?? null,
    storyPoints: typeof points === "number" ? points : null,
    originalEstimateSec: typeof estimate === "number" ? Math.round(estimate) : null,
    jiraCreatedAt: toDate(fields.created) ?? new Date(0),
    jiraUpdatedAt: toDate(fields.updated),
    resolvedAt: toDate(fields.resolutiondate),
    statusCategoryChangedAt: toDate(fields.statuscategorychangedate),
  };
}

/** The open-pipeline query: every active program's component, unexcluded (classification excludes). */
export function openPipelineQuery(settings, programs) {
  const components = [...new Set(programs.map((program) => program.component))].map(quote).join(", ");
  return `${settings.openPipelineJql} AND ${settings.priorityJql} AND component IN (${components})`;
}

/**
 * Refresh vocabulary → mirror → today's snapshots.
 * @param {{ auth: object, refreshedByEmail: string | null, asOf?: Date }} args
 */
export async function refreshSecurityTracker(args) {
  if (inFlight) throw new ConflictError("A security tracker refresh is already running — try again in a minute");
  inFlight = runRefresh(args);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function runRefresh({ auth, refreshedByEmail, asOf = new Date() }) {
  const startedAt = Date.now();
  let config = await loadSecurityConfig();
  const active = config.programs.filter((program) => program.isActive);
  if (active.length === 0) throw new ValidationError("No active security programs — add one in Admin first");

  // 1. Vocabulary (isolated): a failure keeps the old lists and becomes a warning.
  let warnings = [];
  try {
    ({ warnings } = await refreshVocabulary({ auth, settings: config.settings }));
  } catch (error) {
    warnings = [{ code: ERROR_CODES.SECURITY_VOCAB_UNAVAILABLE, message: `Vocabulary not refreshed: ${error.message}` }];
  }
  config = await loadSecurityConfig();
  const { settings } = config;

  // 2. Fetch everything, serially, before writing anything.
  const fields = [...BASE_FIELDS, settings.storyPointsField, settings.sprintField, settings.subComponentField];
  const byKey = new Map();
  const movedToSecVal7d = {};
  try {
    const pipeline = await searchIssues({ auth, jql: openPipelineQuery(settings, active), fields, maxIssues: SECURITY_MAX_ISSUES });
    for (const raw of pipeline) byKey.set(raw.key, { ...toSecurityIssueRow(raw, settings), inOpenPipeline: true, progressProgramKeys: [] });

    for (const program of active) {
      const universe = await searchIssues({ auth, jql: program.progressJql, fields, maxIssues: SECURITY_MAX_ISSUES });
      for (const raw of universe) {
        const row = byKey.get(raw.key) ?? { ...toSecurityIssueRow(raw, settings), inOpenPipeline: false, progressProgramKeys: [] };
        row.progressProgramKeys.push(program.key);
        byKey.set(raw.key, row);
      }
      const moved = await searchIssues({
        auth,
        jql: `(${program.progressJql}) AND status CHANGED TO "Security Validation" AFTER -7d`,
        fields: ["status"],
        maxIssues: SECURITY_MAX_ISSUES,
      });
      movedToSecVal7d[program.key] = moved.length;
    }
  } catch (error) {
    await prisma.securityTrackerSettings.upsert({
      where: { id: SECURITY_SETTINGS_ID },
      update: { lastRefreshError: error.message?.slice(0, 500) ?? "Refresh failed" },
      create: { ...settingsCreatePayload(), lastRefreshError: error.message?.slice(0, 500) ?? "Refresh failed" },
    });
    throw error;
  }

  // 3. Atomic mirror replace.
  const rows = [...byKey.values()];
  const lastSyncedAt = new Date();
  await prisma.$transaction(
    async (tx) => {
      await tx.securityIssue.deleteMany({});
      for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
        await tx.securityIssue.createMany({ data: rows.slice(i, i + WRITE_CHUNK).map((row) => ({ ...row, lastSyncedAt })) });
      }
      const provenance = { lastRefreshedAt: lastSyncedAt, lastRefreshedByEmail: refreshedByEmail, lastRefreshError: null };
      await tx.securityTrackerSettings.upsert({
        where: { id: SECURITY_SETTINGS_ID },
        update: provenance,
        create: { ...settingsCreatePayload(), ...provenance },
      });
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  // 4. Today's snapshots, from the rows just written.
  const snapshot = await writeSecuritySnapshots({ config, issues: rows, asOf, movedToSecVal7d });

  const summary = {
    lastRefreshedAt: lastSyncedAt,
    refreshedByEmail,
    issues: rows.length,
    pipeline: rows.filter((row) => row.inOpenPipeline).length,
    programs: snapshot.programs,
    snapshotRows: snapshot.written,
    capturedOn: snapshot.capturedOn,
    warnings,
  };
  logger.info("security.refreshed", { ms: Date.now() - startedAt, issues: summary.issues, pipeline: summary.pipeline, warnings: warnings.length });
  return summary;
}

/**
 * Upsert one SecuritySnapshot per active program + the "__all__" rollup at UTC midnight of `asOf`.
 * Same-day re-runs replace the day's values (the step-7 precedent).
 */
export async function writeSecuritySnapshots({ config, issues, asOf, movedToSecVal7d = {} }) {
  const ctx = buildContext({ ...config, now: asOf });
  const rows = pipelineRows(issues, ctx);
  const aggs = ctx.programs.map((program) => aggregateProgram(program, rows, issues, ctx));
  const currentReleaseName = ctx.window.current.name;
  const programRows = aggs.map((agg) => ({
    programKey: agg.program.key,
    ...snapshotValues(agg, { movedToSecVal7d: movedToSecVal7d[agg.program.key] ?? 0, currentReleaseName }),
  }));
  // The rollup row sums the numeric columns only, so the string programKey is ignored by design.
  const all = { ...rollupSnapshotValues(programRows, currentReleaseName), programKey: ALL_PROGRAMS_KEY };

  const capturedOn = utcMidnight(asOf);
  const values = [...programRows, all];
  await prisma.$transaction(
    values.map(({ programKey, ...data }) =>
      prisma.securitySnapshot.upsert({
        where: { programKey_capturedOn: { programKey, capturedOn } },
        create: { programKey, capturedOn, ...data },
        update: data,
      }),
    ),
  );
  return {
    capturedOn,
    written: values.length,
    programs: programRows.map((row) => ({ key: row.programKey, pipeline: row.pipeline, total: row.total, done: row.done })),
  };
}
