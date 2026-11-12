/**
 * The Ask StoryBoard "sow" data pack (sow-tracker.md round 5). Pure: takes the SOW page's own view
 * (lib/sow/data.js `getSowData`, hidden feed items already excluded) and returns the compact JSON
 * the model is grounded in. Lists are capped with an `overflow` count, the shape.mjs convention.
 *
 * Storage-free and plain-Node loadable (`.mjs`, RELATIVE imports only).
 */
import { KIND_LABELS } from "../sow/defaults.mjs";

export const ASK_SOW_MAX_TICKETS = 40;
export const ASK_SOW_MAX_PRE_QA = 15;
export const ASK_SOW_MAX_DECISIONS = 25;
export const ASK_SOW_MAX_DOCS = 45;
export const ASK_SOW_MAX_PEOPLE = 8;

const round1 = (value) => (value === null || value === undefined ? null : Math.round(value * 10) / 10);

/** `list` capped to `max`, with how many were left out. */
function capped(list, max) {
  return list.length > max ? { items: list.slice(0, max), overflow: list.length - max } : { items: list, overflow: 0 };
}

const OPEN_FIRST = { inReview: 0, inProgress: 1, todo: 2, done: 3 };

/**
 * @param {object} view the SOW page view (getSowData)
 * @param {{ knowledge?: object | null }} [extra] matching page sections (knowledge.mjs selectKnowledge)
 * @returns {object} the pack data
 */
export function shapeSowPack(view, { knowledge = null } = {}) {
  const { sow, progress, health, launch, chart, funnel, issues, risks, phases } = view;
  const tickets = capped(
    issues
      .filter((issue) => issue.kind !== "EPIC")
      .sort((a, b) => OPEN_FIRST[a.detail] - OPEN_FIRST[b.detail])
      .map((issue) => ({
        key: issue.key,
        summary: issue.summary,
        kind: KIND_LABELS[issue.kind] ?? issue.kind,
        status: issue.status,
        state: issue.detail,
        assignee: issue.assigneeName ?? "Unassigned",
        epic: issue.epicKey,
        ...(issue.isDependency ? { ownedByOtherTeam: issue.projectKey } : {}),
      })),
    ASK_SOW_MAX_TICKETS,
  );
  const preQa = capped(
    (view.slack.posts ?? [])
      .filter((post) => post.status === "NEW" || post.status === "ACKNOWLEDGED")
      .map((post) => ({
        title: post.title,
        status: post.status === "NEW" ? "new" : "acknowledged",
        reportedBy: post.authorName,
        raised: post.postedDay,
        ageDays: post.ageDays,
        jiraKeys: post.jiraKeys,
        screenshot: post.files.find((file) => file.description)?.description ?? null,
      })),
    ASK_SOW_MAX_PRE_QA,
  );
  const decisions = capped(
    (view.feed?.decisions ?? []).map((item) => ({
      date: item.postedDay,
      decision: item.title,
      context: item.summary,
      by: item.authorName,
      channel: item.channelName ? `#${item.channelName}` : item.channelId,
    })),
    ASK_SOW_MAX_DECISIONS,
  );
  const docs = capped(
    [
      ...sow.references.map((reference) => ({
        title: reference.label,
        url: reference.url ?? null,
        group: reference.group,
        kind: reference.kind,
        ...(reference.note ? { note: reference.note } : {}),
        ...(reference.primary ? { primarySource: true } : {}),
        from: "curated reading list",
      })),
      ...(view.feed?.docs ?? []).map((item) => ({ title: item.title, url: item.url, sharedBy: item.authorName, date: item.postedDay, from: item.channelName ? `#${item.channelName}` : "Slack" })),
    ],
    ASK_SOW_MAX_DOCS,
  );

  return {
    sow: {
      name: sow.name,
      program: sow.program?.name ?? null,
      status: sow.status,
      owner: sow.ownerName,
      description: sow.description,
      start: sow.startDate,
      launch: { milestone: launch.title, date: launch.date, daysLeft: launch.daysLeft, slipDays: launch.slip, largestSlip: launch.worstSlip },
    },
    today: view.today,
    health: { status: health.label, reasons: health.reasons },
    progress: {
      weightedPct: round1(progress.overall.pct),
      planExpectsPct: round1(chart.expected),
      gapPts: round1(chart.gap),
      changeVsWeekAgoPts: progress.delta,
      ticketsDone: progress.overall.done,
      ticketsTotal: progress.overall.total,
      note: "Weighted by ticket kind (stories weigh most, bugs least); epics roll up from their tickets. Plan = a straight line through the build phases.",
      projection: chart.projection ? { finishDate: chart.projection.finishDay, daysLateVsPlan: chart.projection.lateBy } : null,
    },
    phases: phases.map((phase) => ({
      name: phase.name,
      start: phase.startDate,
      end: phase.endDate,
      state: phase.state,
      ticketProgressPct: phase.progress.total > 0 ? round1(phase.progress.pct) : null,
      planItems: phase.items.map((item) => ({
        title: item.title,
        gate: item.isGate,
        status: item.status,
        baseline: item.baselineDate,
        current: item.currentDate,
        slipDays: item.slip,
        pastDue: item.overdue,
        ...(item.linked ? { jiraKey: item.linked.key, ticketPct: item.linked.pct } : {}),
        ...(item.comment ? { comment: item.comment } : {}),
      })),
    })),
    epics: progress.epics.map((epic) => ({ key: epic.key, summary: epic.summary, pct: epic.pct, done: epic.done, inProgress: epic.inProgress, todo: epic.todo, total: epic.total })),
    byKind: progress.byKind.map((entry) => ({ kind: KIND_LABELS[entry.kind] ?? entry.kind, total: entry.total, done: entry.done, inProgress: entry.inProgress, todo: entry.todo })),
    tickets,
    issues: {
      stages: funnel.map((stage) => ({ stage: stage.label, open: stage.open, fixed: stage.fixed, total: stage.total })),
      preQaOpen: preQa,
      note: "Pre-QA issues were raised in Slack before the QA hand-off and read by Claude; status follows the reactions on each post.",
    },
    people: view.people.slice(0, ASK_SOW_MAX_PEOPLE).map((person) => ({ name: person.name, openPlanned: person.planned, openBugs: person.bugs, preQaMentions: person.slack })),
    risks: risks.map((risk) => ({ type: risk.type, title: risk.title, status: risk.status, owner: risk.ownerName, due: risk.dueDate, note: risk.note })),
    dependencies: issues
      .filter((issue) => issue.isDependency)
      .map((issue) => ({ key: issue.key, summary: issue.summary, project: issue.projectKey, status: issue.status, assignee: issue.assigneeName ?? "Unassigned" })),
    decisions: { ...decisions, note: "Extracted from Slack by Claude; cite them as the decision log, with date and channel." },
    docs,
    // Matching sections of the primary Confluence pages (lib/sow/knowledge.mjs), when stored.
    ...(knowledge ? { pages: knowledge } : {}),
    freshness: { jiraReadAt: view.meta.lastRefreshedAt, slackReadAt: view.slack.lastSyncedAt },
  };
}
