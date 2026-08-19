# Scrum-team member roster + auto "Needs attention" (untagged items) board track

**Status:** **Done 2026-08-12.** Branch `feature/needs-attention-roster`, off `main` @ `4f4d295`
"Default view." (baseline **47 ƒ Dynamic routes / 10 migrations**; the sibling `default-team-release`
is merged). **Uncommitted** — pending Naveen's commit (gitleaks hook). Post-v1, not a master-plan step.

Implemented: `Team.memberEmails String[]` + `WorkflowType.NEEDS_ATTENTION` (migration
`add_member_emails_and_needs_attention_workflow`, **10 → 11**); `buildNeedsAttentionJql` +
`emptyClause`/email-quote in [track-jql.mjs](../../src/lib/sprint-start/track-jql.mjs);
`WORKFLOWS.NEEDS_ATTENTION` (stages `[]`, non-seedable); a one-line additive §12 guard in
[metrics.mjs](../../src/lib/metrics.mjs); [ensure-filter.js](../../src/lib/needs-attention/ensure-filter.js)
wired into `syncTeamSprint` (auto-generate/refresh/delete); NA-exclusion in progress-seeding;
partition in [dashboard-data.js](../../src/lib/dashboard-data.js); admin roster editor in
[team-config-dialog.jsx](../../src/components/admin/team-config-dialog.jsx); board
[needs-attention-panel.jsx](../../src/components/dashboard/needs-attention-panel.jsx) (populated /
all-clear / manager config-prompt states + a **"View in Jira"** deep-link).

Verified: **`yarn lint` clean**; **7/7 pure fixtures** (exact JQL + the byte-identical §12 no-op proof);
**cold `rm -rf .next` DB/env-free build compiled, 47 ƒ Dynamic routes unchanged**; `migrate status`
up-to-date (**11 migrations**); **live-Jira E2E** — `assignee in ("naveens@tekion.com")` returned **17
real untagged GM items**, sync cached them, the panel rendered with chips; **deletion-bug regression +
manager-prompt + Jira-link SSR checks pass** on the running server (throwaway rows, torn down to 0).

## Problem

Every existing team track scopes its Jira issues by the custom field
`"sub-component[dropdown]" IN (team's claimed sub-components)` (see `buildAllTrackJql` in
[`src/lib/sprint-start/track-jql.mjs`](../../src/lib/sprint-start/track-jql.mjs)). That has a blind
spot: an issue that **should** belong to the team but carries **no sub-component tag** (and/or no fix
version) falls through *every* filter and is invisible on the board — nobody notices it needs
triage/tagging. The reliable alternative identity for those orphaned items is the **assignee**, but
nothing today stores which developers belong to a team: `TeamMembership` is RBAC and only holds
signed-in app users, and `Team.developerCount` is just an integer.

Naveen: *"add all team members in a scrum team in admin screen — this will help identify items
without the subcomponent, fix version that should potentially need attention … configure/set the
email id of scrum team members in admin, and have a new filter in each scrum team's board for
potential items needing subcomponent addition."*

## Ratified decisions (AskUserQuestion, 2026-08-11)

1. **Filter scope — sub-component OR fix version.** The track surfaces items assigned to the roster
   that are missing a sub-component **or** a fix version (the broad hygiene net), not sub-component
   alone.
2. **Trigger — always present, auto-refreshed.** The track is built and kept fresh automatically by
   every sprint **Sync** + the **daily cron** whenever the team has a roster; there is **no button to
   click**. This is why the feature adds **no new API route** — generation folds into
   `syncTeamSprint`.

**Design tool:** the two UI surfaces (admin roster editor + board "Needs attention" panel) are built
with `/impeccable:impeccable` per the request.

## Design

A real `Filter` row of a new dedicated `WorkflowType.NEEDS_ATTENTION`, generated/refreshed inside the
existing sync engine, cached like any track, then **excluded from all §12 metrics** by one additive
guard and **partitioned out** of the board's normal filter list for separate rendering. The roster is
a `String[]` on `Team`, edited through the existing team create/edit route (no new route).

- **Why a real Filter** (not a synthetic per-render list): it reuses the whole sync path
  (`searchIssues → transformJiraIssue → refreshFilterCache`) so untagged items get cached for free; a
  synthetic approach can't work anyway — those items are by definition absent from every other
  filter's cache.
- **Why a dedicated enum value** (not reused `CUSTOM`): the enum value is the single explicit marker
  used to (i) exclude from metrics, (ii) partition for rendering, (iii) upsert one-per-sprint, and
  (iv) skip stage seeding.

### Schema (migration `add_member_emails_and_needs_attention_workflow`, 10 → 11 migrations)

- `Team.memberEmails String[]` — admin-entered Jira assignee identities; **distinct from
  `TeamMembership`** (grants no app access; not required to be signed-in users).
- `enum WorkflowType` gains `NEEDS_ATTENTION`. Kept out of `SEEDABLE_WORKFLOW_TYPES`; `WORKFLOWS`
  entry has `stages: []` (renders as a plain issue list, no stage columns). Migration is the column
  add + `ALTER TYPE ... ADD VALUE` only — the new value is not referenced in the same migration (NA
  rows created at runtime).

### JQL (`buildNeedsAttentionJql`, pure, in `track-jql.mjs`)

```
assignee in ("a@x.com", "b@x.com") AND project in (GM)
  AND ("sub-component[dropdown]" IS EMPTY OR fixVersion IS EMPTY)
  AND statusCategory != Done
  ORDER BY updated DESC
```

New helpers: `emptyClause(field)`, an **always-quote** email path (existing `quoteIfNeeded` only
quotes on whitespace — emails would render bare and break `assignee`). **Guard:** returns `null` when
`memberEmails` or `projectKeys` is empty — never an unbounded `assignee in ()` or a project-less scan.

### Auto-generation (`syncTeamSprint`)

A new `src/lib/needs-attention/ensure-filter.mjs` helper: given `tx`, `team`, `sprint` — if roster +
`jiraProjectKeys` non-empty, **upsert** the single NA Filter for `(teamId, sprintId,
NEEDS_ATTENTION)` (create via `insertFilterAtPriority`, else update its `jql`); if the roster is
empty, **delete** any existing NA filter (so clearing the roster removes the track). Wired into
`syncTeamSprint` before the per-filter fetch loop, so the existing loop caches its issues with no
other change. Progress-seeding read excludes `NEEDS_ATTENTION` (untagged items never spawn
`IssueProgress`). CLOSED sprints are never generated (unchanged rejection).

### Metrics guard (`metrics.mjs`)

One additive line at the top of `computeSprintMetrics` filtering out `NEEDS_ATTENTION`, shielding all
call sites (dashboard, rollup, share, leaderboard, cron snapshot, ai-digest) at once. Provably a
no-op on existing fixtures (no NA filters exist today).

### Rendering

- `getDashboardData` partitions the fetched filters: `filters` = non-NA (feeds
  `FilterPanel`/`PlannerPanel`/search/export unchanged); `needsAttentionTrack` = the single NA filter
  + its issues (or `null`).
- `needs-attention-panel.jsx` (new, `/impeccable`): an attention-toned list — Jira key, title,
  assignee, type, status — one hygiene chip per row derived **with no schema change**:
  `fixVersions == null` → "No fix version", else → "No sub-component". States: populated · "No
  untagged items" · zero-config ("Add team member emails in Admin"). Rendered below `PlannerPanel`.

### Admin roster editor (`team-config-dialog.jsx`, `/impeccable`)

A "Scrum team member emails" field (chip / newline-or-comma input), `parseEmails` helper
(trim/lowercase/dedupe, mirrors `parseIssueTypes`), in the existing team POST/PATCH body — no route
change. Helper copy clarifies it is distinct from team membership/roles.

## Scope / invariants

- **Additive to §12** — the only `metrics.mjs` change is a provably no-op guard; `IssueProgress` /
  `SprintSnapshot` untouched.
- **No new route** — 47 ƒ Dynamic stays 47. **One additive migration** — 10 → 11.
- No RBAC change; roster edited via the existing admin team route (`requireAdmin`). No cookie /
  localStorage-key change; no new dependency.
- Reuses `insertFilterAtPriority`, `accentColorForIndex`, `SUB_COMPONENT_FIELD`/`compareClause`,
  `getJiraAuthForUser`/`searchIssues`/`refreshFilterCache`.

## Deep-test findings & fixes (2026-08-11, post-first-run)

- **Filter-deletion bug (severe, FIXED).** `ensure-filter.js` matched the NA row via
  `WorkflowType.NEEDS_ATTENTION`; under a stale/partially-hot-reloaded generated client that enum
  member is `undefined`, Prisma strips it from the `where`, and the roster-empty delete branch then
  removed an arbitrary REAL track. Confirmed against Aug/Sep data (missing tracks with `sortOrder`
  gaps). Fixed: match on the **string literal** `"NEEDS_ATTENTION"` (never undefined) in both
  `ensure-filter.js` and `engine.js`, and delete via **`deleteMany` scoped by `workflowType`** so the
  DB applies the constraint at delete time — structurally incapable of removing a real track.
  Regression-tested (3/3). `IssueProgress` survived (decoupled §9), so re-running Sprint Start on the
  affected teams restores tracks + reattaches progress. Affected: PCX/DX/INT (Aug), CALM (Sep).
- **Missing import (FIXED).** `engine.js` used `WorkflowType.NEEDS_ATTENTION` without importing it →
  `ReferenceError` at runtime (post-Jira-auth, so fresh-process smokes missed it). Now uses the string.
- **Discoverability (FIXED).** The panel was invisible until a roster was set AND a sync ran, with no
  on-screen hint — so a manager saw nothing. The panel now renders a **manager-only prompt** ("Add
  your scrum team's member emails in Admin, then Sync Jira") when no track exists yet; viewers still
  see nothing. Verified over SSR (manager sees prompt, viewer doesn't, populated panel intact).
- **Server-side dedupe (FIXED).** `memberEmails` zod now `.transform`-dedupes (each already
  lowercased) so a direct API call can't persist case-variant duplicates.
- **Assignee-by-email JQL CONFIRMED working on Tekion Jira** (risk #1 cleared) — `assignee in
  ("naveens@tekion.com") AND project in (GM) AND (…IS EMPTY…)` returned 17 real untagged items; full
  sync cached them and the panel rendered with chips. Root cause of "can't see it": **no team had a
  roster set** (all `[]`) — the feature was simply dormant, now discoverable via the prompt.

## Results (2026-08-11)

- `yarn lint` clean.
- **7/7 pure-Node fixtures**: `buildNeedsAttentionJql` exact strings (quoted emails, `IS EMPTY`,
  parenthesized OR, `statusCategory != Done`, `ORDER BY updated DESC`), dedup/normalization, guarded
  `null`; and the **§12 no-op proof** — `computeSprintMetrics([...real, NA])` is `deepEqual` to
  `computeSprintMetrics([...real])` (byte-identical), NA issues absent from `points`/`issues`.
- **Cold `rm -rf .next` DB/env-free build** green with `.env` moved aside + confirmed absent
  mid-build, restored after; **47 ƒ Dynamic routes unchanged** (no new route).
- `prisma migrate status` clean; migration SQL is exactly `ALTER TYPE ... ADD VALUE 'NEEDS_ATTENTION'`
  + `ALTER TABLE "Team" ADD COLUMN "memberEmails" TEXT[]`; client regenerated (**11 migrations**).
- **4/4 DB smoke** (tsx + real Neon, fixtures torn down to 0): `ensureNeedsAttentionFilter`
  create → roster-edit-updates-in-place (no dup) → clear-roster-deletes; `getDashboardData` partitions
  NA out of `filters` into `needsAttentionTrack` and `metrics.points` excludes the NA issue.
- **Pending Naveen (live Jira token + connected browser):** a real Sync generating the NA track from
  the roster JQL, untagged items rendering with correct chips in both Tekion + Modern themes.

## As-built notes (vs. the spec)

Deviations and hard-won details the plan didn't anticipate — read these before touching this code:

- **Baseline re-based.** Planned off `5e96703` (46 routes / 9 migrations); actually branched off
  `4f4d295` "Default view." (the sibling feature had merged) → **47 routes / 10 migrations** baseline,
  so this feature is **10 → 11 migrations, routes unchanged**.
- **Never reference `WorkflowType.NEEDS_ATTENTION` (the enum object) in a Prisma `where`.** The plan
  used it; it caused **two production bugs**: (1) a `ReferenceError` in `engine.js` (the import was
  missing — lint doesn't flag `no-undef` here, and the line only runs post-Jira-auth so fresh-process
  smokes missed it); (2) **worse** — under a stale/partially-hot-reloaded generated client the enum
  member is `undefined`, Prisma **strips undefined keys from a `where`**, widening `findFirst` to "any
  filter", and the roster-empty **delete branch then deleted real tracks**. Both `ensure-filter.js`
  and `engine.js` now use the **string literal `"NEEDS_ATTENTION"`** (matching `metrics.mjs`/
  `dashboard-data.js`), and the NA delete is **`deleteMany` scoped by `workflowType`** so it is
  structurally incapable of removing a real track. Real tracks were deleted in Aug/Sep during the buggy
  window — recover by re-running One-Click Sprint Start (progress reattaches, §9 decoupling).
- **Discoverability added (not in the original plan).** The track is invisible until a roster is set
  *and* a sync runs, which read as "broken". The panel now shows a **manager-only config prompt** when
  no track exists (viewers see nothing). Wired via the already-available `can.manage`; no dashboard-data
  change needed.
- **`memberEmails` zod dedupes server-side** (`.transform([...new Set])`) — the UI dedupes but a direct
  API call shouldn't persist case-variant duplicates. `buildNeedsAttentionJql` also dedupes defensively.
- **"View in Jira" deep-link** (added on request) — `{JIRA_BASE_URL}/issues/?jql=<encoded NA jql>`,
  shown whenever the track exists (populated + all-clear).
- **Risk #1 (assignee-by-email JQL) is CLEARED** — Tekion Jira resolves `assignee in ("email")`
  (17 real items for a live user). Risk #4 (>2000-item cap throws the sync) remains **unmitigated** —
  bounded by `statusCategory != Done` + single-team rosters; revisit only if hit.
- **JSX whitespace:** React collapses spaces adjacent to inline elements under this Turbopack/RSC
  setup — use explicit `{" "}` at every `<strong>`/`<Link>` boundary (bit us twice).
- **Verification lesson:** fresh-process/isolated smokes with a fresh Prisma client passed while the
  *running* dev server failed (stale client). Always exercise the **running server** and the
  **post-Jira-auth** code paths, not just clean-room fixtures.

## Verification plan (no test suite → fixtures + smoke; always `rm -rf .next` first)

1. Pure-Node JQL fixtures for `buildNeedsAttentionJql` (exact string; empty roster/projectKeys →
   guarded null).
2. §12 no-op proof — existing `computeSprintMetrics` fixtures byte-identical before/after the guard.
3. DB/env-free build green with `.env` absent; **46 ƒ Dynamic** unchanged.
4. `prisma migrate status` clean; enum value present; client regenerated.
5. API/engine smoke (minted iron-session cookie, teardown after): `PATCH /api/teams/[id]` persists +
   normalizes `memberEmails`; `syncTeamSprint` on a fresh sprint creates one NA filter + caches
   issues; a second sync after a roster edit updates the same filter (no dup); clearing the roster
   deletes the NA filter; CLOSED sprint unaffected.
6. SSR smoke `GET /` — NA panel renders with chips; MetricGrid / velocity / leaderboard totals
   unchanged vs. before NA existed.
7. Regression — `/rollup`, `/share/[token]`, ai-digest, daily-cron snapshot all exclude NA.
8. Live acceptance (Naveen, browser): real roster → Sync → untagged items appear with correct chips,
   both themes.

## Risks

1. **Emails-vs-accountId in JQL (highest):** if Tekion hides assignee emails, `assignee in (emails)`
   silently returns nothing. Fallback = a new `searchUsersByEmail` client method
   (`GET /rest/api/3/user/search?query=<email>`) → accountIds. Out of v1 (single internal tenant →
   emails almost certainly visible); validate on Naveen's first live Sync.
2. **Badge imprecision:** an item missing **both** fields badges only "No fix version" (sub-component
   isn't cached). Acceptable v1; precise dual-badging is the documented follow-up (add
   `Issue.subComponent`, reuse `bug-report/sub-component-field.mjs`, add one `/field` fetch to sync).
3. **Unbounded JQL** — guarded in both the builder and the ensure-helper.
4. **`SEARCH_MAX_ISSUES` (2000)** — a broad roster with many untagged items could exceed it; tighten
   `statusCategory` or raise `maxIssues` for the NA search if hit.
5. **Scope excludes ENG/external bugs** — NA scopes to `team.jiraProjectKeys` (the team's own
   project); untagged external (ENG) bugs are already served by the bug board's "Unassigned" bucket.
   Deliberate v1 bound.

## References

- Plan: `/Users/naveen/.claude/plans/let-s-build-a-feature-flickering-journal.md`
- [one-click-sprint-start.md](one-click-sprint-start.md) — the JQL builder + `insertFilterAtPriority`
  + sync-then-tolerate-error precedent this mirrors.
- [sync-stages-from-jira.md](sync-stages-from-jira.md), [sync-hybrid-seeding.md](sync-hybrid-seeding.md)
  — sync engine conventions.
- [enhancing-bug-board.md](enhancing-bug-board.md) — sub-component field discovery (`JIRA_SUBCOMPONENT_FIELD_ID`,
  `bug-report/sub-component-field.mjs`) for the documented dual-badging follow-up.
- [committed-unplanned-work.md](committed-unplanned-work.md) — precedent for an additive display lens
  that never touches §12 metrics.
