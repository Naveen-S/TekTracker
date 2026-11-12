/**
 * SOW refresh (sow-tracker.md (d), decision 11) — mirrors a SOW's Jira source into `SowIssue` and
 * writes today's `SowSnapshot`. Called by POST /api/sows/[sowId]/refresh and the daily cron.
 *
 * Invariants (the bug-report / security refresh precedent):
 * - READ-ONLY against Jira: the saved-filter GET and the existing POST /search/jql only.
 * - Fetch everything first; a failure aborts BEFORE the first write, records `lastRefreshError`
 *   and keeps the previous mirror. A zeroed leadership number is a lie.
 * - The mirror holds RAW FACTS ONLY; kind, dependency and progress are read-time (lib/sow/*.mjs).
 */
import { prisma } from "@/lib/db";
import { logger } from "@/lib/log";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { fetchFilter, searchIssues } from "@/lib/jira/client";
import { fetchConfluencePage } from "@/lib/jira/confluence";
import { confluencePageId, storageToSections } from "@/lib/sow/knowledge.mjs";
import { DEFAULT_STORY_POINTS_FIELD } from "@/lib/jira/transform";
import { classifyIssues } from "@/lib/sow/classify.mjs";
import { snapshotValues, summarizeProgress } from "@/lib/sow/progress.mjs";

/** A SOW is a few hundred tickets; past this the source is almost certainly wrong. */
const SOW_MAX_ISSUES = 5000;
const WRITE_CHUNK = 500;

const SOW_ISSUE_FIELDS = [
  "summary", "issuetype", "status", "priority", "assignee", "parent", "labels", "components",
  "fixVersions", "duedate", "created", "updated", "resolutiondate", "project",
  DEFAULT_STORY_POINTS_FIELD,
];

/** One refresh per SOW per process — a second click gets a clear 409. */
const inFlight = new Map();

export function utcMidnight(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const names = (list) => (Array.isArray(list) ? list.map((entry) => entry?.name).filter(Boolean) : []);

/** Raw Jira issue → `SowIssue` columns (minus sowId, which the caller owns). */
export function toSowIssueRow(raw) {
  const fields = raw.fields ?? {};
  const points = fields[DEFAULT_STORY_POINTS_FIELD];
  return {
    jiraKey: raw.key,
    projectKey: fields.project?.key ?? raw.key.split("-")[0],
    summary: fields.summary ?? "(no summary)",
    issueType: fields.issuetype?.name ?? "Unknown",
    status: fields.status?.name ?? "Unknown",
    statusCategory: fields.status?.statusCategory?.key ?? "new",
    priority: fields.priority?.name ?? null,
    assigneeName: fields.assignee?.displayName ?? null,
    parentKey: fields.parent?.key ?? null,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    components: names(fields.components),
    fixVersions: names(fields.fixVersions),
    storyPoints: typeof points === "number" ? points : null,
    dueDate: toDate(fields.duedate),
    jiraCreatedAt: toDate(fields.created),
    jiraUpdatedAt: toDate(fields.updated),
    resolvedAt: toDate(fields.resolutiondate),
  };
}

/** The SOW's JQL — a saved filter is re-read every refresh so Jira-side edits are picked up. */
async function resolveJql(sow, auth) {
  if (sow.sourceType === "JIRA_FILTER") {
    if (!sow.jiraFilterId) throw new ValidationError(`"${sow.name}" has no Jira filter id`);
    const filter = await fetchFilter({ auth, filterId: sow.jiraFilterId });
    if (!filter.jql?.trim()) throw new ValidationError(`Jira filter ${sow.jiraFilterId} ("${filter.name}") has no JQL`);
    return filter.jql.trim();
  }
  if (!sow.jql?.trim()) throw new ValidationError(`"${sow.name}" has no JQL`);
  return sow.jql.trim();
}

/** Upsert today's snapshot for one SOW from its (already loaded) mirror rows. */
export async function writeSowSnapshot(sow, issues, asOf = new Date()) {
  const values = snapshotValues(summarizeProgress(classifyIssues(issues, sow), sow.kindWeights));
  const capturedOn = utcMidnight(asOf);
  const data = { sowName: sow.name, ...values };
  await prisma.sowSnapshot.upsert({
    where: { sowId_capturedOn: { sowId: sow.id, capturedOn } },
    create: { sowId: sow.id, capturedOn, ...data },
    update: data,
  });
  return { capturedOn, ...values };
}

/**
 * Re-read the SOW's PRIMARY Confluence pages into `Sow.knowledge` (round 6). Isolated: a page that
 * can't be read keeps its previous copy with the error noted, and never fails the Jira refresh.
 * Serial, read-only GETs on the same Atlassian credential as the Jira read.
 * @returns {Promise<{ pages: number, failed: number }>}
 */
export async function refreshKnowledge(sow, auth) {
  const references = Array.isArray(sow.references) ? sow.references : [];
  const primary = references.filter((reference) => reference.primary && reference.kind === "CONFLUENCE" && confluencePageId(reference.url));
  const previous = new Map((Array.isArray(sow.knowledge) ? sow.knowledge : []).map((page) => [page.pageId, page]));
  const knowledge = [];
  let failed = 0;
  for (const reference of primary) {
    const pageId = confluencePageId(reference.url);
    try {
      const page = await fetchConfluencePage({ auth, pageId });
      knowledge.push({ url: reference.url, pageId, title: page.title || reference.label, version: page.version, fetchedAt: new Date().toISOString(), sections: storageToSections(page.storage) });
    } catch (error) {
      failed += 1;
      const kept = previous.get(pageId);
      knowledge.push({ ...(kept ?? { url: reference.url, pageId, title: reference.label, sections: [] }), error: error.message?.slice(0, 300) ?? "Could not read the page" });
      logger.warn("sow.knowledge_failed", { sowId: sow.id, pageId, err: error });
    }
  }
  await prisma.sow.update({ where: { id: sow.id }, data: { knowledge } });
  return { pages: knowledge.length - failed, failed };
}

/**
 * Refresh one SOW: resolve the JQL → fetch → atomic mirror replace → today's snapshot.
 * @param {string} sowId
 * @param {{ auth: object, refreshedByEmail?: string | null, asOf?: Date }} args
 */
export async function refreshSow(sowId, args) {
  if (inFlight.has(sowId)) throw new ConflictError("This SOW is already refreshing — try again in a minute");
  const run = runRefresh(sowId, args);
  inFlight.set(sowId, run);
  try {
    return await run;
  } finally {
    inFlight.delete(sowId);
  }
}

async function runRefresh(sowId, { auth, refreshedByEmail = null, asOf = new Date() }) {
  const startedAt = Date.now();
  const sow = await prisma.sow.findUnique({ where: { id: sowId } });
  if (!sow) throw new NotFoundError("SOW not found");

  let jql;
  let rows;
  try {
    jql = await resolveJql(sow, auth);
    const raw = await searchIssues({ auth, jql, fields: SOW_ISSUE_FIELDS, maxIssues: SOW_MAX_ISSUES });
    rows = [...new Map(raw.map((issue) => [issue.key, toSowIssueRow(issue)])).values()];
  } catch (error) {
    await prisma.sow.update({
      where: { id: sowId },
      data: { lastRefreshError: error.message?.slice(0, 500) ?? "Refresh failed" },
    });
    throw error;
  }

  const lastSyncedAt = new Date();
  await prisma.$transaction(
    async (tx) => {
      await tx.sowIssue.deleteMany({ where: { sowId } });
      for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
        await tx.sowIssue.createMany({ data: rows.slice(i, i + WRITE_CHUNK).map((row) => ({ ...row, sowId, lastSyncedAt })) });
      }
      await tx.sow.update({
        where: { id: sowId },
        data: { resolvedJql: jql, lastRefreshedAt: lastSyncedAt, lastRefreshedByEmail: refreshedByEmail, lastRefreshError: null },
      });
    },
    { timeout: 60_000, maxWait: 20_000 },
  );

  const snapshot = await writeSowSnapshot(sow, rows, asOf);
  const knowledge = await refreshKnowledge(sow, auth).catch((error) => {
    logger.warn("sow.knowledge_failed", { sowId, err: error });
    return { pages: 0, failed: 1 };
  });
  const summary = { sowId, name: sow.name, issues: rows.length, progressPct: snapshot.progressPct, lastRefreshedAt: lastSyncedAt, refreshedByEmail, knowledge };
  logger.info("sow.refreshed", { ms: Date.now() - startedAt, sow: sow.slug, issues: rows.length });
  return summary;
}
