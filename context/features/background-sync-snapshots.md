# Background sync + daily SprintSnapshot (migration step 7)

## Overview

**Production Migration Plan step 7 — the next in-order step** (step 6 fully DONE 2026-07-08).
A cron on Tekion internal infra hits an **internal, secret-gated route** that, for every
`ACTIVE` sprint: (1) refreshes each participating team's Issue cache through the step-5 sync
engine, then (2) writes the **daily per-team `SprintSnapshot`** row (§9) — the data plumbing for
the last unserved leadership signal, VP **trend/burndown** (§2.2, §14.8), and the freshness story
the roll-up deliberately deferred (`/rollup` has no Sync by design, §14.9 — ed-rollup.md
decision 6). It also starts amortizing §14.9 (ED reads hit a warm cache instead of N live Jira
call chains).

> **Key architectural point:** this step is almost entirely **assembly of already-built,
> already-verified parts**. `syncTeamSprint` was designed for cron reuse in step 5 (engine header:
> "Called by the sync route now and the step-7 cron later"); `computeSprintMetrics` grew
> `totalIssues`/`healthCounts` in 6b **specifically in the §9 `SprintSnapshot` shape**; the
> batched no-N+1 read pattern is `getRollupData`'s. What's genuinely new: the cron **auth model**
> (shared secret, no session — a first: every existing route is cookie-gated) and the **service
> Jira credential** (a cron has no calling user to decrypt a token for).

Trend/burndown **UI stays out** (step 10 post-v1 per the master plan); this step only writes the
rows that make it possible.

## Status

**Done 2026-07-09** — all 8 decisions implemented as proposed. Implemented: pure `snapshotValues`
in `web/src/lib/metrics.mjs`; `runDailyJob` in `web/src/lib/cron/daily.js` (service-credential
resolution with up-front `/myself` validation, ACTIVE sprints × filter-bearing teams, sequential
refresh with per-team error isolation, batched two-query snapshot reads per sprint, UTC-midnight
upsert on `sprintId_teamId_capturedOn`); secret-gated `POST /api/cron/daily`
(`web/src/app/api/cron/daily/route.js` — `timingSafeEqual` over sha256 digests, loud-fail on
unset/short secret, body ignored); `CRON_SECRET` + `CRON_SYNC_USER_EMAIL` documented in
`web/.env.example` with the crontab example. Verified: **23/23 plain-Node fixtures** (§9 field
pick, `healthCounts` shape, per-team keying, Σ-over-teams = `aggregateRollup`); lint clean;
migrate status up to date; **DB/env-free build green — `/api/cron/daily` `ƒ Dynamic`**; **30/30
live checks on dev+Neon** (401 gates; 200 + summary; hand-computed snapshot values; PLANNING
sprint + filterless team skipped; credential-degrade with snapshots still landing; same-day
re-run idempotent — same row id, refreshed values; plus unset-secret → loud 500 with nothing
written). Fixture torn down (0 leftovers), harnesses deleted. **Finding: the stored Jira token is
ALIVE again** (Naveen re-logged in since the step-5 diagnosis) — the first smoke run exercised
the **real refresh-success path** end-to-end; the degrade path was then forced via a nonexistent
`CRON_SYNC_USER_EMAIL`. Both paths green; see As-built notes. Actual scheduling on Tekion infra
remains Naveen's deploy-time task (References example).

## As-built notes (vs. the spec)

- **`capturedOn` normalization lives in the engine, not the route** — `runDailyJob` normalizes
  its input to UTC midnight (`utcMidnight()` in `lib/cron/daily.js`); the route passes the raw
  request instant. One implementation of the "one canonical midnight" invariant instead of a
  route-side computation the engine would have to trust.
- **Service credential validated once per run, not per team** — `resolveRefreshUser` runs
  `getJiraAuthForUser` + `fetchMyself` up front; ANY failure there (unset env, unknown user,
  missing credential, dead token, Jira unreachable) degrades the whole run to
  `refresh: { skipped }` rather than burning a doomed `/myself` round-trip per team. The engine's
  own per-team fail-fast (step 5) still applies whenever the refresh does run.
- **Per-team refresh summary is condensed counts** — `{ filters, issues, progressSeeded,
  workflowsReevaluated }`, not the engine's full per-filter added/removed diff (the cron summary
  is an ops artifact, not the sync toast). Per-team failures record `{ error: message }`;
  a run-level skip records `{ skipped: true }` in each team slot.
- **`CRON_SECRET` shorter than 32 chars fails as loudly as unset** (500) — the "≥32 chars"
  requirement is enforced at call time, not just documented.
- **The "conveniently dead" token was alive** — so the first live run took the refresh-success
  path against real Jira: `/search/jql` returned **200 + empty** for the fabricated
  `project = S7A` JQL (no 400), the engine correctly replaced the fabricated cache with empty
  reality, and the §9 Issue↔IssueProgress decoupling was re-verified live (progress rows survived
  the wipe). The absent/dead path was then tested deterministically by pointing
  `CRON_SYNC_USER_EMAIL` at a nonexistent user. The full **UI-driven** real-Jira acceptance
  (login page → dashboard sync on real filters) stays open from 6a.
- **Dev `.env` now carries a real `CRON_SECRET` + `CRON_SYNC_USER_EMAIL`** (left set after
  verification — the intended dev end state; prod values go to the secret store). Next 16 dev
  **hot-reloads `.env`**, so the vars took effect without a server restart (the 2026-06-29
  stale-server gotcha did not bite).
- **Smoke harness ran from `web/.tmp-step7/`** (bare imports — dotenv, adapter-pg, the generated
  client — don't resolve from the scratchpad), deleted after; the plain-Node `snapshotValues`
  fixture stayed in the scratchpad. Snapshot-table baseline was 0 rows, so teardown could safely
  `deleteMany({})` (also clearing the row my runs wrote for the one pre-existing ACTIVE sprint).

## Decisions (PROPOSED 2026-07-09)

1. **Delivery: external cron → `POST /api/cron/daily` Route Handler** — exactly the master plan's
   "cron on your internal infra hitting an internal route". One deployable, no queue, no new
   dependency; any scheduler (crontab/Jenkins/k8s CronJob) can `curl` it. Suggested cadence: once
   daily, end of IST workday. *Alternatives:* in-process `node-cron` (rejected — new dep, dies
   with the process, awkward across multiple app instances); Vercel cron (rejected — we host on
   Tekion infra, §16).
2. **Auth: `CRON_SECRET` bearer token, no session.** The route compares
   `Authorization: Bearer <secret>` against env `CRON_SECRET` (≥32 chars; **fail loudly at call
   time if unset**, auth-layer decision 9 — never a dev fallback; compare SHA-256 digests via
   `crypto.timingSafeEqual` to dodge length/timing leaks). 401 otherwise. RBAC/`requireUser` do
   not apply — the job is org-wide and userless; the secret lives beside `SESSION_PASSWORD` in the
   secret store. *Alternative:* a synthetic "system" User + minted session (rejected — pollutes
   the User table and RBAC semantics for zero gain).
3. **Jira refresh uses a designated service credential: `CRON_SYNC_USER_EMAIL`.** The env var
   names the User whose stored (encrypted) `JiraCredential` the refresh runs with — typically
   Naveen/the seeded admin. Resolved per run → `getJiraAuthForUser(user.id)`; the engine's
   fail-fast `/myself` check (step 5) applies unchanged. ⚠️ Per-user tokens see per-user data
   (§13.2): the sync user must be able to browse every team's projects — flag in `.env.example`.
   *Alternatives:* per-team sync-owner column (rejected for now — config surface with no
   requirement behind it; revisit at OAuth, §13.2); app-level OAuth service principal (that IS the
   §13.2 revisit).
4. **Refresh failure degrades to snapshot-only — never aborts the run.** Per team:
   `syncTeamSprint` first, then snapshot **regardless** (the cache still holds last-synced
   truth — a data point from a stale cache beats a hole in the trend line). Missing/dead service
   credential (today's reality: the stored token is dead, pending Naveen's fresh-token run) →
   refresh skipped for ALL teams, snapshots still written, and the summary says why. Per-team
   refresh errors are isolated (team B's Jira 5xx must not cost team C its snapshot).
5. **Scope of one run: every `ACTIVE` sprint × teams with ≥1 filter in it.** Teams sequentially,
   never parallel (§14.9 rate-limit storm; step-5 decision 10 kept filters sequential for the same
   reason). Teams with no filters in the sprint are skipped — no zero-noise rows (`/rollup`
   renders "no filters yet" live; the trend table doesn't need it). PLANNING/CLOSED sprints
   untouched. *Alternative:* snapshot all member teams with zeros (rejected — pollutes trend data
   with teams that never participated).
6. **Snapshot write: upsert on `@@unique([sprintId, teamId, capturedOn])`, `capturedOn` = UTC
   midnight of the run date.** Same-day re-runs (manual + cron double-fire) overwrite with fresher
   numbers instead of erroring — idempotent by construction. Values are a straight pick off
   `computeSprintMetrics`: `totalPoints ← points`, `completedPoints`, `avgProgress`,
   `totalIssues`, `healthCounts` (the 6b field — already the §9 JSON comment shape
   `{ blocked, behind, atRisk, onTrack, ahead, done }`). *Alternative:* IST-local date bucketing
   (rejected — UTC keeps uniqueness stable if the cron time ever moves; the UI can localize).
7. **Metrics stay per-team, computed exactly like `/rollup`:** batched
   `filter.findMany({ teamId: { in } }, include issues)` + `issueProgress.findMany` per sprint,
   grouped in JS, per-team `computeSprintMetrics` — progress maps never merged across teams (§9).
   Org totals are NOT stored — they are the sum over team rows (§9 SprintSnapshot rationale), the
   same contract `aggregateRollup` proved in 6b.
8. **Module split mirrors step 5:** pure field-pick `snapshotValues(metrics)` lives in
   `lib/metrics.mjs` (dependency-free, plain-Node testable — the seeding.mjs precedent); the
   Prisma/engine orchestration lives under `lib/cron/` (imports the Next-bound chain). No new API
   surface beyond the one route; the domain routes are untouched.

## Requirements

### Scope

- **(a) Pure mapping — `web/src/lib/metrics.mjs`**: `snapshotValues(metrics)` →
  `{ totalPoints, completedPoints, avgProgress, totalIssues, healthCounts }` (decision 6's pick,
  §9 column names). Trivial by design — it exists so the metrics→row contract is pinned by a
  plain-Node fixture, not re-derived in the job.
- **(b) Job engine — `web/src/lib/cron/daily.js`**: `runDailyJob({ capturedOn })` —
  resolve the service credential per decision 3 (absent/dead → `refresh: skipped` mode); find
  `ACTIVE` sprints; per sprint, batched reads per decision 7; per team **sequentially**:
  `syncTeamSprint` (errors caught + recorded per decision 4) then `sprintSnapshot.upsert` per
  decision 6. Returns a summary
  `{ capturedOn, refresh: { user } | { skipped }, sprints: [{ sprint, teams: [{ team, refresh, snapshot }] }] }`.
- **(c) Route — `web/src/app/api/cron/daily/route.js`**: `POST`, `force-dynamic`; decision-2
  secret gate (401 on missing/bad bearer); no request body (ignore any); calls `runDailyJob` with
  `capturedOn` = UTC midnight of now; 200 + summary JSON; errors through `handleRouteError`
  conventions (`{ error }` bodies).
- **(d) Env — `web/.env.example`**: document `CRON_SECRET` (openssl-generated, secret store) and
  `CRON_SYNC_USER_EMAIL` (must be a logged-in user whose Jira token sees all teams' projects);
  both read lazily at call time, loud-fail (`CRON_SECRET`) / degrade-with-report
  (`CRON_SYNC_USER_EMAIL`) per decisions 2/4.
- **(e) Ops note — this spec's References**: the one-line crontab example
  (`curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/daily`) recorded here
  and in `.env.example` — actual scheduling on Tekion infra is Naveen's deploy-time task, out of
  repo scope.

### Mechanism / gotchas

- **Read the installed Next 16 route-handler docs first** (`node_modules/next/dist/docs/`,
  `web/AGENTS.md` discipline) — headers/body access on `Request` and the `force-dynamic` idiom
  should match the step-4/5 routes, but verify before writing.
- **`crypto.timingSafeEqual` throws on length mismatch** — compare `sha256(provided)` vs
  `sha256(expected)` digests (equal length always), not raw strings.
- **Prisma compound-unique upsert idiom:**
  `where: { sprintId_teamId_capturedOn: { sprintId, teamId, capturedOn } }` — the generated
  composite-key name; confirm against the generated client types.
- `capturedOn` normalization: `new Date(Date.UTC(y, m, d))` from the run instant — one canonical
  midnight, or same-day upserts silently become distinct rows.
- The engine throws `NotFoundError`/`JiraAuthError`/`JiraApiError` (step 5) — the job must catch
  **per team** (decision 4), record `{ error: message }` in that team's summary slot, and carry on;
  only `CRON_SECRET` problems and truly unexpected throws surface as route-level errors.
- Snapshot reads must happen **after** that team's refresh attempt (fresh cache when refresh
  succeeded, last-good cache when it failed) — order inside the team loop matters. Simplest
  correct shape: refresh all of a sprint's teams first (sequential), then do the sprint's batched
  snapshot reads once.
- No schema change (`SprintSnapshot` shipped in the `init` migration), **no migration, no new
  dependency**.

### Acceptance criteria

- `yarn lint` + `yarn build` green in `web/`; build stays **DB/env-free** (`.env` moved aside;
  `CRON_*` unset) — `/api/cron/daily` listed `ƒ Dynamic`.
- **Plain-Node fixture** (scratchpad): `snapshotValues` against a `computeSprintMetrics` result —
  field pick + `healthCounts` passthrough (§9 shape), and the summed-over-teams totals equal
  `aggregateRollup`'s (the §9 "org totals = sum over teams" contract).
- **Live checks on dev+Neon** (fabricated ACTIVE sprint + 2 teams w/ filters + 1 team w/o,
  fabricated Issue/progress rows; torn down after):
  - no/wrong `Authorization` → 401; correct secret → 200 + summary.
  - `SprintSnapshot` rows appear for exactly the 2 filter-bearing teams (skipped team absent);
    values match hand-computed metrics; PLANNING/CLOSED sprints produce no rows.
  - **Same-day re-run**: row count unchanged, values refreshed (mutate a progress row between
    runs and see `avgProgress` move).
  - **Dead-credential path** (the stored token is conveniently still dead unless Naveen's
    re-login landed): summary reports the refresh skip/error **and snapshot rows still land**.
  - `CRON_SECRET` unset → loud 500-style failure, nothing written.
- ⚠️ Carry-over acceptance (unchanged, still Naveen's): fresh classic token → `/login` → real
  sync — after which a cron run exercises the **refresh-success** path against real Jira.

### Out of scope

- **Trend/burndown/velocity-from-snapshots UI** — master plan step 10 (post-v1: "burndown/trend
  UI from snapshots"); §5's trend row gains a data-side note only.
- **Replacing §12's naive linear velocity** with snapshot actuals — same step-10 item.
- **Per-team sync buttons on `/rollup`** — parked in ed-rollup.md decision 6; the cron makes them
  redundant.
- **Redis read-cache** (§14.9's second half) — still optional/post-v1.
- **OAuth / service-principal Jira auth** — §13.2, unchanged.
- **Retention/pruning of old snapshots** — not needed at one row/team/day; revisit post-v1.

## Doc-sync (§17 — do in the same PR)

- **§5 "Trend / burndown" row** → **[PARTIAL]**: daily per-team `SprintSnapshot` written by the
  step-7 cron (date); the *UI* remains unbuilt (step 10) — do not over-claim the row BUILT.
- **§8 diagram line** "Background sync (cron/queue)" → mark BUILT-in-`web/` with date; §8 stays
  [PLANNED] overall (Redis/Gemini still optional-future).
- **§12 velocity bullet** — note snapshot data now exists; the naive linear model is still what
  the UI computes (step 10 swaps it).
- **§14.8** → fixed-in-`web/` (data side) with date, pointing here; **§14.9** → partially
  addressed (background refresh into the cache exists; Redis still open).
- **§15.5** → BUILT-in-`web/` note with date.
- **Master plan step 7** → **[DONE date]** with a one-line as-built summary; update
  current-feature.md `**Next:**` pointers (step 8 share/export or step 9 importer).
- **Don't over-claim:** §7 stays the legacy snapshot; the legacy Vite app is unchanged; VP trend
  *UI* is still a GAP; the real-Jira acceptance run stays flagged until Naveen's token lands.

## References

- @context/project-overview.md — §2.2, §8 (background sync line), §9 (`SprintSnapshot` model +
  "write one row per day per team per active sprint" rationale; healthCounts JSON shape), §12
  (velocity caveat), §13.2 (per-user token visibility), §14.8/§14.9, §16 (hosting on internal
  infra), master plan step 7.
- @context/features/sync-hybrid-seeding.md — the engine this step drives; fail-fast dead-token
  behavior; sequential-filters rationale.
- @context/features/ed-rollup.md — 6b as-built: `healthCounts`/`totalIssues` added in the §9
  snapshot shape; `getRollupData` batching; "no Sync on the roll-up — freshness is step 7".
- `web/src/lib/sync/engine.js` — `syncTeamSprint({ teamId, sprintId, userId })` (header:
  "Called by the sync route now and the step-7 cron later"); error classes.
- `web/src/lib/metrics.mjs` — `computeSprintMetrics` (`totalIssues`/`healthCounts` since 6b),
  `aggregateRollup` (sum-over-teams contract for the fixture cross-check).
- `web/src/lib/dashboard-data.js` — `getRollupData`'s batched two-query pattern to mirror.
- `web/src/lib/jira/client.js` — `getJiraAuthForUser`, `fetchMyself`, error classes.
- `web/src/lib/api/route-helpers.js` — `{ error }` response convention.
- `web/prisma/schema.prisma` — `SprintSnapshot` (`@@unique([sprintId, teamId, capturedOn])`).
- `web/.env.example` — env/secret conventions (fail-loud precedent).
- Cron example (ops): `0 19 * * * curl -sf -X POST -H "Authorization: Bearer $CRON_SECRET" https://<internal-host>/api/cron/daily`
