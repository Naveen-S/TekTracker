# Velocity / LeaderBoard

## Overview

The handwritten spec (`context/SprintTracker - Project Spec/Velocity:LeaderBoard.jpg`) asks for a
"fun but critical" screen capturing developer/team efficiency sprint on sprint:

> Since we have multi scrum teams, let's have a healthy competition screen where we capture team's
> velocity leaderboard. Where it should be total story points delivered ÷ divided by no of
> developers. We should also have overall developer leaderboard across all the scrum teams.

Two boards, both gamified in spirit (dribbble refs: avatar leaderboards, rank badges/podiums):

1. **Team velocity leaderboard** — teams ranked by `total points delivered ÷ number of developers`.
2. **Developer leaderboard** — individual developers ranked by points delivered, across every
   scrum team, org-wide.

A new top-level tab (`/leaderboard`), sitting alongside `/`, `/rollup`, `/bugs`, `/admin`.

Requested by Naveen 2026-07-26; drafted through several rounds of clarifying questions (see
Decisions below) plus a research pass that surfaced the real shape of the problem:

- **"Completed points" is already a defined metric** — `src/lib/metrics.mjs`'s existing weighted
  stage-completion computation (`storyPoints × percent/100`, summed), not Jira status. This
  feature reuses it rather than inventing a second definition of "delivered."
- **Individual developers have no identity in the data model.** Only Leads/EMs/EDs/Admins log into
  this app (`User`/`TeamMembership`). Developers exist solely as `Issue.assigneeName`/
  `assigneeAccountId` strings captured from Jira sync. Usefully, `User.jiraAccountId` (populated at
  login via Jira `/myself`) and `Issue.assigneeAccountId` (populated at sync) share the same
  Atlassian account-id namespace — so a logged-in Lead/Member CAN be matched to their own delivered
  issues with zero new roster/identity modeling.
- **Key architecture insight — no new snapshot table needed.** `Issue`/`IssueProgress` rows are
  never deleted except by an explicit re-sync of that team+sprint's filters (`refreshFilterCache`
  in `src/lib/sync/engine.js`) or a Filter/Team delete (cascade). The daily cron
  (`src/lib/cron/daily.js`) only touches `ACTIVE` sprints. Once the **manual** sync route is also
  gated away from `CLOSED` sprints (a real, previously-unguarded gap found during research — see
  decision 7), a closed sprint's Issue/IssueProgress rows are permanently frozen. That means
  **historical per-developer and per-team data for any past sprint can be computed live, on
  demand** — exactly like `computeSprintMetrics` already does for the current sprint. This is a
  deliberate departure from the `SprintSnapshot` precedent (a daily, per-team, cron-written table
  used for burndown trend) — no new daily-cadence data, no new migration for history, because the
  spec wants "sprint on sprint" comparison (one number per completed sprint), not a within-sprint
  daily trend.
- One pre-existing, unrelated gap was confirmed during research but is explicitly **not** fixed
  here: deleting a Filter or Team on a closed sprint still cascade-deletes its frozen Issue rows.
  Same class of risk as decision 7's sync-gate bug, but out of scope for this feature — noted for
  the record only (see Open risks).

## Status

**Done 2026-07-27.** Implemented as specced: `Team.developerCount` (one migration,
`add_team_developercount`); the sync-gate bugfix (decision 7); four new pure functions in
`metrics.mjs` (`aggregateByDeveloper`, `teamVelocityPerDeveloper`, `aggregateTeamAllTime`,
`aggregateDeveloperAllTime`, `rankBy`); a new `src/lib/leaderboard-data.js` data module (org-wide,
no membership scoping, 3 batched queries for cross-sprint history); a new `LEADERBOARD_ROLES`
group + `hasLeaderboardAccess()` in `rbac.js`; the new `/leaderboard` page + `TeamLeaderboard`/
`DeveloperLeaderboard`/`LeaderboardTopBar` components; a shared `AvatarChip` (retrofit into the 3
existing inline copies) and `RankBadge` (Crown/Medal/Award podium treatment, reusing the house
"sweep" sheen from `release-countdown.jsx`); `MyStatsCard` wired into `/` for LEAD/MEMBER; the
`developerCount` admin field in `team-config-dialog.jsx`; sidebar/`AppShell` wiring across all 5
pages.

**Verified:** `yarn lint` clean; `prisma validate` + `migrate status` up to date (**6 migrations**);
**DB/env-free cold build green — 42 ƒ Dynamic (41 → 42)**, `.env` genuinely moved aside (twice —
once pre-polish, once post-polish) and restored both times; **26/26 pure-fixture checks** for the
four new `metrics.mjs` functions (developer aggregation incl. skip-unassigned, all-time sums, rank
ties); **24/24 SSR/API smoke checks** against a fabricated multi-team/multi-sprint fixture covering
the RBAC gate (EM/ED/VIEWER/admin see the board; TPM/LEAD/MEMBER don't), the sync-gate 409, sprint-
and all-time team/developer math hand-verified against the fixture, the unconfigured-team footnote,
`MyStatsCard`'s figures with no rank/comparison leakage, and the admin `developerCount` PATCH taking
effect live; fixture torn down to 0 leftovers both times. A design pass (`impeccable` skill,
`bolder` playbook) added a podium treatment for rank 1 on both boards, confirmed via headless-
Chrome screenshots (a temporary `playwright` install, `--no-save`, fully removed after) in **both
themes** (Tekion teal / Modern blue) — the accent-token reuse re-hues automatically with zero
per-theme branching.

## Decisions (RATIFIED 2026-07-26, via clarifying-question rounds)

1. **"Delivered" points = the existing weighted stage-completion metric**, reused as-is (partial
   credit — an issue at 80% weighted completion contributes 80% of its points). Not a binary
   Jira-status-Done cutoff, and not re-derived independently of `computeSprintMetrics`.
2. **Work scope = ALL work — throughput lens** (Roadmap + Tech Debt + Support + Internal Bugs),
   matching the existing Velocity card convention (ratified 2026-07-24: "bugs consume real
   capacity, everything counts"). Not the narrower delivery lens (Roadmap + Tech Debt only) used by
   Sprint Health/Completion.
3. **Team leaderboard's "number of developers" divisor = a new admin-entered `Team.developerCount`
   field**, mirroring the existing `storyPointsFieldId`/`sprintFieldId` override-field pattern —
   **not** a dynamically-derived distinct-assignee count. Rationale: a dynamic count fluctuates
   with Jira assignment noise (a one-ticket helper from another team would inflate a team's
   apparent headcount) and doesn't match "efficiency" framing as cleanly as a stable, admin-owned
   number. Teams without `developerCount` set are **excluded from the team leaderboard's ranking**
   (shown in an "unconfigured" footnote, with an admin link) but their developers still appear
   individually on the developer leaderboard.
4. **Time scope: BOTH a sprint-scoped view AND an all-time cumulative view**, for BOTH boards. A
   sprint selector (default: the active sprint) plus a toggle to "All-time." Matches the spec's own
   two framings — "sprint on sprint" (item 1) and "overall...across all the scrum teams" (item 2).
5. **Visibility: the full org-wide board is gated to roles EM + ED + VIEWER only** (global admin
   `User.isAdmin` always bypasses, per house convention). **TPM is deliberately excluded**, even
   though it's grouped with ED everywhere else in `src/lib/rbac.js`
   (`TEAM_MANAGER_ROLES = [ADMIN, ED, TPM, EM, LEAD]`) — this needed its own new, narrower role
   group (`LEADERBOARD_ROLES`), not reuse of an existing one. Holding EM/ED/VIEWER on **any one**
   team unlocks the **entire org-wide** board (not scoped to the viewer's own teams) — mirrors the
   existing loose "Roll-up" nav-link visibility rule (`teams.length >= 2 || isAdmin`).
6. **LEAD/MEMBER (excluded from the full board) get a personal "my stats" card only** — their own
   points delivered (this sprint + all-time), with **no rank number and no comparison to others**
   — on their existing `/` dashboard, not a link into the gated `/leaderboard` page. Identity match:
   `User.jiraAccountId === Issue.assigneeAccountId`.
7. **Bundled bugfix**: `syncTeamSprint` (`src/lib/sync/engine.js`) has no guard today against
   syncing an already-`CLOSED` sprint, which would silently overwrite that sprint's frozen
   historical Issue rows (assigneeAccountId/storyPoints/jiraStatus) with today's live Jira state —
   corrupting the exact historical data this whole feature depends on (see the architecture
   insight above). Fixed as part of this feature: reject with `ConflictError` (409, the existing
   class in `route-helpers.js`) when `sprint.state === SprintState.CLOSED`. The guard lives in the
   engine function itself (protects every caller, present and future), not just the one route. The
   daily cron already only selects `ACTIVE` sprints, so it's unaffected.
8. **Unassigned issues** (`Issue.assigneeAccountId === null`) still count toward a team's total
   points — consistency with the existing Completion/Velocity cards elsewhere in the app, which
   already include unassigned issues — but are excluded from individual developer attribution
   (there's nobody to attribute them to).
9. **No backfill mechanism needed.** Per the architecture insight above, this "just works" the
   moment decision 7 ships — history is computed live from already-persisted rows, not captured
   going forward from a new snapshot table. There is no "start clean" gap for team-level history
   (it was already derivable from the existing `SprintSnapshot` table too) or developer-level
   history (derivable from `Issue`+`IssueProgress`, frozen per closed sprint).

**Deliberately deferred, not silently dropped** — flagged during planning, worth a quick gut-check
with Naveen before or during implementation rather than a hard blocker:

- **Rank-delta / "moved up since last sprint" arrows.** Would roughly double the cost of the
  heaviest query on this page (re-running the aggregation for the previous sprint too) and is
  ill-defined for the all-time view (previous-to-what?). The sprint dropdown already lets a viewer
  manually flip between two sprints to eyeball the comparison. Recommendation: ship v1 without it;
  the pure `rankBy` helper accepts an unused `previousRankByKey` hook so it's a small addition
  later if wanted.
- **Retrofitting the 3 existing inline avatar-initials chips** (`top-bar.jsx`, `bugs-top-bar.jsx`,
  `rollup-top-bar.jsx`) to a new shared `AvatarChip` component. Small and mechanical, and prevents
  a 4th divergent copy (the leaderboard needs avatar chips in bulk, for a whole ranked list) — doing
  it in the same PR since it's low-risk, but easy to split out if the diff should stay smaller.

## As-built notes (vs. the spec)

- **Rank-delta ("moved since last sprint") stayed deferred**, as flagged in the deferred-items
  list above — `rankBy` ships without a `previousRankByKey` parameter at all (the spec's draft
  signature mentioned one; it was dropped rather than shipped unused, per coding-standards' "no
  unused parameters"). Easy to add later if wanted.
- **`AvatarChip`/`RankBadge` sizing** ended up as `sm`/`md`/`lg` (the spec didn't pin exact sizes).
  `RankBadge` rank 1 uses `lg` + the reused `sweep` sheen from `release-countdown.jsx`; ranks 2–3
  use `md`; the rest render a plain `#N` text chip — no new colors, matching the "amplify what the
  system already owns" instruction from the `impeccable` `bolder` playbook used for the visual
  pass.
- **A real, pre-existing dev-mode quirk discovered during smoke testing, unrelated to this
  feature**: this Next 16.2.9 + Turbopack dev server resolves both `redirect()` and `notFound()`
  to an HTTP 200 response (with the correct final content client-rendered in), not the expected
  30x/404 status — reproduces identically on totally untouched routes (`/`, `/admin`, `/rollup`)
  that predate this feature. Confirmed via a direct diff of an EM (access-granted) vs. TPM
  (access-denied) response body: the reliable signal is content (`"Team Velocity"` present or
  absent), not the HTTP status code, in this dev environment. Not a bug in `hasLeaderboardAccess`
  or the page gate — smoke checks were written around this once found. Worth knowing for any
  future feature's dev-mode smoke testing in this repo; production builds were not checked for
  this (out of scope to investigate further here).
- **Prisma client regeneration is a separate step from `migrate dev`** — after running the
  migration, the generated client (`src/generated/prisma/`) did not yet know about
  `developerCount` until an explicit `yarn prisma generate` ran; the already-running dev server
  also needed a restart afterward (the same stale-Prisma-client hazard this project's history has
  hit repeatedly on schema-change features). Not a new problem, just re-encountered.
- **The smoke-test math itself had a bug, not the app**: an early failing assertion
  ("team total = 16 pts") turned out to be my own hand-calculation forgetting the fixture's
  unassigned issue (3 pts) — the real total (19 pts) is exactly correct per decision 8 (unassigned
  issues still count toward the team total). Corrected the test, not the implementation.

## Requirements

### Data model

One additive field, one migration (`yarn db:migrate`, never `db push`), doc-sync §9
byte-consistently:

```prisma
model Team {
  ...
  supportIssueTypes     String[]
  /// Admin-entered scrum-team headcount — the Team Velocity Leaderboard's "points ÷ developers"
  /// divisor (Velocity/Leaderboard decision 3). Mirrors storyPointsFieldId/sprintFieldId: a
  /// per-team, admin-entered value, not derived from Jira/distinct assignees (headcount should
  /// include people on leave/ramping who still count toward capacity, and shouldn't fluctuate with
  /// Jira assignment noise). `null` ⇒ the team is excluded from the TEAM leaderboard's ranking
  /// (its developers still appear individually on the developer leaderboard).
  developerCount        Int?
  createdAt             DateTime         @default(now())
  ...
}
```

No other model changes. `Issue`/`IssueProgress`/`Filter`/`Sprint` are all read-only inputs to this
feature.

`src/lib/schemas/team.js`'s shared `teamFields` object gains:
```js
developerCount: z.coerce.number().int().min(1).max(200).nullish(),
```

### RBAC — `src/lib/rbac.js`

New, deliberately narrower role group + page-level (not team-scoped) access check:

```js
/** Roles that unlock the org-wide Velocity/Leaderboard page — a NEW, narrower group. NOT reused
 *  from TEAM_MANAGER_ROLES: TPM sits inside that group everywhere else but is intentionally
 *  excluded here; LEAD/MEMBER get the personal "my stats" card instead of the full board. */
export const LEADERBOARD_ROLES = [Role.EM, Role.ED, Role.VIEWER];

/** Whether `user` may view the org-wide leaderboard: global admin, OR holds one of
 *  LEADERBOARD_ROLES on ANY team — not scoped to the viewer's own teams (decision 5). */
export async function hasLeaderboardAccess(user) {
  if (user.isAdmin) return true;
  const membership = await prisma.teamMembership.findFirst({
    where: { userId: user.id, role: { in: LEADERBOARD_ROLES } },
    select: { id: true },
  });
  return membership !== null;
}
```

No throwing `requireLeaderboardAccess()` is added — v1 has no new mutation routes to guard with it.

### Sync-gate bugfix — `src/lib/sync/engine.js`

In `syncTeamSprint`, select `state` on the sprint lookup and reject `CLOSED`:

```js
const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { id: true, state: true } });
if (!sprint) throw new NotFoundError("Sprint not found");
if (sprint.state === SprintState.CLOSED) {
  throw new ConflictError("Cannot sync a CLOSED sprint — its historical data is frozen for the leaderboard and history views");
}
```

No change needed to `src/app/api/teams/[teamId]/sprints/[sprintId]/sync/route.js` —
`handleRouteError` already maps `ConflictError` → 409.

### New pure functions — `src/lib/metrics.mjs`

Storage-free, matching the module's house rule ("metrics are pure functions"):

- `aggregateByDeveloper(issues)` — groups `computeSprintMetrics(...).issues` (already-resolved,
  all-work scope) by `assigneeAccountId`, skipping `null` (unassigned, decision 8). Returns
  `Array<{ assigneeAccountId, assigneeName, totalPoints, completedPoints, issueCount }>`.
- `teamVelocityPerDeveloper(completedPoints, developerCount)` — `completedPoints ÷ developerCount`;
  `null` when `developerCount` is unset or `≤ 0`.
- `aggregateTeamAllTime(historyRows)` / `aggregateDeveloperAllTime(historyRows)` — sum
  `computeSprintMetrics` results (and their `aggregateByDeveloper` breakdowns) across every
  `(team, sprint)` pair a caller passes in.
- `rankBy(rows, { metricKey, idKey })` — 1-based competition rank (ties share a rank, the next
  distinct value skips: 1, 2, 2, 4), sorted descending. No rank-delta wiring in v1 (see deferred
  items above); the shape leaves room for it.

No duplication of the delivery/throughput lens split — `aggregateByDeveloper` just groups the array
`computeSprintMetrics` already produced; it doesn't re-run `calculateWeightedCompletion` or
`resolveProgress`.

### New data-access module — `src/lib/leaderboard-data.js`

Exports three existing private helpers from `dashboard-data.js` as-is (`getSprintSelection`,
`hasActiveBugReport`, `serializeUser` — additive, zero behavior change; keeps the import direction
one-way, `leaderboard-data.js → dashboard-data.js`, so there's no circular dependency). New module:

- `getSprintBoards(sprint)` — org-wide (every `Team`, not membership-scoped), one sprint: 2 batched
  queries (`Filter.findMany` with issues, `IssueProgress.findMany`), grouped in JS → team board +
  developer board via the new pure functions.
- `getAllTimeBoards()` — org-wide, every `(team, sprint)` pair that has ≥1 Filter, via a new
  `getTeamSprintHistory(teamIds)` helper (3 batched queries total regardless of team/sprint count —
  no N+1, grouped via `Map`), summed via `aggregateTeamAllTime`/`aggregateDeveloperAllTime`.
- `getLeaderboardData(user, { sprintId, view })` — the page's single entry point; dispatches to the
  above based on `view` (`"sprint"` default, or `"allTime"`).
- `getMyAllTimePoints(jiraAccountId, teamId)` — single-team-scoped (mirrors `/`'s single-selected-
  team framing), reused by the personal "my stats" card; same `getTeamSprintHistory` code path
  called with one team.

**No new API routes.** The page is 100% read-only, matching `/rollup`'s "no writes, no Sync"
precedent. The one mutation this feature needs (`Team.developerCount`) rides the existing
`PATCH /api/teams/[teamId]`.

### New page — `src/app/leaderboard/page.jsx`

```
GET /leaderboard?sprint=<id>&view=sprint|allTime
```

Server component: auth gate (`redirect("/login")`) → `hasLeaderboardAccess(user)` gate
(`notFound()`, matching `/admin`'s exact convention — not a 403 JSON error, since this is a page) →
`getLeaderboardData(user, {...})` → render. `sprint` defaults exactly like `/` and `/rollup`
(requested id, else `ACTIVE`, else latest); `view` defaults to `"sprint"`. Only client leaf: a
`LeaderboardTopBar` (sprint `<Select>` + view toggle, `router.push` on change) — the `RollupTopBar`
shape. Everything else server-renders.

### New UI components

- `src/components/ui/avatar-chip.jsx` — shared initials chip (`initials()` from `lib/utils.js`,
  extracted since this is a 4th usage site); retrofit the 3 existing inline copies (see deferred
  items — doing it in this PR, small diff).
- `src/components/ui/rank-badge.jsx` — `Crown`/`Medal`/`Award` (lucide-react, unused elsewhere
  today) for #1/#2/#3, a plain `#N` chip otherwise. Existing tone tokens only, no new hex
  (coding-standards: no inline styles).
- `src/components/leaderboard/team-leaderboard.jsx` — ranked cards: rank badge, team name,
  `completedPoints ÷ developerCount`, a footer note listing unconfigured teams (with an admin link
  when the viewer is admin).
- `src/components/leaderboard/developer-leaderboard.jsx` — ranked list: rank badge, `AvatarChip`,
  name, team tag, issue count, points.
- `src/components/leaderboard/leaderboard-top-bar.jsx` — sprint `<Select>` + view-toggle `<Select>`.
- `src/components/dashboard/my-stats-card.jsx` — plain presentational card (no client hooks), two
  numbers (this sprint / all-time), explicitly no rank/comparison per decision 6.

**Design pass**: invoke the `impeccable` skill (or apply `emil-design-eng`'s polish principles for
the micro-interactions — count-up numbers, hover states, a subtle rank-badge glow) during the build,
using the dribbble references (avatar leaderboard, gamified dashboard) for direction. Any chart
(e.g. a team's sprint-over-sprint bar) follows the house hand-rolled-inline-SVG convention
(`src/lib/chart-path.mjs`) — no new charting dependency.

### Wiring

- `src/components/ui/app-shell.jsx` / `app-sidebar.jsx`: new `hasLeaderboardAccess` prop, `Trophy`
  icon (lucide-react), nav entry placed after "Roll-up" (both are portfolio-wide views).
- Five call sites need `hasLeaderboardAccess(user)` computed and threaded: `/` (via
  `getDashboardData`'s return), `/rollup` (via `getRollupData`), `/bugs` (inline, no data module),
  `/admin` (inline), and `/leaderboard` itself (always `true`, already gated above it).
- `/` dashboard: compute `myStats` in `src/app/page.jsx` (not inside `dashboard-data.js`, to avoid a
  circular import with `leaderboard-data.js`) for LEAD/MEMBER roles with a selected team, pass to
  `Dashboard` → render `MyStatsCard` right after `Hero`. The "this sprint" figure costs zero extra
  queries (derived from `data.metrics.issues`, which `getDashboardData` already fetched); only the
  all-time figure is a new, cheap, single-team-scoped query via `getMyAllTimePoints`.

### Admin UI

`src/components/admin/team-config-dialog.jsx`: one new `Input type="number" min="1"` + `Label` row
below "Description" (a core field, not buried in the collapsed "Advanced: Issue Type overrides"
section), with helper copy explaining the leaderboard divisor and that leaving it blank excludes
the team from the team leaderboard's ranking. Added to `handleSubmit`'s body object exactly like the
existing fields.

## Open risks / known limitations

1. **Filter/Team delete cascades on closed sprints** (confirmed during research, not introduced by
   this feature): deleting a Filter or Team belonging to a `CLOSED` sprint still cascade-deletes its
   frozen `Issue` rows, permanently losing that sprint's leaderboard data for those issues. Same
   class of risk as decision 7's sync-gate bug, but explicitly out of scope here — a pre-existing,
   shared limitation of the app's cascade design, not something this feature newly creates.
2. **`VIEWER` role's dual meaning.** The `Role` enum's doc comment describes `VIEWER` as
   "read-only (share-view recipients, VPs)" — but `SharedView` is actually a bearer-token mechanism
   with no `TeamMembership` row at all, so the comment is aspirational for the VP case, not literal.
   If any actual `VIEWER` `TeamMembership` rows exist today for narrow/unrelated purposes, decision
   5 hands them full org-wide leaderboard access too. Worth a quick audit
   (`TeamMembership` rows where `role = VIEWER`) before shipping — informational, not a blocker.
3. **Multi-team developer "home team" tag.** A developer could in principle have issues in two
   teams within the same sprint (e.g. a loaned engineer). Their total points sum correctly across
   teams on the developer board, but the team badge shown next to their name reflects whichever
   team's rows were encountered first when building the board — a display simplification, not a
   math error. Acceptable for v1; a "+1 team" indicator is a natural future polish item.
4. **`computeSprintMetrics`'s existing "counted per appearance" quirk** (an issue in two filters in
   the same team+sprint is double-counted) is inherited here, not introduced — it already affects
   `MetricGrid`/`aggregateRollup` today. Flagging so a future "why is my number off" report on the
   leaderboard isn't misdiagnosed as a new bug.

## Verification plan

1. `yarn lint`; `prisma validate` + `migrate status`; DB/env-free cold `yarn build` (`.env` genuinely
   moved aside, not just shell-unset).
2. Pure-fixture tests (throwaway script, deleted after) for the four new `metrics.mjs` functions:
   hand-computed points-per-developer over a small fixture, an unassigned issue excluded from
   individual rows but present in the team total, all-time sums matching manually-summed per-sprint
   values, rank ties (1, 2, 2, 4), and `teamVelocityPerDeveloper` returning `null` for an unset
   `developerCount`.
3. SSR/API smoke against a fabricated multi-team, multi-sprint fixture: RBAC gate (EM/ED/VIEWER see
   `/leaderboard`; LEAD/MEMBER/TPM get `notFound()` there but see their `MyStatsCard` on `/`; global
   admin bypasses); the sync-gate fix (409 on a `CLOSED` sprint, unaffected on `ACTIVE`/`PLANNING`);
   team leaderboard math against a hand-computed example; unconfigured-team exclusion from the team
   board while its developers still appear on the developer board; all-time sums reconciling against
   manually-summed per-sprint values; cross-team developer point aggregation (the colliding-
   `assigneeAccountId`-across-two-teams case from Open Risk 3).
4. **Human acceptance**: a real-data runtime smoke (render-only, no writes) against Naveen's actual
   synced teams/sprints, plus his own judgment on the gamified visual direction.

## Doc-sync (§17 — same PR)

- **§5**: new feature-list row.
- **§9**: `Team.developerCount` field addition, byte-consistent with `schema.prisma`.
- **§11**: new `/leaderboard` page + `MyStatsCard` note.
- **§13**: note the new `LEADERBOARD_ROLES` group and the sync-gate bugfix (a RBAC/data-integrity
  hardening, not a new mutation surface).
- **§16**: append this feature's decisions, especially decision 3 (admin-entered divisor, not
  derived) and decision 5 (the new, narrower role group excluding TPM).
- **Master plan**: post-v1 addition (not a numbered step — the plan is complete, like
  `gm-bug-report.md`/`one-click-sprint-start.md`).
- **current-feature.md**: Status/History per the finish-feature ritual.

## References

- `context/features/trend-burndown.md` — the `SprintSnapshot` precedent this feature deliberately
  does NOT follow for history (daily cron snapshot vs. this feature's live-computed history), and
  why that's the right call here.
- `context/features/ed-rollup.md` — the "batch across teams, never merge progress maps" pattern
  this feature extends to "batch across teams AND sprints."
- `context/features/one-click-sprint-start.md` — the `Team.developerCount`-style
  override-field precedent (`storyPointsFieldId`/`sprintFieldId`/the 4 issue-type arrays) and the
  `ConflictError` (409) convention reused here.
- `Velocity:LeaderBoard.jpg` (`context/SprintTracker - Project Spec/`) — the original handwritten
  spec.
