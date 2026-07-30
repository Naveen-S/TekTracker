# Committed / Tech Debt / Unplanned Work Breakdown + Per-Sprint Team Capacity

## Overview

Two handwritten notebook pages
(`context/SprintTracker - Project Spec/CommittedAndUnplanned-{1,2}.jpg`) describe how GM-team work
actually divides each sprint:

> Basically we have two types of work that we do in a sprint:
> 1. Planned/Committed work — this is committed work that is planned with the GM team. The
>    expectation is we strictly adhere to this scope. This is non-negotiable. Since this is
>    committed to the customer...
> 2. Tech Debts (planned but not committed) + Unplanned Internal & External issues — some tech
>    debts which we plan ahead of time and even though it's not committed to customer, it's
>    internally committed to deliver. Plus we have internal & external reported issues.

Page 2 lists a "planned/dedicated track capacity" — a per-team point number (e.g. "Configurator +
Website Setup: 24", "PCX (VSR/DPP + My Account): 84") against real, already-synced `Team` rows —
with the ask: *"Let's have an option to configure this against each of the team. And let's
represent this in each of the scrum team and also in the roll up screen."*

Today the app only ever shows one "total story points" number per screen (plus the existing
`delivery` vs `all-work` two-lens split in `src/lib/metrics.mjs`, which is a *scoring* split, §12 —
not a *composition* breakdown). This feature adds:

1. A **three-way story-point breakdown** (Committed / Tech Debt / Unplanned Bugs), badged visually
   as "two types" (Committed alone vs. {Tech Debt, Unplanned Bugs} grouped) per the handwritten
   framing — everywhere a total-points number shows today.
2. A new admin-configurable, **per-team-per-sprint "committed capacity"** target, compared only
   against the Committed bucket.

> **Key architectural note, ratified with Naveen**: this is a **new, purely additive display lens**
> layered over the same already-computed `issues` array — it does **not** touch Sprint Health,
> Completion %, At-Risk, or the existing `delivery*`/`velocity*` fields (§12,
> `sprint-phases-delivery-lens.md`). Those keep scoring roadmap+tech-debt vs. all-work exactly as
> today; this feature only adds a new way of *slicing* the same totals for display.

Requested by Naveen 2026-07-28; drafted through several rounds of clarifying questions (see
Decisions below) after an exploration pass confirmed: no existing per-`workflowType` breakdown
exists anywhere in the codebase today (only the binary `DELIVERY_TYPES` set in `metrics.mjs:28`),
and `Team.developerCount` (leaderboard.md) is the closest precedent for an admin-entered per-team
number — but that one is a **static** per-team constant, whereas capacity here must vary **per
sprint**, so it needs a new join table, not a `Team` column.

## Status

**Done 2026-07-29.** Implemented as specced: new `SprintCapacity` model (migration
`20260728180901_add_sprint_capacity`, one additive model + two relation lines, no other schema
change); `COMMITTED_TYPES`/`TECH_DEBT_ONLY_TYPES`/`UNPLANNED_TYPES` sets + `segmentTotals` helper in
`metrics.mjs`, feeding 9 new purely-additive fields on both `computeSprintMetrics` and
`aggregateRollup`; `src/lib/schemas/sprint-capacity.js`; two new admin-only routes (`PUT
/api/sprints/[sprintId]/capacity`, `POST …/capacity/duplicate`); capacity reads threaded through
`getDashboardData` (sibling `capacity` prop), `getRollupData` (batched `combinedCapacity` w/ the "N
of M teams configured" caveat), and `buildShareSnapshot`/`getShareData` (frozen shares pin capacity
too, per the asOf invariant) + the shares-route call site; new admin `SprintCapacityConfig`
component (sprint picker + per-team matrix + save + "duplicate from another sprint" with an
overwrite-confirm dialog) wired into `admin-panel.jsx`; `StoryPointsHighlight` grew optional
`breakdown`/`capacity` props (originally a chip row: Committed alone, Tech Debt + Unplanned Bugs
grouped under one bordered pill — **superseded the same day by the scoreboard redesign recorded
below; the chip row no longer exists**) wired at all three existing call sites (`/`, `/rollup`,
`/share/[token]`);
`team-summary-table.jsx` gained one new "Committed / Cap" column; `export-dialog.jsx`'s
`SummaryPage` gained a new "Committed / Tech Debt / Unplanned" row of `ReportMetricBox`es, entirely
additive to the existing Sprint Health/Completion/Projected cards. `/leaderboard` untouched, as
specced.

**Verified:** `yarn lint` clean; `prisma validate` + `migrate status` up to date (**7
migrations**); **DB/env-free cold build green — 44 ƒ Dynamic (42 → 44)**, `.env` genuinely moved
aside via `mv` and restored, exactly the 2 new capacity routes added; **23/23 pure-Node fixture
checks** for the new `metrics.mjs` segments (hand-computed Committed/Tech Debt/Unplanned sums
across all 5 `WorkflowType`s incl. the `CUSTOM` edge case, `aggregateRollup` doubling for 2
identical teams) **plus a before/after regression check** proving every pre-existing field
(`deliveryPoints`, `deliveryCompletedPoints`, `velocityPoints`, `totalIssues`,
`totalDeliveryIssues`, and their `aggregateRollup` equivalents) is byte-identical to before this
feature — decision 2 held; **32/32 live API-route + SSR smoke checks** against a fully isolated
fabricated fixture (2 teams, 2 sprints, 1 non-admin `MEMBER` user, 1 `Filter`) with real HTTP
requests and minted iron-session cookies: non-admin 403 on both new routes, 404 on an unknown
sprint, 400 on an unknown `teamId` / a negative number, a `null` row genuinely clearing (verified
via a follow-up DB read, not just the response), the duplicate route's same-sprint/unknown-source
400/404 guards, a happy-path duplicate + a re-duplicate proving it overwrites, and SSR rendering
on `/` (the Committed/Tech Debt/Unplanned Bugs chips + the capacity figure), `/rollup` (the new
table column + both fabricated teams' rows), and `/admin` (the new "Committed Capacity" section);
fixture torn down to **0 leftovers** (confirmed by a post-teardown count query, not just "no
errors"). One pre-existing stale `next-server` process (holding a pre-migration build from the
prior day, per this project's own documented "build clobbers `.next`" hazard) was found holding
port 3002 and was restarted mid-verification — unrelated to this feature's code.

### Second pass, same day — `StoryPointsHighlight` redesigned as the delivery scoreboard

**Done 2026-07-29.** Per Naveen ("extremely important section… every detail in it is represented
well"), the card above was **replaced, not tweaked** — the chip row is gone. Presentation only: no
schema/migration/route/dependency change, and all three call sites keep their existing props. Seven
choices were ratified before any code: full scoreboard footprint · **ink surface** (the hero's
material, not the pale accent tint) · totals lead · one authored arrival · **Committed branded, the
other two neutral** · over-capacity flagged · hover reveals precision.

As built: a headline `256 / 319`-style pair over a **composition rail** whose segment WIDTH is each
type's share of planned scope and whose solid FILL is what's delivered — so the rail's lit area *is*
the headline %. **Two variants**: `condensed` (the default — `/` and `/share/[token]`) puts the
headline beside the rail with a one-line legend, landing at **148px, down from 428px**; `relaxed`
stacks them and gives each type a full-scale track. `/rollup` defaults to `relaxed` and is the ONLY
screen with a **Condensed/Relaxed toggle** — new client leaf `rollup/rollup-story-points.jsx` over
`useLocalPref` (a per-card control, **not** a revival of the app-wide density toggle retired
2026-07-25). Palette: two new theme-neutral tokens `--on-ink-cat-2` **gold `#e3a72f`** and
`--on-ink-cat-3` **rose `#f2a8b6`** (the first cut's two greys read as background at 6.7:1/4.2:1 on
ink); **Unplanned Bugs stays hatched** (`.sp-stripe`) because brand↔cat-3 is worst-case ΔE 4.8 under
deuteranopia, so texture is that pair's second channel; the over-capacity marker moved from amber to
`--on-ink-alert` **red `#ff5f56`** (amber sat ΔE 6.4 from the new gold and would have read as a
fourth category). The capacity tick is drawn **only when committed scope has overrun the target** —
under target the legend states the headroom in words instead. Hover-dimming is pure CSS `:has()`, so
the card stays a server component, and nothing is hover-only. Motion is one ~0.8s
`sp-draw`/`sp-fill`/`sp-mark` sequence, all `backwards`-filled so it hands the property back and
never outranks the hover rule. `useCountTransition` gained an opt-in `countOnMount` **and a real bug
fix**: its `getSnapshot` sampled the clock on every call (which React flags as "the result of
getSnapshot should be cached to avoid an infinite loop") — the eased value is now computed once per
rAF frame and cached, fixing every caller (both leaderboards and `MyStatsCard`), not just this card.

### Completion verification (2026-07-30)

Re-ran the full suite as the finish gate, against **Naveen's real synced data**: `yarn lint` clean;
`prisma validate` + `migrate status` up to date (**7 migrations**, no schema change in this pass);
**cold `rm -rf .next` DB/env-free build green — 44 ƒ Dynamic, unchanged**, `.env` genuinely moved
aside via `mv` and restored (verified absent mid-build); **22/22 pure-Node fixtures** re-derived for
the three segments (hand-computed sums across all 5 `WorkflowType`s incl. the `CUSTOM` issue landing
in none of them, `aggregateRollup` doubling, empty-board NaN safety); **26/26 SSR/API smoke** on
`/`, `/rollup`, `/admin` + the unauth gate + both capacity routes' 401/404s; **19/19 dedicated
share-path checks** creating one live **and one frozen** share through the real API route — the
frozen `snapshot` JSON is confirmed to physically **pin capacity** (`keys: sprint, filters,
capacity, progress, capturedAt`), both render the condensed variant, and teardown left **0**
leftovers. `metrics.mjs`'s diff is **purely additive — zero removed lines**, which is decision 2
(display-only) proven structurally rather than only by fixture diff. The `getSnapshot` bug fix is
confirmed live: **zero** `getSnapshot`/infinite-loop/`Maximum update depth` warnings in the dev
server's captured browser console across real page loads.

**Human-acceptance item now closed:** Naveen has entered his **six real capacity numbers** via the
new admin screen — `AAI=24, CALM=24, D360=36, DX=48, INT=24, PCX=84` — and they render correctly:
the AAI board shows `· 24 cap (on target)` (the equality case) and `/rollup`'s portfolio figure
reads **240 capacity**, exactly the sum of the six.

**Visual pass — partially done, honestly bounded.** The Claude-in-Chrome extension is still not
connected (as in every prior session of this arc), so the authed real-browser round remains
Naveen's. What *was* captured: the session-less `/share` page driven through **system Chrome
headless** at 1512 / 900 / 420 px against a temporary live share (deleted after). The scoreboard
renders as specced — ink surface, `79 / 100` headline, rail segments at 24% / 30% / 46% of scope
summing to 100%, gold Tech Debt, hatched rose Unplanned Bugs, `24 cap (on target)` in words with
**no** capacity tick (correct: at/under target), `79% of planned scope` badge, and a graceful
3-line legend reflow at 420px. **Still open:** the **Modern**-theme visual round and the authed
`/` + `/rollup` + `/admin` screens (theme is a `localStorage`-backed class, so a cookie-less
headless capture cannot toggle it).

**Observation, not a regression:** below ~900px every card on a board page overflows the viewport
horizontally. The cause is the Delivery Matrix's pre-existing `min-w-225` (= 900px) rows in
`planner-panel.jsx` — a file **not touched by this diff at all** — whose min-content width
propagates up past the scroll container. The scoreboard itself is `overflow-hidden` + `min-w-0`
throughout and stacks correctly. Worth a separate mobile-layout fix; out of scope here.

## Decisions (RATIFIED 2026-07-28, via clarifying-question rounds)

1. **Three-way segmentation, badged as "two types" at the headline level.** Committed = `FEATURE`
   workflow only (the roadmap track committed to the customer). Tech Debt = `TECH_DEBT` workflow,
   its own visible segment (planned ahead of time, internally committed, but not customer-committed
   — per the notes). Unplanned Bugs = `SUPPORT` + `INTERNAL_BUG` combined into one segment (genuinely
   reactive work). Visually: Committed stands alone; Tech Debt + Unplanned Bugs are grouped under one
   lighter bracket/pill — delivering "two types" structurally without losing the tech-debt-vs-bugs
   distinction the notes draw.
2. **Display-only, additive.** Sprint Health, Completion %, At-Risk, and the existing `delivery*`
   fields are untouched. The three new segments are a parallel set of fields on
   `computeSprintMetrics`/`aggregateRollup`, never wired into `bandSprintHealth` or any existing
   scoring path. A before/after fixture diff proves every pre-existing field stays byte-identical.
3. **Capacity compares against Committed (`FEATURE`) points only.** Tech Debt and Unplanned Bugs
   never have a configured target — the notebook's capacity table is explicitly about the
   customer-committed track's non-negotiable scope, not total planned work.
4. **Screens**: Dashboard (`/`), Roll-up (`/rollup`), Share view (`/share/[token]`), Export PDF/PNG.
   **`/leaderboard` is explicitly out of scope** — stays a single all-work points ranking, unchanged
   (it answers a different question — "who delivered the most" — not "what kind of work was it").
5. **Capacity cadence: per team, PER SPRINT** — not a static per-team constant like
   `Team.developerCount`. A team's committed capacity can shift release to release, so this needs a
   new `(team, sprint)`-scoped table, following the `SprintSnapshot` shape (minus its daily axis)
   rather than a new `Team` column.
6. **Admin UI: one matrix screen.** Pick a sprint (default: `ACTIVE`), see/edit every team's
   capacity in one table, one batched save — mirrors the existing bug-report SLA-days matrix
   pattern (`bug-report-config.jsx`). Plus a **"duplicate to another sprint"** action (explicitly
   requested — "with an option to easily duplicate this to next sprint as well") so admins don't
   retype every release.
7. **RBAC: global admin only.** Matches Sprint config's existing global-admin-only gate (§13, no
   carve-out) — zero new role groups, same reasoning as `one-click-sprint-start.md` decision 4
   (Sprint-scoped config stays admin-only, full stop).
8. **Roll-up portfolio total**: sum whatever capacity numbers ARE configured, with a caveat like
   "4 of 6 teams configured" — never hide the total just because configuration is partial (a
   provisioning-in-progress workspace shouldn't lose the feature entirely).
9. **`team-summary-table.jsx`**: one new column, "Committed / Capacity" (e.g. `18/24`, `—` when
   unconfigured). The fuller 3-way breakdown stays portfolio-level only (the `StoryPointsHighlight`
   card above the table) — deliberately not widening an already-wide, 10-column table with three
   more columns per team.
10. **Duplicate-to-sprint UX**: overwriting a target sprint that already has any configured rows
    requires a confirm dialog (reusing the existing destructive-confirm `Dialog` pattern already in
    `admin-panel.jsx`); copying into an empty/unconfigured sprint proceeds with no prompt.

**Flagged during planning, not a blocker** — worth a quick real-data sanity check during build, not
a decision that needs Naveen's input up front:

- `WorkflowType.CUSTOM` issues (if any exist in real data) fall into none of the three new segments,
  same as they already fall outside `DELIVERY_TYPES` today. Verify with a live query that no team
  actually uses `CUSTOM`, so `committedPoints + techDebtPoints + unplannedPoints` always reconciles
  to `points`. If some do exist, that's a pre-existing gap this feature inherits, not introduces.

## Requirements

### Data model

New model, following `SprintSnapshot`'s exact `(team, sprint)` relation/cascade/index shape
(`prisma/schema.prisma:346-361`) minus its daily `capturedOn` axis — one row per `(team, sprint)`,
not one per day:

```prisma
/// Admin-configured "planned/dedicated track capacity" (Naveen's notebook page 2) — the Committed
/// (FEATURE) point target for one team in one sprint. Cadence is PER SPRINT (decision 5): unlike
/// Team.developerCount, committed capacity can change release to release, so it is NOT a static
/// per-team constant — it lives on this join row. No row for a (team, sprint) ⇒ capacity is
/// UNCONFIGURED, not zero (decision 3: only Committed work is ever compared against a target).
model SprintCapacity {
  id              String   @id @default(cuid())
  sprintId        String
  sprint          Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  teamId          String
  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  committedPoints Float
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([sprintId, teamId])
  @@index([sprintId])
}
```

Add `capacities SprintCapacity[]` to both `Team`'s relation list (`schema.prisma:103-109`, next to
`snapshots`) and `Sprint`'s (`schema.prisma:194-197`). One migration:
`yarn prisma migrate dev --name add_sprint_capacity` (never `db push`). No seed change — Naveen
types his six real numbers into the new admin screen post-deploy against already-synced real `Team`
rows. Doc-sync §9 byte-consistently (model block + the two `capacities` relation lines) in the same
PR.

Prisma's compound-unique accessor is `sprintId_teamId` (declared field order).

### Pure metrics — `src/lib/metrics.mjs`

Beside `DELIVERY_TYPES` (`metrics.mjs:28`):

```js
const COMMITTED_TYPES = new Set(["FEATURE"]);
const TECH_DEBT_ONLY_TYPES = new Set(["TECH_DEBT"]);
const UNPLANNED_TYPES = new Set(["SUPPORT", "INTERNAL_BUG"]);
```

Small helper reusing the existing `weightedCompleted` (`metrics.mjs:32-33`):

```js
function segmentTotals(list) {
  return {
    points: list.reduce((sum, issue) => sum + issue.storyPoints, 0),
    completedPoints: weightedCompleted(list),
    issueCount: list.length,
  };
}
```

In `computeSprintMetrics` (`metrics.mjs:114-188`), right after the existing `deliveryIssues` filter
(line 158), filter the SAME already-materialized `issues` array three more ways — no new Prisma
reads, no new per-issue fields:

```js
const committed = segmentTotals(issues.filter((i) => COMMITTED_TYPES.has(i.workflowType)));
const techDebtWork = segmentTotals(issues.filter((i) => TECH_DEBT_ONLY_TYPES.has(i.workflowType)));
const unplanned = segmentTotals(issues.filter((i) => UNPLANNED_TYPES.has(i.workflowType)));
```

Append to the return object (never modifying an existing field): `committedPoints`,
`committedCompletedPoints`, `committedIssueCount`, `techDebtPoints`, `techDebtCompletedPoints`,
`techDebtIssueCount`, `unplannedPoints`, `unplannedCompletedPoints`, `unplannedIssueCount`.

`aggregateRollup` (`metrics.mjs:223-262`): sum the same nine fields via the existing `sumOf` reducer
— identical treatment to `deliveryPoints`/`velocityPoints` today.

### Data access — `src/lib/dashboard-data.js`

- **`getDashboardData`** (`:105-182`): inside the existing `if (selectedTeam && selectedSprint)`
  block, add `prisma.sprintCapacity.findUnique({ where: { sprintId_teamId: {...} }, select:
  { committedPoints: true } })`. Return `capacity: { committedPoints } | null` as a **sibling** of
  `metrics` (same treatment as `snapshots`/`sprintStartConfig` — never folded into
  `computeSprintMetrics`'s return, since it's an admin-configured value, not derived from issues).
  `src/app/page.jsx` spreads `data` into `<Dashboard {...data} .../>`, so `capacity` reaches
  `Dashboard` for free once added to its prop destructure.
- **`getRollupData`** (`:251-331`): one more batched (no-N+1) query alongside the existing
  `{ teamId: { in: teamIds } }` reads: `prisma.sprintCapacity.findMany({ where: { teamId: { in:
  teamIds }, sprintId: selectedSprint.id } })`. Attach per team inside `perTeam = teams.map(...)`.
  Portfolio total (sibling of `combined`, not part of `aggregateRollup` — capacity isn't a `metrics`
  field):
  ```js
  const combinedCapacity = capacityRows.length > 0
    ? {
        committedPoints: capacityRows.reduce((sum, r) => sum + r.committedPoints, 0),
        configuredTeamCount: capacityRows.length,
        totalTeamCount: teams.length,
      }
    : null;
  ```
  (Decision 8: never hidden for partial configuration — `configuredTeamCount`/`totalTeamCount` drive
  the "N of M teams configured" caveat.) `rollup/page.jsx` destructures `data` explicitly (line 45)
  — add `combinedCapacity` there.
- **`buildShareSnapshot`/`getShareData`** (`:343-427`): a frozen share must pin capacity too (the
  asOf-pinning invariant, §12) — otherwise a frozen share would show a live, possibly-since-edited
  capacity while everything else stays frozen. Add a 4th param: `buildShareSnapshot(filters,
  progressRows, sprint, capacity)`, include `capacity` in the frozen JSON; `getShareData`'s frozen
  branch (`:377-396`) returns `snapshot.capacity ?? null`, its live branch (`:398-426`) fetches it
  the same way the dashboard does. **Call-site update**:
  `src/app/api/teams/[teamId]/sprints/[sprintId]/shares/route.js:56` (the only caller) fetches
  `prisma.sprintCapacity.findUnique(...)` before calling it and passes the 4th arg.
- **`src/app/admin/page.jsx`**: add `prisma.sprintCapacity.findMany({ orderBy: { sprintId: "asc" }
  })` as a new parallel entry in the existing `Promise.all` (`:26-52`); pass as `capacityRows` into
  `<AdminPanel .../>` (`:64-73`).

### New API routes

`src/lib/schemas/sprint-capacity.js` (zod):

```js
import { z } from "zod";

// null clears a team's row (decision 3: unconfigured is a real state, not 0). z.null() must be
// checked before z.coerce.number() so a literal null isn't coerced to 0.
const committedPointsField = z.union([z.null(), z.coerce.number().min(0).max(100000)]).nullish();

export const sprintCapacityMatrixSchema = z.object({
  rows: z.array(z.object({ teamId: z.string().min(1), committedPoints: committedPointsField })),
});

export const sprintCapacityDuplicateSchema = z.object({ sourceSprintId: z.string().min(1) });
```

**`PUT /api/sprints/[sprintId]/capacity/route.js`** (admin only): `requireAdmin()` → 404 if
`sprintId` unknown → `parseJsonBody(request, sprintCapacityMatrixSchema)` → validate every
`teamId` exists (400 otherwise) → `prisma.$transaction([...])` of one `upsert` per row (or
`deleteMany` when `committedPoints` is `null`, clearing that team's row) → return the sprint's
updated `SprintCapacity[]`. Errors flow through the existing `handleRouteError`.

**`POST /api/sprints/[sprintId]/capacity/duplicate/route.js`**: `[sprintId]` in the URL is the
**destination**, `sourceSprintId` in the body is where numbers come from (reads as "copy INTO the
sprint I'm viewing FROM another sprint"; the admin UI's "duplicate to next sprint" action is this
same route called while viewing the next sprint). `requireAdmin()` → reject
`sourceSprintId === sprintId` (400) → 404 if either sprint unknown → read source `SprintCapacity`
rows → `$transaction` of upserts into the destination → return updated rows.

Both routes admin-only, no `requireTeamRole` carve-out (decision 7).

### Admin UI

New `src/components/admin/sprint-capacity-config.jsx`,
`SprintCapacityConfig({ teams, sprints, capacityRows, run, busy })` — takes `run`/`busy` as props
from `AdminPanel` (matching `TeamCard`'s pattern, not a self-contained `useTransition` like
`BugReportConfig`), riding the page's existing toast-on-success/pinned-inline-error convention.

- **Sprint picker**: defaults to `sprints.find(s => s.state === "ACTIVE") ?? sprints[0]` (mirrors
  `admin-panel.jsx`'s own `activeSprint`, line 279).
- **Matrix table**: one row per team (reuse the `teams` prop already passed into `AdminPanel`), each
  row = team name + one numeric `Input` for `committedPoints`, pre-filled from `capacityRows`, blank
  when unconfigured — same per-row `Input` idiom as `bug-report-config.jsx`'s SLA-days matrix.
- `key={selectedSprintId}` on the editable table so switching sprints (or a save/duplicate
  completing → `router.refresh()`) remounts it and resets the local input buffer to server truth —
  no manual sync-`useEffect`.
- **Save**: one button → `PUT /api/sprints/${selectedSprintId}/capacity` with all rows at once.
- **Duplicate**: a second sprint `Select` + "Copy" button → `POST .../capacity/duplicate` with
  `{ sourceSprintId }`. Per decision 10: confirm `Dialog` before overwriting a target sprint that
  already has any configured rows; direct call when the target is empty.

Wiring: `admin-panel.jsx` gets `capacityRows = []` added to `AdminPanel`'s prop destructure
(`:233-241`); render `<SprintCapacityConfig .../>` as a new `SectionCard`-wrapped section right
after the `SprintConfigDialog` block (`:527-534`) and before `<BugReportConfig .../>` (`:536-541`).
`src/app/admin/page.jsx` fetches + passes `capacityRows`.

### Dashboard / Rollup / Share / Export UI

Extend `src/components/dashboard/story-points-highlight.jsx` (already has the exact visual slot —
the Delivered/Planned pair) with two new **optional** props, fully backward-compatible when absent:

```js
export function StoryPointsHighlight({ completedPoints, totalPoints, scope, breakdown, capacity }) {
```

`breakdown` shape: `{ committed: {points, completedPoints, issueCount}, techDebt: {...}, unplanned:
{...} }`. When present, render a new row below the existing progress bar: a standalone "Committed"
chip (`X/Y pts`, plus `· Z capacity` appended only when `capacity` is non-null), and a "Tech Debt" +
"Unplanned Bugs" pair visually grouped under one lighter pill/bracket (decision 1's "badged as two
types," delivered structurally). Exact labels: **"Committed"**, **"Tech Debt"**,
**"Unplanned Bugs"**.

Wire the same component/props at all three call sites (one component, different data source):
- `dashboard.jsx` (~line 310): `breakdown` from `metrics.committed*/techDebt*/unplanned*`,
  `capacity={capacity}`.
- `rollup/page.jsx` (~line 105): `breakdown` from `combined.committed*/techDebt*/unplanned*`,
  `capacity={combinedCapacity}` (renders the "N of M teams configured" caveat, decision 8).
- `share/[token]/page.jsx` (~line 117): `breakdown` from `metrics.*` (frozen-or-live, already
  asOf-pinned), `capacity={data.capacity}`.

**`MetricGrid` deliberately NOT touched** — its five cards are exactly the scoring surface decision
2 protects; `StoryPointsHighlight`'s breakdown already satisfies the display-only ask.

**`src/components/rollup/team-summary-table.jsx`**: one new column, "Committed / Capacity" (`18/24`,
or `—` when unconfigured), placed right after the existing "Points done" column (decision 9).

**`src/components/dashboard/export-dialog.jsx`**: `exportMetrics` is already recomputed
client-side via `computeSprintMetrics` (line 55) — the nine new fields arrive for free once
`metrics.mjs` is extended. Two things still needed: (1) thread a new `capacity` prop into
`<ExportDialog .../>` at its call site (`dashboard.jsx` ~line 399, already available via spread
props); (2) in `SummaryPage` (~333-472), add one new mini-section — three boxes for Committed/Tech
Debt/Unplanned Bugs, same visual pattern as the existing "Overall sprint metrics" row (~451-471) —
as an additional row, leaving the existing Sprint Health/Completion/Projected `OverallCard`s
completely untouched.

### Naming summary

| Concept | Name |
|---|---|
| Prisma model | `SprintCapacity` (`sprintId`, `teamId`, `committedPoints`; `@@unique([sprintId, teamId])`) |
| Relations | `Team.capacities` / `Sprint.capacities` → `SprintCapacity[]` |
| `metrics.mjs` type sets | `COMMITTED_TYPES` (`FEATURE`), `TECH_DEBT_ONLY_TYPES` (`TECH_DEBT`), `UNPLANNED_TYPES` (`SUPPORT`, `INTERNAL_BUG`) |
| New metrics fields | `committedPoints`/`committedCompletedPoints`/`committedIssueCount`, `techDebtPoints`/`techDebtCompletedPoints`/`techDebtIssueCount`, `unplannedPoints`/`unplannedCompletedPoints`/`unplannedIssueCount` |
| Dashboard/Share sibling prop | `capacity` → `{ committedPoints } \| null` |
| Rollup sibling prop | `combinedCapacity` → `{ committedPoints, configuredTeamCount, totalTeamCount } \| null` |
| zod schemas | `src/lib/schemas/sprint-capacity.js` → `sprintCapacityMatrixSchema`, `sprintCapacityDuplicateSchema` |
| API routes | `PUT /api/sprints/[sprintId]/capacity`, `POST /api/sprints/[sprintId]/capacity/duplicate` |
| Admin component | `SprintCapacityConfig` — `src/components/admin/sprint-capacity-config.jsx` |
| Admin SectionCard title | "Committed Capacity" |
| UI segment labels | **"Committed"**, **"Tech Debt"**, **"Unplanned Bugs"** |

### Acceptance criteria

1. `yarn lint` clean; `yarn prisma validate` + `migrate status` clean (one new migration); DB/env-free
   cold `yarn build` green with `ƒ Dynamic` incrementing by exactly 2 (the new capacity PUT +
   duplicate routes).
2. Pure-fixture checks (scratchpad, discarded after): hand-computed `committedPoints`/
   `techDebtPoints`/`unplannedPoints` over a fixture spanning all 5 `WorkflowType`s; a **before/after
   regression diff** proving every pre-existing `computeSprintMetrics`/`aggregateRollup` field is
   byte-identical (decision 2); `aggregateRollup` summed fields equal the per-team sum; a
   partial-stage-completion issue contributes the identical fractional `completedPoints` to its new
   segment as it already does to `completedPoints`.
3. API-route smoke: non-admin → 403 on both routes; unknown `sprintId`/`sourceSprintId` → 404;
   unknown `teamId` in a PUT row → 400; out-of-range number → 400; `null` clears a row (verified via
   follow-up read); `sourceSprintId === sprintId` → 400; happy-path duplicate copies N rows; a PUT
   is reflected in `getDashboardData`'s `capacity` on the next request.
4. SSR smoke on `/`, `/rollup`, `/share/[token]` (live + frozen), and the Export preview against
   Naveen's real synced data — breakdown renders with real `FEATURE`/`TECH_DEBT`/`SUPPORT`/
   `INTERNAL_BUG` issues; Sprint Health/Completion/Velocity/At-risk text diffed against a
   pre-change baseline to prove zero drift; `/leaderboard` explicitly re-checked unchanged.
5. Visual pass (both themes, Tekion/Modern) on the `StoryPointsHighlight` breakdown chips and the
   admin matrix table, following the `impeccable` skill precedent already used for
   `StoryPointsHighlight`'s original build.
6. **Human acceptance**: Naveen enters his six real capacity numbers via the new admin screen and
   confirms the breakdown + capacity comparison read correctly against his real synced teams.

### Out of scope

- **`/leaderboard` breakdown** (decision 4) — stays a single all-work points ranking. If wanted
  later, it's a small addition (the segment fields already exist on the underlying issues).
- **Full 3-way breakdown per team row in `team-summary-table.jsx`** (decision 9) — only the
  Committed/Capacity column lands there; the fuller split stays portfolio-level. Revisit if Naveen
  wants per-team Tech Debt/Unplanned visibility later.
- **Capacity targets for Tech Debt or Unplanned Bugs** (decision 3) — only Committed has a
  configured target in v1.
- **AI Digest narrative mentioning the breakdown** — `src/lib/ai/digest.mjs` is untouched; the
  digest continues narrating delivery-lens/all-work totals only. A natural fast-follow, not asked
  for here.

## As-built notes (vs. the spec)

- **Fixture verification used a fabricated `Filter` row, not just teams/sprints/users** — the
  dashboard's `showWelcome` gate (`dashboard.jsx:240`, `filters.length === 0`) skips the entire
  matrix + `StoryPointsHighlight` when a team has zero filters, which the first smoke pass missed
  (all 4 dashboard-rendering assertions failed until a bare `Filter` row with zero cached issues
  was added to the fixture team). Not a bug in this feature — a pre-existing gate this feature's
  verification needed to route around, same class of lesson as several prior features' smoke
  scripts.
- **A harness bug, not an app bug, in the same round**: the "24 capacity" text assertion initially
  failed because React SSR inserts `<!-- -->` comment markers between adjacent JSX text/expression
  nodes (`24<!-- --> capacity` in the raw HTML) — the same "RSC-flight markup doubling" class of
  gotcha `trend-burndown.md`'s smoke script hit. Fixed by stripping `<!--\s*-->` before asserting on
  substrings, not by changing the component.
- **Pure-fixture count is 23/23, not a rounder number** — one fixture spanning all 5 `WorkflowType`s
  (incl. a 100-point `CUSTOM` issue proving it lands in none of the three new segments) plus a
  same-fixture before/after regression diff of every pre-existing `computeSprintMetrics`/
  `aggregateRollup` field, run inline as `assertEqual` checks rather than a separate test file per
  assertion (this repo keeps no permanent test suite by design).
- **The admin duplicate route itself never refuses an overwrite** — decision 10's confirm-dialog
  friction lives entirely in `sprint-capacity-config.jsx` (client-side, based on whether the
  destination sprint already has rows); `POST …/capacity/duplicate` always overwrites when called,
  same as e.g. the sprint-state `PATCH` having no server-side confirm step either. Verified directly:
  a re-duplicate call in the smoke script changed an already-duplicated team's value from 24 → 30,
  confirming the route's overwrite semantics independent of the UI's confirm dialog.
- **No `GET` route for the capacity matrix** — unlike most domain resources, admin reads its rows
  via the existing `admin/page.jsx` page-load query (`prisma.sprintCapacity.findMany`), and the
  dashboard/rollup/share paths read via `dashboard-data.js`, so a standalone GET was never needed —
  consistent with the spec's original design, not a deviation.
- **Icon choice**: `Target` (lucide-react) for the admin "Committed Capacity" `SectionCard`, `warn`
  tone tile (visually distinct from Teams' `brand` and Sprints' `info` tiles) — not specified in the
  plan, chosen to match the existing `SectionCard` icon/tone convention.
- **The spec's own UI design was superseded within the day.** The plan (and the first
  implementation) called for a **chip row** under the Delivered/Planned pair. Naveen's review
  replaced it outright with the full **delivery scoreboard** — ink surface, composition rail, two
  variants. The requirement it serves is unchanged (decision 1's "two types" reading, decision 3's
  Committed-only capacity), so no ratified decision was reversed; only the presentation the
  Requirements section describes. Read `## Status` → "Second pass" as authoritative over the
  chip-row wording in Requirements.
- **A second variant + a per-card toggle were not in the plan at all.** `condensed` vs `relaxed`
  and the `/rollup`-only Condensed/Relaxed control (`rollup/rollup-story-points.jsx`, the one new
  file this pass added) came from Naveen mid-build ("it's occupying a lot of real estate" / "in the
  Rollup screen keep this view, but give an option to have condense/relax"). It rides `useLocalPref`
  per §17's ephemeral-pref rule and is deliberately **per-card**, not a revival of the app-wide
  density toggle retired 2026-07-25 — worth stating because the two look identical in a changelog.
- **Two new palette tokens + one renamed token were required, and were measured, not eyeballed.**
  `--on-ink-cat-2` gold / `--on-ink-cat-3` rose replaced a first cut of two greys (6.7:1 and 4.2:1
  on ink — they read as background). The `/bugs` Ageing ramp is deliberately **not** reused verbatim:
  authored against a white card, its two darkest steps collapse to 3.4:1 / 2.2:1 on ink, so `--age-*`
  is untouched and this is the same hue re-pitched. Knock-on rename: `--on-ink-warn` →
  `--on-ink-alert` red `#ff5f56`, because amber sat ΔE 6.4 from the new gold and would have read as a
  fourth category. **`.sp-stripe` hatching is load-bearing, not decoration** — brand↔cat-3 is ΔE 4.8
  worst-case under deuteranopia in Tekion, so texture is that pair's second channel and must not be
  "simplified" away by a later cleanup.
- **A pre-existing bug in shared code was fixed as a side effect.** `useCountTransition`'s
  `getSnapshot` sampled the clock on every call — the exact pattern React warns about ("the result
  of getSnapshot should be cached to avoid an infinite loop"). Caching the eased value per rAF frame
  fixed **both leaderboards and `MyStatsCard`** too, not just this card. Flagged rather than folded
  in silently because it widens this feature's blast radius beyond its own screens.
- **Three harness bugs, zero app bugs, during the completion pass** — recorded because each is a
  repeat of a documented house gotcha and cost real time: (1) assertions used `"Story Points"` where
  the component renders `"Story points delivered"`; (2) the capacity assertion used the **relaxed**
  variant's wording (`24 capacity`) against a **condensed** page, whose legend reads `· 24 cap
  (on target)` — the two variants have deliberately different copy; (3) the share-create call sent
  `includedFilterIds` where the route's contract is `filterIds` (its 400 was correct). Also
  re-confirmed: `computeSprintMetrics(filters, progressByKey, sprint, asOf)` is **positional** with
  progress as a **plain object keyed by jiraKey**, and `aggregateRollup` takes a flat **array of
  metrics objects** — not the `{ perTeam }` shape a caller might assume.
- **`velocityPoints` is the throughput-lens SCOPE total, not delivered points** (`velocityPoints =
  points`, `velocityCompletedPoints = completedPoints`). Noted because a fixture asserting
  `velocityPoints === completedPoints` looks reasonable and is wrong.
- **The only pre-existing `SharedView` row expired 2026-07-19**, so `/share/<that token>` correctly
  serves the generic expired page — which reads identically to a broken board in a substring
  assertion. Live/frozen scoreboard rendering therefore needs a **freshly created** share to verify
  at all; a temporary live + frozen pair was created through the real route and deleted after.
- **Still open**: the **Modern**-theme visual round and the authed real-browser pass on `/`,
  `/rollup`, `/admin` (extension not connected; theme is a `localStorage` class a cookie-less
  headless capture can't toggle). Naveen's six real capacity numbers are **no longer** open — they
  are entered and verified rendering (see Status).

## Doc-sync (§17 — same PR)

- **§5**: new feature-list row, dated on landing, summarizing the three-way segmentation + the
  `SprintCapacity` model + "display-only, doesn't touch Sprint Health/Completion/velocity."
- **§9**: insert the `SprintCapacity` model block + the two `capacities` relation lines,
  byte-consistent with `schema.prisma`.
- **§11**: short new paragraph on the `StoryPointsHighlight` breakdown row (Dashboard/Rollup/
  Share/Export) and the new team-summary-table column.
- **§16**: one new ratified-decision paragraph enumerating the 10 decisions above, dated on landing.
- The running historical "Cutover, then post-v1…" clause near the bottom of the file gets one more
  appended sentence, per this repo's established convention for every post-cutover feature.
- **current-feature.md**: Status/History per the finish-feature ritual.

## References

- `context/features/leaderboard.md` — the `Team.developerCount` override-field precedent this
  feature deliberately does NOT reuse for capacity (that field is static per-team; this one must
  vary per sprint) — and the RBAC/admin-matrix conventions this feature does reuse.
- `context/features/sprint-phases-delivery-lens.md` — the existing delivery-vs-throughput two-lens
  model this feature adds a third, orthogonal, display-only lens alongside (never modifying it).
- `context/features/gm-bug-report.md` — the SLA-days-per-(scope,priority) matrix
  (`bug-report-config.jsx`) this feature's admin capacity matrix mirrors.
- `context/SprintTracker - Project Spec/CommittedAndUnplanned-1.jpg`,
  `CommittedAndUnplanned-2.jpg` — the original handwritten spec.
