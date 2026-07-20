# Trend & burndown UI (post-v1 — master-plan step 10 "then" clause)

## Overview

Render the **trend/burndown view from `SprintSnapshot` rows** — the first post-v1 item and the
step-10 "then" clause of the Production Migration Plan ("then burndown/trend UI from snapshots,
then Gemini"). The migration itself is complete (steps 1–8 + 10 DONE, 9 skipped); this is the
**next in-order feature**, and it closes the last leadership-visibility gap: §2.2's "VPs & EDs
only see a sprint go from 0 → 1" is answered mid-sprint by a daily trend line and a **"projected
by end of sprint"** signal (§5 trend row, §14.8). The data side has existed since step 7
(2026-07-09): the daily cron writes one `SprintSnapshot` row per team per ACTIVE sprint per day
(`totalPoints`, `completedPoints`, `avgProgress`, `totalIssues`, `healthCounts`, keyed
`sprintId+teamId+capturedOn`). This feature is the read/render half, plus §12's deferred velocity
swap ("replace with snapshot-based actuals once `SprintSnapshot` exists … the swap is step 10").

> **Key architectural point:** like step 7, this is mostly **assembly of proven parts** — batched
> no-N+1 Prisma reads (`getRollupData` pattern), pure functions in `lib/metrics.mjs`
> (plain-Node-fixture testable, §17), a server-safe presentational component (the `hero-shell.jsx`
> precedent: no hooks, renders in both the `/rollup` server page and the client `Dashboard`
> shell), and additive optional props (the step-8 `asOf` precedent). What's genuinely new: the
> first **chart** in the app — hand-rolled inline SVG, no charting dependency — and the first
> reads of `SprintSnapshot` outside the cron writer.

No schema change, no migration, no new dependency, no new API routes.

## Status

**Done 2026-07-19** — all 8 decisions implemented as proposed. Implemented: pure
`buildTrendSeries` / `combineSnapshotsByDay` / `snapshotVelocity` (shared `trailingBurn` basis) +
`formatDateUTC` in `src/lib/metrics.mjs`; snapshot reads in `src/lib/dashboard-data.js`
(`getDashboardData.snapshots` + request-time `asOf`, `getRollupData.combinedSnapshots` — batched,
no N+1, `getShareData` untouched); server-safe `src/components/dashboard/trend-panel.jsx`
(inline-SVG burndown: ideal/actual/projection + today marker + `<title>` tooltips + endpoint
direct-label, metric-card chrome, stat chips + projected-finish badge, decision-8 empty/sparse
states); additive `velocityOverride` on `MetricGrid` (naive detail string **byte-identical** when
absent); wiring on `/` (Dashboard) and `/rollup`. **No schema change, no migration, no new deps,
no new routes.** Verified: **31/31 plain-Node fixtures** (remaining math, latest-total ideal,
trailing-7-day rate w/ hand-computed finish `2026-07-14T03:41:32.307Z`, window exclusion, all
guards incl. zero/negative burn + asOf-past-end, off-pace clamp, combine sums/weighted-avg/
partial-day `teamCount`, card-contract fields, `formatDateUTC`); lint clean; `prisma validate` +
`migrate status` up to date; **DB/env-free build green — route list unchanged (27 ƒ Dynamic)**;
**23/23 SSR smoke on dev+Neon** (fabricated 3-team PLANNING sprint + 7 hand-written snapshot rows
incl. a gap day and a partial day, minted cookie: team-A panel w/ exactly 4 markers /
`14 pts left` / `~Jul 14` on-track badge / `45.5 pts/wk` card labeled "from daily snapshots" /
Today marker / `week 2/3`; roll-up combined `18 pts left` / `56 pts/wk` / `1 of 3` + `2 of 3
teams` titles; 0-snapshot team → accrues-daily empty state + naive card fallback; live share page
→ **no trend panel, naive velocity** — the frozen-share/export invariant); **headless-Chrome
visual pass** over a temporary `/trend-spike` page (on-track, past-sprint-end, no-burn,
single-snapshot, empty — one label collision found and fixed, see as-built); fixture torn down
(**0 leftovers**), spike + harness deleted, dev server stopped (was not running before).
⚠️ Human acceptance: Naveen's eyeball on real accrued snapshot data (density depends on the
still-pending Tekion-infra cron scheduling).

## As-built notes (vs. the spec)

- **`TrendPanel` takes a prebuilt `series` prop, not raw snapshots** — the pages/Dashboard call
  `buildTrendSeries` once and feed the same `series.points` to `snapshotVelocity`, so the chart
  and the velocity card share one derivation and can never disagree. (Spec (c) implied the panel
  consumed snapshots directly.)
- **`getDashboardData` also returns `asOf`** (request-time `new Date()`) — the panel hydrates
  inside the client tree on `/`, so the today-marker/projection clock must come from the server;
  the panel deliberately has **no `Date.now()` fallback** (no `asOf` → marker omitted) to keep
  SSR and hydration byte-identical.
- **`formatDateUTC(value, { year })`** grew a `year: false` option — axis labels and badge dates
  use "Jul 14", the general form keeps the `formatDate` shape.
- **`projection.line` (the drawable dashed segment) is computed in the pure layer** and
  fixture-pinned: zero-crossing inside the window, clamped at `developmentEnd` with positive
  remaining when off-pace, flat to end when there's no burn.
- **Endpoint direct-label raised above the point (`y − 6`)** after the visual pass — vertically
  centered, the flat no-burn projection line struck straight through the text. This was the one
  defect the headless-Chrome eyeball caught that greps couldn't.
- **Velocity card detail is now one join-built string** — naive output stays byte-identical
  ("week 2/3 · needs 1w more · on pace"); the override appends "· from daily snapshots" and
  renders `weeksNeeded: null` (work left, zero burn) as "no burn this week" instead of a
  misleading "needs 0w more".
- **Roll-up `totalTeams` = `perTeam.length`** — a team that never captured a snapshot still
  counts in the "N of M teams" denominators (honest: the day IS missing that team).
- **dataviz-skill validator run recorded:** the gray ideal line intentionally "fails" the
  categorical chroma floor (it's a reference line, not a series — gray is the point); the teal's
  2.99:1 contrast WARN is relieved per the skill's rule by the stat chips, axis ticks, and the
  endpoint label. CVD/normal-vision separation passed (ΔE 10.7/15.5).
- **Smoke mechanics:** PLANNING-state fixture sprint (the 6b precedent — never hijacks the
  real ACTIVE default selection); on `/rollup` the server-rendered panel's markup appears
  **twice** in the raw response (HTML + RSC flight payload), so marker-count greps must strip
  `<script>` blocks first — the client-tree render on `/` has no such doubling.
- **Two-up row with Risk call-outs (iterated 2026-07-19, per Naveen: "wasting a lot of real
  estate on the right of chart"):** the panel row became `grid xl:grid-cols-2` (stacking below
  xl) — burndown left, new **`RiskCalloutsPanel`** right
  (`src/components/dashboard/risk-callouts-panel.jsx`, server-safe like TrendPanel). It is the
  **deterministic forerunner of the §16 Gemini "risk/blocker call-outs" use case** (no AI, no
  new data): sprint-level trend signals first (no-burn / off-pace off the same `series` the
  chart draws, guarded on `remaining > 0`), then issues where `health.status ∈ {Blocked, Behind,
  At Risk}` sorted worst-first then points-desc, capped at 6 w/ a "+N more" overflow line;
  blocked rows show `blockedReason` inline (`/` only — the rollup progress read doesn't select
  it); Jira-linked key chips when `jiraBaseUrl` is passed (both boards since 2026-07-20 — see
  the alignment note below), `teamKey` chips on the
  roll-up (issues flat-mapped from `perTeam` with the team key attached); all-clear success
  state; stripe tone danger/warn/success by severity. Verified by an 1800px headless-Chrome
  capture of the recreated spike (populated + signal-only states; spike deleted after) and lint;
  the production build is deferred to pre-commit (Naveen's dev server holds :3002/.next).
- **Risk-panel links + column alignment (iterated 2026-07-20, per Naveen):** the roll-up's key
  chips are now Jira links too — `getRollupData` returns the same env-derived `jiraBaseUrl` as
  `getDashboardData` and `rollup/page.jsx` passes it through (the panel already supported the
  prop). And the ragged rows were per-`li` flexboxes sizing their badge/chip/key columns
  independently ("Behind" vs "At Risk" widths shifted every title): the `ul` is now a grid
  (`auto_auto_minmax(0,1fr)_auto`, +1 leading `auto` when `teamKey` chips render) with each row
  a `col-span-full grid-cols-subgrid`, so all rows share column tracks; signal rows span
  `col-[2/-1]`, pts right-align via `justify-self-end`, `minmax(0,1fr)` keeps `truncate`
  working. Verified over the live dev server with a minted admin cookie: linked `browse/GM-*`
  keys + 5-col track on `/rollup`, 4-col track on both team boards, subgrid/`col-[2/-1]`/track
  utilities present in the compiled dev CSS (harness deleted; build deferred to pre-commit —
  the dev server holds :3002/.next).
- **Chart scaling (iterated 2026-07-19, per Naveen: "way too big"):** the first cut was a
  760×236 viewBox with bare `w-full` — uniform scaling ballooned it past 500px tall on wide
  monitors. Now a flatter **760×190** viewBox with **`max-w-3xl` on the `<svg>`**, capping the
  rendered chart at ~190px tall on any screen (no `preserveAspectRatio="none"` — that would
  distort the text). The card still spans the full-bleed main column; the chart sits left within
  it. Legend is HTML below the SVG; the projection legend key only renders when a projection
  exists. Verified by an 1800px-viewport headless-Chrome capture of the recreated spike page
  (deleted again after).

## Decisions (PROPOSED 2026-07-19)

All PROPOSED with sensible defaults — none block implementation; flag disagreement at review.

1. **Placement: a shared `TrendPanel` on both `/` (per-team) and `/rollup` (combined).** The VP/ED
   trend need (§2.2, §3) lives on `/rollup`; the EM/Lead giving the weekly update upward (§2.3)
   lives on `/`. Both pages already share `MetricGrid`; the panel renders directly under it. One
   component, fed a prepared series. *Alternatives:* `/rollup`-only (rejected — EMs author the
   updates the trend is for); a dedicated `/trend` page (rejected — a new route + nav for a view
   that belongs beside the metrics it explains).
2. **Chart: hand-rolled inline SVG, server-safe, zero new deps.** A burndown is two polylines and
   an axis — a charting library (recharts/chart.js) is a client-only bundle + new dep for no gain,
   against the house no-new-deps bias (step 8 added deps only after a spike proved necessity).
   Plain `<svg>` with Tailwind `fill-*`/`stroke-*` classes (app tokens: teal brand, health
   triplets), native `<title>` per point for hover detail. No hooks, no browser APIs → the
   component renders in server and client trees alike (hero-shell precedent). *Alternative:*
   recharts (rejected — ~100KB client JS, `"use client"` forced, fights the token system).
3. **What's plotted: remaining-points burndown with ideal + actual + projection.** Per §5's row
   ("Trend / burndown / 'projected by end of sprint'"): **ideal** line from total points at
   `developmentStart` → 0 at `developmentEnd`; **actual** line through the snapshot days
   (`remaining = totalPoints − completedPoints`); **projection** dashed from the latest snapshot
   at the recent burn rate (decision 4) to sprint end. A stat row above the chart:
   latest completion %, snapshot velocity, projected finish ("~Jul 28 · on pace" / "past sprint
   end" / "no burn this week"). *Alternatives:* burnup (equivalent information, burndown is the
   §5 word and the leadership convention); health-band stacked area over time (parked — out of
   scope, the healthCounts data is stored and ready if wanted post-v1).
4. **Projection & snapshot velocity: linear over the trailing 7 days of snapshots.** Pure function
   in `metrics.mjs`: burn rate = Δ`completedPoints` between the first and last snapshot within the
   trailing 7-day window (whole series if shorter), in pts/day; `ptsPerWeek = rate × 7`;
   `projectedFinishDate = lastSnapshotDate + remaining/rate` (null when `rate ≤ 0`);
   `onTrack = projectedFinishDate ≤ developmentEnd`. **Guard: < 2 snapshots → no projection**
   (render "needs two daily snapshots"). *Alternatives:* least-squares over all points (rejected —
   early-sprint seeding noise dominates; trailing window reflects current pace); reusing the naive
   `getWeeklyVelocity` (that's exactly what §12 says to replace).
5. **The §12 velocity-card swap is additive-with-fallback, not a replacement.** `MetricGrid` gains
   an optional `velocityOverride` prop; `/` and `/rollup` pass the snapshot-based velocity
   (decision 4) when ≥ 2 snapshots exist, and the card labels it (e.g. "from daily snapshots").
   When absent — young sprints, `/share/[token]` (frozen shares store no snapshots; live shares
   get no new reads), export pages — the card computes the naive model exactly as today, so
   **frozen-share numbers cannot change** (step-8 `asOf` invariant). `getWeeklyVelocity` stays
   exported and untouched. *Alternative:* swap globally incl. shares (rejected — breaks the
   frozen-share pin and adds share-page reads for a page that deliberately has one data path).
6. **Reads extend `dashboard-data.js` — no new API routes.** Server components fetch directly with
   Prisma (coding-standards). `getDashboardData` adds one query
   (`sprintSnapshot.findMany({ where: { sprintId, teamId }, orderBy: { capturedOn: "asc" } })`);
   `getRollupData` adds the batched form (`teamId: { in: teamIds }`) grouped in JS — the
   established no-N+1 pattern. The roll-up chart plots the **per-day sum over teams** via a pure
   `combineSnapshotsByDay` (sums points/issues, issue-weighted `avgProgress` — the
   `aggregateRollup` convention; §9 "org totals are the sum over team rows").
7. **Days with partial team coverage are summed as-is, tagged with `teamCount`.** If team B has no
   row for a day (cron failure, later-added team), the combined point sums what exists; the point's
   `<title>` shows "N of M teams". *Alternative:* drop incomplete days (rejected — one never-synced
   team would blank the entire portfolio chart).
8. **Empty state renders the panel, not nothing.** 0 snapshots (PLANNING sprint, cron not yet
   scheduled — still a deploy-time task) → the panel shows "Trend data accrues daily once the
   snapshot cron runs." Making the cron's absence *visible* nudges the outstanding scheduling task;
   hiding the panel would silently re-open §14.8. One snapshot → plot the dot, no lines/projection.
   CLOSED sprints → full historical chart, no projection (window over).

## Requirements

### Scope

- **(a) Pure series builders — `src/lib/metrics.mjs`:**
  - `buildTrendSeries(snapshots, sprint, asOf)` → `{ points, ideal, projection }` where
    `points: [{ date, totalPoints, completedPoints, remainingPoints, avgProgress, totalIssues, teamCount }]`
    (sorted by date), `ideal: { start: { date, remaining }, end: { date, remaining: 0 } }` (from
    the **latest** snapshot's `totalPoints` — scope grows mid-sprint; document the choice), and
    `projection` per decision 4 (or `null`). Storage-free, Date-or-ISO tolerant like the existing
    functions; optional `asOf` marks "today" on the chart (the step-8 clock convention).
  - `combineSnapshotsByDay(snapshotRows)` → per-day combined rows (decision 6/7) for the roll-up.
  - `snapshotVelocity(points, sprint, asOf)` → the decision-4/5 override shape
    (`{ velocity, weeksElapsed, totalWeeks, weeksNeeded, onTrack, projectedFinishDate }` — field
    names matching what the velocity card consumes from `getWeeklyVelocity`, plus a
    `fromSnapshots: true` marker), or `null` under the < 2-snapshot guard.
- **(b) Data assembly — `src/lib/dashboard-data.js`:** the decision-6 reads; `getDashboardData`
  returns `snapshots` (raw team rows) and `getRollupData` returns `combinedSnapshots` (from
  `combineSnapshotsByDay`) — series building itself happens in the pages/panel via (a) so the
  pure layer stays the single owner of the math.
- **(c) Chart panel — `src/components/dashboard/trend-panel.jsx`:** server-safe presentational
  component (no `"use client"`, no hooks — hero-shell precedent). Card styled like the metric
  cards (border, tone stripe, uppercase label); stat row (completion %, snapshot velocity,
  projected finish per decision 3); the SVG burndown (ideal solid-muted, actual brand-teal,
  projection dashed, "today" marker from `asOf`, x-axis = sprint window, y-axis = points, point
  `<title>` tooltips incl. `teamCount` on `/rollup`); decision-8 empty/sparse states. **Invoke the
  `dataviz` skill before writing the chart markup** (house rule: read it before any chart code)
  and keep its guidance inside the app's existing tokens.
- **(d) Page wiring:** `/` — `src/app/page.jsx` threads `snapshots` into `Dashboard`
  (`src/components/dashboard/dashboard.jsx`), which renders `TrendPanel` under `MetricGrid` and
  passes `velocityOverride` into `MetricGrid` (decision 5). `/rollup` —
  `src/app/rollup/page.jsx` renders `TrendPanel` (combined series) between `MetricGrid` and
  `TeamSummaryTable`, same override. `src/components/dashboard/metric-grid.jsx` gains the
  optional `velocityOverride` prop (absent → naive computation exactly as today).
- **(e) Nothing else moves:** no schema change (`SprintSnapshot` shipped in `init`), no migration,
  no new deps, no new routes; `/share/[token]` and `export-dialog.jsx` untouched (decision 5).

### Mechanism / gotchas

- **Read the installed Next 16 docs first** (`node_modules/next/dist/docs/`, AGENTS.md discipline)
  for anything touched — async `searchParams` on the pages is already known; verify RSC
  serialization of `Date` props before passing snapshot rows into the client `Dashboard` shell
  (the `TeamSummaryTable` `asOf`/`lastSyncedAt` props are the working precedent).
- **Hydration-safe date labels.** `capturedOn` is **UTC midnight** (step-7 decision 6). The panel
  renders server-side on `/rollup` but inside a client tree on `/` — labels must be byte-identical
  across server render and client hydration, so format with an explicit `timeZone: "UTC"` (add a
  `formatDateUTC` beside `formatDate` in `metrics.mjs`; local-tz formatting shifts the day west of
  UTC and risks hydration mismatch).
- **Never assume contiguous days.** Snapshots start 2026-07-09, the cron can miss days, teams join
  sprints late. Lines connect the points that exist; no zero-filling (a fabricated 0-remaining
  point reads as "done").
- **SVG geometry attributes are data-driven, not inline styles** — computed `points`/`d`/`x`/`y`
  attrs are fine (ui-port precedent: "two data-driven inline styles" accepted); colors and
  typography stay Tailwind classes (`stroke-primary`, `fill-muted-foreground`, …). Confirm the
  needed `stroke-*`/`fill-*` utilities exist in the Tailwind v4 build — **no `tailwind.config.*`**;
  if a token is missing it goes in `globals.css` `@theme`.
- **`healthCounts` is `Json`** — not consumed by the burndown (decision 3 parks the band chart),
  so don't validate/thread it into the series; `combineSnapshotsByDay` sums only the numeric
  columns it needs.
- **Division guards everywhere:** single-snapshot windows (Δdays = 0), `rate ≤ 0` (no burn →
  `projectedFinishDate: null`, honest "no burn this week" copy), `totalPoints = 0` sprints
  (y-domain of 0 → render empty state, not a degenerate axis).
- The `MetricGrid` change must be **prop-additive and default-preserving** — the step-8 SSR smoke
  assertions and the frozen-share divergence check must still hold with no callers changed except
  the two pages.

### Acceptance criteria

- `yarn lint` + `yarn build` green at the repo root; build stays **DB/env-free** (`.env` moved
  aside); route list unchanged from cutover (**27 ƒ Dynamic** — no new routes/pages).
- **Plain-Node fixtures** (scratchpad) for (a): ideal endpoints from the latest total; actual
  `remainingPoints` math; trailing-7-day projection rate + `projectedFinishDate` on a hand-computed
  series; `onTrack` both ways; < 2-snapshot guard → `null`; `rate ≤ 0` → null finish;
  `combineSnapshotsByDay` sums + issue-weighted `avgProgress` + partial-day `teamCount`;
  `snapshotVelocity` field-compatibility with what the card consumes; non-contiguous days.
- **SSR smoke on dev+Neon** (minted-cookie pattern; fabricated sprint + 2 teams + ~5 days of
  hand-written `SprintSnapshot` rows incl. a gap day and a partial day; torn down to 0 leftovers):
  `/` shows the panel with expected point count + projected-finish copy + snapshot-velocity card
  (labeled); `/rollup` shows the combined series with hand-computed summed values and "N of M
  teams" on the partial day; 0-snapshot sprint → decision-8 empty state; `/share/[token]` (one
  live + one frozen fixture) renders **byte-stable velocity vs pre-change** (no trend panel, naive
  card path).
- ⚠️ Human acceptance (Naveen): eyeball the chart on `/` and `/rollup` against real accrued
  snapshot data — by now the cron has been runnable since 2026-07-09, but real-data density
  depends on the still-pending Tekion-infra scheduling; the fixture smoke is the deterministic
  gate.

### Out of scope

- **Gemini** (risk call-outs + narrative) — the next post-v1 item after this one.
- **Health-band stacked-area trend** over `healthCounts` — parked; data is stored and ready.
- **Per-team line overlay on the roll-up chart** — the per-team table already carries per-team
  detail; revisit on demand.
- **Trend on `/share/[token]` or in the PDF export** — frozen shares store no snapshots by design;
  adding live-share/export trend is a separate decision (would touch `buildShareSnapshot` and the
  A4 pages).
- **Snapshot retention/pruning and backfill** of pre-2026-07-09 days — unchanged from step 7.
- **Interactive tooltips/zoom beyond `<title>`** — post-v1 polish if wanted.
- **Redis** (§14.9 second half), **OAuth** (§13.2) — unchanged.

## Doc-sync (§17 — do in the same PR)

- **§5 "Trend / burndown / projected by end of sprint" row** → **[BUILT]** with date (data step 7 +
  UI this feature).
- **§12 velocity bullet** → the swap landed: snapshot-based actuals on `/` and `/rollup` when ≥ 2
  snapshots exist, **naive model deliberately retained** as the fallback and on share/export paths
  (don't over-claim a full replacement).
- **§14.8** → fully fixed (data 2026-07-09, UI this feature); **§3's** VP-trend clause → resolved.
- **§11** → append the trend-panel note (placement, SVG, empty state).
- **Master plan step 10** → the "then" clause's first item done; **Gemini remains open** — update
  current-feature.md `**Next:**` to Gemini.
- **Don't over-claim:** dark-mode toggle + loading skeletons stay post-v1; frozen shares
  intentionally show no trend; cron **scheduling on Tekion infra is still a deploy-time task** —
  the empty state exists precisely because it may not be running yet.

## References

- @context/project-overview.md — §2.2/§3 (leadership trend need), §5 (trend row), §9
  (`SprintSnapshot` model + "org totals = sum over teams" rationale), §12 (velocity caveat — "the
  swap is step 10"), §14.8, master plan step 10.
- @context/features/background-sync-snapshots.md — the writer of the rows this reads; UTC-midnight
  `capturedOn`; `snapshotValues` field contract.
- @context/features/ed-rollup.md — `getRollupData` batching, `aggregateRollup` sum conventions,
  per-team-never-merged (§9).
- @context/features/share-view-export.md — the additive-`asOf`-prop precedent decision 5 follows;
  the frozen-share pin this feature must not disturb.
- `src/lib/metrics.mjs` — `getWeeklyVelocity` (the naive model being superseded), `formatDate`,
  `aggregateRollup` (weighting conventions).
- `src/lib/dashboard-data.js` — `getDashboardData`/`getRollupData` (extension points),
  `getShareData` (must stay untouched).
- `src/components/dashboard/metric-grid.jsx` — the velocity card consuming
  `velocity/weeksElapsed/totalWeeks/weeksNeeded/onTrack`.
- `src/components/ui/hero-shell.jsx` — the server-safe shared-component precedent.
- `src/app/rollup/page.jsx`, `src/app/page.jsx` — wiring points; request-time `asOf` precedent.
- `prisma/schema.prisma` — `SprintSnapshot` (`@@unique([sprintId, teamId, capturedOn])`).
- `.claude/skills/dataviz` — read before writing the chart markup (house trigger).
