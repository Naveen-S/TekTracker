# Jira Sync with hybrid stage seeding (migration step 5)

## Overview

**Production Migration Plan step 5**, verbatim: *"port the Jira client (keep field IDs/pagination
isolated in one module); on sync, upsert the Issue cache and create missing IssueProgress rows
seeded via StatusStageMapping; never touch rows that already exist."*

This is the feature that makes the **hybrid stage model real** — "the single most important product
decision" (§6, ratified 2026-06-10): stage checklists get *seeded* from Jira status on first sight
of an issue, and manual edits win forever after. It is also what makes step 6 (UI port) properly
testable — the delivery matrix has nothing to render until sync fills the Issue cache — and it
completes the fix for flaw **§14.7** (hardcoded Jira field ids → per-team config, columns already
in §9's `Team`).

Concretely: `POST …/sync` for a team+sprint fetches every filter's issues from Jira Cloud (using
the **caller's** stored credential), replaces that filter's `Issue` cache, creates missing
`IssueProgress` rows seeded via `StatusStageMapping`, re-evaluates owning workflows, and returns
the added/removed diff the prototype's sync toast showed.

Sources to port: [src/jiraService.js](../../src/jiraService.js) (`fetchFilterDetails`,
`searchAllIssues` pagination, `transformJiraIssue`, field lists),
[server.js:243-315](../../server.js#L243-L315) (`/api/jira/filter/:id`, `/api/jira/search` →
Jira `/rest/api/3/search/jql` with `nextPageToken`), and the sync-diff behavior of
`handleSyncAll` ([useSprintData.js:64-150](../../src/hooks/useSprintData.js#L64-L150)).

## Status

**Done 2026-07-07** (with one ⚠️ external blocker, below). Implemented all of (a)–(e): client growth
(`getJiraAuthForUser`/`fetchFilter`/`searchIssues`), pure `transform.js`, `sync/engine.js` + pure
`sync/seeding.mjs`, `schemas/jira.js`, the `POST …/sync` route, and `owningWorkflowType` moved into
`workflows.mjs` (shared with the step-4 progress route). Decisions 1–10 implemented as proposed.
**Verified:** `yarn lint` clean; `yarn build` green + DB/env-free (sync route `ƒ Dynamic`); **15
standalone checks** (transform edge cases incl. per-team/legacy points fields + all three sprint-field
shapes; seeding prefixes, case-insensitivity, team-over-global, CUSTOM; reshape 10↔4; owning
priority); **full pipeline verified over real HTTP** — the dev server synced a mock Jira serving the
exact `/search/jql` + `/filter/{id}` contract: 2-page pagination, JIRA_FILTER jql refresh (name kept),
seeded shapes in Neon (`In Progress`→4×true, `Code Review`→6×true, unmapped→all-false +
`seededFromStatus:null`, owning FEATURE for a key in two filters), create-only re-sync (0 reseeded),
manual edit survives re-sync, removed issue keeps progress + loses cache, owning-workflow re-eval
FEATURE→SUPPORT with 10→4 reshape, VIEWER 403 / no-cookie 401, non-admin MEMBER can sync.
**Real Tekion Jira:** live `/search/jql` round-trip verified (200s), and an invalid JQL correctly
surfaced as the mapped 502. **Corrected finding (2026-07-07, follow-up probe):** the stored token is
**dead** (expired or revoked — `/myself` now 401s though it passed at login on 2026-06-29), and Jira
**silently degrades invalid Basic auth to ANONYMOUS** on endpoints that permit it — which is why
`project/search` and even `search/jql` returned 200-with-zero instead of 401 (verified: a no-auth
request behaves identically). Whether Naveen's *account* can browse projects is therefore **still
unknown**. This exposed a real gap — a dead token made sync look successful-but-empty — **fixed
same-day:** the engine now validates via `/myself` before syncing (the only endpoint that reliably
rejects) and returns `401 "Stored Jira token is invalid or expired — log in again to reconnect"`;
verified live against the dead credential. ⚠️ **Action for Naveen:** create a fresh API token
(id.atlassian.com → Security → API tokens; pick a long expiry, classic/unscoped), `POST
/api/auth/login` with it, then re-run a real sync — that will also finally answer the
project-visibility question. All test data cleaned from Neon; tmp harnesses deleted. **Next:** UI
port (step 6) or importer (step 9).

## Decisions (PROPOSED 2026-07-07)

1. **Trigger: `POST /api/teams/[teamId]/sprints/[sprintId]/sync`** — syncs **all** of that
   team+sprint's filters in one call (parity with the prototype's single "Sync Jira" button /
   `handleSyncAll`). No per-filter sync in v1. The orchestration lives in
   **`web/src/lib/sync/engine.js`**, not the route, so the step-7 cron reuses it unchanged.
2. **Credentials: the caller's `JiraCredential`, decrypted per request.** Per-user tokens mean
   per-user visibility (§13) — you sync what *your* token can see. `getJiraAuthForUser(userId)`
   loads + `decryptToken`s the credential; **no stored credential → 401** with a "reconnect your
   Jira account" message (re-login re-writes it).
3. **RBAC: `TEAM_WRITER_ROLES` may sync** (everyone but VIEWER). Sync never destroys product data
   (`IssueProgress` is create-only here), and the prototype's Sync button was for the whole team.
4. **Cache refresh is per-filter replace-by-diff**: upsert `Issue` by `(filterId, jiraKey)`,
   **delete** cached rows whose keys the filter no longer returns, set `Filter.lastSyncedAt`.
   The route returns `{ filters: [{ id, name, total, added, removed }], progressSeeded,
   workflowsReevaluated }` — the data behind the prototype's added/removed toast. Progress rows are
   untouched by cache deletion (§9 decoupling).
5. **Seeding is CREATE-ONLY (§9 rule, "never touch rows that already exist").** For each cached
   issue with no `IssueProgress` row: look up `StatusStageMapping` for (owning workflowType, raw
   Jira status) — **team-specific row wins over global (`teamId null`)**, matched
   case-insensitively; found → check stages `0..stageIndex` (the checklist rule); no row → all
   `false`. Set `seededFromStatus` = the raw status (or `null` when no mapping matched — record
   only what actually seeded). Existing rows are never re-seeded — manual edits win. *Deferred
   enhancement (noted, not built): re-seed forward if a row still exactly equals its seeded
   baseline; revisit after real usage.*
6. **Owning-workflow re-evaluation on sync (§9).** After the cache refresh, recompute the owning
   workflow (highest-priority filter containing the key) for every progress row in the team+sprint;
   if it changed, update `workflowType` and **pad/truncate `stageCompletion`** to the new length
   (prefix preserved — same shape rule as seed.md). 4-stage ↔ 4-stage moves keep booleans intact;
   only the enum label changes. Rows whose key no longer appears in ANY filter keep their last
   `workflowType` untouched (progress survives, §9).
7. **Per-team field ids with global defaults** (fixes §14.7 in `web/`):
   `Team.storyPointsFieldId ?? "customfield_10008"` (legacy `customfield_10016` read as fallback
   when the primary is null on the issue) and `Team.sprintFieldId ?? "customfield_10020"`. The
   requested `fields` list is built from these — all field specifics stay in the Jira module (§17).
8. **Jira responses are zod-validated at the boundary** (§17) with *loose* schemas — required keys
   only (`key`, `fields.summary`, `fields.status.name`, …), everything else passthrough; a
   malformed page fails the sync loudly rather than caching garbage.
9. **JIRA_FILTER-sourced filters re-fetch the Jira filter first** (`/rest/api/3/filter/{id}`) and
   search on its **current** jql, refreshing our `Filter.jql` copy (prototype behavior); the local
   display `name` is NOT overwritten (the team may have renamed their track). JQL-sourced filters
   search their stored `jql` directly.
10. **Fetching is sequential per filter** (a team has ~4 tracks; no parallel burst against Jira
    rate limits). A Jira 429/5xx fails that sync with a readable `{ error }` — retry/backoff and
    ED-scale caching are step 7/Redis concerns.

## Requirements

### Scope

**(a) Jira client growth — `web/src/lib/jira/client.js`** (stays the single Jira-specifics module)
- `getJiraAuthForUser(userId)` → `{ baseUrl, email, token }` from `JiraCredential` +
  `decryptToken`; throws a typed `JiraCredentialMissingError` (route maps → 401 "Reconnect Jira").
- `fetchFilter({ auth, filterId })` → `{ id, name, jql }` (GET `/rest/api/3/filter/{id}`).
- `searchIssues({ auth, jql, fields })` → raw issue array; ports the prototype's pagination loop
  (POST-style params against **`/rest/api/3/search/jql`**, `maxResults` 100, `nextPageToken`,
  `isLast`) — verify the exact request shape against [server.js:273-315](../../server.js#L273-L315)
  (the legacy proxy already speaks the new `/search/jql` endpoint).
- Reuse `JiraAuthError` (401/403 → caller's 401); 429/5xx → typed `JiraApiError` (route → 502-ish
  `{ error }`, decision 10).

**(b) Transform — `web/src/lib/jira/transform.js`**
- `transformJiraIssue(raw, { storyPointsFieldId, sprintFieldId })` → the `Issue` cache columns:
  `jiraKey`, `title`, `issueType`, `jiraStatus` (raw name), `assigneeName`, `assigneeAccountId`,
  `storyPoints` (per-team field, legacy fallback), `priority`, `dueDate` (real `DateTime`),
  `jiraSprintName` (array/object/legacy-string handling ported from
  [jiraService.js:195-208](../../src/jiraService.js#L195-L208)), `fixVersions` (joined names).
- **Upgrades over the prototype** (its localStorage shape was lossy — see seed.md): keep the
  **full** assignee `displayName` (not first-name-only) + `accountId`; keep `priority`; keep
  `dueDate` as a real date. The prototype's derived `status`/`stage`/`percent` fields are **not
  ported** — they were effectively unused (§6); stage truth is `IssueProgress`.
- Pure function, no DB/fetch — unit-testable standalone.

**(c) Sync engine — `web/src/lib/sync/engine.js`**
- `syncTeamSprint({ teamId, sprintId, userId })`:
  1. Load team (field ids), the team+sprint's filters, and the caller's Jira auth.
  2. Per filter (sequential): resolve jql (decision 9) → `searchIssues` → transform → in ONE
     `prisma.$transaction`: upsert/delete the filter's `Issue` rows (decision 4), bump
     `lastSyncedAt`, collect added/removed keys.
  3. Seed missing `IssueProgress` rows (decision 5) using the owning workflow across the just-synced
     cache (same derivation as the progress route) + the `StatusStageMapping` lookup
     (team-over-global, case-insensitive).
  4. Re-evaluate owning workflows for existing rows (decision 6).
  5. Return the summary object (decision 4).
- Mapping/seeding helpers (`buildSeededStages(workflowType, jiraStatus, mappings)`) exported for
  standalone testing; `WORKFLOWS`/`stageCountFor` from `workflows.mjs` stay the stage-shape source.

**(d) Route — `web/src/app/api/teams/[teamId]/sprints/[sprintId]/sync/route.js`**
- `POST`, `force-dynamic`, guard `requireTeamRole(teamId, TEAM_WRITER_ROLES)` + sprint existence;
  no body. Calls the engine; maps typed errors via `handleRouteError` (+ the two new Jira error
  mappings). Everything else (RBAC freshness, `{ error }` contract) as per domain-apis.md.

**(e) No schema change, no new deps, no new env.** (`JIRA_BASE_URL` already exists; per-team field
ids are existing nullable columns.)

### Mechanism / gotchas

- **The Jira search API moved**: old `/search` is deprecated in favor of `/search/jql` with
  `nextPageToken` — the legacy proxy already uses it ([server.js:297](../../server.js#L297)); port
  that shape, not training-data memory. Same doc-check discipline as steps 3–4.
- **Multiple filters can return the same key** (one progress row, several cache rows) — seed ONCE
  per key using the owning workflow, not once per filter.
- **CUSTOM workflow**: no stages, no mappings (seed skips it) → `stageCompletion: []`, no seeding.
- **Case-insensitive status match**: mappings store canonical casing; compare lowercased at lookup.
- **Transactions**: cache replace per filter is atomic; seeding + re-evaluation batched (createMany
  where possible). Don't hold one giant transaction across network calls — fetch first, then write.
- **Neon/pg adapter**: the engine runs inside a route (request-time only); build stays DB/env-free
  (`force-dynamic`, no module-level env reads).

### Acceptance criteria

Pure parts verified standalone; the live path needs real creds (Naveen), mirroring auth's split.

- **Standalone (scratch-tested, no Jira):** `transformJiraIssue` handles assignee/points-fallback/
  sprint-field shapes (array/object/legacy string)/missing fields; `buildSeededStages` checks
  `0..stageIndex` per mapping (FEATURE "In Progress" → 4×true+6×false; unmapped status → all-false;
  team override beats global); owning-workflow re-eval pads/truncates correctly.
- **Live (real creds + Neon):** sync a real filter/JQL → `Issue` rows populated (title, raw status,
  points, full assignee name + accountId, priority, dueDate); `IssueProgress` rows created with
  correct seeded prefixes and `seededFromStatus`; **re-sync changes nothing** on progress
  (create-only) and reports added/removed correctly after the JQL changes; a manually-edited row
  (via the step-4 progress API) **survives re-sync**; an issue leaving the filter keeps its
  progress row but loses its cache rows; `lastSyncedAt` set; VIEWER → 403; a user with no
  credential → 401 "reconnect".
- **Hygiene:** `yarn lint` + `yarn build` green, build DB/env-free, new route `ƒ (Dynamic)`.

### Out of scope

- **Background/cron sync + daily `SprintSnapshot`** — step 7 (the engine is built to be called by
  it).
- **Re-seed-forward** for untouched seeded rows (decision 5's deferred enhancement).
- **Issue-detail endpoint, dashboard/scrape proxy routes** (legacy `server.js` extras — port only
  if the UI (step 6) turns out to need them).
- **Rate-limit retry/backoff, Redis caching, webhooks** (step 7+ / §15).
- **OAuth 3LO** (§13, deferred) — credential loading stays isolated in the client module for the
  eventual swap.

## Doc-sync (§17 — same PR)

- **§5 "Sync Jira" row**: note built in `web/` too (server-side engine + route, with hybrid
  seeding; legacy row stays for the Vite app).
- **§6 "Critical design decision" block**: the recommended hybrid model is now **implemented in
  `web/`** — stages seed on first sync, manual edits win; update the warning to legacy-only.
- **§14.2** (stages manual, sync doesn't touch them): fixed in `web/`; **§14.7** (hardcoded field
  ids): fixed in `web/` (per-team columns consumed).
- **Production Migration Plan step 5**: record done + as-built decisions.
- **§7 stays as-is** (legacy snapshot). Fill "As-built deviations" below; update
  current-feature.md.

## As-built deviations from the spec

- **`buildSeededStages`/`reshapeStageCompletion` live in `lib/sync/seeding.mjs`, not the engine** —
  the engine's import chain (db → generated client, rbac → auth → `next/headers`) can't load outside
  Next, so the pure helpers were split into an `.mjs` module (relative import of `workflows.mjs`,
  same plain-Node reasoning as bootstrap-seed). The engine re-imports them.
- **`owningWorkflowType` moved to `workflows.mjs`** and the step-4 progress route was refactored to
  import it — one derivation shared by both writers, per the spec's "must agree" note.
- **Cache replace is delete-all + `createMany`**, not per-row upserts — identical end state (nothing
  references `Issue.id`), fewer queries; the added/removed diff is computed from key sets first.
- **2000-issue safety cap** in `searchIssues` (throws a readable `JiraApiError`) — protects against
  an accidentally org-wide JQL flooding the cache.
- **Jira error mapping lives in the sync route** (credential-missing/auth → 401, `JiraApiError` →
  502), keeping `route-helpers.js` free of Jira imports.
- **Seeded rows have `updatedById: null`** — seeding is not a manual edit; attribution starts with
  the first human write.
- **zod 4 `z.looseObject`** for the Jira response schemas (`.passthrough()` is deprecated in the
  installed zod).
- **Verification substituted a faithful local mock for Atlassian's servers** (the stored token turned
  out to be dead — see Status): the real dev server + real engine + real Neon synced a mock serving
  the exact request/response contract (verified against server.js:273-315), driven by a fabricated
  MEMBER user whose `JiraCredential.baseUrl` pointed at the mock. Real-Jira round-trip (auth,
  search, error mapping) was additionally exercised live with the real credential. The
  transform unit test imported a byte-identical `.mjs` copy (the `.js`-is-CJS gotcha, crypto-test
  precedent); seeding/workflows tests ran the real module bytes.
- **Fail-fast credential validation added post-spec (2026-07-07):** `syncTeamSprint` calls
  `fetchMyself` before any fetch/write, because Jira treats invalid Basic auth as anonymous on
  `search/jql`/`project/search` (200 + empty, never 401) — without the check, a dead token produced
  a plausible-looking empty sync. Costs one extra Jira call per sync; verified live (dead token →
  401 + reconnect message). Consider periodic `lastValidatedAt`-based re-validation later (step 7).

## References

- @context/project-overview.md — §6 hybrid model + critical note, §9 (`Issue`, `IssueProgress`,
  `StatusStageMapping`, `Team` field ids, keying rationale), §13 credentials, §14 flaws 2/7,
  §16 decisions (hybrid, one progress row per key), Migration Plan step 5
- @context/features/domain-apis.md — RBAC guards, route conventions, owning-workflow derivation
  (the progress route and the engine must agree)
- @context/features/bootstrap-seed.md + `web/prisma/seed.mjs` — the mapping table being consumed
- Port sources: [src/jiraService.js](../../src/jiraService.js),
  [server.js:243-315](../../server.js#L243-L315),
  [useSprintData.js:64-150](../../src/hooks/useSprintData.js#L64-L150)
- `web/src/lib/{jira/client.js,crypto.js,rbac.js,workflows.mjs}` · `web/AGENTS.md`
