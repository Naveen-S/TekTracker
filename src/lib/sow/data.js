/**
 * The /sow reads (sow-tracker.md (d)): the list, one SOW's page view, and the public share view.
 * Server-only. Everything derived — kind, dependency, progress, phase state, slip, health — is
 * computed here from the raw mirror and the plan, with one request-time `asOf`.
 */
import { prisma } from "@/lib/db";
import { classifyIssues } from "@/lib/sow/classify.mjs";
import { SCOPE_KINDS } from "@/lib/sow/defaults.mjs";
import { BUG_KINDS } from "@/lib/sow/defaults.mjs";
import { creditOf, detailState, progressState, summarizeProgress, weightedProgress } from "@/lib/sow/progress.mjs";
import {
  buildJourney,
  deriveHealth,
  diffDays,
  isOverdue,
  launchGate,
  scopeWindow,
  slipDays,
  toIsoDay,
  todayIso,
} from "@/lib/sow/timeline.mjs";
import { buildProgressSeries, issueFlow, layoutGates, layoutPhases, monthTicks, peopleLoad } from "@/lib/sow/charts.mjs";
import { isSlackIssue, linkedKeys, readFeedChannels, slackCounts, slackFileUrl, slackPermalink, slackStatus } from "@/lib/sow/slack.mjs";
import { utcMidnight } from "@/lib/sow/refresh";

const DAY_MS = 86_400_000;

const PLAN_INCLUDE = {
  program: { select: { id: true, key: true, name: true } },
  phases: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
  risks: { orderBy: { sortOrder: "asc" } },
};

const round1 = (value) => (value === null || value === undefined ? null : Math.round(value * 10) / 10);

const pickProgress = ({ pct, total, done, inProgress, todo }) => ({ pct: round1(pct), total, done, inProgress, todo });

/** Mirror row → the lean, serializable row the page lists. */
function toIssueView(row, epicKey) {
  return {
    key: row.jiraKey,
    summary: row.summary,
    issueType: row.issueType,
    status: row.status,
    state: progressState(row),
    detail: detailState(row),
    credit: creditOf(row),
    createdDay: row.jiraCreatedAt ? todayIso(row.jiraCreatedAt) : null,
    resolvedDay: row.resolvedAt ? todayIso(row.resolvedAt) : null,
    dueDate: toIsoDay(row.dueDate),
    kind: row.kind,
    projectKey: row.projectKey,
    assigneeName: row.assigneeName,
    priority: row.priority,
    storyPoints: row.storyPoints,
    fixVersions: row.fixVersions,
    epicKey,
    isDependency: row.isDependency,
  };
}

function toItemView(item, today, issueByKey, epicProgress) {
  const view = {
    id: item.id,
    title: item.title,
    status: item.status,
    baselineDate: toIsoDay(item.baselineDate),
    currentDate: toIsoDay(item.currentDate),
    isGate: item.isGate,
    jiraKey: item.jiraKey,
    comment: item.comment,
  };
  const linked = item.jiraKey ? issueByKey.get(item.jiraKey) : null;
  return {
    ...view,
    slip: slipDays(view),
    overdue: isOverdue(view, today),
    linked: linked
      ? { key: linked.jiraKey, status: linked.status, pct: epicProgress.get(linked.jiraKey) ?? round1(creditOf(linked) * 100) }
      : null,
  };
}

function toPhaseView(phase, today, rows, weights, issueByKey, epicProgress) {
  const members = rows.filter((row) => phase.kinds.includes(row.kind));
  return {
    id: phase.id,
    name: phase.name,
    startDate: toIsoDay(phase.startDate),
    endDate: toIsoDay(phase.endDate),
    kinds: phase.kinds,
    items: phase.items.map((item) => toItemView(item, today, issueByKey, epicProgress)),
    progress: pickProgress(weightedProgress(members, weights)),
  };
}

function toRiskView(risk) {
  return {
    id: risk.id,
    type: risk.type,
    title: risk.title,
    ownerName: risk.ownerName,
    status: risk.status,
    note: risk.note,
    dueDate: toIsoDay(risk.dueDate),
  };
}

/** The headline's launch block: the last gate's date (else the SOW's), countdown and slip. */
function launchView(sow, items, today) {
  const gate = launchGate(items);
  const date = gate?.currentDate ?? toIsoDay(sow.launchDate);
  const slipped = items.filter((item) => (item.slip ?? 0) > 0).sort((a, b) => b.slip - a.slip);
  return {
    title: gate?.title ?? "Launch",
    date,
    daysLeft: diffDays(today, date),
    slip: gate?.slip ?? 0,
    worstSlip: slipped[0] ? { title: slipped[0].title, days: slipped[0].slip } : null,
  };
}

/** A Slack post → the row the drill-in lists (signed-in viewers only). */
function toSlackView(post, sow, doneByKey, today) {
  const postedDay = todayIso(post.postedAt);
  const url = slackPermalink(process.env.SLACK_WORKSPACE_URL, sow.slackChannelId, post.ts);
  return {
    files: (Array.isArray(post.files) ? post.files : []).map((file) => ({
      id: file.id,
      name: file.name,
      kind: file.kind,
      description: file.description ?? null,
      url: slackFileUrl(process.env.SLACK_WORKSPACE_URL, post.authorId, file.id) ?? url,
    })),
    id: post.id,
    ts: post.ts,
    authorName: post.authorName,
    postedDay,
    ageDays: diffDays(postedDay, today),
    title: post.title,
    text: post.text,
    reactions: post.reactions,
    replyCount: post.replyCount,
    mentions: post.mentions,
    jiraKeys: linkedKeys(post),
    sessionId: post.sessionId,
    hasMedia: post.hasMedia,
    isIssue: isSlackIssue(post),
    status: slackStatus(post, doneByKey),
    overrideStatus: post.overrideStatus,
    linkedJiraKey: post.linkedJiraKey,
    note: post.note,
    url,
  };
}

/**
 * Decisions and documents from the docs-and-decisions channels, newest first. A document already
 * on the curated reading list is not repeated. Hidden items only reach admins (`includeHidden`).
 */
function buildFeed(sow, feedItems, today, includeHidden) {
  const channels = readFeedChannels(sow.feedChannels);
  const nameOf = new Map(channels.map((channel) => [channel.id, channel.name ?? null]));
  const curated = new Set((Array.isArray(sow.references) ? sow.references : []).map((reference) => reference.url).filter(Boolean));
  const rows = feedItems
    .filter((item) => includeHidden || !item.hidden)
    .map((item) => {
      const postedDay = todayIso(item.postedAt);
      return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        summary: item.summary,
        url: item.url,
        authorName: item.authorName,
        postedDay,
        ageDays: diffDays(postedDay, today),
        channelId: item.channelId,
        channelName: nameOf.get(item.channelId) ?? null,
        permalink: slackPermalink(process.env.SLACK_WORKSPACE_URL, item.channelId, item.ts),
        hidden: item.hidden,
      };
    });
  return {
    channels: channels.map(({ id, name, lastSyncedAt, error }) => ({ id, name: name ?? null, lastSyncedAt: lastSyncedAt ?? null, error: error ?? null })),
    decisions: rows.filter((row) => row.kind === "DECISION"),
    docs: rows.filter((row) => row.kind === "DOC" && !(row.url && curated.has(row.url))),
  };
}

/** The three issue stages a SOW moves through, each with open / fixed counts. */
function buildFunnel(issueViews, slackViews, tracked) {
  const stage = (key, label, hint, kind) => {
    const rows = issueViews.filter((issue) => issue.kind === kind);
    const fixed = rows.filter((issue) => issue.state === "done").length;
    return { key, label, hint, total: rows.length, fixed, open: rows.length - fixed };
  };
  const slack = slackCounts(slackViews);
  return [
    { key: "SLACK", label: "Pre-QA", hint: "Raised in Slack before the QA hand-off", total: slack.total, fixed: slack.fixed, open: slack.open, fresh: slack.fresh, tracked },
    stage("INTERNAL_BUG", "Internal QA", "Bugs raised by Tekion QA", "INTERNAL_BUG"),
    stage("UAT_ISSUE", "UAT", "Issues raised in customer UAT", "UAT_ISSUE"),
    stage("EXTERNAL_BUG", "Production", "External bugs after go-live", "EXTERNAL_BUG"),
  ].filter((entry) => entry.key !== "EXTERNAL_BUG" || entry.total > 0);
}

/**
 * Build the whole page view for one loaded SOW.
 * @param {object} sow with `program`, `phases.items`, `risks`
 * @param {Array<object>} issues its mirror rows
 * @param {{ asOf: Date, weekAgo?: object | null, publicView?: boolean }} options
 */
export function buildSowView(sow, issues, { asOf, weekAgo = null, publicView = false, slackPosts = [], history = [], feedItems = [], includeHidden = false }) {
  const today = todayIso(asOf);
  const rows = classifyIssues(issues, sow);
  const summary = summarizeProgress(rows, sow.kindWeights);
  const issueByKey = new Map(rows.map((row) => [row.jiraKey, row]));
  const epicOfChild = new Map();
  const epicProgress = new Map();
  for (const { epic, children, progress } of summary.epics) {
    epicProgress.set(epic.jiraKey, round1(progress.pct));
    for (const child of children) epicOfChild.set(child.jiraKey, epic.jiraKey);
  }

  const phases = buildJourney(
    sow.phases.map((phase) => toPhaseView(phase, today, rows, summary.weights, issueByKey, epicProgress)),
    today,
  );
  const items = phases.flatMap((phase) => phase.items);
  const risks = sow.risks.map(toRiskView);
  const claimed = new Set(phases.flatMap((phase) => phase.kinds));
  const ends = [toIsoDay(sow.launchDate), ...phases.map((phase) => phase.endDate)].sort();
  const starts = [toIsoDay(sow.startDate), ...phases.map((phase) => phase.startDate)].sort();
  const overallPct = round1(summary.overall.pct);
  const axis = { start: starts[0], end: ends.at(-1) };
  const issueViews = rows.map((row) => toIssueView(row, epicOfChild.get(row.jiraKey) ?? null));
  const doneByKey = new Map(issueViews.map((issue) => [issue.key, issue.state === "done"]));
  const slackViews = slackPosts.map((post) => toSlackView(post, sow, doneByKey, today)).filter((post) => post.isIssue || post.overrideStatus);
  const bugEvents = [
    ...issueViews.filter((issue) => BUG_KINDS.includes(issue.kind)).map((issue) => ({ raisedDay: issue.createdDay, closedDay: issue.resolvedDay })),
    // Slack gives no time for a fix, so a Slack issue only ever counts as raised here.
    ...slackViews.filter((post) => post.status !== "NOT_ISSUE").map((post) => ({ raisedDay: post.postedDay, closedDay: null })),
  ];

  return {
    sow: {
      id: sow.id,
      slug: sow.slug,
      name: sow.name,
      description: sow.description,
      ownerName: sow.ownerName,
      status: sow.status,
      program: sow.program,
      startDate: toIsoDay(sow.startDate),
      launchDate: toIsoDay(sow.launchDate),
      // Internal reading list — never on the public share page.
      references: publicView || !Array.isArray(sow.references) ? [] : sow.references,
      // When StoryBoard last read each primary page for Ask (no page text reaches the browser).
      knowledgeStatus:
        publicView || !Array.isArray(sow.knowledge)
          ? []
          : sow.knowledge.map((page) => ({ url: page.url, fetchedAt: page.fetchedAt ?? null, error: page.error ?? null, sections: page.sections?.length ?? 0 })),
      ...(publicView
        ? {}
        : {
            programId: sow.programId,
            sourceType: sow.sourceType,
            jql: sow.jql,
            jiraFilterId: sow.jiraFilterId,
            resolvedJql: sow.resolvedJql,
            homeProjectKeys: sow.homeProjectKeys,
            slackChannelId: sow.slackChannelId,
            feedChannelIds: readFeedChannels(sow.feedChannels).map((channel) => channel.id),
            kindRules: sow.kindRules,
            kindWeights: summary.weights,
          }),
    },
    today,
    asOf: asOf.toISOString(),
    axis,
    phases,
    risks,
    issues: issueViews,
    timeline: {
      ticks: monthTicks(axis),
      bars: layoutPhases(phases, axis).map(({ id, name, state, lane, left, width, startDate, endDate }) => ({ id, name, state, lane, left, width, startDate, endDate })),
      gates: layoutGates(phases, axis).map(({ id, title, status, currentDate, baselineDate, slip, overdue, pct, baselinePct, phaseId }) => ({
        id, title, status, currentDate, baselineDate, slip, overdue, pct, baselinePct, phaseId,
      })),
      todayPct: diffDays(axis.start, today) < 0 || diffDays(today, axis.end) < 0 ? null : (diffDays(axis.start, today) / Math.max(diffDays(axis.start, axis.end), 1)) * 100,
    },
    chart: buildProgressSeries({
      history: history.map((row) => ({ day: toIsoDay(row.capturedOn), pct: row.progressPct })),
      today,
      todayPct: overallPct,
      window: scopeWindow(phases, SCOPE_KINDS),
      axis,
    }),
    funnel: buildFunnel(issueViews, slackViews, Boolean(sow.slackChannelId)),
    flow: issueFlow(bugEvents, today),
    people: publicView ? [] : peopleLoad(issueViews, slackViews),
    // Decisions and shared documents from Slack: signed-in viewers only (round 4).
    feed: publicView ? null : buildFeed(sow, feedItems, today, includeHidden),
    slack: {
      tracked: Boolean(sow.slackChannelId),
      hasChannels: Boolean(sow.slackChannelId) || readFeedChannels(sow.feedChannels).length > 0,
      lastSyncedAt: sow.slackLastSyncedAt?.toISOString() ?? null,
      counts: slackCounts(slackViews),
      // Message text and names stay with signed-in viewers (round 2, decision 9).
      ...(publicView
        ? {}
        : { channelId: sow.slackChannelId, channelName: sow.slackChannelName, syncError: sow.slackSyncError, posts: slackViews }),
    },
    progress: {
      overall: pickProgress(summary.overall),
      scope: pickProgress(summary.scope),
      delta: weekAgo && overallPct !== null ? round1(overallPct - weekAgo.progressPct) : null,
      byKind: summary.byKind.map((entry) => ({ ...entry, pct: round1(entry.pct) })),
      epics: summary.epics.map(({ epic, children, progress }) => ({
        key: epic.jiraKey,
        summary: epic.summary,
        status: epic.status,
        assigneeName: epic.assigneeName,
        childCount: children.length,
        ...pickProgress(progress),
      })),
      bugs: summary.bugs,
      weights: summary.weights,
    },
    unclaimedKinds: summary.byKind.map((entry) => entry.kind).filter((kind) => kind !== "EPIC" && !claimed.has(kind)),
    health: deriveHealth({
      sowStatus: sow.status,
      scopePct: summary.scope.pct,
      phases,
      items,
      risks,
      scopeKinds: SCOPE_KINDS,
      today,
    }),
    launch: launchView(sow, items, today),
    hasData: issues.length > 0,
    jiraBaseUrl: (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, ""),
    meta: {
      lastRefreshedAt: sow.lastRefreshedAt?.toISOString() ?? null,
      lastRefreshError: sow.lastRefreshError,
      ...(publicView ? {} : { lastRefreshedByEmail: sow.lastRefreshedByEmail }),
    },
  };
}

async function weekAgoSnapshot(sowId, asOf) {
  const capturedOn = new Date(utcMidnight(asOf).getTime() - 7 * DAY_MS);
  return prisma.sowSnapshot.findUnique({ where: { sowId_capturedOn: { sowId, capturedOn } } });
}

async function loadView(sow, options) {
  const [issues, weekAgo, slackPosts, history, feedItems] = await Promise.all([
    prisma.sowIssue.findMany({ where: { sowId: sow.id }, orderBy: { jiraKey: "asc" } }),
    weekAgoSnapshot(sow.id, options.asOf),
    prisma.sowSlackIssue.findMany({ where: { sowId: sow.id }, orderBy: { postedAt: "desc" } }),
    prisma.sowSnapshot.findMany({ where: { sowId: sow.id }, orderBy: { capturedOn: "asc" }, select: { capturedOn: true, progressPct: true } }),
    // The public share page never shows the feed, so it never loads it.
    options.publicView ? [] : prisma.sowFeedItem.findMany({ where: { sowId: sow.id }, orderBy: { postedAt: "desc" } }),
  ]);
  return buildSowView(sow, issues, { ...options, weekAgo, slackPosts, history, feedItems });
}

/** One SOW's page view by slug, or null. */
export async function getSowData(slug, asOf = new Date(), { includeHidden = false } = {}) {
  const sow = await prisma.sow.findUnique({ where: { slug }, include: PLAN_INCLUDE });
  return sow ? loadView(sow, { asOf, includeHidden }) : null;
}

/**
 * The public view behind a share token, or null when the token is unknown or expired — callers
 * render ONE generic state for both, so a token's past existence is not revealed.
 */
export async function getSharedSowData(token, asOf = new Date()) {
  if (typeof token !== "string" || token.length < 16) return null;
  const share = await prisma.sowShare.findUnique({ where: { token }, include: { sow: { include: PLAN_INCLUDE } } });
  if (!share || (share.expiresAt && share.expiresAt.getTime() <= asOf.getTime())) return null;
  return loadView(share.sow, { asOf, publicView: true });
}

/** Every SOW as a list card (no ticket rows), plus the programs for the "New SOW" picker. */
export async function getSowList(asOf = new Date()) {
  const [sows, issues, programs, slackPosts] = await Promise.all([
    prisma.sow.findMany({ include: PLAN_INCLUDE, orderBy: [{ status: "asc" }, { launchDate: "asc" }] }),
    prisma.sowIssue.findMany(),
    prisma.program.findMany({ orderBy: { name: "asc" }, select: { id: true, key: true, name: true } }),
    prisma.sowSlackIssue.findMany(),
  ]);
  const group = (rows) => {
    const map = new Map();
    for (const row of rows) map.set(row.sowId, [...(map.get(row.sowId) ?? []), row]);
    return map;
  };
  const bySow = group(issues);
  const slackBySow = group(slackPosts);

  const cards = sows.map((sow) => {
    const view = buildSowView(sow, bySow.get(sow.id) ?? [], { asOf, slackPosts: slackBySow.get(sow.id) ?? [] });
    return {
      sow: view.sow,
      today: view.today,
      axis: view.axis,
      phases: view.phases.map(({ id, name, startDate, endDate, state, isFocus, items }) => ({
        id,
        name,
        startDate,
        endDate,
        state,
        isFocus,
        items: items.map((item) => ({ id: item.id, status: item.status, isGate: false })),
      })),
      gates: view.phases.flatMap((phase) => phase.items).filter((item) => item.isGate && item.currentDate)
        .map(({ id, title, currentDate, status }) => ({ id, title, currentDate, status })),
      timeline: view.timeline,
      funnel: view.funnel,
      progress: { overall: view.progress.overall, bugs: view.progress.bugs },
      health: view.health,
      launch: view.launch,
      hasData: view.hasData,
      openRisks: view.risks.filter((risk) => risk.status === "OPEN").length,
    };
  });
  return { cards, programs };
}
