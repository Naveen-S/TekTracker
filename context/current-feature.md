# Current Feature

**ED / multi-team roll-up (migration step 6b)** — full spec: @context/features/ed-rollup.md

Completes master-plan step 6 and closes the product's №1 gap (§14.1, §2.2 leadership visibility):
a read-only, **membership-derived** cross-team roll-up at **`/rollup`** for ED/TPM (N teams) and
EM/SEM (2–3 teams) — combined metric cards + a per-team summary table for one selected global
sprint, with an "Open board →" link into each team's `/` dashboard. No new write path and **no new
API route**: a server component reading Prisma via a new `getRollupData`, reusing the
fixture-proven per-team `computeSprintMetrics` plus one new **pure `aggregateRollup`** (per-team
rows, org totals = sum over teams — the shape step 7's `SprintSnapshot` job will mirror). It's
next because 6a (Done 2026-07-08) delivered the EM/Lead loop and steps 7/9 stay sensible after it.
Trend/burndown stays out (needs `SprintSnapshot`, step 7); no Sync on the roll-up (rate-limit
storm, §14.9) — staleness from `Filter.lastSyncedAt` instead.

## Status

**Done 2026-07-08** — all 8 decisions implemented as proposed; **master-plan step 6 is now fully
DONE (6a + 6b)**. Pure `aggregateRollup` + shared `bandSprintHealth` in `lib/metrics.mjs` (plus
additive `totalIssues`/`healthCounts`/`featureHealthCounts` on `computeSprintMetrics` — the §9
`SprintSnapshot.healthCounts` shape); `getRollupData` in `lib/dashboard-data.js` (extracted shared
`getMembershipContext`/`getSprintSelection`, two batched queries, no N+1); `/rollup` server page +
`components/rollup/{rollup-top-bar,team-summary-table}.jsx` (one client leaf; SSR table sorted
worst-health-first w/ request-time staleness); TopBar "Roll-up" link (≥2 teams or admin);
`MetricGrid` reused via `totalIssues`. Verified: **34/34 plain-Node fixtures** (sums, weighted
avg, per-team key independence, blocked→Critical, No-Data, additive velocity); lint clean;
migrations up to date; **DB/env-free build green (23 routes/pages `ƒ Dynamic` incl. the new
`/rollup`)**; **32/32 SSR smoke** on dev+Neon (unauth 307, 2-of-3-teams scoping + summed combined, admin all-teams +
Critical + danger-first order, zeroed no-filters row, link visibility). Fixture torn down,
harnesses deleted, docs synced (§3/§5/§11/§14.1/step-6). ⚠️ Naveen's real-Jira acceptance run
(fresh token → UI login → sync) still open from 6a. See @context/features/ed-rollup.md "As-built
notes". **Next:** step 7 (background job: cron sync + daily `SprintSnapshot`) or step 9
(localStorage importer); step 8 (share/export) after.

## Goals

- **(a) Aggregation — `web/src/lib/metrics.mjs`**: pure `aggregateRollup(perTeamMetrics)` — sums
  (counts, points, velocity), issue-weighted `avgProgress`, portfolio health = §12 bands re-applied
  to summed feature health counts; extract the §12 sprint-health banding into a shared internal
  helper so `/` and `/rollup` can never drift. Plain-Node testable.
- **(b) Data assembly — `web/src/lib/dashboard-data.js`**: `getRollupData(user, { sprintId })` —
  membership-derived teams (admin sees all), shared sprint-defaulting (ACTIVE else latest),
  **no N+1** (one batched `filter.findMany` + one `issueProgress.findMany`, grouped in JS), →
  `{ user, teams, sprints, selectedSprint, perTeam: [{ team, myRole, filters, metrics, lastSyncedAt }], combined }`.
- **(c) Page — `web/src/app/rollup/page.jsx`**: server component; `getCurrentUser()` gate →
  redirect `/login`; `?sprint=` via async `searchParams`.
- **(d) Components — `web/src/components/rollup/`**: client `rollup-top-bar.jsx` (sprint Select →
  `router.push`, "My board" link, logout) + server-rendered combined `MetricGrid` + team-summary
  table (key/name, role, issues, pts, avg %, health chip, band counts, blocked, staleness,
  "Open board →" `/?team=&sprint=`), sorted worst-health-first.
- **(e) Entry — `web/src/components/dashboard/top-bar.jsx`**: "Roll-up" link when
  `teams.length >= 2 || user.isAdmin`.
- **Acceptance:** pure fixtures for `aggregateRollup` (sums, weighted avg, blocked-anywhere →
  Critical, No-Data handling, velocity projection); lint + DB/env-free build green (`/rollup`
  `ƒ Dynamic`); SSR smoke on dev+Neon (2-of-3-teams user sees exactly 2 rows + summed combined,
  admin sees all, zeroed no-filters row, link visibility, 307 gate). No schema change, no
  migration, no new dependency.

## Notes

- **Next 16 async `searchParams`/`cookies()`** — await them; verified pattern in
  `web/src/app/page.jsx`.
- **Never merge progress maps across teams** (§9: same jiraKey can hold different progress in two
  teams) — run `computeSprintMetrics` per team, aggregate the results.
- Keep `metrics.mjs` dependency-free (`.mjs`, no `@/` imports) so plain-Node checks keep working.
- Staleness = max `Filter.lastSyncedAt` per team, rendered server-side from request time (no
  client `Date.now()` — the row is server-only, hydration-safe for free).
- Velocity roll-up = **sum of per-team weekly velocities**; `weeksNeeded` recomputed from summed
  remaining / summed velocity.
- **Doc-sync (§17):** §5 roll-up row → BUILT-in-web (trend row stays GAP), §3 GAP note narrowed to
  legacy, §14.1 fixed-in-web, §11 dated `/rollup` note, master-plan step 6 → DONE (6a+6b).

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-06-12 — Picked @context/features/scaffold-nextjs.md as the current feature.
- 2026-06-12 — Scaffolded `web/` (Next.js 16.2.9, App Router, JS, Tailwind v4, yarn). Verified
  build, lint, and three-server coexistence. Deviations recorded in the feature spec: `web/` dev
  pinned to :3002 (root Vite app owns :3000), `turbopack.root` pinned (dual-lockfile repo),
  `typescript` devDep added (required by `eslint-config-next` under yarn 1).
- 2026-06-13 — Feature 1 (Next.js scaffold) **Done**. Picked
  @context/features/scaffold-tailwind-shadcn-zod.md as the current feature (Tailwind theme +
  shadcn/ui + zod); default theme set to **light**.
- 2026-06-13 — Implemented Feature 2: Tailwind v4 Tekion token theme (light default, dark under
  `.dark`), shadcn/ui (radix base, JS/`.jsx`) with `Button`, and zod + `validate()` helper +
  placeholder schema. Lint/build/dev verified. shadcn set up manually (`ui.shadcn.com` unreachable).
- 2026-06-14 — Feature 2 (Tailwind + shadcn/ui + zod) **Done** and re-verified (`yarn lint` +
  `yarn build` pass in `web/`; all spec files present; no `tailwind.config.*`, no source
  `.ts`/`.tsx`). Picked @context/features/scaffload-prisma.md as the current feature (Feature 3 —
  Prisma 7 + Postgres data layer).
- 2026-06-14 — Implemented Feature 3: Prisma 7.8.0 + `@prisma/client` + `@prisma/adapter-pg` +
  `dotenv` (in `web/` only, `--ignore-engines` for a Node-22 transitive). Ported §9 verbatim to
  `web/prisma/schema.prisma` (12 models, 4 enums, `///` doc comments); `url` removed from datasource
  (Prisma 7) and moved to `web/prisma.config.mjs`; legacy `prisma-client-js` generator; singleton
  at `web/src/lib/db.js` via the pg driver adapter; `db:*` scripts + `postinstall: prisma generate`;
  `.env.example` committed (+ `!.env.example` gitignore exception), `.env` uncommitted. `init`
  migration created and applied to the Neon dev DB; `validate`/`generate`/`migrate status`/`lint`/
  `build` all green; build verified DB-free (passes with `DATABASE_URL` unset). Delete-me
  `force-dynamic` `/api/health/db` smoke route added. §9 reconciled with the Prisma 7 deviations.
  NextAuth models confirmed **omitted** (conflicts with verbatim-§9 / §16 Jira-token auth).
- 2026-06-14 — Per Naveen ("use latest Prisma"), switched from the deprecated `prisma-client-js`
  generator to the modern **`prisma-client`** generator (`output = ../src/generated/prisma`,
  emits `.ts`); updated the singleton import to `@/generated/prisma/client`, gitignored
  `/src/generated/prisma`, and ESLint-ignored `src/generated/**`. No `tsconfig.json` required —
  Next 16 + Turbopack compiles the generated `.ts` and resolves `@/*` via `jsconfig.json`.
  Re-verified: `validate`/`generate`/`lint`/`build` green, build DB-free (passes with
  `DATABASE_URL` unset), and `GET /api/health/db` returns `{status:"ok",db:true,users:0}` against
  Neon at runtime. §9 deviation #2 updated to match.
- 2026-06-14 — Froze all `web/package.json` dep versions to exact (dropped `^` ranges; lockfile
  reconciled, versions unchanged). Added `web/.yarnrc` (`ignore-engines true`) so flagless
  `yarn install` works. Logged a **deferred follow-up** (project-overview §16): bump to Node 22
  (≥22.12) and drop the `ignore-engines` shim **after** the root Vite app is retired / `web/` is
  promoted to root.
- 2026-06-15 — Feature 3 (Prisma 7 + Postgres data layer) **Done**. Re-verified `yarn prisma
  validate`/`lint`/`build` green, build DB-free, `migrate status` up to date on Neon.
- 2026-06-15 — Planning session (no code): reviewed the handwritten spec + current build and
  confirmed migration **step 2 is only partially done** — schema + `init` migration yes, the
  **seed** (ADMIN user + global `StatusStageMapping` + workflow metadata) no. Drafted three feature
  plans: @context/features/seed.md (localStorage → Postgres **importer**, master-plan step 9),
  @context/features/bootstrap-seed.md (completes step 2's seed), and
  @context/features/add-user-isadmin.md. Ratified with Naveen: (1) represent global admin via a new
  **`User.isAdmin`** column (not an env allowlist); (2) `FEATURE` status→stage map uses **Code
  Review → E2E testing (5)** and **Testing/In QA → QA/PM demo (6)**; (3) workflow metadata stays a
  code-port (`web/src/lib/workflows.js`), no `Workflow` table.
- 2026-06-15 — Picked @context/features/add-user-isadmin.md as the current feature.
- 2026-06-15 — **Implemented add-user-isadmin.** Added `isAdmin Boolean @default(false)` to `User`
  in `web/prisma/schema.prisma` (with a note vs. `TeamMembership.role = ADMIN`); tightened the `Role`
  enum `ADMIN` comment; doc-synced §9 (User model block, `Role` note, ER-diagram USER entity, the
  User/TeamMembership rationale bullet). Created + applied migration
  `20260615042100_add_user_isadmin` (single additive `ALTER TABLE "User" ADD COLUMN "isAdmin"
  BOOLEAN NOT NULL DEFAULT false`) — `migrate dev` ran directly against the Neon pooled endpoint
  (no shadow-DB workaround needed, unlike the `init` migration). Regenerated client. Verified:
  `prisma validate` valid, `migrate status` up to date (2 migrations), `yarn lint` clean, `yarn
  build` green + DB-free, `isAdmin` present in the generated client. **Done.**
- 2026-06-15 — add-user-isadmin **Done**. Picked @context/features/bootstrap-seed.md as the current
  feature (completes migration step 2 — bootstrap seed: ADMIN user + global `StatusStageMapping` +
  workflow-constants port).
- 2026-06-15 — **Implemented bootstrap-seed (completes migration step 2).** Added
  `web/src/lib/workflows.mjs` (workflow stages/weights/priority keyed by `WorkflowType`) and
  `web/prisma/seed.mjs` (zod-validated, idempotent): upserts the `SEED_ADMIN_EMAIL` user with
  `isAdmin: true` (placeholder `jiraAccountId`), and replaces the global (`teamId=null`)
  `StatusStageMapping` set via delete-then-`createMany`. Wired `migrations.seed = "tsx
  prisma/seed.mjs"` in `prisma.config.mjs`, added `db:seed` script + `tsx` devDep (exact 4.22.4),
  documented `SEED_ADMIN_EMAIL` in `.env.example`. Ran against Neon: 1 admin + 35 global mappings
  (FEATURE 11; TECH_DEBT/SUPPORT/INTERNAL_BUG 8 each; CUSTOM skipped). Verified idempotent re-run (no
  dupes), out-of-range `stageIndex` fails loudly before any write, `yarn lint` + `yarn build` green +
  DB-free. As-built deviations (vs. spec): `.mjs` not `.js` (ESM under tsx), `tsx` runner (TS-only
  generated client on Node 20), seed command in `prisma.config.mjs` not `package.json`, delete-then-
  create for global rows (Postgres NULL-unique). **Done.**
- 2026-06-29 — Planning session (no code): with migration step 2 complete, confirmed step 3 (Auth
  layer) is the next in-order step and chose it over the pulled-forward importer (seed.md, step 9).
  Drafted @context/features/auth-layer.md (port `server.js` login/me/logout → Next 16 Route Handlers;
  Jira `/myself` validation; upsert `User` + `JiraCredential` with AES-256-GCM token; iron-session
  cookie `{ userId }`; reconcile the seeded admin). Refined it against a full re-read of
  project-overview.md: **resolved decisions 3–4** (discover `cloudId` via `/_edgeProxy/tenant_info`
  rather than a hand-found `JIRA_CLOUD_ID` env var — it's a tenant UUID, unused under token auth;
  response is a superset returning `isAdmin` read from `User.isAdmin`, not Jira); **added proposed
  decisions 7–9** (Route Handlers vs Server Actions per coding-standards/§8; cookie payload `{ userId }`
  only so `isAdmin`/roles stay fresh from the DB per request; secrets from a store + retire the legacy
  `SESSION_SECRET`/`dev-secret` fallback). Noted the Next 16 async `cookies()` + iron-session unknown
  and a precise doc-sync that keeps §7 as the legacy snapshot.
- 2026-06-29 — Picked @context/features/auth-layer.md as the current feature (migration **step 3** —
  auth: Next 16 Route Handlers + AES-256-GCM-encrypted `JiraCredential` + iron-session, reconciling the
  bootstrap-seeded admin). bootstrap-seed remains **Done**.
- 2026-06-29 — **Implemented auth-layer (migration step 3).** Read the installed Next 16 `cookies()`
  doc (async) + iron-session 8.0.4 types before writing. Added `web/src/lib/crypto.js` (AES-256-GCM,
  `iv ‖ authTag ‖ ciphertext`, loud-fail on bad key), `web/src/lib/auth.js` (iron-session `{ userId }`
  cookie; `getSession`/`createUserSession`/`destroySession`/`getCurrentUser`/`requireUser` +
  `UnauthorizedError`), `web/src/lib/jira/client.js` (`getJiraBaseUrl`/`fetchMyself`/`fetchCloudId` +
  `JiraAuthError`, all Jira specifics isolated), `web/src/lib/schemas/auth.js`, and route handlers
  `app/api/auth/{login,me,logout}/route.js` (login upserts `User` by email — preserving `isAdmin` —
  and `JiraCredential` with the encrypted token; `cloudId` via `_edgeProxy/tenant_info` with `baseUrl`
  fallback). Installed `iron-session@8.0.4` (exact). Verified: lint clean; build green + DB/env-free
  (`DATABASE_URL`/secrets unset, routes `ƒ Dynamic`); crypto round-trip/IV/tamper/bad-key pass against
  the real bytes; curl smoke (400/401/200 + clearing `Set-Cookie`) confirms the Next-16-async-cookies
  + iron-session integration. As-built deviations recorded in auth-layer.md (two thin session
  wrappers; zod 400 message; `JiraAuthError` covers 401+403; `force-dynamic` on all three; ESM-rename
  crypto test harness). Doc-synced project-overview §10/§13/step-3 (§7 left as legacy). **Done** — the
  login success path (real Jira + Neon) is left for Naveen to run. **Next:** importer (seed.md, step 9)
  or Domain APIs (step 4).
- 2026-06-29 — **Verified the login success path** with Naveen's real Jira creds against Neon. First
  attempt returned 500 "Login failed" — diagnosed a leftover `.env.example` placeholder
  `TOKEN_ENCRYPTION_KEY` in `web/.env` (decoded to 19 bytes, so `encryptToken` correctly **failed
  loudly**); replaced it with a real 32-byte key and restarted the dev server (the running one had
  loaded the stale key, and held :3002 so a second server couldn't start). Results: `login` →
  `200 { isAdmin:true, displayName:"Naveen S", avatarUrl }` + sealed `Fe26.2*…` 30-day cookie; `me`
  round-trips; `logout` → `401` after. DB confirms **seed-admin reconciliation** (`jiraAccountId` now
  the real `602a…`, `isAdmin` still true) and the **token encrypted at rest** (296-char ciphertext ≠
  plaintext, decrypts back; `lastValidatedAt` set). `cloudId` fell back to `baseUrl`
  (`_edgeProxy/tenant_info` returned none — harmless under token auth; revisit at OAuth). auth-layer.md
  Status + as-built notes updated.
- 2026-07-07 — Planning session (no code): with step 3 done, confirmed **step 4 (Domain APIs)** as the
  next in-order step (over the pulled-forward importer, seed.md — now unblocked by step 4's team
  provisioning, sequenced right after). Drafted @context/features/domain-apis.md against the auth-layer
  patterns and the prototype's mutation semantics: 14 route files (teams/memberships, sprints,
  filter-templates, filters incl. reorder, IssueProgress writes, admin users list), `lib/rbac.js` +
  `lib/api/route-helpers.js`, 4 schema modules. 9 PROPOSED decisions incl. Route Handlers over Server
  Actions (refines the auth-layer decision-7 aside — step 4 predates any UI, so Actions would be
  untestable), the RBAC matrix (global-admin bypass; sprints admin-only, §13.3's "+ED" deferred),
  idempotent progress PUT with the server-owned checklist cascade, owning-workflow derivation from the
  Issue cache (unknown key → 404), no Sprint DELETE, and progress surviving filter delete (designed
  §9 deviation from the prototype's stage-wipe). No schema change/migration in this step.
- 2026-07-07 — Picked @context/features/domain-apis.md as the current feature (migration **step 4** —
  Domain APIs: RBAC-gated CRUD for teams/memberships/sprints/filter-templates/filters + IssueProgress
  stage/blocked writes). auth-layer remains **Done**.
- 2026-07-07 — **Implemented domain-apis (migration step 4).** Confirmed Next 16 async `params`
  against the installed docs first. Added `web/src/lib/rbac.js` (`ForbiddenError`/`NotFoundError`,
  `requireAdmin`, `requireTeamRole` w/ global-admin bypass, MANAGER/WRITER/ALL role groups),
  `web/src/lib/api/route-helpers.js` (`ValidationError`, `parseJsonBody` w/ zod folded in,
  `handleRouteError` mapping 400/401/403/404/409/500), zod-4 schemas
  `schemas/{team,sprint,filter,progress}.js`, and 14 `force-dynamic` route files (teams+members,
  sprints incl. merged-date PATCH check + no DELETE, filter-templates, sprint-scoped filters w/
  transactional priority insertion + `order` reorder, progress GET + idempotent PUT w/ checklist
  cascade + owning-workflow derivation + `updatedById`, admin users list). No schema change/migration.
  Verified: lint clean; build green + DB/env-free (14 routes `ƒ Dynamic`); **68/68 curl acceptance
  checks** against Neon w/ fabricated non-admin users (minted iron-session cookies via `sealData`)
  and Issue cache rows — all cleaned up after, tmp harness deleted. As-built deviations recorded in
  domain-apis.md (NotFoundError in rbac.js; parseJsonBody+zod; 200-not-201; renumber-all sortOrder;
  zod-4 enum/date idioms). Doc-synced project-overview (§5 rows, §13.3 BUILT-in-web, §14.5–6 fixed
  in web, step 4 DONE). **Done.**
- 2026-07-07 — Planning session (no code): with step 4 done and proper end-to-end testing only
  possible after step 6 (UI), confirmed **step 5 (Sync with hybrid seeding)** as next in order — it
  is also what gives step 6 real data to render. Drafted
  @context/features/sync-hybrid-seeding.md from the port sources (jiraService.js `searchAllIssues`/
  `transformJiraIssue`, server.js `/api/jira/{filter,search}` incl. the new `/search/jql` +
  `nextPageToken` shape, `handleSyncAll` diffing) and the seeded `StatusStageMapping` table. 10
  PROPOSED decisions, notably: sync-all route + engine reusable by the step-7 cron; caller's
  decrypted credential; writer-roles RBAC; replace-by-diff Issue cache; **create-only seeding**
  (§9 — manual edits win; re-seed-forward deferred); owning-workflow re-eval with pad/truncate;
  per-team field ids (fixes §14.7); transform upgrades (full assignee name + accountId, priority,
  real dueDate — the prototype's lossy fields); no derived status/stage/percent port.
- 2026-07-07 — Picked @context/features/sync-hybrid-seeding.md as the current feature (migration
  **step 5** — Jira sync client + engine + `POST …/sync` with hybrid StatusStageMapping seeding).
  domain-apis remains **Done**.
- 2026-07-07 — **Implemented sync-hybrid-seeding (migration step 5).** Verified the `/search/jql`
  POST shape against the legacy proxy first. Grew `lib/jira/client.js` (`getJiraAuthForUser`
  decrypting the caller's credential, `fetchFilter`, paginated `searchIssues` w/ `nextPageToken` +
  2000-issue cap, `JiraCredentialMissingError`/`JiraApiError`); added pure `lib/jira/transform.js`
  (per-team field ids, legacy points fallback, full assignee+accountId/priority/dueDate; no derived
  status/stage/percent), `lib/schemas/jira.js` (zod-4 `looseObject`), `lib/sync/engine.js` (per-filter
  atomic delete-all+createMany cache replace w/ key-diff, create-only StatusStageMapping seeding
  team-over-global, owning-workflow re-eval w/ reshape), pure `lib/sync/seeding.mjs` (split out —
  engine's import chain needs Next), and the writer-gated sync route (Jira errors mapped in-route:
  401/502). Moved `owningWorkflowType` into `workflows.mjs`, shared with the step-4 progress route.
  Verified: lint/build green + DB/env-free; 15 standalone checks; full pipeline over real HTTP via a
  contract-faithful mock Jira + fabricated MEMBER credential (pagination, jql refresh, seeded shapes,
  create-only, manual-edit survival, removal survival, FEATURE→SUPPORT reshape, 403/401); real-Jira
  round-trip live (200s, 400→502 mapping). **Found: the stored Tekion token sees zero projects** —
  real-data sync blocked on Jira access, flagged in the spec Status. Cleanup done; docs synced. **Done.**
- 2026-07-07 — **Corrected the zero-projects finding + hardened sync.** Naveen asked whether his EM
  account can search all projects; probed the permission endpoints with the stored credential
  (`/myself` plain + expanded, `project/search` browse/view, `mypermissions`, and the same calls with
  NO auth). Result: authenticated and anonymous behave **identically** → the stored token is **dead**
  (expired/revoked; it passed `/myself` at login 2026-06-29), and Jira degrades invalid Basic auth to
  anonymous (200 + empty) on search/project endpoints — so account project-visibility is **still
  unknown**, and the earlier "sees zero projects" read was a misdiagnosis. This exposed a sync gap
  (dead token → plausible empty sync): added a **fail-fast `fetchMyself` validation** at
  `syncTeamSprint` start → `401 "Stored Jira token is invalid or expired — log in again to
  reconnect"`; verified live against the dead credential; lint/build re-verified green + env-free.
  Doc-synced the corrected finding (spec Status + as-built, project-overview step-5, this file).
  Atlassian claude.ai connector is not authorized (can't check via Rovo either). **Naveen's action:**
  fresh long-expiry classic API token → `POST /api/auth/login` → re-run a real sync (that answers the
  permissions question too).
- 2026-07-07 — Planning session (no code): per Naveen, the real-Jira re-verify waits for the UI —
  **step 6 is next**. Drafted @context/features/ui-port.md, scoping it to **6a** (login + team
  dashboard + minimal admin — the EM/Lead daily loop); the ED multi-team roll-up split off as **6b**
  (needs its own read-model/metric-aggregation decisions). 9 PROPOSED decisions, notably:
  server-component reads via Prisma + pure metrics (no new read-model APIs) with client `fetch`
  writes to the existing step-4/5 routes + `router.refresh()` (no Server Actions in 6a);
  `?team=&sprint=` searchParams routing; per-page auth gates; hand-written shadcn-style components
  (no new deps); add-filter = CRUD + immediate sync (prototype parity across the step-5 split);
  exactly two localStorage prefs and no `?share=` port (step 8 owns sharing). Acceptance includes
  the deferred fresh-token real-Jira sync test through the login UI.
- 2026-07-07 — Picked @context/features/ui-port.md as the current feature (migration **step 6a** —
  UI port: login + server-data Delivery Matrix dashboard + minimal admin). sync-hybrid-seeding
  remains **Done**.
- 2026-07-08 — **Implemented ui-port (migration step 6a).** Confirmed Next 16 async `searchParams`
  against the installed docs first. Added pure `lib/metrics.mjs` (ported
  `computeSprintMetrics`/health/velocity onto Issue-cache+IssueProgress shapes, semantic `tone`
  keys instead of hex; **16/16 fixture-parity** vs the prototype's byte-copied modules),
  `lib/dashboard-data.js` (server-only Prisma assembly + `can` flags), `lib/api-client.js`,
  `lib/use-local-pref.js` (`useSyncExternalStore` — the installed `react-hooks/set-state-in-effect`
  rule rejects the prototype's effect pattern), UI kit
  (`ui/{input,textarea,label,select,badge,dialog}.jsx`), `/login` + `components/auth/login-form.jsx`,
  `/` server page + `components/dashboard/{dashboard,top-bar,hero,metric-grid,empty-state,
  filter-panel,planner-panel,issue-row,add-filter-dialog,sprint-config-dialog,alert-dialog}.jsx`,
  and admin-gated `/admin` + `components/admin/admin-panel.jsx`; `tekion-logo.svg` copied, scaffold
  placeholders removed. Verified: lint clean, migrate status up to date, build green + DB/env-free
  (23 `ƒ Dynamic` entries); ~30-check SSR smoke over dev+Neon w/ minted cookies (auth gates, matrix
  SSR, stage-4 PUT → `80<!-- -->%` badge, blocked chip, VIEWER read-only + `/admin` 404,
  no-membership/welcome empty states, admin page). As-built deviations in ui-port.md (useLocalPref;
  name required for both source types; no optimistic updates; search in sidebar; simplified
  velocity card; owning-workflow weights stricter than prototype; two data-driven inline styles;
  no browser automation — SSR-assertion verification). Cleanup done; docs synced (§5/§11/§13.3/
  step-6 PARTIAL 6a). **Done** — ⚠️ real-token UI acceptance run left for Naveen. **Next:** 6b
  (ED roll-up), step 7 (background job), or step 9 (importer).
- 2026-07-08 — **Post-6a UI polish** (rides on the uncommitted 6a diff): (1) labeled the admin
  Sprint Gates create form (Name / Development start / Development end / Release date (optional) —
  hover-only `title` tooltips replaced with the SprintConfig dialog's Label-column pattern, submit
  button `self-end`); (2) **in-flight loaders** — root cause: `router.refresh()` returns before
  the server re-render lands, so `busy` cleared while data was still stale. All dashboard + admin
  mutations now run in **React 19 transitions** (post-await updates re-wrapped per the installed
  Next 16 docs), so `busy = isPending` spans the API call *and* the refresh render. New
  `ui/spinner.jsx` (`Spinner` + floating `ActivityPill`: "Updating…" / "Syncing Jira…" /
  "Working…"); success alerts and the admin "— done" status now commit *together with* the
  refreshed data; SprintConfig stays open ("Saving…") until the change is visible; TopBar Add
  filter/Sync disabled while anything is in flight; add-filter now refreshes even when the
  follow-up sync fails (created filter no longer invisible until next nav). Lint + build green.
  Not yet feel-tested in a browser — transition timing is client-side, beyond SSR checks.
- 2026-07-08 — Planning session (no code): with 6a done, confirmed **step 6b (ED/TPM multi-team
  roll-up)** as next — it completes master-plan step 6 and the №1 gap (§14.1 leadership
  visibility); step 7 (cron/snapshots) and step 9 (importer) stay sensible after it. Drafted
  @context/features/ed-rollup.md: 8 PROPOSED decisions, notably a dedicated **`/rollup` server
  page** (no `?team=all` mode; TopBar link when ≥2 teams or admin), **membership-derived access,
  any role** (§3 EM/SEM combined views; admin sees all), **no new API routes** (extend
  `dashboard-data.js` with `getRollupData`, batched non-N+1 reads), **per-team
  `computeSprintMetrics` + new pure `aggregateRollup`** in `metrics.mjs` (per-team progress keys
  can collide across teams, §9 — never merge; portfolio health = §12 bands over summed feature
  counts; velocity sums), **no Sync on the roll-up** (rate-limit storm — staleness from
  `lastSyncedAt` instead; freshness is step 7's cron), server-first UI with one thin client top
  bar. Out of scope: trend/burndown (step 7), share/export (step 8). Acceptance: pure aggregation
  fixtures + SSR smoke w/ a fabricated 2-of-3-teams user + membership scoping + link-visibility
  checks.
- 2026-07-08 — Picked @context/features/ed-rollup.md as the current feature (migration **step 6b**
  — ED/TPM multi-team roll-up: `/rollup` server page + `getRollupData` + pure `aggregateRollup`).
  ui-port (6a) remains **Done**.
- 2026-07-08 — **Implemented ed-rollup (migration step 6b — completes step 6).** Re-confirmed the
  Next 16 async `searchParams` shape against the installed docs first. Extracted the §12
  sprint-health banding into shared `bandSprintHealth` and added pure `aggregateRollup` to
  `lib/metrics.mjs` (sums; issue-weighted `avgProgress`; portfolio health over summed feature
  counts; velocity additive via summed inputs), growing `computeSprintMetrics` with **additive**
  `totalIssues`/`healthCounts`/`featureHealthCounts` (the §9 `SprintSnapshot.healthCounts` shape —
  step 7 alignment); refactored `lib/dashboard-data.js` into shared
  `getMembershipContext`/`getSprintSelection`/`serializeUser` + new `getRollupData` (two batched
  `{ teamId: { in } }` queries grouped in JS — no N+1; per-team progress maps never merged, §9);
  added `/rollup` server page (auth gate, `?sprint=`, request-time `asOf`),
  `components/rollup/{rollup-top-bar,team-summary-table}.jsx` (single client leaf; SSR table:
  role, issues, pts, avg %, health chip, 5-band counts + blocked column, staleness, "Open board →"
  links; worst-health-first), the TopBar "Roll-up" link (`teams.length >= 2 || isAdmin`),
  `MetricGrid` switched to `totalIssues`, and `initials()` extracted to `lib/utils.js`. No schema
  change, no new deps, no new API routes. Verified: **34/34 plain-Node fixtures** (incl.
  blocked-anywhere→Critical, No-Data teams ignored, all-No-Data, combined velocity = sum of
  per-team velocities); lint clean; migrate status up to date; **DB/env-free build green — 23
  routes/pages `ƒ Dynamic` incl. the new `/rollup`**; **32/32 SSR smoke** on dev+Neon (minted cookies, fabricated
  3-teams/3-users fixture: unauth 307→/login; 2-of-3 user sees exactly 2 rows, combined =
  2 issues/8 pts/75%/Fair with **no Critical leak** from the 3rd team's blocked issue; admin sees
  all 3, Critical, danger-first ordering; zeroed "no filters yet"+"never" row; `2h ago` staleness;
  `?team=&sprint=` links; Roll-up link shown/hidden correctly). Fixture torn down (0 leftovers),
  harnesses deleted. As-built deviations in ed-rollup.md (additive metrics fields; MetricGrid
  `totalIssues`; velocity from summed inputs not double-rounded per-team sums; internal
  `bandSprintHealth`; bands/blocked column split; no Admin link on the roll-up top bar;
  PLANNING-state smoke sprint). Docs synced (§3 GAP narrowed to legacy, §5 roll-up row BUILT,
  §11 6b note, §14.1 fixed-in-web, master-plan step 6 **DONE 6a+6b**; trend row stays GAP).
  **Done.** **Next:** step 7 (background job) or step 9 (importer).
