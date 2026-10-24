/**
 * The /security read (security-vulnerability-tracker.md (b) data.js): settings + programs +
 * calendar, the mirror, and the captures from 7 days earlier (for the risk deltas), then the pure
 * aggregates. Server-only; one request-time `asOf` flows through every computation.
 */
import { prisma } from "@/lib/db";
import { ALL_PROGRAMS_KEY } from "@/lib/security/defaults.mjs";
import { loadSecurityConfig } from "@/lib/security/settings";
import { aggregateProgram, aggregateRollup, buildContext, pipelineRows } from "@/lib/security/aggregate.mjs";
import { SEVERITY_ORDER, SNAPSHOT_FIELD, headlines, riskDelta } from "@/lib/security/risks.mjs";
import { utcMidnight } from "@/lib/security/refresh";

const DAY_MS = 86_400_000;

/** Attach "▼28 vs last week" deltas; S1 is stored 0/1, so it never carries a count delta. */
function withDeltas(risks, weekAgo) {
  return risks.map((signal) => ({
    ...signal,
    delta: signal.key === "noPlan" || !weekAgo ? null : riskDelta(signal.count, weekAgo[SNAPSHOT_FIELD[signal.key]]),
  }));
}

/**
 * @param {string | null} programKey a SecurityProgram key, or "ALL"/null for the rollup
 * @param {Date} [asOf]
 */
export async function getSecurityData(programKey, asOf = new Date()) {
  const config = await loadSecurityConfig();
  const weekAgoDay = new Date(utcMidnight(asOf).getTime() - 7 * DAY_MS);
  const [issues, weekAgoRows] = await Promise.all([
    prisma.securityIssue.findMany({ orderBy: { jiraCreatedAt: "asc" } }),
    prisma.securitySnapshot.findMany({ where: { capturedOn: weekAgoDay } }),
  ]);
  const weekAgo = new Map(weekAgoRows.map((row) => [row.programKey, row]));

  const ctx = buildContext({ ...config, now: asOf });
  const rows = pipelineRows(issues, ctx);
  const selected = ctx.programs.find((program) => program.key === programKey) ?? null;

  let view;
  if (selected) {
    const agg = aggregateProgram(selected, rows, issues, ctx);
    view = { ...agg, risks: withDeltas(agg.risks, weekAgo.get(selected.key)) };
  } else {
    const aggs = ctx.programs.map((program) => aggregateProgram(program, rows, issues, ctx));
    const rollup = aggregateRollup(aggs, rows, issues, ctx);
    const entries = aggs.map((agg) => ({ program: agg.program, risks: agg.risks, weekAgo: weekAgo.get(agg.program.key) ?? null }));
    view = {
      ...rollup,
      heatmap: rollup.heatmap.sort((a, b) => SEVERITY_ORDER[a.level] - SEVERITY_ORDER[b.level] || b.pipeline - a.pipeline),
      headlines: headlines(entries),
      hasWeekAgo: weekAgo.has(ALL_PROGRAMS_KEY),
    };
  }

  const { settings } = config;
  return {
    selectedKey: selected ? selected.key : "ALL",
    programs: ctx.programs.map((program) => ({ key: program.key, name: program.name })),
    window: ctx.window,
    view,
    hasData: issues.length > 0,
    jiraBaseUrl: (process.env.JIRA_BASE_URL ?? "").replace(/\/+$/, ""),
    meta: {
      lastRefreshedAt: settings.lastRefreshedAt,
      lastRefreshedByEmail: settings.lastRefreshedByEmail,
      lastRefreshError: settings.lastRefreshError,
      vocabFetchedAt: settings.vocabFetchedAt,
      vocabError: settings.vocabError,
      vocabLive: ctx.vocab.live,
      vocabCounts: { vuln: ctx.vocab.vuln.length, track: ctx.vocab.track.length, service: Object.keys(ctx.vocab.service).length },
      workbenchUrl: settings.workbenchUrl,
    },
  };
}
