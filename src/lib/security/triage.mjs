/**
 * Triage queue + fix-once campaigns (security-vulnerability-tracker.md mapping table; clarification
 * C7). Ported from the artifact's `renderTriage` — READ-ONLY proposals: nothing here writes, and
 * anything unclear is flagged for a person rather than guessed.
 *
 * - Not analysed (no `<prefix>MMM_YYYY` label), grouped program → CVE + package. A group never
 *   mixes programs: GM items carry GM track labels, every other program stays in its own bucket.
 * - Vulnerability-label proposal: the most common approved label earlier tickets for the same
 *   package carried (only tickets with exactly one approved label count as a clean precedent),
 *   then a name match against the approved list. Track proposal: the service→track page.
 * - Label fixes needed, unapproved spellings, unmapped / ambiguous services.
 */
import {
  approvedTrackLabels,
  approvedVulnLabels,
  parseFinding,
  statusBucket,
  trackOf,
  unapprovedVulnLike,
} from "./classify.mjs";
import { and, keysJql } from "./jql.mjs";

/** Approved labels whose core matches a package (axios → axios-vulna, path-to-regexp → PATH_TO_REGEX_VULNA). */
const labelCore = (label) =>
  label.toLowerCase().replace(/^vulna-|-vulna$|_vulna$|_vuln$|_upgrade$/g, "").replace(/[^a-z0-9]/g, "");

export function nameMatch(name, vocab) {
  const base = String(name).split(/[:/]/).pop().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!base) return [];
  return vocab.vuln.filter((label) => {
    const core = labelCore(label);
    return core && (core === base || (core.length >= 4 && base.startsWith(core)) || (base.length >= 4 && core.startsWith(base)));
  });
}

/** package(lowercase) → { label: count } from every mirrored ticket with exactly one approved label. */
export function precedentByPackage(pool, vocab) {
  const byPkg = new Map();
  for (const issue of pool) {
    const finding = parseFinding(issue.summary);
    const approved = approvedVulnLabels(issue.labels, vocab);
    if (!finding || approved.length !== 1) continue;
    const counts = byPkg.get(finding.pkg.toLowerCase()) ?? {};
    counts[approved[0]] = (counts[approved[0]] ?? 0) + 1;
    byPkg.set(finding.pkg.toLowerCase(), counts);
  }
  return byPkg;
}

export function proposeVulnLabel(finding, byPkg, vocab) {
  const counts = byPkg.get(finding.pkg.toLowerCase());
  if (counts) {
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const [label, n] = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return { label, basis: `${n}/${total} earlier tickets` };
  }
  const matches = nameMatch(finding.pkg, vocab);
  if (matches.length === 1) return { label: matches[0], basis: "name match" };
  if (matches.length > 1) return { label: null, choices: matches, basis: "ambiguous — pick one" };
  return { label: null, basis: "no approved label fits — new label?" };
}

/**
 * @param {Array<object>} rows classified pipeline rows (aggregate.mjs), each with `issue` + `program`
 * @param {{ vocab: object, pool: Array<object>, progressIssues: Array<object>, baseJql: string,
 *   untriagedClause: string, programs: Array<object> }} ctx
 */
export function triageQueue(rows, ctx) {
  const { vocab } = ctx;
  const byPkg = precedentByPackage(ctx.pool, vocab);
  const recs = rows.map((row) => {
    const { issue, program } = row;
    const finding = parseFinding(issue.summary);
    const vulnHave = approvedVulnLabels(issue.labels, vocab);
    const usesTracks = Boolean(program?.usesTrackLabels);
    const trackHave = usesTracks ? approvedTrackLabels(issue.labels, vocab) : [];
    return {
      key: row.key,
      programKey: program?.key ?? null,
      usesTracks,
      finding,
      analysed: row.triaged,
      vulnHave,
      trackHave,
      unapproved: unapprovedVulnLike(issue.labels, vocab),
      track: usesTracks && trackHave.length === 0 ? trackOf(issue, vocab, program) : null,
    };
  });

  return {
    notAnalysed: notAnalysedGroups(recs, ctx, byPkg),
    ...labelFixes(recs, ctx),
  };
}

function notAnalysedGroups(recs, ctx, byPkg) {
  const todo = recs.filter((rec) => !rec.analysed);
  const programs = ctx.programs
    .map((program) => {
      const mine = todo.filter((rec) => rec.programKey === program.key);
      const groups = new Map();
      const manual = [];
      for (const rec of mine) {
        if (!rec.finding) {
          manual.push(rec.key);
          continue;
        }
        const id = `${rec.finding.cve}||${rec.finding.pkg}`;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(rec);
      }
      const list = [...groups.values()]
        .map((group) => describeGroup(group, ctx, byPkg))
        .sort((a, b) => b.keys.length - a.keys.length || a.cve.localeCompare(b.cve));
      return {
        key: program.key,
        name: program.name,
        usesTracks: Boolean(program.usesTrackLabels),
        count: mine.length,
        groups: list,
        manual,
        manualJql: keysJql(manual),
      };
    })
    .filter((entry) => entry.count > 0);
  return { count: todo.length, jql: and(ctx.baseJql, ctx.untriagedClause), programs };
}

function describeGroup(group, ctx, byPkg) {
  const first = group[0];
  const keys = group.map((rec) => rec.key);
  const have = group.filter((rec) => rec.vulnHave.length > 0).length;
  const vuln =
    have === group.length
      ? { state: "labelled", label: first.vulnHave[0] }
      : { state: "proposed", have, ...proposeVulnLabel(first.finding, byPkg, ctx.vocab) };

  let track = null;
  if (first.usesTracks) {
    const tally = {};
    let ambiguous = 0;
    let unmapped = 0;
    let done = 0;
    for (const rec of group) {
      if (rec.trackHave.length > 0) done += 1;
      else if (rec.track?.status === "mapped") tally[rec.track.track] = (tally[rec.track.track] ?? 0) + 1;
      else if (rec.track?.status === "ambiguous") ambiguous += 1;
      else unmapped += 1;
    }
    track = { tally: Object.entries(tally).map(([label, n]) => ({ label, n })), ambiguous, unmapped, done };
  }
  return { cve: first.finding.cve, pkg: first.finding.pkg, keys, jql: keysJql(keys), vuln, track };
}

function fixRow(id, label, keys, note) {
  return { id, label, keys, jql: keysJql(keys), note };
}

function labelFixes(recs, ctx) {
  const noVuln = recs.filter((rec) => rec.vulnHave.length === 0);
  const twoVuln = recs.filter((rec) => rec.vulnHave.length > 1);
  const trackRecs = recs.filter((rec) => rec.usesTracks);
  const noTrack = trackRecs.filter((rec) => rec.trackHave.length === 0);
  const twoTrack = trackRecs.filter((rec) => rec.trackHave.length > 1);
  const status = (wanted) => noTrack.filter((rec) => rec.track?.status === wanted);
  const keys = (list) => list.map((rec) => rec.key);
  const closedNoResolution = ctx.progressIssues.filter(
    (issue) => statusBucket(issue) === "done" && !issue.resolvedAt,
  );

  const fixes = [
    fixRow("noVuln", "No approved vulnerability label", keys(noVuln), null),
    fixRow("twoVuln", "Two or more vulnerability labels", keys(twoVuln), "the workflow allows exactly one"),
    fixRow(
      "closedNoResolution",
      "Closed without a resolution date",
      closedNoResolution.map((issue) => issue.jiraKey),
      "invisible to resolution-date reports; trends use the status-change date instead",
    ),
  ];
  if (trackRecs.length > 0) {
    fixes.push(
      fixRow(
        "noTrack",
        "No approved track label",
        keys(noTrack),
        `${status("mapped").length} mapped · ${status("ambiguous").length} ambiguous · ${status("unmapped").length} unmapped service · ${status("noimage").length} without an image`,
      ),
      fixRow("twoTrack", "Two or more track labels", keys(twoTrack), "the workflow allows exactly one"),
    );
  }

  const spellings = new Map();
  for (const rec of recs) {
    for (const label of rec.unapproved) spellings.set(label, [...(spellings.get(label) ?? []), rec.key]);
  }
  const unmapped = new Map();
  // "unmapped" is only ever set for a parsed finding (no finding ⇒ "noimage"), so the image exists.
  for (const rec of status("unmapped")) {
    unmapped.set(rec.finding.image, [...(unmapped.get(rec.finding.image) ?? []), rec.key]);
  }
  const ambiguous = new Map();
  for (const rec of status("ambiguous")) ambiguous.set(rec.finding.image, rec.track.choices);

  return {
    fixes,
    spellings: [...spellings.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([label, list]) => {
        const suggestion = nameMatch(label.replace(/vulnerability|vulna|vuln/gi, ""), ctx.vocab);
        return { label, keys: list, jql: keysJql(list), suggestion: suggestion.length === 1 ? suggestion[0] : null };
      }),
    unmappedServices: [...unmapped.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([service, list]) => ({ service, keys: list, jql: keysJql(list) })),
    ambiguousServices: [...ambiguous.entries()].map(([service, choices]) => ({ service, choices })),
  };
}

/**
 * Fix-once campaigns: open Oligo findings grouped by vulnerable package — one dependency upgrade
 * (or base-image rebuild) can close all of them.
 */
export function campaigns(rows) {
  const byPkg = new Map();
  let oligoTotal = 0;
  for (const row of rows) {
    const finding = parseFinding(row.issue.summary);
    if (!finding) continue;
    oligoTotal += 1;
    const entry = byPkg.get(finding.pkg) ?? { pkg: finding.pkg, keys: [], cves: new Set(), images: new Set(), versions: new Set(), programs: {} };
    entry.keys.push(row.key);
    entry.cves.add(finding.cve);
    entry.images.add(finding.image);
    entry.versions.add(finding.version);
    const programKey = row.program?.key ?? "—";
    entry.programs[programKey] = (entry.programs[programKey] ?? 0) + 1;
    byPkg.set(finding.pkg, entry);
  }
  const list = [...byPkg.values()]
    .sort((a, b) => b.keys.length - a.keys.length || a.pkg.localeCompare(b.pkg))
    .map((entry) => ({
      pkg: entry.pkg,
      keys: entry.keys,
      jql: keysJql(entry.keys),
      cves: entry.cves.size,
      services: entry.images.size,
      versions: [...entry.versions].sort(),
      programs: Object.entries(entry.programs).sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n })),
    }));
  return {
    packages: list.length,
    oligoTotal,
    top5Coverage: list.slice(0, 5).reduce((sum, entry) => sum + entry.keys.length, 0),
    list,
  };
}
