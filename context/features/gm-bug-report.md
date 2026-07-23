# Bug Report dashboards — config-driven bug matrix + executive dashboard

## Overview

Automate the **daily GM bug report** that is hand-built today: a matrix of open bug counts with
SLA-breach overlays, broken down by category (Engineering / Product / Support / QA / GM) × scope
(External / Internal) × priority band (P0 / P1 / P2+), presented as a leadership dashboard at
**`/bugs`**. Built **multi-report from day one** (Naveen 2026-07-21: *"tomorrow I should be able
to get a similar dashboard for even Project = Honda"*) — a new dashboard is an admin config
exercise, never a code change.

The manual artifact today:

| Category | Ext P0 | Ext P1 | Ext P2+ | Ext Total | Int P0 | Int P1 | Int P2+ | Int Total | Total |
|---|---|---|---|---|---|---|---|---|---|
| **Total Open Bugs** | — | 28 (12) | 31 (9) | 59 | 21 (18) | 62 (33) | 79 (16) | 162 | **221** |
| Engineering Team | — | 12 | 9 | 21 | 6 | 15 | 35 | 56 | 77 |
| Product Team | — | 5 | 8 | 13 | 5 | 11 | 5 | 21 | 34 |
| Support Team | — | 7 | 8 | 15 | — | — | — | — | 15 |
| QA Team | — | 2 | 2 | 4 | 10 | 36 | 39 | 85 | 89 |
| GM Team | — | 2 | 4 | 6 | — | — | — | — | 6 |
| Wrong Component / Status | — | — | — | — | — | — | — | — | — |

`n (m)` = n open, m SLA-breached (red).

**We render one column per real priority — P0 · P1 · P2 · P3 · P4 — not the manual report's
grouped `P2+`** (Naveen 2026-07-21: more intuitive for charts and graphs). The matrix is therefore
~13 columns wide (2 scopes × 5 bands + 2 scope totals + grand total); it reuses the delivery
matrix's frozen-first-column + horizontal-scroll treatment. Equivalence against the manual table
is `P2 + P3 + P4 == manual P2+`.

Same §2/§3 mission as `/rollup` — leadership visibility — for a different unit of work. Touches
project-overview §5, §8, §9, §10, §11, §13, §17.

> **Key architectural shift: the first read path in the app that is NOT sprint-scoped.**
> Everything so far hangs off `Sprint → Filter → Issue → IssueProgress` with a manual stage
> overlay. A bug report has no sprint, no stages, no per-issue lifecycle — its unit is *counts
> across dimensions*. It gets its own config + cache + snapshot models and its own pure
> aggregation module, reusing only the Jira client, the cron shell, and the UI kit.

> **Second shift: the cache stores raw Jira facts only; ALL classification happens at read time.**
> Band, category, and SLA breach are pure functions of `(issue, config)` evaluated on every render
> — not baked into the cache. Editing a status list or an SLA day count in `/admin` therefore
> changes the dashboard **instantly**, with no Jira refresh. It also keeps the refresh pipeline a
> dumb Jira mirror, which is the part most likely to fail.

**Roadmap position:** post-v1, not a master-plan step (the plan is complete). Requested by Naveen
2026-07-21, sequenced ahead of the remaining open AI ideas.

**Size warning:** the largest feature in the project to date. Scope (a)–(f) is the load-bearing
core; (g) is the panel set and may land incrementally within the branch. A panel either renders
real data or isn't rendered.

## Status

**Done 2026-07-21.** Implemented as specced, with **two real bugs found and fixed during
verification** (both Prisma transaction-timeout defects — see As-built notes) and one linter-caught
purity violation.

Implemented: (a) 7 models + migration `20260721190833_add_bug_report_models` (§9 synced same
change); (b) pure `src/lib/bug-report/matrix.mjs` (`resolveBand`, `resolveCategory`, `isBreached`,
`buildMatrix`, `snapshotRows`, `diffMatrix`, `agingBuckets`, `daysOverSla`, `cellJql`,
`validateConfig`, `DEFAULT_BANDS`); (c) `src/lib/bug-report/refresh.js` (resolve → fetch-all →
abort-before-write → transactional cache replace → snapshot, plus `resolveRefreshAuth`);
(d) `searchIssues` gained optional `maxIssues`; (e) 4 routes (`/api/bug-reports`,
`/[reportId]`, `/[reportId]/config`, `/[reportId]/refresh`) + `schemas/bug-report.js` + the cron
extension with per-report isolation; (f) `src/lib/bug-report-data.js` + `/bugs` + `/bugs/[slug]` +
`BugsTopBar` + TopBar links on `/` and `/rollup`; (g) 10 panels across
`bug-matrix.jsx` / `bug-kpi-cards.jsx` / `bug-charts.jsx` / `bug-lists.jsx` / `bugs-page.jsx` /
`bugs-actions.jsx`; (h) `admin/bug-report-config.jsx` wired into `/admin`.

**Verified:** `yarn lint` clean; `prisma validate` valid + `migrate status` up to date
(**4 migrations**); **DB/env-free production build green — 35 ƒ Dynamic** (`.env` genuinely moved
away and restored, exactly the 6 new entries added); **80/80 plain-Node fixtures** including the
ground-truth case built from live filter 68840; **49/49 SSR/API smoke on dev + Neon against the
REAL filters 68840 / 68841** — RBAC gates (401/403 for view/create/config, refresh open to any
authenticated user), config validation rejecting a duplicated status and two catch-alls, a live
two-scope refresh (**External 58 · Internal 173 · 231 total, 60 snapshot rows**, Internal proving
>100-issue pagination), matrix arithmetic reconciling against the cache (bands sum to scope total,
category rows sum to grand total, grand total = cached issue count), idempotent same-day re-run
(exactly one snapshot set/day), **failure isolation** (broken filter → non-2xx with cache AND
snapshots untouched and `lastRefreshError` recorded), full SSR of every panel with drill-down
hrefs, and **an SLA-days edit changing breach counts from 81 → 0 with no Jira refresh** (proving
read-time classification). Runtime smoke re-run post-build: `/bugs` unauth 307, all three API
routes 401, `health/db` ok against Neon, cron bad-bearer 401. **Headless-Chrome visual pass at
1440 px and 1800 px** against real data — 13 columns fit with no page overflow. Fixtures torn down
to **0 rows across all 7 tables**; harnesses and the temporary spike page deleted.

⚠️ **Pending human acceptance (Naveen):** create the production report in `/admin` with the real
filters, the category → status mapping, and the SLA days; then confirm the rendered matrix matches
the manual report (remembering `P2 + P3 + P4 == manual P2+`).

## As-built notes (vs. the spec)

- **Bug found and fixed №1 — `PUT …/config` blew Prisma's 5 s interactive-transaction timeout
  (P2028).** A full config save is ~20 sequential round-trips (scopes + their SLA targets, bands,
  categories, fallback, plus a read-back) and took 6.8 s against Neon. Fixed by moving the
  read-back *outside* the transaction (it needs no transactional guarantee) and budgeting
  `{ timeout: 30000 }`. This would have grown worse with more categories — it was not a
  fixture-sized fluke.
- **Bug found and fixed №2 — the snapshot write blew the same timeout.** `writeSnapshot` issued
  one `upsert` per cell inside `$transaction`; a real report is ~60–70 cells, which took 5.7 s and
  failed the refresh *after* the cache had been replaced. Replaced with
  `deleteMany({reportId, capturedOn}) + createMany(rows)` — 2 statements, still atomic, still
  exactly one set per day. Snapshot ids are re-minted on re-run, which costs nothing (nothing
  references them); the spec's decision-7 upsert wording is superseded by this.
- **Linter caught a real `asOf` violation.** `BugTicketTable` computed ages with `Date.now()` in
  render; the installed `react-hooks/purity` rule rejected it. Fixed by threading the page's
  request-time `asOf` through — which is also what the spec's own asOf discipline required, so the
  rule caught a genuine inconsistency rather than a style nit.
- **Panel files consolidated 10 → 6.** The spec listed ten component files; (g)5–7 became
  `bug-charts.jsx` (three bar panels sharing one `<Bar>` primitive) and (g)8–10 became
  `bug-lists.jsx` (three list panels sharing the `IssueKey` link primitive). Same content, less
  near-identical boilerplate. `bugs-page.jsx` was added to share the body between `/bugs` and
  `/bugs/[slug]`, and `bugs-top-bar.jsx` for the page chrome.
- **Config is one document route, and editing a scope WITHOUT its id is a delete+create** —
  which cascade-drops that scope's cached issues until the next refresh. The admin UI always
  sends ids so this is invisible there, but it bit the smoke harness and is worth knowing.
- **`BugReport.slug` is unique and `BugReportScope`/`Band`/`Category` are unique per report+name**,
  so a duplicate name returns 409 through the existing P2002 mapping rather than silently
  creating a twin.
- **SLA days are capped at 3650** in the zod schema (10 years). The smoke harness initially tried
  9999 and was correctly rejected — the cap works, the test was wrong.
- **Palette validated, not eyeballed** (dataviz skill): `#00a892` teal + `#3b82f6` blue passed all
  checks — CVD ΔE 19.9 (protan) / 20.9 normal. The one contrast WARN (teal 2.92:1 vs surface) is
  discharged as the validator requires: every series is directly labelled and the matrix is the
  table view. `#ef4444` is reserved for SLA breach as a status colour and never reused as a series.
- **The dev server had to be restarted mid-verification** — it was started before the migration
  and held a stale Prisma client with no `bugReport` model, returning 500s. Same class of stale-
  server issue as the risk-comments feature.
- **Live numbers drift daily.** Filter 68840 returned 57 issues when the spec was written and 58
  during verification. Any future assertion on these must re-read them, not trust the spec.
- **Drill-down JQL was malformed for saved-filter scopes, fixed post-verification (Naveen,
  2026-07-22 — "hyperlink on those issue count is not accurate").** `cellJql` inlined the scope's
  `resolvedJql` in parentheses, but **saved Jira filters end with `ORDER BY …`** (68840 →
  `… ORDER BY assignee DESC`, 68841 → `… ORDER BY created DESC`) and `ORDER BY` is only legal at
  the very END of a query — so every cell link emitted
  `(… ORDER BY assignee DESC) AND status IN (…)`, a syntax error rather than a narrower search.
  Two fixes: (1) a saved-filter scope is now referenced as **`filter = <id>`** rather than by
  inlining its JQL — always valid, and it stays correct if the filter is edited in Jira;
  (2) a trailing top-level `ORDER BY` is stripped (`stripOrderBy`, quote-aware so a status
  literally named "Order by date" survives). **Verified against live Jira: 20/20 cells
  now match the dashboard exactly** — every band and scope total plus every category row incl. the
  fallback (whose `status NOT IN (others)` form was independently confirmed correct). The first
  run showed 3 Internal cells off by exactly +1; refreshing the cache resolved them, confirming
  cache staleness (by design) rather than a composition error.

- **The breach `(m)` count had no separate link, added (Naveen, 2026-07-22 — "I don't see the
  href for the breached items").** The whole cell was one anchor, so clicking the red `(m)` opened
  ALL open items in the cell, not the breached subset. Added `cellBreachedJql` in `matrix.mjs`: it
  ANDs the SLA condition onto the cell JQL as an OR of `(priority = P AND created < -{days}d)` over
  the column's SLA-targeted priorities (day counts differ per priority, so it can't be one
  threshold; Jira evaluates `-Nd` at click time — same staleness tolerance as any drill-down).
  Returns `null` when the column has no SLA-targeted priority (nothing to link). The matrix now
  renders the count and the `(m)` as **sibling** links (nested `<a>` is invalid HTML): count →
  full cell, `(m)` → breached subset. **Verified live: 20/20 breach counts match the composed JQL
  exactly**, and the rendered `/bugs` HTML emits **32 distinct breach links** carrying
  `created < -Nd` alongside the 39 open-cell links.

- **Drill-down universe was dropped for EVERY cell, fixed (Naveen, 2026-07-22 — "the href
  generation logic … doesn't filter data by project, type, status and component").** The links
  degraded to a bare `priority IN ("P1 - High")`. Root cause: `buildMatrix` returns **trimmed**
  scope objects (`{ id, name, bands }` — no `resolvedJql`/`jql`/`jiraFilterId`), and the page fed
  those straight into `cellJql`, so `scopeClause` found no source and emitted nothing. **This is a
  verification gap, not just a code bug:** the live-Jira harness had passed the *full* `report.scopes`
  object, so it exercised a path the real render never takes — it proved counts, never the actual
  hrefs. Fixed by having `getBugReportData`'s `cellJql` closure resolve the full scope by id
  (`report.scopes.find(s => s.id === scope.id)`). Re-verified the RIGHT way: **39/39 drill-down
  hrefs parsed out of the rendered `/bugs` HTML now carry their scope's full universe** (External →
  `project in ("Tekion Engineering") and type in ("Tap Ticket") … and component = DR_GM`, Internal →
  `project = GM and issuetype = Bug …`), 0 bare; and a new fixture reproduces the trimmed-scope drop
  and its fix so it can't regress.

- **Drill-down links were opaque, fixed (Naveen, 2026-07-22 — "the links are not considering
  project space, type, status and component").** The `filter = <id>` form above produced the right
  COUNT but told Jira's navigator nothing: the criteria are invisible in the UI, and anyone
  without access to that saved filter just gets an error. Since `stripOrderBy` had made inlining
  safe, `scopeClause` now **inlines the scope's resolved JQL** — so a cell link carries the whole
  universe (project, type, status exclusions, the `Program[…]` custom field, component) plus the
  cell's own status and priority. It also pins the link to exactly the JQL that produced the
  cached numbers, so a link can't diverge from its cell if the filter is edited in Jira between
  refreshes. `filter = <id>` survives only as the fallback for a saved-filter scope that has never
  been resolved (before the first refresh), where inlining nothing would widen the search to the
  whole instance. **Re-verified live: 20/20 cells match.** Two mismatches in the first pass were
  again pure staleness — a refresh showed External had genuinely dropped 62 → 61.

- **Trend chart clipping + dead space, fixed post-verification (Naveen, 2026-07-22 — "UI is
  chopping").** Two defects in `BugTrendPanel`, both invisible to SSR assertions and only visible
  once a second capture existed: (1) the endpoint value label is drawn at `y(last) − 10`, so when
  the last point IS the series maximum it sat at `PAD.top − 10` and had its glyph tops sheared off
  by the viewBox — fixed by clamping to `Math.max(…, 12)` and raising `PAD.top` to 24; (2) the
  `max-w-3xl` cap (added during trend-burndown to stop the sprint chart ballooning) left ~a third
  of the card empty whenever the two-up row collapses to full width below `xl` — fixed by dropping
  the cap and widening the viewBox to **1000×190**, so the chart fills its card at any width while
  staying ~200px tall at 1200px and ~115px at half width. Re-verified by screenshotting Naveen's
  real `gm` report (233 issues, 2 captures) at 1200px and 1600px.

**Nothing about the report is hardcoded** (Naveen, restated 2026-07-21): the two scope universes,
the category→status mapping, the SLA days, and the priority bands are *all* admin-configurable —
see decision 1 and scope (h). The values below are development/test inputs, not constants baked
into the build; the app ships with an empty config and a "no report configured yet" state.
Verification runs against fabricated config + a contract-faithful mock Jira, plus the two real
test filters recorded below.

### Live-Jira validation (2026-07-21, before writing this spec)

Probed to kill assumptions rather than encode them:

- **External universe reconciles EXACTLY with the manual table.**
  `project = "Tekion Engineering" AND type = "Tap Ticket" AND component = DR_GM AND
  statusCategory != Done` → **59** issues (no next page); priorities P1 **28**, P2 25 + P3 1 + P4
  5 = **31**, P0 **0**. The manual table's External row is 28 / 31 / 59. **So `P2+` = P2+P3+P4.**
- **Status-driven categorisation confirmed.** Live external statuses: `Support Clarification` 20 ·
  `PM Backlog` 12 · `Backlog` 8 · `Dev To Do` 5 · `Pending RCA` 5 · `Testing` 5 · `Dev In
  Progress` 2 · `Awaiting ED Acceptance` 1 · `Blocked` 1. `Backlog + Dev To Do + Dev In Progress +
  Blocked + Pending RCA` = **21** = the manual Engineering Team external count exactly.
- **Internal:** `project = GM AND issuetype = Bug AND statusCategory != Done` → >100 open
  (consistent with 162). `issuetype = Bug` was my guess; the configured filter settles it.
- **Two dead assumptions:** `project = GM` alone yields ~3 bugs in 60 days (30/30 recent open
  issues are component `DR_GM`, 26 Tech Story) — it is the *Internal* universe only, never the
  whole report. And `issuetype in ("Internal Bug","Support Bug")` returns **zero** in GM, so class
  is not issue-type-driven — it is which **project/universe** the bug lives in.
- Priority names in play: `P0 - Highest`, `P1 - High`, `P2 - Medium`, `P3 - Low`, `P4 - Lowest`.

**Test filters supplied by Naveen (2026-07-21) — both resolve and are visible:**

| | Filter | Live result |
|---|---|---|
| External | `filter = 68840` | **57** (no next page) · P0 0 · P1 **28** · P2+ 29 (P2 23 + P3 1 + P4 5) |
| Internal | `filter = 68841` | **>100** (paginated; total unknown from one page) · first page P0 18 · P1 37 · P2 42 · P3 3 |

Point the dev/smoke config at these two. Note the External filter returns **57**, not the 59 my
hand-written JQL returned, so it is *not* byte-identical to my reconstruction — **the configured
filter is the source of truth**, and small drift from the pasted manual table is expected and fine.

**Observed status vocabulary** (union across both scopes, to seed the admin status picker):
`Support Clarification` · `PM Backlog` · `Backlog` · `Pending RCA` · `Testing` · `Dev To Do` ·
`Dev In Progress` · `Code Review` · `Blocked` · `OEM Review` · `Awaiting ED Acceptance`.
`OEM Review` appears only in the Internal scope and in none of the manual table's rows — exactly
the case decision 9's fallback category exists to absorb.

## Decisions

Decisions 1–5, 7–8 are **ratified (Naveen 2026-07-21)**. **Decisions 6 and 9 were ratified and
then REVERSED the same day** — the reversal is authoritative and is what must be built. Decisions
10–18 are **PROPOSED** with a default and alternatives considered; none block implementation.

1. **Rows configurable, columns configurable, cells derived.** Categories (rows), scopes
   (External/Internal), and priority bands are all admin config. *Superseded* the original
   "columns fixed" decision once multi-report extensibility became a requirement — Honda may not
   have the same shape.
2. **New top-level route `/bugs` (+ `/bugs/[slug]`)**, with a TopBar link. Not a `/rollup` tab:
   `/rollup` is sprint-scoped and membership-derived; the bug report is neither, and a shared
   sprint selector over a non-sprint artifact would be misleading.
3. **Cached + daily cron + manual Refresh.** Page renders instantly from Postgres with a staleness
   label; Refresh re-pulls on demand; `POST /api/cron/daily` refreshes nightly. *Alternative:*
   live-pull-on-open like the reference tracker — rejected (5–20 s leadership page loads, no
   history).
4. **Full executive dashboard in v1** (scope (g)). **The `gm-security-vulnerabilities-tracker` PDF
   is a VISUAL reference only** (Naveen, explicit) — take its language (hero, KPI cards, stat
   emphasis, section cards, reference links), not its program-specific panels (release plans,
   1.0/2.0 bifurcation, timeline, Slack feed). Those do not exist for bugs.
5. **A scope's universe is a saved Jira filter ID *or* raw JQL** — `sourceType` union, reusing the
   existing `FilterSourceType` enum. Naveen has supplied working JQL in conversation and will
   supply saved filters later; supporting both costs one enum column and avoids a migration when
   he switches. Filter IDs resolve to their current JQL at refresh time via the existing
   `fetchFilter`; the resolved JQL + resolve timestamp are persisted and shown in admin so a
   Jira-side edit is visible rather than silent.
6. **~~SLA breach is a configured Jira filter~~ → REVERSED. SLA breach is app-computed from
   configurable days per (scope, priority).** Admin sets SLA days for P0/P1/P2/P3/P4 separately
   for External and Internal; a bug is breached when `jiraCreatedAt + days < now` (Naveen's
   example: `created < '-16d'`). Note the config is keyed by **Jira priority name**, not by band —
   bands are display columns, SLA is per real priority. Evaluated at **read time** (see the
   Overview's second shift), so editing a day count re-renders instantly.
7. **Snapshot every cell daily** — one row per (report, day, row, scope, band) with `count` +
   `breachedCount`. Powers per-cell deltas, per-category trend, and the trend chart.
   *Alternative:* totals-only — rejected, history cannot be backfilled.
8. **Categories are ordered status lists.** `QA Team → status = Testing`, `Product Team → status =
   PM Backlog`, etc. First match wins by `sortOrder`, so rows always partition and the arithmetic
   always reconciles. A status appearing in two categories is a config error — **rejected at save
   time**, not silently resolved.
9. **~~Unmatched statuses land in a `Wrong Component / Status` residual row~~ → REVERSED.
   Unmatched statuses fall back to a configurable fallback category** (`BugReport.fallbackCategoryId`;
   Naveen: Engineering Team). This is what makes the live `Pending RCA` + `Backlog` + … = 21
   Engineering match work. The residual `__unattributed__` row is still computed and rendered
   **only when no fallback category is configured** — so `Wrong Component / Status` becomes an
   ordinary configurable category if Naveen wants it back, and is otherwise structurally empty
   (matching his table, where it is all dashes).
10. **`Total Open Bugs` = the union of the scope universes**, which are disjoint by construction
    (different projects), so scope totals simply add. Category rows sum to it exactly *because* of
    decisions 8 + 9 — a partition with a fallback cannot leak.
11. **Bands are an ordered, configurable list of priority-name sets.** **Default is one band per
    real priority — `P0 · P1 · P2 · P3 · P4`** (Naveen 2026-07-21: *"break it down to all
    priorities so charts and graphs are more intuitive"*), replacing the earlier grouped
    `P0/P1/P2+` default. Grouping remains expressible (a band may list several priority names), so
    a `P2+` view is still one config edit away. **At most one band may be `isCatchAll`, and zero
    is the default** — an unmatched or missing priority then lands in the derived `__unbanded__`
    column, which renders only when non-empty (symmetric with decision 9's residual row). Never
    parse priority strings — map them, the `StatusStageMapping` precedent. **Explicitly not an AI
    task** (Naveen floated
    "programmatically or using AI tools"): priority→band is a finite, stable, auditable mapping,
    and an LLM would add latency, cost, and nondeterminism to a number leadership reads daily.
    AI belongs in the *narrative over* these numbers, never in producing them.
12. **Classification is pure and read-time; the cache stores raw Jira facts only.** No
    `categoryId` / `bandId` / `slaBreached` columns on the cache. Config edits apply without a
    refresh, the pipeline stays a dumb mirror, and the whole classifier is plain-Node testable.
13. **Refresh is ~1 paginated fetch per scope.** Status, priority and created ride on the issues
    we already fetch, so there is no key-set intersection and no per-cell counting. GM = 2 fetches.
    *(This supersedes the intersection pipeline in the first draft, which existed only because
    class/band/category were all separate filters.)*
14. **Two-layer storage mirroring `Issue` (cache) vs `SprintSnapshot` (history).**
    `BugReportIssue` is a replace-on-refresh mirror of each scope's universe; `BugReportSnapshot`
    is upsert-per-day history of the classified matrix.
15. **Snapshot rows are self-describing** — `rowKey`/`rowLabel`, `scopeKey`/`scopeLabel`,
    `bandKey`/`bandLabel`. Renaming or deleting a category, scope, or band never rewrites or
    orphans history, and the unique constraint stays NULL-free (the bootstrap-seed
    Postgres-NULL-unique lesson).
16. **Refresh uses the service credential (`CRON_SYNC_USER_EMAIL`) for both cron and manual
    refresh**, falling back to the caller's only when unset; the resolved identity is shown.
    A deliberate departure from step-5's "you sync what YOUR token can see": this is one shared
    org artifact, and per-caller Jira visibility would make the headline number flip-flop between
    viewers and disagree with the nightly snapshot.
17. **A failed scope never silently zeroes rows.** If a scope's filter fails to resolve or fetch,
    the refresh aborts *before* writing, `lastRefreshError` is recorded, and the page keeps
    rendering last-good data behind a visible banner. A zeroed row on a leadership dashboard is a
    lie.
18. **Access: any authenticated user may view and refresh; global admin only may configure.**
    Reports are org-level, not team-scoped — the categories deliberately cut across teams.
    **Charts stay hand-rolled inline SVG, no charting dependency** (the `TrendPanel` precedent;
    Recharts would force `'use client'` across the dashboard and fight the `html2canvas-pro`
    export path). Consult the `dataviz` skill before writing chart code.

## Requirements

### Scope

**(a) Schema + migration (prisma-change workflow)**

Migration `add_bug_report_models` via `yarn db:migrate` (never `db push`); §9 updated
byte-consistent in the same change (Prisma block + ER diagram + entity rationale).

- `BugReport` — `name`, `slug @unique`, `description?`, `ownerName?`, `targetDate?`,
  `targetLabel?` (optional hero countdown), `fallbackCategoryId?` (decision 9), `isActive`,
  `lastRefreshedAt?`, `lastRefreshedByEmail?`, `lastRefreshError?`, timestamps.
- `BugReportScope` — `reportId`, `name` ("External"/"Internal"), `sortOrder`,
  `sourceType FilterSourceType`, `jql?`, `jiraFilterId?`, `resolvedJql?`, `resolvedAt?`.
- `BugReportBand` — `reportId`, `label`, `sortOrder`, `priorityNames String[]`, `isCatchAll`.
- `BugSlaTarget` — `scopeId`, `priorityName`, `days Int`; `@@unique([scopeId, priorityName])`.
- `BugReportCategory` — `reportId`, `name`, `sortOrder`, `statuses String[]`, `accentColor?`.
- `BugReportIssue` (cache, raw facts only per decision 12) — `reportId`, `scopeId`, `jiraKey`,
  `title`, `issueType`, `jiraStatus`, `statusCategory?`, `priority?`, `assigneeName?`,
  `reporterName?`, `components?`, `labels?`, `jiraCreatedAt?`, `jiraUpdatedAt?`, `lastSyncedAt`;
  `@@unique([scopeId, jiraKey])`, `@@index([reportId])`.
- `BugReportSnapshot` — `reportId`, `capturedOn` (UTC midnight), `rowKey`, `rowLabel`, `scopeKey`,
  `scopeLabel`, `bandKey`, `bandLabel`, `count`, `breachedCount`;
  `@@unique([reportId, capturedOn, rowKey, scopeKey, bandKey])`, `@@index([reportId, capturedOn])`.

**(b) Pure classification + aggregation — `src/lib/bug-report/matrix.mjs`**

Plain-Node testable, no Prisma, no fetch (the `metrics.mjs` / `seeding.mjs` precedent):
- `resolveBand(priority, bands)` — name-set match; catch-all band if one is configured, else
  `__unbanded__` (decision 11).
- `resolveCategory(status, categories, fallbackCategoryId)` — first match by `sortOrder`;
  unmatched → fallback category, else `__unattributed__` (decision 9).
- `isBreached(issue, slaTargets, asOf)` — `jiraCreatedAt + days(priority) < asOf`; no target for
  that priority ⇒ never breached.
- `buildMatrix(issues, config, asOf)` → ordered rows (`__total__`, categories, optional
  `__unattributed__`) × scopes × (bands + per-scope Total) + a grand total, each cell
  `{ count, breachedCount }`.
- `snapshotRows(matrix, reportId, capturedOn)` → the §(a) snapshot shape (self-describing).
- `diffMatrix(today, priorSnapshotRows)` → per-cell deltas + the prior capture date.
- `agingBuckets(issues, asOf)` → `0–7d / 8–30d / 31–90d / 90d+` by `jiraCreatedAt`.
- `cellJql(scope, row, band)` → the composed drill-down JQL.
- `validateConfig(config)` → duplicate-status-across-categories, duplicate-priority-across-bands,
  more-than-one-catch-all, orphan-fallback errors (decision 8's save-time rejection). Zero
  catch-all bands is **valid** (decision 11).

**(c) Refresh pipeline — `src/lib/bug-report/refresh.js`**

`refreshBugReport(reportId, { auth })`: per scope resolve JQL (`fetchFilter` for `JIRA_FILTER`,
persist `resolvedJql`/`resolvedAt`) → paginated `searchIssues` with the fields the cache needs →
**transactional** replace of that report's `BugReportIssue` rows → classify via (b) → upsert
today's `BugReportSnapshot` rows → stamp `lastRefreshedAt`/`ByEmail`, clear `lastRefreshError`.
Any scope failure aborts before the first write (decision 17). Returns a summary.

**(d) Jira client**

`src/lib/jira/client.js`: `searchIssues` gains an optional `maxIssues` (default unchanged at
`SEARCH_MAX_ISSUES = 2000`) so a bug universe can raise the cap without weakening the sprint path.
Exceeding it still **throws loudly** — never truncate. Add `created`/`updated`/`components`/
`labels`/`reporter` to the requested field list for this path only (a bug-report-specific field
list, not a change to `buildIssueFields`).

**(e) Routes** (4 API + 2 pages → **29 → 35 ƒ Dynamic**, confirm at build)

- `GET|POST /api/bug-reports` — list (any authenticated) / create (admin).
- `GET|PATCH|DELETE /api/bug-reports/[reportId]` — admin for writes.
- `PUT /api/bug-reports/[reportId]/config` — the whole config document (scopes, bands,
  categories, SLA targets, fallback) validated by zod and applied **transactionally**; admin only.
  One document route rather than six CRUD trees: config is document-shaped, and cross-field
  validation (decision 8) needs the whole thing at once.
- `POST /api/bug-reports/[reportId]/refresh` — any authenticated user; service-credential
  resolution per decision 16; Jira errors mapped 401/502 (step-5 precedent).
- `src/lib/schemas/bug-report.js` — zod for all of the above.
- `src/lib/cron/daily.js` — after the sprint loop, refresh + snapshot every `isActive` report;
  per-report errors isolated (the per-team isolation precedent).

**(f) Read path + pages**

- `src/lib/bug-report-data.js` (server-only): `getBugReportData(slug?)` — report + config + cached
  issues + read-time matrix + prior snapshot for deltas + trend series; `listBugReports()`;
  `getBugReportConfig(reportId)` for admin.
- `src/app/bugs/page.jsx` (default/first active report) and `src/app/bugs/[slug]/page.jsx` —
  `force-dynamic` server components, auth gate → `/login`, one client leaf for Refresh + the
  report switcher.
- TopBar link on `/` and `/rollup` when ≥1 active report exists.

**(g) Dashboard panels** (`src/components/bugs/`, server components unless noted)

1. `bugs-hero.jsx` — HeroShell reuse: report name, owner, `Updated Nh ago` + refreshed-by,
   optional countdown pill, report switcher + Refresh (client leaf), `lastRefreshError` banner.
2. `bug-kpi-cards.jsx` — Total open · SLA breached · P0 open · per-scope totals · unattributed,
   each with a delta vs the prior snapshot (MetricGrid card treatment).
3. `bug-matrix.jsx` — **the core**: the table above, frozen first column, `n (m)` with breach in
   danger tone, per-cell delta on hover, every cell a Jira drill-down link.
4. `bug-trend-panel.jsx` — inline-SVG total-open + breached over time from snapshots; the
   0/1-snapshot "accrues daily" state (TrendPanel precedent).
5. `bug-priority-panel.jsx` — priority × scope table + stacked bar.
6. `bug-category-panel.jsx` — open by category, horizontal bars (**not** a donut: 7 near-equal
   categories read poorly as arcs and worse in a PDF export).
7. `bug-aging-panel.jsx` — aging buckets + oldest-open call-out.
8. `bug-breach-panel.jsx` — SLA breach call-outs, worst-first (the RiskCalloutsPanel treatment),
   showing days-over-SLA.
9. `bug-ticket-table.jsx` — top N breached/oldest with linked keys, assignee, priority, status.
10. `bug-reference-links.jsx` — each scope as a Jira link + its resolved JQL.

**(h) Admin config surface**

`src/components/admin/bug-report-config.jsx` — a `SectionCard` in `/admin`: report fields +
fallback-category picker; scopes (name, filter-id-or-JQL, **"Resolve & preview"** showing resolved
JQL + matched count before saving); the SLA-days grid (priority × scope); bands (label, priority
names, catch-all); ordered categories (name, status list, reorder, delete) with **live validation**
(duplicate status across categories, statuses present in the cache but mapped nowhere, categories
matching nothing); and a manual Refresh. A **"Duplicate report"** action seeds Honda from GM's
config (decision 1's extensibility promise, made concrete).

**Status and priority inputs are pickers over the observed vocabulary, not free text.** The cache
already knows every distinct `jiraStatus` and `priority` in the report's universes, so the category
editor offers those as a multi-select (with an "add unlisted" escape hatch for a status that
hasn't appeared yet) and shows a live count beside each. A typo'd status name would otherwise fail
silently — the issues would just drift into the fallback category and nobody would notice. The
same applies to the SLA grid: one row per priority name actually present in that scope.

### Mechanism / gotchas

- **Read the installed docs first.** Next 16 (`node_modules/next/dist/docs/`, AGENTS.md) for the
  new route tree + async `params`/`searchParams`; Prisma 7 for the migration + `String[]` scalar
  lists; Tailwind v4 `@theme` for any new token. All three differ from training data.
- **Never hardcode a universe.** `project = GM` is the *Internal* scope only; External lives in a
  different project entirely. See the validation block above.
- **Never parse priority strings** — map names to bands via config (decision 11). `P2+` is
  P2+P3+P4 *today* because that is what the default map says, not because of string ordering.
- **SLA config is keyed by Jira priority name, bands are display columns** — do not collapse them.
- **Read-time classification means `asOf` discipline:** the page passes one request-time `asOf`
  into `buildMatrix` (the step-8 metrics `asOf` precedent) so a render can't straddle midnight;
  the cron passes its capture instant.
- **Volume:** a universe may exceed the 2000-issue sprint cap. Raise it for this path only, page
  at 100, fail loudly rather than truncate.
- **Jira load:** ~1 paginated fetch per scope, sequential (§14.9 posture). Manual Refresh must
  show a blocking `PageLoader` and survive a slow round-trip.
- **Transactional cache replace** per report, mirroring the sync engine's delete-all +
  `createMany`, so a mid-refresh failure can't leave a half-populated matrix.
- **Snapshot idempotency:** upsert on `(reportId, capturedOn, rowKey, scopeKey, bandKey)` at UTC
  midnight — same-day re-runs refresh values (step-7 precedent).
- **Deltas compare against the most recent *prior* capture day**, not literally yesterday —
  snapshot gaps are never zero-filled (the `buildTrendSeries` rule).
- **Metrics purity:** nothing here reads or writes `metrics.mjs`, `IssueProgress`, or sprint data.
  §12 numbers cannot move.
- **Build stays DB/env-free** — no env reads at module load in any new file.

### Acceptance criteria

- `yarn lint` green; `prisma validate` + `migrate status` up to date (**4 migrations**);
  **DB/env-free build green — expected 35 ƒ Dynamic**. (`/verify`)
- **Plain-Node fixtures** (scratchpad, no DB): band resolution incl. catch-all, no-catch-all
  `__unbanded__`, and a missing priority; category resolution incl. first-match-wins,
  fallback-category, and no-fallback residual; `isBreached` at the exact boundary and with a
  missing target; `buildMatrix` reproducing **the sample table above** from a fabricated issue set
  (every column reconciling, total = union of scopes, rows summing to total); `diffMatrix` across
  a gap; aging-bucket boundaries; `cellJql`; `validateConfig` rejecting a duplicated status, a
  duplicated priority, and two catch-alls — while **accepting zero catch-alls**.
- **A fixture built from the real live distribution** of filter `68840` (57 issues): the five-band
  default must produce P0 **0** · P1 **28** · P2 **23** · P3 **1** · P4 **5** · Total **57**, and
  Engineering **21** under the `Backlog/Dev To Do/Dev In Progress/Blocked/Pending RCA` mapping.
  **Parity note:** the manual report groups `P2+`, so the equivalence check against it is
  `P2 + P3 + P4 == manual P2+` — do not expect a column-for-column match on that one column.
  This locks the arithmetic against ground truth before any real filter exists.
- **SSR/API smoke on dev + Neon** (minted-cookie pattern, fabricated report, contract-faithful
  **mock Jira**, teardown to 0 rows): admin-only config gates (non-admin 403 on config/create,
  200 for admin); refresh allowed for a plain authenticated user, 401 unauthenticated; a full
  refresh populating cache + snapshot; **idempotent same-day re-run**; a second day producing
  correct deltas; **failure isolation** — one broken scope leaves cache and snapshots untouched
  with `lastRefreshError` set and last-good data still rendering; config validation rejecting a
  duplicate status; **an SLA-days edit changing the breach counts with no refresh** (decision 12);
  `/bugs` and `/bugs/[slug]` SSR with correct numbers, drill-down hrefs, staleness label, and
  every panel rendering; cron refreshing the report without disturbing sprint snapshots.
- **A real two-scope run against filters `68840` (External) + `68841` (Internal)** through the
  admin config UI — not seeded SQL — proving filter-ID resolution, pagination on the >100-issue
  Internal scope, and that External renders P0 **0** / P1 **28** / P2 **23** / P3 **1** / P4 **5**
  / Total **57** (the live values recorded above, re-checked at build time since they drift daily).
- **One real end-to-end run** once Naveen enters the production filters + category→status mapping
  + SLA days: the rendered matrix matches the manual report cell for cell. **This is the
  acceptance test that matters** — fixtures prove arithmetic, not configuration.
- Visual pass at 1440px and 1800px (headless-Chrome capture, the trend-burndown precedent).

### Out of scope

- **PDF/PNG export and share tokens for `/bugs`.** Panels are built export-ready (server
  components, inline SVG, no client-only rendering) so the follow-up is small — but porting
  `ExportDialog` + a `SharedView` variant is its own feature.
- **AI narrative over the bug report** — the `lib/ai/` platform is the natural home
  (`buildBugDigestInput` alongside the sprint builders); parked as the successor feature. Note
  decision 11: AI narrates these numbers, it never computes them.
- **Daily Slack/email emission** — depends on the narrative above plus outbound plumbing the app
  does not have.
- **Per-team bug reports / roll-up integration** — reports are org-level by decision 18.
- **Resolved/closed-bug analytics** (fix rate, MTTR, reopen rate) — the universes are open-bug
  filters; closed-bug trend needs a different scope definition.
- **Redis / read caching** — unchanged from §14.9; the Postgres cache already makes reads cheap.

## Doc-sync (§17 — same PR)

- **§9**: the new models + enums in the Prisma block (byte-consistent), the ER diagram (a
  `BUG_REPORT` cluster deliberately unlinked from `TEAM`/`SPRINT`), and an entity-rationale bullet
  covering the cache-vs-history split, read-time classification, and why reports are org-level.
- **§5**: new feature row — "Bug Report dashboards (config-driven matrix + exec dashboard)".
- **§8**: note the new non-sprint read path.
- **§11**: a `/bugs` layout note alongside `/` and `/rollup`.
- **§13.3**: admin-only config; view + refresh for any authenticated user.
- **§16**: append the 2026-07-21 amendment — the ratified decisions **and the two reversals**
  (SLA computed from configurable days, not a filter; unmatched statuses → fallback category, not
  a residual row), so the reversal is not re-litigated later.
- **Master plan step 10 post-v1 clause**: add the bug report; remaining ideas shrink accordingly.
- **current-feature.md**: Status + History per the finish-feature ritual.
- **Don't over-claim:** if panel set (g) lands partially, mark the feature **[PARTIAL]** and name
  the missing panels. Do not claim "matches the manual report" until the real-config run in
  Acceptance has actually been done — until then it is "verified against fixtures only".

## References

- `/Users/naveen/Downloads/gm-security-vulnerabilities-tracker.pdf` — **visual reference only**
  (decision 4).
- @context/project-overview.md — §2, §5, §8, §9, §11, §12 (purity), §13, §14.9, §17.
- @context/features/ed-rollup.md — server-page + batched-reads + pure-aggregation precedent.
- @context/features/background-sync-snapshots.md — cron shell, UTC-midnight upsert, per-unit error
  isolation, service-credential resolution (decision 16 departs from it deliberately).
- @context/features/sync-hybrid-seeding.md — Jira client growth, pagination, transactional cache
  replace, fail-fast on dead credentials.
- @context/features/trend-burndown.md — hand-rolled inline-SVG chart precedent, gap-tolerant
  series, "accrues daily" empty state.
- @context/features/share-view-export.md — the `asOf` clock precedent for read-time computation.
- @context/features/domain-apis.md — RBAC guards, zod-per-resource, `handleRouteError` mapping.
- `src/lib/jira/client.js:105-175` (`fetchFilter`, `searchIssues` pagination, `SEARCH_MAX_ISSUES`),
  `src/lib/sync/engine.js` (cache replace), `src/lib/cron/daily.js` (loop + isolation),
  `src/lib/dashboard-data.js` (server-only read module), `src/lib/rbac.js` (`requireAdmin`),
  `src/components/dashboard/trend-panel.jsx` (SVG), `src/components/dashboard/metric-grid.jsx`,
  `src/components/admin/admin-panel.jsx` (`SectionCard` precedent), `prisma/schema.prisma`.
