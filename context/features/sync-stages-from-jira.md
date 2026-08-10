# Sync Jira status → delivery-matrix stages (per track)

> Post-v1 feature (not a master-plan step). Branch `feature/sync-stages-from-jira` off `main`.

## Overview

The delivery-matrix **stages** are a manual, per-ticket checklist. The app already knows how to
*derive* stages from Jira status — `buildSeededStages` (`src/lib/sync/seeding.mjs`) maps a raw Jira
status → a `stageCompletion[]` via the `StatusStageMapping` table — but the sync engine only applies
that to **new** `IssueProgress` rows (create-only; "manual edits win"). Once a row exists, no sync
ever advances its stages, so keeping the matrix in step with Jira meant hand-toggling every ticket.

This feature adds a **per-track "Sync stages" button** in the delivery matrix. For one track
(Roadmap / Tech Debt / External Bug / Internal Bug) it **pulls the latest Jira status** for that
filter, then **re-derives every one of its issues' stage checklists from that status**, overwriting
existing rows (behind a confirm). It is the user-triggered, per-track **overwrite** variant of the
"re-seed forward" reconciliation deferred in `sync-hybrid-seeding.md` decision 5.

## Decisions (confirmed with Naveen via AskUserQuestion, 2026-08-10)

1. **Overwrite, confirm first.** Recompute every ticket's stages from Jira status; a confirm dialog
   first states how many tickets have **manual** stage edits that will be replaced. (Alternatives
   offered and declined: "preserve manual edits only" and "overwrite silently".)
2. **A button per track.** Each filter's matrix section header carries its own "Sync stages" button
   — matches the "set of items (Roadmap / TechDebt / External / Internal)" framing. (Declined: one
   whole-sprint button; folding it into the global "Sync Jira".)
3. **Pull latest, then map.** One click refreshes *that filter* from Jira and then maps
   status→stages — a live Jira call scoped to the single filter, not the whole sprint. (Declined:
   map from the last "Sync Jira" cache.)

Derived design calls (not asked — followed existing invariants):
- **Non-destructive on unmapped status.** A status with no `StatusStageMapping` row never *wipes* an
  existing row — it is counted as `unmapped` and left as-is; a brand-new key still gets an all-false
  baseline (matches sync's create-only behavior). Surfaced in the toast so missing mappings are
  visible, not silent.
- **`updatedById` reset to null on overwrite.** The action writes stages as *status-derived*, not a
  manual edit, so it is **idempotent / re-runnable**: only hand-edits made *after* an apply count as
  "manual" next time (and drive the next confirm's count).
- **`blocked` / `blockedReason` / `riskComment` preserved** — only stage fields are touched.
- **Owning workflow honored.** A key living in several tracks still writes ONE progress row via
  `owningWorkflowType` (feature > techdebt > support > internal-bug), sized by that workflow.
- **CLOSED sprints blocked** (409) — same leaderboard-freeze guard as the full sync.

## Scope / implementation

**Backend**
- `src/lib/sync/seeding.mjs` — new pure `resolveStageResync({ workflowType, jiraStatus, mappings,
  existing })` → `{ stages, seededFromStatus, unmapped, write, overwroteManual }`. Encodes the
  overwrite/skip/baseline decision; unit-fixtured (no Jira needed).
- `src/lib/sync/engine.js` — new `syncFilterStagesFromJira({ teamId, sprintId, filterId, userId })`
  next to `syncTeamSprint`, reusing `refreshFilterCache`, `buildSeededStages`, `owningWorkflowType`,
  `getJiraAuthForUser`/`fetchMyself`/`fetchFilter`/`searchIssues`, `transformJiraIssue`. Refreshes
  the one filter's cache, groups all cached issues by key for owning-workflow, then creates/updates
  `IssueProgress` in one transaction. Returns `{ filterId, filterName, total, applied, unmapped,
  overwroteManual }`.
- `src/app/api/teams/[teamId]/sprints/[sprintId]/filters/[filterId]/sync-stages/route.js` — new
  `POST`, no body, `requireTeamRole(teamId, TEAM_WRITER_ROLES)`; Jira-error mapping copied from the
  sync route (401/502), `ConflictError`→409 / `NotFoundError`→404 via `handleRouteError`.
  **+1 dynamic route (45 → 46 ƒ Dynamic).**

**Data**
- `src/lib/dashboard-data.js` — the progress `select` gains `updatedById`; `progressByKey` rows carry
  a derived `manuallyEdited: Boolean(updatedById)` (raw id dropped) to drive the confirm count.

**UI** (mirrors existing patterns; no new primitives)
- `src/components/dashboard/planner-panel.jsx` — a `canWrite`-gated ghost "Sync stages" button
  (`RefreshCw`) in each filter's section header; hidden for zero-stage (CUSTOM) tracks and empty
  tracks. Computes that track's `manualEdits` count from `progressByKey` and calls
  `onSyncTrackStages({ filterId, filterName, total, manualEdits })`.
- `src/components/dashboard/dashboard.jsx` — `handleSyncTrackStages` opens a confirm `<Dialog>`
  (`confirmStages` state, the admin `confirmingDelete` idiom; `tone="error"` when `manualEdits > 0`,
  and a red "N item(s) … will be replaced" line). `confirmSyncTrackStages` runs the same
  two-transition mutation as `handleSync` (`POST …/sync-stages` → `router.refresh()` + toast via
  `condenseStageSync`). Threaded `onSyncTrackStages` into `<PlannerPanel>`.
- No change to `issue-row.jsx` or `metrics.mjs` — stage arrays change; live-computed metrics
  (Sprint Health / Completion / At-Risk) move on refresh, which is the intended effect.

## Doc-sync

- This spec (new).
- `sync-hybrid-seeding.md` decision 5 + Out-of-scope — dated amendment (the deferred re-seed-forward
  now ships as this per-track overwrite; append, don't rewrite).
- `context/project-overview.md` — §5 "Update stages per work item" row note; §6 create-only note;
  §17 running-log Done entry; route count **45 → 46 ƒ Dynamic** (in the new dated entry only —
  prior dated entries keep their as-of numbers).
- `context/current-feature.md` — set as current feature; carry-forward baseline bumped to
  **46 ƒ Dynamic**.
- No `prisma/schema.prisma` / migration change (**9 migrations** unchanged).

## Status

**Done 2026-08-10.** Implemented across `src/lib/sync/seeding.mjs` (pure `resolveStageResync`),
`src/lib/sync/engine.js` (`syncFilterStagesFromJira`), the new
`.../filters/[filterId]/sync-stages/route.js`, `src/lib/dashboard-data.js` (`manuallyEdited`),
`src/components/dashboard/planner-panel.jsx` (per-track button), and
`src/components/dashboard/dashboard.jsx` (confirm dialog + handlers).

Verified:
- **`yarn lint` clean.**
- **Cold `rm -rf .next` DB/env-free build green** (`.env` genuinely moved aside, confirmed absent
  mid-build, restored) — **46 ƒ Dynamic** (was 45; exactly the one new route).
- **Pure fixtures 5/5** for `resolveStageResync` (mapped+manual → overwrite & flags manual; mapped+
  new → create; unmapped+existing → skip/preserve; unmapped+new → all-false baseline; mapped+
  seed-owned → overwrite, not flagged manual).
- **Guard smoke 4/4** against the live dev server (:3002) + Neon with minted iron-session cookies
  (fixtures torn down to 0 rows): unauthenticated → **401**, VIEWER → **403**, writer + unknown
  filter → **404**, writer + CLOSED sprint → **409** — all short-circuit before any Jira call.
- **`prisma validate` + `migrate status`**: 9 migrations, schema up to date, **no schema change**.

**Pending:** Naveen's real-browser acceptance (the Chrome extension has never been connected, so the
live Jira happy-path is his step) — click a track's "Sync stages", see the confirm with the
manual-edit count, confirm, verify stages fill from Jira status and Sprint Health/Completion move;
re-run to confirm idempotence and the "unmapped" count; check both Tekion + Modern themes.

## As-built notes (vs. the plan)

- Followed the plan's *optional* suggestion and **did extract** the pure `resolveStageResync` helper
  into `seeding.mjs` (testable without a live Jira call) — this is what the 5 fixtures cover.
- `applied` counts every row written (create + update), including no-op re-writes of already-correct
  rows; the toast reads "N items synced". `overwroteManual` (server) is informational; the confirm's
  count is computed client-side from `manuallyEdited` before the call.
- Guard smoke used `tsx` (present in the repo) to import the generated Prisma client; the script had
  to live at the **project root** (not the scratchpad) so bare imports resolve `node_modules`.
  Removed after the run. A pre-existing `pg` SSL-mode deprecation warning printed during the run
  (unrelated to this change).
- Session hazard hit and cleared: a stale dev server from a prior session was hung on :3002 after an
  earlier `yarn build` clobbered its `.next` (the documented hazard) — killed and restarted fresh
  before the smoke.
- **Design polish pass (2026-08-11, `/impeccable`).** Three fixes Naveen flagged: (1) the matrix
  "Sync stages" button had no pointer cursor — added `cursor-pointer` locally (the incumbent
  convention; the shared `Button` cva deliberately omits it and `filter-panel`/`issue-row`/`checkbox`
  add it per-use), plus `h-7`/`px-2` + a `size-3.5` icon for cleaner icon↔label alignment in the
  small header. (2) The confirm body dropped the space before "and" ("Tech Debt**and**") — a JSX
  whitespace collapse; rewritten with explicit `{" "}` tokens between every inline boundary and
  tighter copy ("…and set their delivery stages from it. · N of them have manual stage edits that
  will be overwritten."). (3) The confirm's primary button now renders `variant="destructive"`
  (red) when `manualEdits > 0`, matching the dialog's error tone. Verified with a headless-Chrome
  (Playwright) round on the live server against Neon fixtures (desktop 1280 + mobile 390): computed
  `cursor === "pointer"` on both, dialog innerText confirmed the space is present, and screenshots
  of both viewports read clean; fixtures torn down. Presentation-only (className/copy/one variant
  prop) over the already-build-verified implementation — `yarn lint` clean, impeccable
  `detect.mjs` → `[]`.

## References

- `sync-hybrid-seeding.md` (the create-only hybrid model this extends) · `domain-apis.md` (route
  + RBAC conventions) · `src/lib/workflows.mjs` (stage templates, priorities) · `prisma/seed.mjs`
  (the 45 global `StatusStageMapping` rows this maps against).
