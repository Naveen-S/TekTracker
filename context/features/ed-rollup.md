# ED / multi-team roll-up (migration step 6b)

## Overview

**Production Migration Plan step 6, second half.** 6a (ui-port.md, Done 2026-07-08) delivered the
EM/Lead daily loop — login + single-team Delivery Matrix + minimal admin. This feature delivers the
other half of step 6 and the product's №1 gap (§14.1, §2.2): the **cross-team roll-up** for
ED/TPM (N teams) and EM/SEM (2–3 teams) personas — "is the sprint on track" across every team I
manage, without opening N boards. Per §9, a roll-up is **membership-derived**: the set of teams the
caller belongs to, for one selected (global) sprint; per §3 it is a read-only aggregation view, not
a separate data source.

> **Key architectural point:** there is still no new write path and no new API route. The roll-up
> is a server component reading Prisma directly (6a decision 1 holds) and reusing the
> fixture-proven per-team `computeSprintMetrics` — plus one new **pure aggregation function** that
> the step-7 `SprintSnapshot` job will later mirror (per-team rows, org totals = sum over teams).

VP-grade **trend/burndown is explicitly out** — it needs `SprintSnapshot` history (step 7).

## Status

**Done 2026-07-08** — all 8 decisions implemented as proposed. Pure `aggregateRollup` + shared
`bandSprintHealth` in `web/src/lib/metrics.mjs` (plus three **additive** `computeSprintMetrics`
return fields: `totalIssues`, `healthCounts`, `featureHealthCounts` — the §9
`SprintSnapshot.healthCounts` shape); `getRollupData` in `web/src/lib/dashboard-data.js` (shared
`getMembershipContext`/`getSprintSelection`/`serializeUser` internals extracted, **two batched
queries, no N+1**); `web/src/app/rollup/page.jsx` (server component, async `searchParams`, 307
auth gate) + `components/rollup/{rollup-top-bar,team-summary-table}.jsx` (one client leaf; table
server-rendered, worst-health-first, request-time staleness); TopBar "Roll-up" link
(`teams.length >= 2 || isAdmin`); `MetricGrid` reused for the combined header via `totalIssues`.
Verified: **34/34 plain-Node fixtures** (sums, issue-weighted avg, per-team progress-key
independence, blocked-anywhere → Critical, No-Data ignored / all-No-Data, additive velocity +
projection); lint clean; migrations up to date; **DB/env-free build green — 23 routes/pages
`ƒ Dynamic` incl. the new `/rollup`**; **32/32 SSR smoke** on dev+Neon (minted `sealData` cookies,
fabricated 3 teams / 3 users / issues+progress): unauth 307→/login, 2-of-3-teams user sees
exactly 2 rows + summed combined (issues 2, 8 pts, 75%, Fair — No-Data team ignored, no Critical
leak from the 3rd team's blocked issue), admin sees all 3 (issues 3, Critical, danger-first row
order), zeroed "no filters yet"/"never" row, `2h ago` staleness, `Open board →` carries
`?team=&sprint=`, Roll-up link shown for 2-team user + admin and hidden for 1-team user. Fixture
torn down (0 leftovers; `/api/health/db` → `users:1`), harnesses deleted. No schema change, no
migration, no new dependency.

## Decisions (PROPOSED 2026-07-08)

1. **Dedicated `/rollup` page, flat searchParams (`?sprint=`)** — not a `?team=all` mode on `/`.
   The team dashboard's chrome (Add filter, Sync, stage writes) is team-scoped and makes no sense
   across teams; a separate server page keeps both simple. TopBar on `/` gets a **"Roll-up" link
   shown when the user has ≥2 teams or is admin**. *Alternatives:* `?team=all` on `/` (rejected —
   conditional chrome everywhere); a nested `/teams/[id]` route tree (rejected — 6a decision 2
   deliberately stayed flat; revisit at cutover if ever).
2. **Access is membership-derived, any role** — the roll-up shows the union of teams where the
   caller has *any* membership (§3 gives EM/SEM combined views, so this is not restricted to
   ED/TPM roles; VIEWERs get it read-only, which the page is anyway). Global admin sees all teams.
   Auth gate identical to `/` (no session → redirect `/login`). No 404 for 1-team users — the link
   is hidden but the URL renders a 1-team roll-up harmlessly.
3. **Read model: extend `lib/dashboard-data.js` with `getRollupData(user, { sprintId })`** (its
   header already anticipates this). No new API routes — the page has zero writes. Reuses the same
   sprint-defaulting rule (ACTIVE else latest) and returns
   `{ user, teams(+myRole), sprints, selectedSprint, perTeam: [{ team, myRole, filters, metrics, lastSyncedAt }], combined }`.
   **No N+1:** one `filter.findMany({ teamId: { in }, sprintId, include: issues })` + one
   `issueProgress.findMany({ teamId: { in }, sprintId })`, grouped in JS per team.
4. **Aggregation: new pure `aggregateRollup(perTeamMetrics)` in `metrics.mjs`** — per-team
   `computeSprintMetrics` runs unchanged (progress rows are keyed **per team**, §9 — the same
   jiraKey can hold different progress in two teams, so a merged `progressByKey` would collide;
   computing per team and aggregating also matches the per-team `SprintSnapshot` shape). The
   aggregate: **sums** for issue counts, points, completedPoints, velocity fields, health-band and
   risk counts; **issue-weighted `avgProgress`**; **portfolio health = the §12 sprint-health rules
   re-applied to the summed feature health counts** (so one blocked feature issue anywhere still
   yields Critical; teams with no feature issues contribute nothing; all-empty → No Data).
   *Alternatives:* recompute over the union of filters (rejected — progress-key collision above);
   worst-of per-team health (rejected — a formula-consistent portfolio band plus visible per-team
   chips beats overweighting the smallest team; the per-team chips make sure nothing hides).
5. **Velocity roll-up = sum of per-team weekly velocities** (points/week is additive over teams);
   `weeksNeeded` recomputed from summed remaining points / summed velocity. Same naive-linear
   caveat as §12 — replaced by snapshot actuals in step 7.
6. **No Sync action on the roll-up.** Syncing N teams from one click is a Jira rate-limit storm
   (§14.9) and freshness is step 7's job (cron). Instead each team row shows staleness from the
   **max `Filter.lastSyncedAt`** ("synced 2h ago" / "never"). *Alternative:* per-team sync buttons
   for writers — parked to step 7 (the cron makes them redundant).
7. **Server-first UI** (coding-standards: server components by default): the page body — combined
   metric cards (reuse `MetricGrid`) + a per-team summary table (team key/name, my role, issues,
   pts done/total, avg %, health chip, band counts, blocked count, staleness, "Open board →" link
   to `/?team=<id>&sprint=<id>`) — renders on the server. The only client leaf is a thin top bar
   (sprint selector pushing `?sprint=`, logout, link back to `/`). No density/collapse prefs, no
   new localStorage keys.
8. **Empty states:** no memberships → same "ask an admin" panel as `/`; no sprints → "no sprint
   configured" (read-only — sprint creation stays on `/` + `/admin`); a member team with no
   filters for the sprint renders as a zeroed row ("no filters yet"), not hidden — EDs should see
   which teams haven't set up their board.

## Requirements

### Scope

- **(a) Aggregation — `web/src/lib/metrics.mjs`**: add pure `aggregateRollup(perTeamMetrics)`
  implementing decisions 4–5 (input: array of `computeSprintMetrics` results; output mirrors its
  aggregate fields + `sprintHealth`). Plain-Node testable like the rest of the module; extract the
  §12 sprint-health banding into a shared internal helper so `/` and `/rollup` can never drift.
- **(b) Data assembly — `web/src/lib/dashboard-data.js`**: `getRollupData(user, { sprintId })` per
  decision 3, sharing the existing membership/teams/sprints query helpers with
  `getDashboardData` (extract small internals rather than duplicating).
- **(c) Page — `web/src/app/rollup/page.jsx`**: server component; `getCurrentUser()` gate →
  redirect `/login`; `const { sprint } = await searchParams` (**async in Next 16** — same
  discipline as 6a, re-read the installed docs first); renders the roll-up shell.
- **(d) Components — `web/src/components/rollup/`**: `rollup-top-bar.jsx` (client: sprint Select →
  `router.push('/rollup?sprint=…')`, "My board" link, logout) + server-rendered team-summary table
  + combined metric header (reuse `MetricGrid`, `Badge`; no new UI-kit pieces expected).
- **(e) Entry point — `web/src/components/dashboard/top-bar.jsx`**: "Roll-up" link (next to Admin)
  when `teams.length >= 2 || user.isAdmin`.

### Mechanism / gotchas

- **Next 16 async `searchParams`** (and `cookies()` inside `getCurrentUser`) — await them; verified
  pattern exists in `web/src/app/page.jsx`.
- `computeSprintMetrics` needs `(filters-with-issues, progressByKey, sprint)` per team — group the
  two batched queries by `teamId`; do **not** merge progress maps across teams (decision 4).
- Portfolio banding reuses §12 thresholds — implement once (shared helper), keep `metrics.mjs`
  dependency-free (`.mjs`, no `@/` imports) so plain-Node checks keep working.
- Sorting: team rows by worst health first (danger > warn > info > success > neutral), then name —
  the ED reads problems top-down; note it in the UI so the order is predictable.
- `lastSyncedAt` staleness renders on the server — use a deterministic "as of" from the request
  time, not client `Date.now()`, to avoid hydration drift (row is server-only, so this is free).

### Acceptance criteria

- `yarn lint` + `yarn build` green in `web/`; build stays **DB/env-free** (`.env` moved aside);
  `/rollup` and all API routes `ƒ Dynamic`.
- **Pure-function checks** (plain Node, scratchpad harness): `aggregateRollup` against
  hand-computed fixtures — sums and issue-weighted avg for 2 known teams; blocked-anywhere →
  Critical; mixed No-Data teams ignored; all-No-Data → No Data; velocity summing + projection.
- **SSR smoke** on dev+Neon (minted `sealData` cookies, fabricated users/teams/issues — cleaned up
  after): unauthenticated `/rollup` → 307 `/login`; a fabricated user in exactly 2 of 3 teams sees
  **2 team rows and not the 3rd**, combined counts = the sum of the two; admin sees all teams;
  "Open board →" links carry `?team=&sprint=`; a no-filters team renders a zeroed row; the
  TopBar Roll-up link appears for the 2-team user and admin, absent for a 1-team user.
- No schema change, no migration, no new dependency.

### Out of scope

- **Trend / burndown / "projected by end of sprint"** — needs `SprintSnapshot` (step 7); §5's
  trend row stays **[GAP]**.
- **Sync from the roll-up** (and any freshness automation) — step 7 (cron).
- **Share/export of the roll-up** — step 8 (SharedView + export port).
- **Org/portfolio grouping beyond memberships** — single implicit org stands (§16); no Org table.
- Per-team sprint-cadence overrides (§9 Sprint note) — unchanged.

## Doc-sync (§17 — do in the same PR)

- **§5 "Multi-team / ED roll-up" row** → the roll-up *views* are **[BUILT in `web/` — date]**;
  keep the note that team/membership APIs came in step 4. Do **not** touch the separate
  "Trend / burndown" row — it stays **[GAP]**.
- **§3 personas note** — update the `[GAP]` blockquote ("no team, role, or multi-team concept"):
  multi-team roll-up now built in `web/`; the sentence stays true only of the legacy app.
- **§14.1** — mark fixed-in-`web/` with date (multi-team/ED roll-up), pointing here.
- **§11** — append a dated BUILT note describing the `/rollup` layout (combined cards + per-team
  table, entry link rule).
- **Master plan step 6** → **[DONE date]** (6a 2026-07-08 + 6b) with a one-line as-built summary;
  update current-feature.md `**Next:**` pointers (step 7 or step 9).
- **Don't over-claim:** §7 stays the legacy snapshot; VP *trend* remains unbuilt; the legacy Vite
  app is unchanged until cutover.

## As-built notes (vs. the spec)

- **`computeSprintMetrics` return grew three additive fields** (no consumer broke): `totalIssues`,
  `healthCounts` (all-issue) and `featureHealthCounts` — both in the §9
  `SprintSnapshot.healthCounts` key shape (`{ blocked, behind, atRisk, onTrack, ahead, done }`),
  which is exactly what step 7's snapshot job will persist. `aggregateRollup` needs the full
  feature counts to re-band; the spec only implied this.
- **`MetricGrid` reuse required one edit**: "Issues in scope" now reads `metrics.totalIssues`
  instead of `metrics.issues.length`, so the combined object (which carries no `issues` array —
  keeping the RSC payload small) renders through the identical component as `/`.
- **Velocity (decision 5) is computed from the summed inputs, not by summing rounded per-team
  outputs**: `aggregateRollup` sums `velocityPoints`/`velocityCompletedPoints` and the reused
  `MetricGrid` feeds those sums to `getWeeklyVelocity`. With the org-wide sprint cadence this
  *equals* the sum of per-team weekly velocities (fixture-checked) while avoiding double
  `toFixed(1)` rounding; `weeksNeeded` = summed remaining / summed velocity as specified.
- **`bandSprintHealth` is module-internal** (not exported) per the spec's "shared internal
  helper"; it's exercised through both callers by the fixtures.
- **`initials()` extracted** from `top-bar.jsx` into `lib/utils.js` (top-bar was being touched for
  the Roll-up link anyway) and shared with `rollup-top-bar.jsx` — one tiny file beyond the spec's
  list.
- **Bands column split**: the table renders a 5-band cell (done/ahead/onTrack/atRisk/behind) plus
  a dedicated Blocked column — the statuses are disjoint (Blocked overrides the delta bands in
  `getHealthStatus`), so nothing is double-counted and the ED's fastest scan (blocked) gets its
  own column.
- **`formatAgo` lives in `team-summary-table.jsx`** (presentational), keeping `metrics.mjs`
  dependency-free and metric-only; the `asOf` timestamp is created once in the server page and
  passed down (mechanism note honored — no client clock anywhere).
- Admin rows for teams they hold no membership in show a muted `admin` role placeholder (the spec
  didn't say what to render there).
- The rollup top bar has **no Admin link** — decision 7's enumeration (sprint select, "My board",
  logout) was kept literal; admins reach `/admin` from `/`.
- Smoke-fixture nuance: the fabricated sprint was created in `PLANNING` state (never `ACTIVE`) so
  the default-sprint rule could never hijack the real dashboard mid-test; every check passed
  `?sprint=` explicitly.

## References

- @context/features/ui-port.md — the 6a/6b split decision + as-built UI patterns to reuse.
- @context/project-overview.md §2.2, §3 (personas), §9 (`Filter`/`IssueProgress` keying, roll-up =
  membership-derived), §12 (formulas), §14.1/§14.9.
- `web/src/lib/dashboard-data.js` (extension point, header note), `web/src/lib/metrics.mjs`
  (per-team compute + return shape), `web/src/lib/rbac.js` (role groups),
  `web/src/app/page.jsx` (async searchParams + auth-gate pattern),
  `web/src/components/dashboard/{top-bar,metric-grid,hero}.jsx` (reuse candidates).
