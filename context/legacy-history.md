# StoryBoard — Development History (archive)

> **Archived from `current-feature.md` on 2026-08-09** to reduce that file's bloat. This is the
> complete chronological development log of the StoryBoard build (earliest → latest), including the
> retired legacy Vite/Express app era and the full Next.js migration. It is preserved verbatim for
> reference. `current-feature.md` now carries only the **active** feature; append new "Done" entries
> to the end of this file.

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
- 2026-07-09 — ed-rollup **merged to main** (`e58afe2`, fast-forward; Naveen). Branch
  `feature/ed-rollup` pending deletion.
- 2026-07-09 — Planning session (no code): with step 6 fully done, confirmed **step 7 (background
  job)** as the next in-order step — over step 9 (importer, spec exists but predates steps 3–6)
  and step 8 (share/export, sequenced after) — because it unlocks the last leadership gap (VP
  trend data, §14.8), supplies `/rollup`'s deferred freshness (§14.9), and 6b shaped
  `computeSprintMetrics.healthCounts`/`aggregateRollup` for exactly this. Drafted
  @context/features/background-sync-snapshots.md: 8 PROPOSED decisions, notably **external cron →
  `POST /api/cron/daily`** (master-plan shape; no node-cron dep), **`CRON_SECRET` bearer gate**
  (first session-less route; timingSafeEqual over sha256 digests), **`CRON_SYNC_USER_EMAIL`
  service credential** for the Jira refresh (per-user token visibility flagged, §13.2),
  **refresh-failure degrades to snapshot-only** (per-team error isolation — a stale-cache data
  point beats a trend hole; today's dead token makes this path live-testable), **ACTIVE sprints ×
  filter-bearing teams, sequential** (§14.9), **UTC-midnight upsert** on
  `(sprintId, teamId, capturedOn)` (idempotent re-runs), per-team metrics never merged (§9), and
  a pure `snapshotValues` in `metrics.mjs` (seeding.mjs split precedent). No schema change (model
  shipped in `init`), no migration, no new dependency, one new route. Out of scope: trend UI +
  snapshot-based velocity (step 10), Redis, OAuth, retention.
- 2026-07-09 — Picked @context/features/background-sync-snapshots.md as the current feature
  (migration **step 7** — background job: secret-gated `POST /api/cron/daily` refreshing Issue
  caches via the step-5 engine + writing the daily per-team `SprintSnapshot`). ed-rollup (6b)
  remains **Done**.
- 2026-07-09 — **Implemented background-sync-snapshots (migration step 7).** Read the installed
  Next 16 route-handler doc + confirmed the generated `sprintId_teamId_capturedOn` composite key
  first. Added pure `snapshotValues` to `lib/metrics.mjs` (§9 column pick off
  `computeSprintMetrics`), `lib/cron/daily.js` (`runDailyJob`: `resolveRefreshUser` validates the
  `CRON_SYNC_USER_EMAIL` credential once up front via `/myself` — any failure degrades the whole
  run to snapshot-only; per ACTIVE sprint, sequential per-team `syncTeamSprint` w/ isolated
  errors, then batched two-query reads → per-team metrics → UTC-midnight `sprintSnapshot.upsert`;
  progress maps never merged, §9), and `app/api/cron/daily/route.js` (POST, `force-dynamic`,
  `CRON_SECRET` bearer gate via `timingSafeEqual` over sha256 digests, <32-chars fails as loudly
  as unset, body ignored, `handleRouteError` mapping); `CRON_*` env + crontab example documented
  in `.env.example`. No schema change, no migration, no new dependency. Verified: 23/23
  plain-Node fixtures (field pick, §9 healthCounts shape, per-team keying, Σ-over-teams =
  `aggregateRollup`); lint clean; migrate status up to date; DB/env-free build green (24 `ƒ
  Dynamic` incl. `/api/cron/daily`); 30/30 live dev+Neon checks (401/401/200 gates, hand-computed
  rows for exactly the 2 filter-bearing fixture teams, PLANNING sprint + filterless team skipped,
  degrade path w/ snapshots still landing, same-day re-run idempotent — same row id, 75→90
  refresh — and unset-secret loud 500 w/ nothing written); teardown 0 leftovers, harness deleted.
  **Finding:** the stored Jira token is **alive again** (Naveen re-logged in) — the first live
  run took the real refresh path (engine end-to-end vs real Jira; fabricated-JQL search returned
  200+empty, cache correctly replaced, §9 progress survival re-verified), so the degrade path was
  forced via a nonexistent `CRON_SYNC_USER_EMAIL`; step-5/6 dead-token flags corrected in the
  docs. As-built deviations in background-sync-snapshots.md (engine-side `capturedOn`
  normalization; once-per-run credential validation; condensed per-team refresh counts; dev
  `.env` now carries real `CRON_*` values; Next 16 dev hot-reloads `.env`). Docs synced (§5 trend
  → PARTIAL-data, §8 cron note, §12 velocity note, §14.8 fixed-data-side / §14.9 partially
  addressed, §15.5 BUILT, master-plan step 7 DONE). **Done.** **Next:** step 8 (share view +
  export) or step 9 (localStorage importer).
- 2026-07-09 — Planning session (no code): per Naveen, the `web/` UI looks amateurish next to the
  legacy Vite app — drafted @context/features/ui-polish.md (**step-6 addendum**, pulled ahead of
  step 8 since share/export will render these same components). Two design-system catalogs
  (legacy `src/styles.css` vs `web/` Tailwind theme) pinned the gap: scaffold Geist fonts instead
  of Manrope/Inter/JetBrains Mono, no shadow/motion tokens, white-on-white (no `#F4F7FA` canvas),
  text-glyph icons (lucide-react installed but never imported), no hero radial glows / glass
  buttons, flat metric cards (no tone stripe / icon tile / display numerals), `gap-px` faux
  gridlines + bare stage cells instead of the legacy 3-state bordered badges, accent color
  reduced to a dot + 4px rule (all `accentColor` null — legacy assigned a palette), blocking
  alert modals instead of toasts. 9 PROPOSED decisions, notably: faithful token-layer translation
  into `@theme` (no `styles.css` import, no `tailwind.config.*`), legacy font stack via
  `next/font/google`, toasts for successes + AlertDialog kept for errors, one shared ink Hero
  (kills 3 copy-pastes), deterministic accent-palette assignment in AddFilter (the only
  non-presentation change), dark-mode toggle + skeletons stay post-v1, zero logic/API/schema
  changes. Acceptance: hygiene + token-audit greps + the 6a/6b behavioral SSR smoke still passing
  + Naveen's side-by-side browser eyeball (`:3000` vs `:3002`), onto which the still-open 6a
  real-Jira UI run piggybacks.
- 2026-07-09 — Picked @context/features/ui-polish.md as the current feature (step-6 addendum —
  re-skin `web/` to the legacy design system: tokens/fonts/shadows/motion, kit + chrome + matrix
  restyle, toasts, shared Hero, accent palette assignment).
- 2026-07-10 — **Implemented ui-polish (step-6 addendum — visual parity with the legacy app).**
  Read the installed Next 16 font doc + Tailwind v4 theme namespaces first. Token layer:
  `layout.jsx` swapped Geist for **Manrope/Inter/JetBrains Mono** (`next/font/google`);
  `globals.css` grew the `#F4F7FA` canvas, ink-tinted `--shadow-xs…xl` + `--shadow-brand`/
  `--shadow-col`, legacy easings, `rise`/`toast-out` keyframes + `--animate-toast`, health-triplet
  tokens (`success/info/warn/danger` ×3), `--color-ink`/on-ink accents, the `hero-panel`
  `@utility` (dual teal radial glows), teal `::selection`. Kit: button hover-lift + brand glow +
  **`onDark` glass variant**; dialog ink-blur overlay + rise entrance + tone strips + lucide `X`;
  Badge tones tokenized; **new `ui/toast.jsx`** (`useToast`, ink pill, ~3s rise/fade) + ink
  ActivityPill; **new server-safe `ui/hero-shell.jsx`** (HeroShell/Eyebrow/Title/Copy +
  DaysRemainingPill w/ urgent variant) shared by `/` and `/rollup` (3 copy-pasted gradients
  killed). Surfaces: TopBar h-14 + display product block + ink avatar + `RefreshCw`/`Plus`;
  welcome hero w/ glass feature grid; metric cards (3px tone stripe, 28px icon tile, display
  26/800 numerals, hover lift); matrix (real `border-subtle` gridlines replacing `gap-px`,
  frozen first column w/ `shadow-col`, `color-mix` 6% accent section tints + dots, 3px accent
  spines, teal key chips, tri-state completion pills, 3-state `border-[1.5px]` stage badges w/
  hover glow rings + done wash + blocked rings, bordered health pills from the legacy triplets);
  sidebar (sticky, teal eyebrow, icon buttons, search box, hover-lift cards, drag states, accent
  bars, collapsed rail); login (max-w-105 rounded-2xl p-10 card, spinner while connecting); admin
  (`window.confirm` → styled destructive confirm dialog, tokenized status, lucide X); rollup
  table tokenized. Sync/add-filter/sprint-save successes → toasts (`condenseSync` one-liner;
  errors keep AlertDialog; SprintConfigDialog gained `onSaved`); AddFilter sends deterministic
  palette `accentColor` (count % 5, red excluded) — the only non-presentation change (schema
  already accepted it). No schema change, no migration, **no new deps**. Verified: lint clean;
  `prisma validate`/`migrate status` up to date; **DB/env-free build green** (24 `ƒ Dynamic`);
  token audits (no Geist, no hero hex in components, no raw palette tone maps, lucide in 6
  files, no `tailwind.config.*`); **29/29 SSR smoke on dev+Neon** with a minted admin cookie —
  against **Naveen's real synced data** (1 team / 2 filters / 73 issues; render-only, no writes)
  — plus compiled-CSS checks (hero gradients, `shadow-brand`, `animate-toast`, all three font
  families in the prod bundle). Harness deleted, dev server stopped, `.env` restored. As-built
  deviations in ui-polish.md (canonical spacing classes per the installed lint; sticky matrix
  header skipped — inert in legacy too; no blocked cell caption; condensed toast copy;
  HEALTH_PILL tone classes instead of inline hex; server-safe hero shell; welcome-grid copy new;
  density stays the 6a pad swap; render-only smoke). Docs synced (§11 ui-polish note; dark-mode
  toggle + skeletons stay post-v1). **Done** — ⚠️ Naveen's side-by-side eyeball (`:3000` vs
  `:3002`) + the 6a real-Jira UI run remain the human acceptance. **Next:** step 8 (share view +
  export) or step 9 (localStorage importer).
- 2026-07-10 — **Iterated ui-polish: full-bleed + responsive pass** (per Naveen — "not filling
  the entire screen on large screen; make it as responsive as possible"). Removed the port-only
  `max-w-400` cap on `/` and `/rollup` mains (legacy `.app-shell` is full-bleed; admin keeps its
  centered `max-w-4xl` form width); workspace sidebar+matrix now **stack below `xl`** (~legacy
  1180px breakpoint) with sidebar sticky/max-h only at `xl` and the collapsed rail lying flat
  horizontally when stacked; metric grid steps `1 → sm:2 → lg:3 → xl:5` (~legacy 760/1180/1400);
  both top bars wrap (`min-h-14 flex-wrap`, product text block hidden below `sm`); hero/login/
  admin gained mobile paddings. Very-large screens are absorbed by the matrix's `fr`-based
  `minmax` columns. Verified: lint clean; DB/env-free build green; **11/11 SSR smoke** on
  dev+Neon (full-width mains, stack/step/wrap classes on `/` + `/rollup`) — first run 307'd on an
  expired minted cookie (1h TTL), re-minted and green; server stopped, harness deleted. As-built
  note appended to ui-polish.md. ui-polish remains **Done**, still uncommitted on
  `feature/ui-polish` awaiting Naveen's side-by-side eyeball + commit approval.
- 2026-07-11 — Planning session (no code): drafted @context/features/share-view-export.md
  (migration **step 8** — the next in-order step: `SharedView` token route `/share/[token]`
  replacing the base64 share URL, + PDF/PNG export port). Research pinned: the `SharedView`
  model already shipped in the `init` migration → **no schema change, no migration**; legacy
  export captures dedicated offscreen A4 pages via html2canvas+jsPDF. 10 decisions (2–10
  PROPOSED), notably: public no-session `/share/[token]` (token = bearer capability; generic
  invalid/expired page; noindex); create gated to `TEAM_WRITER_ROLES`, one team's board per
  share, server-validated `filterIds`; app-generated 192-bit token over the schema's guessable
  cuid default; **both live and frozen shares** — frozen snapshots store inputs (incl. sprint
  dates) and an **optional `asOf` threads through the time-dependent metrics** so frozen numbers
  don't drift; routes follow the existing team/sprint tree + flat DELETE (creator/admin);
  **`html2canvas-pro` over stock html2canvas** (the Tailwind v4 oklch/`color-mix` theme breaks
  1.4.1 — capture spike required before the full port) + `jspdf@2.5.2` exact, dynamically
  imported; share page reuses the dashboard components read-only via a new `getShareData`; Hero
  gains the §11 Share/Export buttons (clipboard + toast, AlertDialog fallback). Out of scope:
  roll-up/cross-team shares, `requiresAuth`, retention/rate-limiting, export of `/rollup`,
  steps 9–10.
- 2026-07-11 — Picked @context/features/share-view-export.md as the current feature (migration
  **step 8** — SharedView token route `/share/[token]` + share dialog + PDF/PNG export port).
  Branch `feature/share-view-export` created off `feature/ui-polish` (whose Done-but-uncommitted
  diff rides along until Naveen's eyeball + commit). ui-polish remains **Done**.
- 2026-07-12 — **Implemented share-view-export (migration step 8).** Read the installed Next 16
  dynamic-routes + generate-metadata docs first (async `params` Promise; `robots` metadata
  shape). Data layer: optional **`asOf` clock** through `getHealthStatus`/`getWeeklyVelocity`/
  `computeSprintMetrics` (+ additive `asOf` props on `MetricGrid`/`PlannerPanel`/`IssueRow` —
  the client leaves compute health/velocity themselves; dashboard//rollup pass nothing),
  `lib/share-token.js` (192-bit base64url over the schema's guessable cuid default), and
  `getShareData(token)` + `buildShareSnapshot` in `lib/dashboard-data.js` (frozen snapshots
  freeze filters+issues+progress **and the sprint window**, trimmed to in-scope keys; live
  resolves `includedFilterIds` at request time, deleted filters drop out, all-gone → null).
  API: `lib/schemas/share.js` (zod-4, future-`expiresAt` check added), writer-gated
  `POST/GET /api/teams/[teamId]/sprints/[sprintId]/shares` (filterIds validated ⊆ team+sprint —
  the only guard on the FK-less `includedFilterIds`; list = sprint+creator scope, admin all,
  rows carry resolvable filterNames) + flat creator/admin `DELETE /api/shares/[shareId]`.
  UI: public session-less `/share/[token]` (force-dynamic, `robots: noindex`, one generic
  invalid/expired state, HeroShell header w/ live-staleness or frozen chip — no
  DaysRemainingPill on frozen, read-only MetricGrid+PlannerPanel, share's `viewDensity`);
  `share-dialog.jsx` (live/frozen cards, expiry presets 7/30/never, created link always inline
  w/ Copy — subsumes the clipboard fallback, manage list w/ copy+revoke, inline errors);
  `export-dialog.jsx` (legacy ExportModal port: accent filter toggles, paged preview, offscreen
  794px A4 SummaryPage/IssuesPage, single `computeSprintMetrics` recompute, PDF/PNG capture
  inline — no separate hook; render-time page clamp per the installed set-state-in-effect
  rule); Hero + Dashboard wiring (Share = writer-gated, Export = anyone). Deps
  **`html2canvas-pro@2.2.3` + `jspdf@2.5.2`** exact, dynamic-imported — **spiked FIRST** via a
  temporary page + headless Chrome (`SPIKE_OK`: oklch + `color-mix` + hero-panel gradients
  captured; spike deleted). No schema change, no migration. Verified: lint clean; migrate
  status up to date; **DB/env-free build green (27 `ƒ Dynamic`** incl. the 3 new surfaces);
  jspdf confirmed split out of the dashboard chunk; **25/25 plain-Node asOf fixtures**; **37/37
  SSR smoke on dev+Neon** (fabricated SHSMK team/sprint/users w/ minted cookies: cookie-less
  render + noindex + no session chrome, 401/403/400×3 create gates, **frozen 65% held vs live
  65%→80% after a progress PUT**, own-vs-admin list scoping + viewer 403, revoke
  403/401/200→invalid→404, expired/unknown → same generic 200 page); fixture torn down (0
  leftovers), harnesses deleted. Smoke ran against the already-running dev server (Naveen's);
  stopped it only for the env-free build and **restarted it after** (:3002 → 200). As-built
  deviations in share-view-export.md. Docs synced (§5 both rows, §11 step-8 note, §12 asOf,
  §13.4 built w/ optional-auth NOT built, §14.3 fixed-in-web, master-plan step 8 DONE).
  **Done.** ⚠️ Human acceptance: open a share logged-out + export a real board to PDF/PNG.
  **Next:** step 9 (localStorage importer — seed.md needs a refresh, it predates steps 3–7),
  then step 10 (cutover).
- 2026-07-14 — **UI iteration (per Naveen, rides on the step-8 branch):** (1) Delivery Matrix
  filter sections now separated — `mt-5` gap between sections + `border-t` on the tinted section
  header (on the `min-w-225` row so it spans the scrolled width); the public `/share/[token]`
  page inherits via the shared `PlannerPanel` (export A4 pages unaffected — separate rendering).
  (2) The bottom-right `ActivityPill` replaced by a full-page **`PageLoader`** overlay
  (`ui/spinner.jsx`: ink-blur backdrop per the dialog system, centered ink spinner panel,
  rendered last so it covers open dialogs; blocks interaction until `router.refresh()` lands) —
  swapped at both call sites (dashboard "Updating…/Syncing Jira…", admin "Working…"). (3) Stage
  headers now **stick while scrolling a long filter**: the matrix scroll region gets
  `max-h-[calc(100vh-10.5rem)] overflow-auto` (an `overflow-x` ancestor is a scroll container on
  both axes, so sticky can only pin against it — the root cause of the legacy app's inert sticky
  header, ui-polish "skipped" note) and each filter's stage-header row is `sticky top-0 z-2`
  (above the `z-1` frozen first column; headers hand off per section since sticky is constrained
  to its filter wrapper). Long matrices now scroll inside the panel instead of the page; share
  page inherits. Lint + DB/env-free build green (27 ƒ Dynamic; one build attempt failed on a
  transient Google Fonts fetch, clean on retry).
- 2026-07-18 — **Export report re-skinned to the legacy design (per Naveen, rides on the step-8
  branch):** comparing a `web/` PDF export against a legacy sample showed the step-8 port had
  re-authored the report pages in muted grays. `export-dialog.jsx`'s SummaryPage/IssuesPage now
  follow the legacy export system (`src/styles.css` :1728-2152) verbatim: teal eyebrow/labels +
  2px teal divider, white bordered metric boxes w/ display numerals, 3-col accent filter cards,
  pastel Sprint-Health/Completion/Projected leadership cards (fixed print hex, new
  `OverallCard`), tinted table head, accent filter-header cells w/ display pct, zebra rows, teal
  mono keys, pill pct badges, bordered health badges, bordered right-aligned footer; print pages
  `p-8`; dialog toggles gained the legacy accent dots. Verified visually: temporary
  `/export-spike` fixture page screenshotted via headless Chrome against the legacy sample PDF
  (rendered w/ poppler) — page-for-page match — then deleted; lint + DB/env-free build green.
  Details in share-view-export.md as-built notes.
- 2026-07-18 — **Export capture font fidelity (follow-up, per Naveen: "font, weight and
  alignment still not accurate"):** the re-exported PDF drew everything at weight ~400 with
  drifted baselines even though the DOM pages were correct. Root cause: `next/font` served the
  type stack as **variable fonts**, and WebKit's canvas ignores `ctx.font` weights on variable
  fonts — legacy never hit this because its Google `@import` delivered per-weight **static**
  faces. Fixed by loading the legacy weight sets as static instances in `layout.jsx` (Manrope
  400–800, Inter 400–700, Mono 400–600; served CSS verified to emit single-weight `@font-face`
  rules) + `onclone: fonts.ready` in the capture options (clone-side metric race). Verified with
  a capture spike (in-page html2canvas-pro run + ctx.font weight probe): Chrome captures
  pre/post pixel-identical (no regression), WebKit path covered by the static faces legacy's own
  correct exports proved. Spike deleted; lint + DB/env-free build green. Details in
  share-view-export.md.
- 2026-07-18 — **Export font follow-up №2 (Naveen: side-by-side still off):** his re-export
  rendered *pixel-equivalent to the pre-fix 01:12 PDF* (150dpi crop comparison) — a **stale
  tab** that never loaded the static-font fix, not a code gap. Closed the loop by reproducing
  the exact capture pipeline (offscreen `-left-500` source + captureOptions) in **Playwright
  WebKit** against the fixed dev server: captured canvas matches DOM weights; ctx.font
  ink-density probe 400/700/800 = 37.3/52.1/59.5 proves WebKit canvas honors the static faces
  (variable fonts had collapsed 700/800 into synthetic bold — the artifact in his PDFs).
  Chromium re-verified; spike + temp exports removed; lint + DB/env-free build green. Remedy:
  hard-reload the app tab, then export.
- 2026-07-18 — **Export font follow-up №3 (Naveen: still off after re-export):** his 14:28/14:29
  exports still matched the stale rendering — and the `:3002` dev server was found **dead**
  shortly after (long-running since pre-fix; the repeated same-`.next` production builds likely
  wedged it), so a hard reload at that time couldn't have loaded fresh code — the exports came
  from the same stale tab. No local Manrope/Inter installed (local-font interference ruled out).
  Started a fresh dev server and completed the engine matrix via the capture-parity spike:
  **Chromium, WebKit, and Firefox (Playwright) all render the capture pipeline correctly**
  against current code — DOM-matching weights, 400/700/800 probe differentiated. No code change;
  spike + temp export reverted; lint green (build skipped deliberately — code byte-identical to
  the green builds, and a build would kill the dev server again). Remedy unchanged: reload the
  tab against the fresh server, then export.
- 2026-07-18 — **Export font follow-up №4 (July-legacy vs Aug-web PDF review):** the 15:23
  export proved **byte-near-identical to the stale 14:28 one** (14,614,116 vs 14,614,117 bytes)
  — every export today came from the same never-reloaded tab; html2canvas runs fully
  client-side, so a stale tab keeps exporting July-17 code (variable fonts → synthetic-bold
  canvas text) regardless of server restarts. Design parity itself re-confirmed against
  `July_2026_Release_Week4_Report_2026-06-24.pdf` (already page-for-page from the re-skin).
  Shipped one improvement doubling as a fresh-code sentinel: **export filenames now carry
  `_HHMM`** (`…_Report_2026-07-18_1530.pdf`) so same-day exports don't collide as "(1)"/"(2)"
  and a time-suffixed filename proves the fresh code ran. Lint green; dev server stopped for
  the build and restarted (:3002 → 200). User action: **close the app tab entirely**, open a
  fresh one, export — filename must end in `_HHMM`.
- 2026-07-18 — Planning session (no code): began refreshing @context/features/seed.md for
  **step 9** (localStorage importer); Naveen decided to **skip step 9** instead — no older sprint
  data remains in localStorage (current work already lives in `web/` via real syncs), so there is
  nothing to import. Master-plan step 9 marked **[SKIPPED]** and the §16 importer decision
  annotated as dropped; seed.md Status updated (draft kept for reference, refresh not written).
  **Next in order: step 10 (cutover)** — promote `web/` to repo root, delete the Vite app, Node 22
  bump per §16.
- 2026-07-18 — Planning session (no code): drafted @context/features/cutover.md (migration
  **step 10** — the final step). Ratified with Naveen: the Vite app is **backed up into
  `legacy/`, not deleted** (supersedes the §16 delete-at-parity plan) so it stays startable for
  reference (Node 20; `cd legacy && yarn dev:all`). Repo surveyed first (root vs `web/` layout,
  `turbopack.root` pin, dual lockfiles, untracked `.env`/`node_modules`/`.sessions`, legacy
  `docs/`). 10 decisions, notably: two-commit `git mv` (retire → promote) for rename-detection
  safety; Node 22 bump (`.nvmrc` + `engines`, delete `web/.yarnrc`) lands in the same feature
  after promotion with a fresh install; dev port stays :3002 (legacy keeps :3000/:3001 for the
  pending side-by-side); `turbopack.root` pin stays (repo remains dual-lockfile with
  `legacy/yarn.lock`); `.sessions/` **deleted** not backed up (plaintext tokens, §13);
  CLAUDE.md/AGENTS.md/README consolidation to root + `.claude/skills` path sweep; the pending
  human-acceptance items recommended before merge but no longer blocked by cutover (legacy stays
  runnable). Zero app-code changes; no schema/migration/deps. Not yet started — awaiting
  start-feature.
- 2026-07-18 — Picked @context/features/cutover.md as the current feature (migration **step 10**
  — cutover: promote `web/` to repo root, retire the Vite app into `legacy/`, Node 22 bump).
  Branch `feature/cutover` created.
- 2026-07-18 — **Implemented cutover (migration step 10 — the final step).** Phase 1: Vite app
  `git mv`'d into `legacy/` (54 renames; untracked `.env`/`node_modules`/`dist` hand-moved;
  plaintext-token `.sessions/` deleted; `legacy/README.md`; `sprint-tracker-legacy` rename;
  boot-verified under Node 20 — Vite :3000 → 200, Express :3001 → 401 JSON). Phase 2: `web/*`
  promoted to root (101 renames; `web/CLAUDE.md` deleted; `.env` moved; node_modules/.next
  dropped for a fresh install), root `.gitignore` = web's + re-added `.claude/*` rules (the
  predicted exposure fired and was caught). **Node 22 landed with it**: `.nvmrc` 22 +
  `engines >=22.12`, `.yarnrc` deleted, fresh install under 22.22.2 passed engines natively,
  postinstall regenerated the Prisma client. Config/docs: `turbopack.root` pin kept (comment
  updated), `sprint-tracker` rename, CLAUDE.md/README.md rewritten + AGENTS.md at root,
  `.claude/skills` `web/` sweep w/ **`verify-web` → `verify` rename** (Naveen), `.env.example`
  header, `legacy/**` ESLint-ignored (only config-behavior change — root lint swept the retired
  tree). Doc-synced project-overview (path note + Last-reviewed, §3 moot-flag, §7 retitled
  "Legacy architecture (retired)", 5× "unchanged until cutover" → "retired to legacy/", §10
  Framework row complete, §16 amendments incl. Node-22 DONE, master-plan step 10 DONE). Zero
  app-code changes; no schema change, no migration, no new deps. **Verified** (see Status).
  Commits d954be0 (docs) + 7ba9521 (phase 1) by Naveen — the Tekion gitleaks pre-commit hook
  can't fetch its config from the session shell; phase-2 commit pending. **Done** pending
  Naveen's human acceptance + merge. **Next:** post-v1 — trend/burndown UI from snapshots, then
  Gemini (risk call-outs + narrative first).
- 2026-07-19 — Planning session (no code): drafted @context/features/trend-burndown.md (post-v1,
  the master-plan step-10 "then" clause — the next in-order feature; cutover commits are on main).
  Trend/burndown UI from the step-7 `SprintSnapshot` rows: shared server-safe `TrendPanel`
  (hand-rolled inline SVG, **no new deps**) on `/` and `/rollup` under `MetricGrid`; pure
  `buildTrendSeries`/`combineSnapshotsByDay`/`snapshotVelocity` in `lib/metrics.mjs` (ideal +
  actual + trailing-7-day projection, "projected by end of sprint"); reads extend
  `dashboard-data.js` (batched, no new API routes); §12 velocity swap as an **additive
  `velocityOverride`** on the velocity card with the naive model kept as fallback so
  frozen-share/export numbers cannot drift (step-8 asOf invariant). 8 PROPOSED decisions incl.
  sum-as-is partial-day roll-up points w/ teamCount tags and a visible "trend accrues daily"
  empty state (cron scheduling on Tekion infra is still pending). No schema change, no
  migration, no new routes. Not yet started — awaiting start-feature.
- 2026-07-19 — Picked @context/features/trend-burndown.md as the current feature (post-v1 —
  trend/burndown UI from `SprintSnapshot`: shared SVG `TrendPanel` on `/` + `/rollup`, pure
  series/projection builders in `metrics.mjs`, snapshot-based velocity override). Branch
  `feature/trend-burndown` created.
- 2026-07-19 — **Implemented trend-burndown (post-v1 item 1 — the step-10 "then" clause).** Read
  the installed Next 16 server/client-component doc (Date props serialize; the TeamSummaryTable
  precedent) and the dataviz skill (validator run: teal/gray CVD ΔE 10.7 pass; teal 2.99:1
  contrast WARN relieved by stat chips + endpoint label + axis ticks; the gray ideal line's
  chroma-floor "fail" is intentional — reference line, not a series). Added pure
  `buildTrendSeries` (latest-total ideal, gap-tolerant actuals, trailing-7-day projection w/
  drawable `projection.line` — zero-crossing / clamped-at-end / flat-no-burn variants),
  `combineSnapshotsByDay` (per-day sums, issue-weighted avg, partial-day `teamCount` tags),
  `snapshotVelocity` (card-contract shape off the same `trailingBurn` basis; `weeksNeeded: null`
  when work remains w/ zero burn), and `formatDateUTC` to `lib/metrics.mjs`; snapshot reads
  (batched on `/rollup`, no N+1) + request-time `asOf` to `lib/dashboard-data.js`
  (`getShareData` untouched); server-safe `components/dashboard/trend-panel.jsx` (inline-SVG
  burndown w/ ideal/actual/projection, today marker, `<title>` tooltips, endpoint direct-label,
  legend, stat chips + projected-finish badge, visible 0-snapshot "accrues daily" state);
  additive `velocityOverride` on `MetricGrid` (naive string byte-identical; override appends
  "from daily snapshots"); wiring in `dashboard.jsx` + `rollup/page.jsx`. No schema change, no
  migration, **no new deps**, no new routes. Verified: **31/31 plain-Node fixtures**
  (hand-computed finish `2026-07-14T03:41:32.307Z`, window exclusion, zero/negative-burn +
  asOf-past-end guards, combine math, card contract); lint clean; migrate status up to date;
  **DB/env-free build green — 27 ƒ Dynamic unchanged**; **23/23 SSR smoke** on dev+Neon
  (fabricated 3-team PLANNING sprint, 7 snapshot rows w/ gap + partial day, minted cookie: 4
  markers/`14 pts left`/`~Jul 14` badge/`45.5 pts/wk` labeled card on `/`; combined
  `18 pts left`/`56 pts/wk`/`1 of 3 teams` on `/rollup`; 0-snapshot empty state + naive
  fallback; live share → no panel, naive velocity — the frozen/export invariant); RSC-flight
  markup doubling on the server-rendered `/rollup` identified and handled in the grep method;
  **headless-Chrome visual pass** over a temporary `/trend-spike` page (5 states — caught the
  flat-projection strike-through of the endpoint label; fixed by raising it). Fixture teardown
  0 leftovers; spike + `.tmp-trend/` harness deleted; dev server stopped (was not running
  before). As-built deviations in trend-burndown.md (series-prop panel, `asOf` from
  getDashboardData, no client-clock fallback, join-built velocity detail, roll-up totalTeams
  semantics, smoke mechanics). Docs synced (§3 VP-trend closed, §5 trend row BUILT, §11 panel
  note, §12 velocity swap + trend-series bullets, §14.1/§14.8 closed, master-plan step-10
  post-v1 clause). **Done** — ⚠️ Naveen's eyeball on real accrued snapshot data pending (cron
  scheduling on Tekion infra is the gate for density). **Next:** Gemini (risk call-outs +
  narrative first) — the last open post-v1 item.
- 2026-07-19 — **Iterated trend-burndown: compact chart (per Naveen — "way too big, occupies a
  lot of real estate").** Root cause: uniform viewBox scaling — 760×236 + `w-full` grew past
  500px tall on wide monitors. Fix: flatter **760×190** viewBox + **`max-w-3xl`** cap on the
  `<svg>` (≈190px rendered height on any screen; card still spans the full-bleed column; no
  `preserveAspectRatio` distortion). Verified via an 1800px headless-Chrome capture of the
  recreated `/trend-spike` page (both projection states clean; spike deleted after); lint
  clean. **Build deliberately skipped** — Naveen's dev server holds :3002/.next (export-saga
  lesson) and the diff is two presentational constants over a green build; re-run `yarn build`
  before commit. Spec as-built note updated.
- 2026-07-19 — **Iterated trend-burndown №2: two-up row w/ Risk call-outs (per Naveen — right of
  the chart wasted real estate; suggested risk call-outs).** The row is now `grid xl:grid-cols-2`
  (stacks below xl): burndown left, new server-safe
  `components/dashboard/risk-callouts-panel.jsx` right — the **deterministic forerunner of the
  §16 Gemini risk-call-outs use case** (no AI, no new data plumbing): trend signals (no-burn /
  off-pace, guarded on remaining > 0) + worst-first issue list (Blocked → Behind → At Risk,
  points desc, cap 6 + overflow line), inline blockedReason (`/` only), Jira-linked keys on `/`,
  teamKey chips on `/rollup` (issues flat-mapped from perTeam), all-clear state, severity stripe.
  Wired in dashboard.jsx + rollup/page.jsx. Verified: lint clean; 1800px headless-Chrome capture
  of the recreated spike (populated + signal-only rows; deleted after). Build still deferred to
  pre-commit (Naveen's dev server holds :3002/.next). Docs synced (§11 note → two-up row; spec
  as-built). Naveen's first REAL snapshot landed meanwhile (cron run: 91% complete, 6.7 pts
  left, single-dot state rendering as designed).
- 2026-07-20 — Planning session (no code): drafted @context/features/ai-insights.md (post-v1
  item 2 — the master-plan step-10 "then Gemini" clause, **reframed per Naveen as a
  provider-agnostic AI platform**: all AI specifics behind a neutral `generateJson` contract in
  `src/lib/ai/` (the `lib/jira/` isolation precedent), provider switched by `AI_PROVIDER` env —
  downtime/cost switching is an env flip + restart, zero code changes; **Gemini demoted to first
  adapter, an Anthropic adapter ships alongside to prove the abstraction** via contract-faithful
  mocks). Use cases: §16's risk call-outs + leadership narrative as an on-demand **"AI Digest"
  dialog** on `/` (Hero button → generate → headline/narrative/call-outs → Copy + toast; the
  deterministic RiskCalloutsPanel stays). Decision 1 (provider-agnostic, env-switched) ratified
  with Naveen 2026-07-20; 9 PROPOSED incl. zero-dep fetch adapters, one new `POST …/ai-digest`
  route (27→28 ƒ Dynamic), TEAM_ALL_ROLES generation, no persistence/schema change, pure
  `digest.mjs` prompt builder (worst-N mirror of the risk panel, never raw Jira dumps),
  zod-validated JSON contract w/ one repair retry, 502/503 error mappings,
  dormant-when-unconfigured (build stays env-free). Out of scope: roll-up digest (fast follow),
  export/share narrative, Q&A + stage suggestions, auto-failover chains, persistence, streaming.
- 2026-07-20 — Picked @context/features/ai-insights.md as the current feature (post-v1
  item 2 — provider-agnostic AI platform in `src/lib/ai/` w/ Gemini + Anthropic fetch adapters,
  env-switched; on-demand "AI Digest" dialog on `/` for risk call-outs + leadership narrative).
  Branch `feature/ai-insights` created.
- 2026-07-20 — **Implemented ai-insights (post-v1 item 2 — the last master-plan clause).** Read
  the house patterns (rbac/route-helpers/sync-route/dashboard-data/share-dialog) + the claude-api
  skill first; verified the Gemini REST shape + current model ids against live docs
  (`gemini-3.5-flash` stable; key sent via `x-goog-api-key` HEADER, not the docs' `?key=` form —
  keys stay out of URLs/logs). Built the platform (`src/lib/ai/`): `provider.js` (lazy
  `getAiConfig` — loud-fail on unknown provider/missing key, `AiNotConfiguredError` dormant
  state; `generateJson` = adapter call → fence-strip parse → zod gate → ONE repair retry;
  30s `AbortSignal.timeout`), `errors.js` (shared, avoids a provider↔adapter circular import;
  curated `providerHttpError`, ≤200-char provider message, never raw payloads), fetch-only
  `adapters/gemini.js` (`generationConfig.responseMimeType/responseSchema`,
  `toGeminiSchema` strips `additionalProperties` — subset dialect) + `adapters/anthropic.js`
  (`output_config.format` json_schema, refusal → 502, no sampling params); pure
  `src/lib/ai/digest.mjs` (`buildDigestInput` — worst-N mirror of the risk panel w/ lockstep
  comment, ISO dates, velocity-basis tag; `buildDigestPrompt` — injection-guard system prompt;
  `sanitizeDigest` — hallucinated-key filter) + `src/lib/schemas/ai.js` (zod contract + strict
  JSON-schema rendering, lockstep); `POST …/ai-digest` route (TEAM_ALL_ROLES, `getDigestData`
  added to `dashboard-data.js`, same metrics/trend/velocity derivations as the board, 400
  empty-board guard, 503 dormant / 502 provider / 500 misconfig); UI: `ai-digest-dialog.jsx`
  (Generate/Regenerate/Copy → clipboard + toast, severity-badged call-outs w/ validated Jira-key
  links, provider·model·time attribution + verify disclaimer), Hero "AI Digest" (Sparkles,
  hidden on welcome), `Dashboard` wiring on `aiEnabled` (from `isAiConfigured()`,
  `AI_PROVIDER`-set only so misconfig stays loud-visible); `.env.example` AI block (both keys
  coexist — switching = flip `AI_PROVIDER`; `AI_MODEL` cost lever; advanced `*_BASE_URL`
  overrides for mocks/proxies). No schema change, no migration, no new deps. Verified: 39/39
  plain-Node fixtures (real-metrics-fed digest input, hand-checked `2026-07-23` projection,
  order/cap/overflow, prompt determinism, sanitize, contract); lint; migrate status; DB/env-free
  build **28 ƒ Dynamic**; 25/25 dev+Neon smoke w/ contract-faithful mock providers (wire-shape
  assertions incl. no-key-in-URL + schema-dialect strip; 401/403/404/400 gates; VIEWER 200;
  **swap proof: `AI_PROVIDER` flip → identical digest, zero code**; garbage→repair→200;
  garbage/500/refusal → 502; dormant 503 + hidden button; bogus provider → 500; share page
  no-AI). One harness bug found (mock prompt parser vs repair-retry append), zero app bugs;
  fixture 0 leftovers, `.env` byte-identical, dev server healthy. Docs synced (§5 row BUILT in
  part, §8 line, §10 AI row, §14.10 fixed, §16 amendment, master-plan clause DONE + remaining
  ideas). **Done** — ⚠️ human acceptance: real key + provider flip. **Next:** roll-up digest
  (fast follow), export narrative, or §16's Q&A / stage suggestions.
- 2026-07-20 — Planning session (no code): drafted
  @context/features/risk-comments-rollup-digest.md per Naveen's three asks — (1) board-level
  **risk comments** on the RiskCalloutsPanel (known/agreed risks communicated upward as managed
  context), (2) `/rollup` **"View all risks" dialog** (every risky issue across teams w/ team
  chips, blocked reasons, comments — also fixes the roll-up's inaccurate "see the matrix below"
  overflow line), (3) the **roll-up AI digest** (the ai-insights fast follow: portfolio prompt w/
  per-team comparison; commented risks narrated as known/agreed). Asks ratified 2026-07-20;
  10 PROPOSED decisions, notably: **first schema change since add-user-isadmin** —
  `IssueProgress.riskComment String?` + migration (presence = acknowledged, survives sync, never
  a metric input); comment writes ride the existing progress PUT (no new route there); flat
  membership-derived `POST /api/rollup/ai-digest` (28 → 29 ƒ Dynamic) reusing `getRollupData`;
  same digest contract (team attribution in text); `AiDigestDialog` generalized via an
  `endpoint` prop; share/export stay comment- and digest-free. Sequencing: branches off the
  uncommitted `feature/ai-insights`. Not yet started — awaiting start-feature.
- 2026-07-20 — Picked @context/features/risk-comments-rollup-digest.md as the current feature
  (risk comments on the risk panel + roll-up all-risks dialog + roll-up AI digest; first schema
  change since add-user-isadmin). Branch `feature/risk-comments-rollup-digest` created off
  `feature/ai-insights`. ai-insights remains **Done** (uncommitted diff rides along).
- 2026-07-21 — **Implemented risk-comments-rollup-digest (Naveen's three asks: risk comments,
  roll-up all-risks dialog, roll-up AI digest).** Added `IssueProgress.riskComment String?` +
  migration `20260720065659_add_issueprogress_riskcomment` (§9 synced same change) — the first
  schema change since `add_user_isadmin` (2026-06-15). Extended `progressWriteSchema` +
  the progress PUT route (`riskComment` independent of blocked, undefined→keep,
  empty/whitespace→clear to null, never auto-cleared by block/unblock). Centralized
  `blockedReason`/`riskComment` pass-through in `lib/metrics.mjs`'s `resolveProgress`/
  `computeSprintMetrics` (annotation only, never a scoring input) so every caller — `/`,
  `/rollup`, both AI digest builders — gets them automatically and per-team-correctly with no
  extra plumbing; `risk-callouts-panel.jsx` dropped its old `progressByKey` prop in favor of
  reading the fields directly off each issue, gained a "Known" badge, an optional per-row
  `onEditComment` affordance, an `onViewAll` header chip, and exported `sortRiskyIssues`/
  `IssueKey`. New `risk-comment-dialog.jsx` (board, writer-gated) and
  `components/rollup/rollup-risk-section.jsx` (roll-up, read-only "View all risks" dialog listing
  every risky issue across teams — replacing the roll-up's inaccurate "see the matrix below"
  line) wired into `dashboard.jsx`/`rollup/page.jsx`. `getRollupData` now selects
  `blockedReason`/`riskComment` + returns `aiEnabled`. Roll-up digest: `digest.mjs` grew shared
  `velocityPayload`/`trendPayload`/`riskIssuePayload` helpers plus
  `buildRollupDigestInput`/`buildRollupDigestPrompt` (per-team summary lines + cross-team
  worst-N risks, capped at 12; `riskComment`/"known" flows into the team digest's prompt too);
  new flat `POST /api/rollup/ai-digest` (`requireUser` → `getRollupData` → 403 zero-membership /
  404 sprint-mismatch / 400 empty-portfolio); `AiDigestDialog` generalized to
  `endpoint`/`body`/`intro` props (both call sites updated); new
  `components/rollup/rollup-digest-button.jsx` in the roll-up hero. **Found + fixed one platform
  bug outside the original scope, flagged rather than silently patched:** live-smoke against real
  Gemini (`gemini-3.5-flash`) truncated mid-JSON (`finishReason: MAX_TOKENS`) on BOTH the new
  roll-up route and the existing, unmodified team route — the model spends part of
  `maxOutputTokens` on invisible "thinking" tokens; fixed by passing `maxOutputTokens: 4096` at
  both `generateJson` call sites (no change to `lib/ai/provider.js` or the adapters). No other
  schema change, no new deps. Verified: lint clean; `prisma validate`/`migrate status` up to date
  (3 migrations); **DB/env-free build green — 29 ƒ Dynamic** (`.env` genuinely moved away for the
  check, not just shell-unset — exactly the new `/api/rollup/ai-digest` route added); **20/20
  plain-Node fixtures** (metrics pass-through, cross-team worst-N ordering, prompt determinism,
  sanitize, progress-schema rules); **41/41 SSR/API smoke** on dev+Neon against a fabricated
  3-team fixture with a **colliding `jiraKey` seeded in two teams with different comments**
  (proving no cross-team progress-map merge): PUT mechanics incl. create-on-first-write/403/404/
  400/empty-clear, a simulated Issue-cache replace leaving the comment intact, board SSR (Known
  badge, edit affordance present for writer/absent for VIEWER), roll-up SSR (both teams' distinct
  comments visible, "view all risks" wording, correct "View all (N)" count), the roll-up digest
  route's full gate matrix, **one real live generation** (the model correctly narrated the
  commented risk as managed/known context), a regression check that the team digest route still
  works post-refactor, and a share-page check confirming no comments/digest leak onto share
  pages. Fixture torn down to 0 leftovers, temporary harness deleted; a stale dev server (running
  since before today's migration, holding an outdated Prisma client) was found and restarted
  cleanly mid-verification — unrelated to app code. **Done.** ⚠️ Pending human acceptance:
  Naveen adds a comment to a real issue, confirms it on `/rollup` (panel + dialog), and judges a
  real roll-up digest's narrative quality. **Next:** export-embedded AI narrative, AI Q&A over
  sprint data, or stage suggestions.
- 2026-07-20 — **Risk-panel iteration (per Naveen; rides on the ai-insights branch):** the
  `/rollup` Risk call-outs now link Jira keys (`getRollupData` returns the env-derived
  `jiraBaseUrl`; the panel already took the prop) and the ragged rows are fixed — the list is a
  shared-track grid (`ul` grid + `col-span-full grid-cols-subgrid` rows, 4 cols on `/`, 5 with
  the roll-up's teamKey chips) so badge/chip/key/title/pts align as columns on both boards.
  Verified: lint; live-server smoke w/ minted admin cookie (linked `browse/GM-*` keys + 5-col
  track on `/rollup`, 4-col on both team boards, subgrid utilities in compiled CSS; harness
  deleted). Build deferred to pre-commit (dev server holds :3002/.next). Docs synced (§11 note,
  trend-burndown.md as-built).
- 2026-07-21 — Planning session (no code): drafted @context/features/gm-bug-report.md — automate
  the manual **daily GM bug report** (category × External/Internal × P0/P1/P2+ matrix with
  SLA-breach overlays) as a config-driven executive dashboard at **`/bugs`**, modelled on the
  `gm-security-vulnerabilities-tracker` PDF. **Probed live Jira first and killed two assumptions:**
  `project = GM` yields ~3 bugs in 60 days (30/30 recent open issues are component `DR_GM`, 26
  Tech Story) against a report counting 221 — so the universe is the GM *program*, not the project
  key; and `issuetype in ("Internal Bug","Support Bug")` returns **zero** in GM, so external-vs-
  internal is not issue-type-driven. Conclusion: never hardcode a universe — it is all config.
  Seven decisions **ratified with Naveen**: rows configurable / columns fixed; new top-level
  `/bugs` route (not a `/rollup` tab — the roll-up is sprint-scoped and this is not); cached +
  daily cron + manual Refresh; full exec dashboard in v1; **every filter is a saved Jira filter
  ID** entered in `/admin` and resolved via the existing `fetchFilter`; **SLA breach is a
  configured filter**, breach = `cell ∩ breachedSet` (no SLA math in our code); snapshot every
  cell daily. Nine more PROPOSED, notably: cells as **local set intersections** (~6+N Jira calls,
  not 36 count queries); `Total` = the universe set and `Wrong Component / Status` = universe −
  ∪(categories), so the hygiene row self-maintains and the arithmetic always reconciles;
  first-match-wins category assignment with overlaps surfaced not hidden; two-layer storage
  (`BugReportIssue` cache vs `BugReportSnapshot` history, the `Issue`/`SprintSnapshot` precedent);
  self-describing snapshot rows so renaming a category never orphans history; **service
  credential for both cron and manual refresh** (a deliberate departure from step-5's per-caller
  rule — one shared org artifact must not flip-flop per viewer); a failed filter **aborts before
  writing** rather than silently zeroing a row; hand-rolled inline SVG, no charting dep.
  **First non-sprint-scoped read path in the app** — 3 new models + 2 enums, one migration
  (4 total), ~6 new routes (29 → expected 35 ƒ Dynamic), new `lib/bug-report/{matrix.mjs,
  refresh.js}`, cron extension, admin config surface, 10 dashboard panels. Flagged as the largest
  feature to date; panel set may land incrementally. Acceptance turns on **one real run against
  Naveen's live filter IDs matching the manual report cell-for-cell** — fixtures only prove the
  arithmetic. Not yet started — awaiting start-feature.
- 2026-07-21 — **Spec revised same day after Naveen supplied the real universes + reversed two
  ratified decisions.** (1) **Two universes, not one:** Internal = `project = GM`, External =
  `project = "Tekion Engineering" AND type = "Tap Ticket" AND component = DR_GM` — so class is
  *which project the bug lives in*, and the two are disjoint. **Probed both live and the External
  one reconciles EXACTLY with the manual table**: 59 issues (no next page), P1 **28**, P2 25 + P3
  1 + P4 5 = **31** — matching 28/31/59, which also proves `P2+` = P2+P3+P4. Status-driven
  categories confirmed too: live `Backlog + Dev To Do + Dev In Progress + Blocked + Pending RCA`
  = **21** = the manual Engineering Team external count. (2) **Categories are ordered status
  lists** (`QA → Testing`, `Product → PM Backlog`), configurable in admin, Naveen supplying the
  exact mapping. (3) **REVERSAL of decision 9:** unmatched statuses fall back to a configurable
  **fallback category** (Engineering Team), not the `Wrong Component / Status` residual row —
  which is why the Engineering=21 match works, and why that row is all dashes in his table.
  (4) **REVERSAL of decision 6:** SLA breach is **no longer a Jira filter** — admin configures SLA
  **days per priority per scope** (P0–P4 × External/Internal) and breach = `created + days < now`.
  (5) **Multi-report promoted from Out-of-scope to a v1 requirement** ("tomorrow I should be able
  to get a similar dashboard for Project = Honda") → `/bugs/[slug]`, configurable scopes/bands/
  categories, and a "Duplicate report" action. (6) The security-tracker PDF is **visual reference
  only** — its program-specific panels (release plans, 1.0/2.0 bifurcation, timeline, Slack feed)
  are dropped. Design consequences: the key-set-intersection pipeline **collapses to ~1 paginated
  fetch per scope** (status/priority/created ride on issues we already fetch); the cache now
  stores **raw Jira facts only** with band/category/breach classified **at read time**, so admin
  config edits re-render instantly without a Jira refresh; bands become a configurable
  priority-name→band map with a catch-all. **Pushed back on one ask:** Naveen floated doing
  priority bucketing "programmatically or using AI tools" — recommended the config map, *not* AI,
  since priority→band is finite, stable and auditable and an LLM would add nondeterminism to a
  number leadership reads daily (AI belongs in the narrative over these numbers, never in
  producing them). Spec rewritten: 7 models, 4 API routes + 2 pages (29 → expected 35 ƒ Dynamic),
  18 decisions with the two reversals flagged authoritative. Still awaiting start-feature.
- 2026-07-21 — Naveen restated that **everything** must be admin-configurable (category→status
  mapping, SLA days, and both universe filters) — already decision 1 + scope (h); spec annotated
  to say the app ships with an **empty config** and a "no report configured yet" state, so no
  filter id, status, or SLA value is ever a build-time constant. He supplied two **test filters**:
  External `68840`, Internal `68841`. Probed both live — they resolve and are visible: **68840 →
  57 issues** (no next page; P0 0 · P1 **28** · P2+ 29) and **68841 → >100** (paginated, total
  unknown from one page; first page P0 18 · P1 37 · P2 42 · P3 3). Recorded in the spec as dev/
  smoke inputs, with the note that 68840 returns **57 vs the 59** my hand-written JQL returned —
  the configured filter is the source of truth and drift from the pasted manual table is expected.
  Also captured the **observed status vocabulary** across both scopes (Support Clarification, PM
  Backlog, Backlog, Pending RCA, Testing, Dev To Do, Dev In Progress, Code Review, Blocked, OEM
  Review, Awaiting ED Acceptance) — `OEM Review` appears in neither the manual table nor any
  category, i.e. exactly what the fallback category absorbs. Two spec additions off the back of
  it: (1) the admin category/SLA editors are **pickers over the observed vocabulary, not free
  text** (a typo'd status would silently drain issues into the fallback and nobody would notice);
  (2) a new acceptance check — a real two-scope run against 68840/68841 **through the config UI**,
  exercising filter-ID resolution and >100-issue pagination. Still awaiting start-feature.
- 2026-07-21 — Picked @context/features/gm-bug-report.md as the current feature (Bug Report
  dashboards — config-driven category × scope × band bug matrix + executive dashboard at `/bugs`,
  multi-report from day one). Branch `feature/gm-bug-report` created off `main` (583d8f5).
  risk-comments-rollup-digest remains **Done**.
- 2026-07-21 — **Implemented gm-bug-report (config-driven bug matrix + executive dashboard at
  `/bugs`).** Read the installed Next 16 / Prisma 7 patterns and the house route/RBAC precedents
  first, and ran the **dataviz** skill's validator before any chart code (teal `#00a892` + blue
  `#3b82f6`: CVD ΔE 19.9 protan / 20.9 normal — PASS; the lone contrast WARN discharged by direct
  labels + the matrix as table view; `#ef4444` reserved for SLA breach). Added **7 models** +
  migration `20260721190833_add_bug_report_models` (§9 synced byte-consistent, ER diagram +
  rationale bullet) — the largest schema change since `init` and the **first non-sprint-scoped read
  path in the app**. Pure `lib/bug-report/matrix.mjs` (`resolveBand`/`resolveCategory`/`isBreached`/
  `buildMatrix`/`snapshotRows`/`diffMatrix`/`agingBuckets`/`daysOverSla`/`cellJql`/`validateConfig`/
  `DEFAULT_BANDS`); `lib/bug-report/refresh.js` (resolve → fetch-all → **abort before the first
  write** → transactional cache replace → snapshot; `resolveRefreshAuth` prefers the service
  credential so the headline number can't differ per viewer); `searchIssues` gained optional
  `maxIssues` (never truncates — throws); 4 routes (`/api/bug-reports`, `/[reportId]`,
  `/[reportId]/config` as ONE transactional document, `/[reportId]/refresh` open to any
  authenticated user) + `schemas/bug-report.js` + a cron extension with per-report error isolation;
  `lib/bug-report-data.js` + `/bugs` + `/bugs/[slug]`; 10 panels across 6 files (matrix, KPI cards,
  charts, lists, page body, client actions leaf); `admin/bug-report-config.jsx` whose status/priority
  inputs are **pickers over the observed vocabulary, not free text** (a typo'd status would
  otherwise drain issues into the fallback silently). TopBar "Bugs" link on `/` and `/rollup`.
  **Found and fixed two real bugs during verification, both Prisma's 5s interactive-transaction
  timeout (P2028):** the config save (~20 sequential round-trips, 6.8s — fixed by moving the
  read-back outside the transaction and budgeting 30s) and `writeSnapshot` (one upsert per cell,
  ~70 cells, 5.7s, failing the refresh *after* the cache had been replaced — replaced with
  `deleteMany + createMany`, 2 statements, still atomic and one-set-per-day). The installed
  `react-hooks/purity` rule also caught `Date.now()` in `BugTicketTable`'s render — a genuine
  violation of this feature's own `asOf` discipline, fixed by threading the request-time clock.
  Verified: lint; `prisma validate` + `migrate status` (**4 migrations**); **DB/env-free build green
  — 35 ƒ Dynamic** (`.env` genuinely moved away and restored); **80/80 plain-Node fixtures**;
  **49/49 SSR/API smoke on dev+Neon against the REAL filters 68840/68841** (RBAC gates, config
  validation rejecting a duplicated status and two catch-alls, live refresh **External 58 · Internal
  173 · 231 total · 60 snapshot rows** with pagination proven, matrix partition checks, idempotent
  re-run, failure isolation leaving cache **and** snapshots untouched, full panel SSR with
  drill-down hrefs, and an **SLA edit moving breaches 81 → 0 with no Jira refresh** — proving
  read-time classification); post-build runtime smoke; **headless-Chrome visual pass at 1440/1800px**
  on real data (13 columns fit, no page overflow). A stale dev server holding a pre-migration Prisma
  client was found and restarted mid-verification. As-built deviations recorded in the spec (panel
  files consolidated 10 → 6; snapshot upsert → delete+createMany; scope edits without an id
  cascade-drop that scope's cache; SLA days capped at 3650). Fixture torn down to **0 rows across
  all 7 tables**, harnesses + temporary spike page deleted. Docs synced (§5 row, §8 line, §9 Prisma
  block + ER diagram + rationale, §11 note, RBAC row, §16 amendment incl. **both reversals**, master
  plan step-10 clause). **Done** — ⚠️ Naveen's production-config run is the acceptance that matters.
  **Next:** export/share for `/bugs`, export-embedded AI narrative, AI Q&A, or stage suggestions.
- 2026-07-22 — **Fixed trend-chart clipping + dead space (per Naveen: "UI is chopping").** Two
  defects in `BugTrendPanel`, both invisible to the SSR assertions and only visible once a second
  capture existed: (1) the endpoint value label is drawn above the last point, so when that point
  IS the series max it sat at `PAD.top − 10` and had its glyph tops sheared off by the viewBox
  (Naveen's screenshot showed "233" cut in half) — clamped to `Math.max(…, 12)` with `PAD.top`
  raised to 24; (2) the `max-w-3xl` cap inherited from the sprint TrendPanel left ~a third of the
  card empty whenever the two-up row collapses to full width below `xl` — dropped the cap and
  widened the viewBox to **1000×190** so the chart fills its card at any width while staying
  ~200px tall at 1200px. Re-verified against **Naveen's real `gm` report** (233 issues, 2 capture
  days — he had configured it himself in `/admin`): label renders whole, chart spans the card, and
  the newly-available deltas render correctly (`233 ▲2`, `98 ▲6`, per-cell `▲2`/`▼1` in the
  matrix). Lint clean; **DB/env-free build green — 35 ƒ Dynamic**; spike page removed, dev server
  restored. Presentation-only change — no schema, route, or data-path impact.
- 2026-07-22 — **Fixed malformed drill-down JQL (per Naveen: "hyperlink on those issue count is
  not accurate").** `cellJql` inlined each scope's `resolvedJql` in parentheses, but **saved Jira
  filters end with `ORDER BY …`** (68840 → `ORDER BY assignee DESC`, 68841 → `ORDER BY created
  DESC`) and `ORDER BY` is only legal at the very end of a query — so every cell link emitted
  `(… ORDER BY assignee DESC) AND status IN (…)`, a **syntax error**, not a narrower search. This
  was invisible to the earlier smoke, which asserted the links were *well-formed URLs*, never that
  Jira accepted the JQL. Two fixes in `matrix.mjs`: a saved-filter scope is now referenced as
  **`filter = <id>`** (always valid, and stays correct if the filter is edited in Jira), and
  raw-JQL scopes get a trailing top-level `ORDER BY` stripped via a new quote-aware `stripOrderBy`
  (a status named "Order by date" survives). **Verified against live Jira on Naveen's real `gm`
  report: 20/20 cells match the dashboard exactly** — all 5 bands × 2 scopes, both scope totals,
  and every category row including the fallback (`status NOT IN (others)`, independently confirmed).
  The first pass showed 3 Internal cells off by +1; a refresh resolved them, confirming plain cache
  staleness (by design) rather than a composition bug. Fixtures grew to **85/85** with 7 new
  `cellJql` cases (filter-id precedence, ORDER BY stripping incl. case-insensitivity and the
  quoted-literal edge). Lint clean; **DB/env-free build green — 35 ƒ Dynamic**; harnesses deleted,
  dev server restored.
- 2026-07-22 — **Made drill-down links self-describing (per Naveen: "the links are not considering
  project space, type, status and component").** The previous fix referenced each universe as
  `filter = <id>`, which yields the correct COUNT but is **opaque**: Jira's navigator can't show
  the criteria, and a viewer without access to that saved filter gets an error. Since
  `stripOrderBy` had already made inlining safe, `scopeClause` now **inlines the resolved JQL**, so
  a cell link carries the full universe — `project in ("Tekion Engineering") and type in ("Tap
  Ticket") and status not in (…) and "Program[Select List (multiple choices)]" = GM and component =
  DR_GM` — plus the cell's own `status IN (…) AND priority IN (…)`. It also pins each link to
  exactly the JQL that produced the cached numbers, so links can't diverge from cells when a filter
  is edited in Jira between refreshes; `filter = <id>` remains only as the fallback for a
  saved-filter scope never yet resolved (before the first refresh), where inlining nothing would
  widen the search to the whole instance. **Re-verified against live Jira: 20/20 cells match**
  (first pass showed 2 External mismatches — a refresh confirmed the scope had genuinely dropped
  62 → 61, i.e. staleness again, not composition). Fixtures **87/87** (4 new cellJql cases: inlining
  precedence, unresolved-filter fallback, no-source case). Lint clean; **DB/env-free build green —
  35 ƒ Dynamic**. Note: the production build clobbers `.next` and leaves the dev server 404ing —
  cleared `.next` and restarted (the repo's known same-`.next` hazard).
- 2026-07-22 — **Fixed the drill-down universe being dropped for every cell (per Naveen: "the href
  generation logic … doesn't filter by project, type, status and component" — links were a bare
  `priority IN (…)`).** Root cause: `buildMatrix` returns **trimmed** scope objects
  (`{ id, name, bands }`, no source fields) and `bugs-page.jsx` fed those into `cellJql`, so
  `scopeClause` found no `resolvedJql` and emitted nothing. **A verification gap of mine:** the
  earlier live-Jira checks passed the *full* `report.scopes` object, a path the real render never
  takes — they proved counts, never the actual hrefs. Fixed by resolving the full scope by id
  inside `getBugReportData`'s `cellJql` closure. Re-verified by parsing the hrefs out of the
  **rendered `/bugs` HTML**: **39/39 carry their scope's full universe**, 0 bare; added a fixture
  reproducing the trimmed-scope drop + fix (**90/90**). Lint clean; **DB/env-free build green — 35 ƒ
  Dynamic**; `.next` cleared + dev server restarted (build-clobbers-.next hazard again).
- 2026-07-22 — **Added a distinct drill-down for breached cells (per Naveen: "I don't see the href
  for the breached items").** The red `(m)` count was inside the cell's single anchor, so clicking
  it opened all open items, not the breached subset. Added `cellBreachedJql` (`matrix.mjs`): the
  cell JQL AND an OR of `(priority = P AND created < -{days}d)` over the column's SLA-targeted
  priorities (per-priority day thresholds, so it can't be one clause; `null` when the column has
  no SLA target). `bug-matrix.jsx` now renders count and `(m)` as **sibling** links (nested `<a>`
  is invalid) — count → full cell, `(m)` → breached subset — wired via a new `buildBreachHref` +
  `cellBreachedJql` closure in `getBugReportData`. **Verified live: 20/20 breach counts match the
  composed JQL exactly**; the rendered `/bugs` HTML emits **32 distinct breach links** (`created <
  -Nd`) alongside 39 open-cell links. Fixtures **94/94** (4 new: per-priority term, no-SLA-target
  → null, scope-total OR, empty-SLA → null). Lint clean; **DB/env-free build green — 35 ƒ Dynamic**.
- 2026-07-23 — Naveen asked to modernize the UI while keeping Tekion, with a settings theme toggle,
  referencing two Figma dashboards. Explored the theming architecture, ratified four scope choices
  (recolor-only, one synthesized "Modern" theme, user-menu localStorage toggle, dark mode out), and
  **implemented a recolor-only indigo theme** on `feature/theme-switcher` (additive
  `:root.theme-modern` tokens, no-FOUC boot script, `ui/theme-toggle.jsx`, wired into the three top
  bars; lint + DB/env-free build green). Figma frames couldn't be captured (no Figma integration;
  Figma won't render via WebFetch), so the palette was synthesized.
- 2026-07-23 — Naveen then supplied **three of his own mockups** (a dark icon-rail board, a
  light-sidebar leadership roll-up, a dense no-sidebar board) — revealing the real Modern theme is
  **blue with a left sidebar (a layout shift)**, not the indigo recolor. Built a high-fidelity
  **design board Artifact** reproducing all frames on one token set
  (https://claude.ai/code/artifact/d84f5b02-0e84-401f-a303-e2ab50a9d520), then extended it with
  **Bugs and Admin frames** grounded in the real page components. Naveen **approved the board**,
  confirmed the layout shift + a unified dark sidebar. Per his instruction: **reverted the indigo
  attempt in full** (restored `globals.css`/`layout.jsx`/the three top bars, deleted
  `ui/theme-toggle.jsx` + `context/features/theme-switcher.md`, deleted branch `feature/theme-switcher`
  — `main` clean), and **drafted this plan** (@context/features/modern-theme.md): a blue,
  sidebar-shell Modern theme in three phases (mechanism + tokens → app shell + sidebar → component
  parity), CSS-driven layout swap, no schema/route change. **Awaiting go-ahead to start-feature.**
- 2026-07-24 — Started `feature/modern-theme` and implemented **Phase A + B**. Phase A (mechanism +
  blue tokens): added `@custom-variant modern (&:is(.theme-modern *))` + an additive
  `:root.theme-modern` blue block (primary `#2f6bff`, canvas `#eef1f5`, ink `#17181b`, radius
  `0.75rem`) + hero/`::selection`/`--shadow-brand` re-hue in `globals.css`; no-FOUC boot script +
  `suppressHydrationWarning` in `layout.jsx`; new `ui/theme-toggle.jsx` wired into all three top bars
  + the admin header (reachable in both themes). Phase B (the layout shift): new `ui/app-shell.jsx` +
  `ui/app-sidebar.jsx` — a dark nav sidebar (active-route highlight via `usePathname`, collapse↔icon
  rail via a `localStorage` pref), revealed only under Modern (`hidden modern:flex`) so Tekion is
  byte-for-byte unchanged (CSS-reveal, decision 3); wrapped `/`, `/rollup`, `/bugs`, `/admin` in
  `AppShell`; hid top-bar nav links + brand under Modern via `modern:hidden`. Verified: lint clean;
  DB/env-free build green — **35 ƒ Dynamic (unchanged)**; Modern tokens + both `modern:` rules + hero
  override + sidebar chunk confirmed in the compiled bundle; boot script served; routes 200/307 (a
  pre-existing dev server on :3002 hot-reloaded the changes). No schema/migration/route/dependency
  change. **Phase C next** (monochrome chips, matrix/KPI parity, motion polish, responsive sidebar).
  ⚠️ Authed visual pass in both themes pending (browser extension not connected). Not committed.
- 2026-07-24 — Implemented **Phase C** (the "wow" pass) and marked modern-theme **Done**.
  (1) **Monochrome status chips under Modern:** marked the health chips (`Badge tone={health.tone}` in
  team-summary + risk-callouts → `.health-chip`; the matrix pill in `issue-row` → `.health-pill`) and
  added an unlayered `:root.theme-modern .health-chip/.health-pill` blue override — sprint-state
  badges and toasts keep their semantic tones; semantic color survives in matrix dots, card accents,
  and SLA-breach counts. (2) **Theme-swap cross-fade:** `theme-toggle.jsx` adds a `.theme-transition`
  class to `<html>` for ~450ms around the flip, and a `prefers-reduced-motion`-guarded rule in
  `globals.css` cross-fades color/border/shadow only during the swap (never during normal use).
  (3) **Responsive sidebar:** `modern:flex`→`modern:lg:flex` and `modern:hidden`→`modern:lg:hidden`
  so the sidebar shows at `lg+` and Modern falls back to top-bar nav below `lg` (mobile isn't
  cramped). Verified: lint clean; **clean-rebuild DB/env-free build green — 35 ƒ Dynamic**; the
  `modern:lg:*` variants (correctly nested under `@media (min-width:64rem)` + `:is(.theme-modern *)`),
  the monochrome-chip override, and `theme-transition` all confirmed in the fresh bundle; source has
  no bare `modern:flex/hidden` left (only comments). Doc-synced project-overview §10 Styling row + §11
  (BUILT note). No schema/migration/route/dependency change. ⚠️ Authed visual pass in both themes
  pending (browser extension not connected). Not committed.
- 2026-07-24 — **Hero iteration (per Naveen): added a 7-phase delivery bar** to the dashboard hero to
  depict overall progress better (mockup from frame 01 of the design board). New server-safe
  `components/dashboard/sprint-phase-bar.jsx`: seven fixed SDLC phases (Scope · Design · Develop ·
  Review · QA · UAT · Release) with the sprint's overall weighted completion (`metrics.avgProgress`,
  the same value the Completion card shows) projected across them — phases behind the frontier render
  Done (green), the phase the completion sits in renders Active (orange), the rest Upcoming (gray),
  with a 500ms colour transition + an `aria-label`. `hero.jsx` restructured to a column (title/actions
  row, then the full-width bar); `dashboard.jsx` passes `completion`. Renders on the dark ink hero in
  **both** themes (dashboard `/` only; `/rollup` has its own inline hero). Verified: lint clean;
  DB/env-free build green — **35 ƒ Dynamic**. Note: the bar projects the overall completion number
  onto the phase scale (not literal per-Jira-phase tracking) — a stage-derived variant is an option
  if a more literal read is wanted. Not committed.
- 2026-07-24 — **Modernized the charts (per Naveen, Dabang-style reference).** Kept the hand-rolled
  inline SVG (no charting dependency — decision 18 / dataviz precedent). New pure
  `src/lib/chart-path.mjs`: `smoothLinePath`/`smoothAreaPath` — **monotone cubic (Fritsch–Carlson)**
  so curves smooth WITHOUT overshoot (a burndown can't dip below a measured value or invent a bump —
  honest). Applied to: (1) the **sprint burndown** (`trend-panel.jsx`, on `/` and `/rollup`) — smooth
  actual line + a theme-aware **gradient area fill** (`<linearGradient>` with `currentColor` = primary
  via `text-primary` on the svg, so it's teal in Tekion / blue in Modern); ideal + projection stay
  straight (they're linear); markers stay on the real data points. (2) The **bug trend**
  (`bug-charts.jsx`) — smooth open + breached lines + a teal gradient fill under Open (keeps the
  dataviz-validated teal/blue palette). (3) The **bug priority/category/ageing bars** — thinner
  `rounded-full` pills with a subtle `color-mix` gradient. Verified: 6/6 plain-Node math checks
  (structure, no-NaN, **no-overshoot within data range**, area closes to baseline); lint clean;
  DB/env-free build green — **35 ƒ Dynamic**. Consulted the `dataviz` skill; palettes unchanged
  (burndown = single primary; bug charts = the already-validated teal/blue). Not committed.
- 2026-07-24 — **Sprint timeline (dev → QA/UAT → release) + two-lens metrics (per Naveen; rides on
  the `feature/modern-theme` branch).** Drafted @context/features/sprint-phases-delivery-lens.md and
  implemented it after ratifying three decision prompts. **(1) A sprint ends at its release date, not
  dev end:** new pure `getSprintPhase(sprint, asOf)` (`dev`/`qa`/`released`/`ended`) +
  `formatSprintWindow` in `metrics.mjs`; the days-remaining pill is now phase-aware across `/`,
  `/rollup`, `/share` (`"N days left in dev cycle"` → **`"Dev cycle ended · QA/UAT · Nd to release"`**
  → `"Released"`; "Sprint ended" only without a release date); hero/rollup/share/admin/export
  eyebrows spell out both cycles; the hero `SprintPhaseBar` is now **hybrid** — delivery completion %
  drives Scope·Design·Develop·Review during the dev cycle, then QA·UAT·Release light up by date.
  **(2) Two-lens metrics:** `computeSprintMetrics`/`aggregateRollup` re-scoped — **delivery lens**
  (roadmap `FEATURE` + tech-debt `TECH_DEBT`, dev cycle) drives Sprint Health (was FEATURE-only),
  Completion %, the At-Risk card and risk call-outs; **throughput lens** (all work) drives velocity
  (widened from feature+techdebt — support/bugs consume real capacity, per Naveen) and Issues-in-scope.
  Removed the `feature*` metric fields for `delivery*`; updated metric-grid, dashboard (phase-bar
  completion = `deliveryAvgProgress`, risk panel fed `deliveryIssues`), rollup page + team-summary
  table, export-dialog, and both AI digest builders. Deliberately **not** touched: the burndown /
  `SprintSnapshot` / trend stay all-work (throughput) so the snapshot contract + history stay
  continuous — no schema change (decision 4). Verified: lint clean; 22/22 plain-Node fixtures
  (support-blocked bug excluded from delivery `blockedCount`/`sprintHealth`, velocity counts all, no
  Critical leak in the roll-up, phase transitions dev/qa/released/ended, window label); **DB/env-free
  build green — 35 ƒ Dynamic (unchanged)**; dev server restarted on :3002 (build clobbered `.next`).
  No schema/migration/route/dependency change. Doc-synced project-overview §4/§11/§12/§16 +
  master-plan clause + `Last reviewed` (per Naveen's "capture all the decisions" ask). ⚠️ Pending
  human acceptance: authed visual pass of the pill across phases, the hybrid phase bar, and the
  two-lens cards. **Not committed. Next:** fold in Naveen's visual tweaks (modern-theme + these) then
  commit; remaining post-v1 ideas — export-embedded AI narrative, AI Q&A, stage suggestions, dark mode.
- 2026-07-25 — **UI/UX pass on `/bugs` + `/admin` (per Naveen — "make the UI/UX better", bolder
  intensity; rides on `feature/modern-theme`, presentation only).** Both surfaces were quietly
  opting out of the app's own strongest devices, which is why they read flat next to `/`.
  **`/bugs`:** new server-safe **`bugs/bug-pressure-bar.jsx`** — the hero instrument, the direct
  counterpart of `SprintPhaseBar`: SLA + trend status chips (the `CycleChip` grammar) over a
  **two-tier composition rail** (upper tier = severity mix per priority band, lower tier = the
  SLA-breached share of each band) with a directly-labelled legend and the open-bug total anchoring
  the right end. **No new palette** — severity is opacity of `--on-ink-accent` mixed toward
  `--ink`, breach is `--on-ink-danger`, so it re-hues to blue under Modern for free. (First cut
  overlaid breach at full height and, at 46% breached, the rail read as one wall of red with the
  severity ramp destroyed — split into two tiers; the ramp floor was then raised to 68% because the
  widest band is a *low*-severity one, so the biggest group was rendering faintest.) Hero metadata
  became discrete chips instead of a run-on `a · b · c` sentence. **Matrix**: fixed a real
  structural defect — at ~13 columns the two scope groups had no separation (the P4│Total│P0
  boundary looked like a band boundary), so scopes now open on a strong rule and close on a tinted
  Total column; plus **magnitude heat** (low-alpha primary wash scaled to share of row max, weight
  stepping with it — never color-only), a **sticky header**, and a row hover line. KPI row gained a
  **lead card** (spans 2 cols, larger numeral) so the headline outranks the hygiene footnote, plus
  the missing `aria-label` and "since <date>" delta context. Consolidated the two drifted local
  `Panel` copies into **`bugs/panel.jsx`** (one header rhythm + the metric-card icon-tile idiom);
  breach rows dropped the 2px accent stripe for a magnitude tint. **`/admin`:** it had **no hero at
  all** and headings that didn't even use the display font — now the shared ink `HeroShell` with
  provisioning counts + active-sprint status, `SectionCard` carrying the app's icon-tile + display
  heading, success feedback moved to the existing **`Toast`** (a banner atop a very long page is
  unread by the time it appears; errors stay pinned inline), `↑`/`↓` text glyphs → lucide chevrons
  (completing the ui-polish sweep admin missed), **empty states** for zero teams/sprints, nesting
  flattened (card > card > card became a divided list / ruled groups), `max-w-4xl` → `5xl`, and
  **SLA/band priority pickers reordered by configured band severity** instead of by frequency —
  they were rendering "P2, P1, P0, P4, P3". Verified: lint clean; **DB/env-free build green — 35 ƒ
  Dynamic (unchanged)**; impeccable detector clean on all 9 files; **two batched headless-Chrome
  rounds at 1512px and 420px against Naveen's real `gm` report** (244 open / 113 breached) with a
  minted admin cookie — both rounds' findings fixed. No schema/migration/route/dependency change.
  ⚠️ One item not re-shot: the admin sprint-row wrap fix at 420px (the confirming crop framed the
  Teams card instead). **Not committed.**
- 2026-07-25 — **Chart palette + chart forms (per Naveen — "some colors look very dull… see if the
  charts can be represented in a better way"; rides on `feature/modern-theme`, presentation only).**
  Scope confirmed with Naveen: `/bugs` **+ the sprint burndown**, with chart colour **theme-aware
  and validated per theme**. Ran the **dataviz** skill's `validate_palette.js` before touching any
  chart code — every value below is computed, none eyeballed. **The colour system now lives in
  `globals.css`, not in component hex:** categorical `--chart-cat-1/2` where **slot 1 is the active
  theme's own hue** (Tekion teal→blue ΔE 19.9 protan / 20.9 normal; Modern blue→teal ΔE 23.5 deutan
  / 26.0 normal — both PASS), plus an **ordinal `--age-1..4` amber ramp** (`--ordinal`: monotone L,
  every adjacent ΔL ≥ 0.06, light end 2.39:1). **The headline bug this fixed:** `bug-charts.jsx`
  hardcoded `#00a892`/`#3b82f6`, so under **Modern the four chart panels stayed Tekion teal on a
  blue page** — the dashboard read as two products glued together. Form + encoding work:
  (1) **Trend** is now two stacked **bands** instead of two free lines, so the filled gap between
  them is "open but still within SLA" — a number the old chart never showed; taller viewBox,
  `niceStep` gridlines, endpoint direct labels outside the plot, and a **CSS-only hover layer**
  (per-capture hit strip → crosshair + ink readout, `opacity-0` so it stays a server component and
  the html2canvas export path is untouched). (2) **Ageing** stopped wearing the **status** palette —
  green/green/red/red invented a cliff at 31 days that no rule defines and spent SLA-breach red on
  something that is not a breach; it takes the ordinal amber ramp. (3) **Category mix** gained the
  breached share as a **second tier under each bar** (the hero pressure-rail grammar) rather than an
  inline segment — an inline split put slot-1 on "External" in Priority mix and on "within SLA" in
  the panel beside it, one hue with two meanings two inches apart. (4) **Solid bar fills** replaced
  the `linear-gradient(…, color-mix(color 72%, white))` that faded every bar toward white across its
  own length, draining density exactly at the value end — most of the literal "dull". (5) **Matrix
  heat** re-curved: linear-capped-at-13% put nearly every real cell between 3% and 8% alpha (one
  flat haze, not heat) — now `share ** 0.7` to a 26% ceiling with the hard 0.12 cutoff removed, and
  weight steps with it. (6) **Sprint burndown**: dropped the `max-w-3xl` cap that left a third of its
  own card empty since it moved into a two-up row, widened the viewBox, pointed its marks at
  `--chart-cat-1`, and **named the un-instrumented stretch** ("no captures yet" band + boundary rule)
  so a cron that started mid-sprint reads as un-instrumented rather than broken. Verified: lint
  clean; **DB/env-free build green — 35 ƒ Dynamic (unchanged)**, `.env` genuinely moved away and
  restored; both themes' `--chart-cat-1` values, all 13 new Tailwind utilities and both
  arbitrary stop-color rules confirmed in the compiled bundle; impeccable detector clean on all 4
  files; **three batched headless-Chrome rounds at 1512px and 420px in BOTH themes** against
  Naveen's real `gm` report (253 open / 115 breached) with a minted admin cookie — caught and fixed
  the slot-1 collision between adjacent panels, the trend card's dead space, and the burndown's
  "no captures yet" label sitting on the ideal line. Dev server stopped for the env-free build and
  restarted; harness deleted. No schema/migration/route/dependency change. **Not committed.**
- 2026-07-26 — **Fixed a self-inflicted build break: prose is a Tailwind source.** The previous
  entry's own text quoted an arbitrary-property class verbatim (`[stop-color:var(…)]`, with a
  literal ellipsis). Tailwind v4 auto-scans every non-ignored file, `context/**` included, so it
  read that changelog sentence as a **class candidate** and emitted `stop-color: var(…)` — invalid
  CSS, PostCSS parse failure, **every route 500**. Fix: `@source not "../../context"` +
  `@source not "../../legacy"` in `globals.css` (these directories describe the app, they never
  define it), and the sentence reworded. Proven, not assumed: with a deliberately bogus
  `bg-[#abcdef]` **and** the ellipsis class left in prose, a from-scratch build passes and neither
  string reaches the CSS, while the real `stop-color:var(--color-chart-cat-1)` rule still compiles.
  **Verification lesson — the reason this shipped:** the "build green" reported in the previous
  entry came from a build over a **warm `.next`** whose CSS chunk predated the bad string, so the
  broken input was never re-transformed. A cached build is not a build. Standing correction to the
  house `/verify` habit: **`rm -rf .next` before the acceptance build**, and finish with a real
  authenticated runtime pass, not greps over a stale bundle. Now verified: lint clean; **cold
  DB/env-free build green — 35 ƒ Dynamic (unchanged)**, `.env` genuinely moved aside and restored;
  dev server restarted on a cleared `.next`; **five routes loaded authed in a real browser — `/bugs`
  (both themes), `/`, `/rollup`, `/admin` all HTTP 200 with zero console errors and zero hydration
  warnings** (the one `next/image` aspect-ratio warning on `tekion-logo.svg` is pre-existing and
  outside this diff); charts re-shot after the cold rebuild, unchanged. Harness deleted.
- 2026-07-26 — **Dropdown redesign + sidebar promoted to Tekion too (per Naveen; rides on
  `feature/modern-theme`, presentation only).** Two asks. (1) **`ui/select.jsx` rebuilt as a
  styled trigger over a still-native `<select>`** (kept the ui-port.md no-radix decision — the
  open option list stays OS-native, only the trigger changes): `appearance-none` + a drawn lucide
  `ChevronDown` replace the OS glyph, with hover/focus-ring treatment matching Input/Button and a
  new `cva`-based `variant="onDark"` for the ink hero. That variant closes a real latent bug —
  `bugs-actions.jsx`'s report switcher was passing `className="onDark"`, which is not a Tailwind
  utility and had silently done nothing since it shipped; it now passes `variant="onDark"` and
  gets the same glass treatment as the neighboring onDark Refresh button. The trigger is wrapped
  in a `relative` div for the icon, deliberately **not** `inline-flex`/`inline-block`: a plain
  block wrapper blockifies identically to the bare `<select>` it replaces when used as a flex
  child, so row contexts (top-bar team/sprint pickers, compact admin role selects) stay
  content-sized and column contexts (dialog forms) still stretch full-width — verified by reasoning
  through both call-site shapes, not by trial and error. (2) **The left-nav sidebar (`app-sidebar.jsx`)
  is no longer Modern-only** — visibility flipped from `hidden modern:lg:flex` to `hidden lg:flex`,
  and the top bars' now-redundant nav links/brand block flipped from `modern:lg:hidden` to
  `lg:hidden` across `dashboard/top-bar.jsx`, `rollup/rollup-top-bar.jsx`, `bugs/bugs-top-bar.jsx`,
  `bugs/bugs-page.jsx`'s footer "back to board" link, and `admin/admin-panel.jsx`'s hero back
  button — plus the `SkeletonChrome` loading placeholder in `ui/skeleton.jsx`, so route transitions
  don't flash a top-bar skeleton under a sidebar page. This **reverses** modern-theme.md's original
  framing ("Tekion renders byte-for-byte as today" / sidebar as a Modern-exclusive differentiator,
  §11) — both themes now share the same shell; `bg-ink` plus the themed `--primary`/`--accent`
  tokens re-hue the sidebar automatically (teal active state under Tekion, blue under Modern) with
  no per-theme branching in the component. `/login` and `/share` are unaffected (they don't use
  `AppShell`). No schema/migration/route/dependency change. Verified: lint clean; impeccable
  detector clean on all 10 touched files; **cold `rm -rf .next` build green — 35 ƒ Dynamic
  unchanged**; since the Chrome extension wasn't connected this session, visual verification used
  a headless-Chrome (Playwright, system Chrome) pass instead — a locally-minted iron-session
  cookie for the seeded admin (house pattern, no real Jira credentials involved) against the
  running dev server, screenshotting `/`, `/rollup`, `/bugs`, `/admin` in both themes at 1600px
  plus responsive checks at 1280px/1000px/390px confirming the sidebar shows at `lg+` in Tekion
  now and both themes correctly fall back to top-bar nav below `lg`; dev server restarted after
  the clobbering build. Screenshots + harness stayed in the session scratch dir, not the repo.
  **Not committed.**
- 2026-07-26 — **Marked modern-theme Done** (finish-feature ritual, per Naveen). Re-ran the full
  verify suite as the completion gate: `yarn lint` clean; `prisma validate` + `migrate status` up
  to date (4 migrations, no schema change); **env-free cold `yarn build` green — 35 ƒ Dynamic,
  unchanged** (`.env` genuinely moved aside via `mv` and restored, not just shell-unset); runtime
  smoke against a freshly rebuilt dev server — unauthenticated `/` correctly serves the login page
  rather than the dashboard, `/api/cron/daily` 401s on a bad bearer, `/api/health/db` reports a
  live connection, and all four `AppShell` pages (`/`, `/rollup`, `/bugs`, `/admin`) return 200
  authenticated. Doc-synced: `context/features/modern-theme.md` gained a proper `## Status` +
  `## As-built notes (vs. the spec)` section (the file's own `Status:` line had said "Planned (not
  started)" this entire time — Phases A–C landing 2026-07-24 was only ever recorded here in
  current-feature.md, never in the spec itself — and the As-built notes now flag the two
  spec-reversing deviations: the sidebar is no longer Modern-exclusive, and the dropdown rebuild
  was never in the original scope at all); `context/project-overview.md` §11 gained a dated
  **[BUILT 2026-07-26]** addendum after the 2026-07-24 Modern-theme note (append-don't-rewrite, per
  the historical-note convention) plus a `Last reviewed` bump. This entry's Status block above and
  the stale "Tekion pixel-identical" acceptance bullet in Goals were corrected in the same pass.
  **Done.** **Mid-pass discovery:** `git status`/`log` turned up that Naveen had committed and
  fast-forward-merged `feature/modern-theme` into `main` as `8240dce` ("UI Polish.") from a
  parallel session while this verify pass was running — the code (including this session's
  dropdown/sidebar change) was already on `main` by the time this entry was written, so the
  Status block's and earlier entries' "Not committed" framing is corrected above rather than left
  to mislead. Only this doc-sync pass itself (3 markdown files) remained uncommitted. ⚠️ Still
  pending: Naveen's first real-browser visual pass across this entire arc (every verification
  round, including this one, used headless capture — the browser extension has never been
  connected). **Next:** that visual pass; remaining post-v1 ideas (export-embedded AI narrative,
  AI Q&A, stage suggestions, dark mode) stay open after.
- 2026-07-26 — Planning session (no code): Naveen shared ideation for **One-Click Sprint Start**
  (two screenshots of a Component→Sub-component→Scrum-team mapping, an org spreadsheet
  `Tekion JIRA Book - 2025-26.xlsx`) — automate onboarding a scrum team's 4 Jira filters
  (Roadmap/Tech Debt/Internal Bug/External Bug) from a reusable admin catalog instead of hand-typed
  JQL every sprint. Ran several rounds of clarifying questions, cross-checked the real spreadsheet
  (confirmed: sub-components are literal flat Jira Component field values under a naming
  convention, not a true hierarchy; Fix Versions follow `Release-YYYY.MM.X.Y`) and a Jira
  screenshot (confirmed exact Issue Type names: `Story`/`Tech Story`/`Bug`, and the External Bug
  project key `ENG`). Drafted @context/features/one-click-sprint-start.md; **Naveen corrected two
  assumptions in the first draft** — no RBAC carve-out for Sprint creation (admin-only, no
  exceptions) and External Bug scoping is parent-Component-only, not sub-component-level (both
  folded into the spec's ratified decisions 4 and 7, see Status above). No schema/code changes yet.
  modern-theme remains **Done** (merged as `8240dce`).
- 2026-07-26 — Picked @context/features/one-click-sprint-start.md as the current feature.
- 2026-07-26 — **Implemented one-click-sprint-start.** Added `JiraComponent`/`JiraSubComponent`
  models + 4 per-track Issue Type override arrays on `Team` + `Sprint.fixVersions` (migration
  `20260726111546_add_component_catalog_and_track_config`); pure
  `lib/jira/issue-type-defaults.mjs` (global defaults + `resolveIssueTypes` override resolver,
  mirroring the `storyPointsFieldId`/`sprintFieldId` pattern) and pure
  `lib/sprint-start/track-jql.mjs` (`buildTrackJql`/`buildAllTrackJql`/
  `groupSubComponentsByComponent`/`TRACK_NAMES`/`SPRINT_START_TRACKS`, following the
  `quoteJql`/`IN (...)` idiom from `bug-report/matrix.mjs` — Roadmap/Tech Debt/Internal Bug scope
  by the team's fine-grained sub-components, External Bug by the parent Component name only per
  decision 7); extracted `lib/accent-palette.mjs` out of `add-filter-dialog.jsx` and
  `lib/filters/priority-insert.js` out of the existing filters route (now shared by both routes).
  New routes: `/api/jira-components[/…]` + `/api/jira-sub-components/[id]` (admin-only catalog
  CRUD), `PATCH /api/teams/[teamId]/sub-components` (full-replacement claim set, `ConflictError`
  409 on double-claim — new error class in `route-helpers.js`), `POST
  /api/teams/[teamId]/sprint-start` (`TEAM_MANAGER_ROLES` — no RBAC change, per decision 4; 404
  unknown/400 closed sprint, 400 zero sub-components, skips existing tracks, syncs immediately
  without rolling back filters on sync failure). `dashboard-data.js` gained
  `sprintStartConfig` (issue-type overrides + componentGroups) on the selected team. New admin UI:
  `jira-components-config.jsx` (catalog, one-at-a-time add forms) + `team-config-dialog.jsx`
  (create/edit, component picker + sub-component claim checklist + collapsed issue-type-override
  section) wired into `admin-panel.jsx` (team cards gained an Edit button); `fixVersions` inputs
  added to both the admin inline Sprint form and `SprintConfigDialog`. New dashboard UI:
  `sprint-start-dialog.jsx` (existing-sprint dropdown only — never creates one; live JQL preview
  computed client-side via the same pure `track-jql.mjs`) behind a new Hero "Sprint Start" button.
  Verified: `yarn lint` clean (11 `react/no-unescaped-entities` fixes along the way); **9/9 plain-
  Node fixtures** for `track-jql.mjs`/`accent-palette.mjs` (DR_GM worked example incl. the
  parent-component External Bug clause, per-team override precedence, no-fixVersions,
  multi-component-group `project IN (...)`, JQL-quote escaping, accent wraparound);
  `prisma validate`/`migrate status` up to date; **DB/env-free cold build green — 41 ƒ Dynamic (35
  → 41)**, `.env` genuinely moved aside via `mv` and restored; **30/30 SSR/API smoke checks**
  against a fabricated 3-team/3-user fixture (RBAC gates incl. VIEWER/EM-non-ADMIN 403s, the 409
  double-claim conflict, 404 unknown sprint, 400 closed sprint / zero sub-components, all 4
  tracks' JQL hand-verified against the fixture's real component/sub-component names, sortOrder
  following `WORKFLOWS` priority, 4 distinct `accentColor`s, an idempotent re-run creating 0 new
  filters with exactly 4 `Filter` rows left in the DB, and confirmation `POST/PATCH /api/sprints`
  are untouched — still admin-only); fixture torn down to 0 leftovers. **Runtime smoke against
  Naveen's real production data** (render-only, no writes): a minted admin cookie against `/admin`
  and `/` both returned 200 with no error markers, the new "Jira components" section and "Sprint
  Start" button both rendered — this also surfaced that Naveen already has real scrum teams synced
  (e.g. "GM PreCheckout", "Configurator & Website Setup"), useful for the pending human-acceptance
  step. Found and restarted one pre-existing, unrelated stale `next-server` process on :3002 mid-
  verification (holding an outdated Prisma client from before the migration — the same stale-dev-
  server hazard this project has hit before). Doc-synced: `context/features/one-click-sprint-
  start.md` Status + As-built notes; `project-overview.md` §5 (new feature row), §9 (schema blocks
  + ER diagram + rationale bullet, byte-consistent with `schema.prisma`), §11 (new admin
  catalog/dialog + dashboard action note), §13 (reaffirmed no RBAC change), §16 (new ratified
  decision entry incl. both reversals), and the master migration plan's step-10 post-v1 clause.
  **Done.** ⚠️ Pending human acceptance: Naveen claiming sub-components for a real team and running
  the flow against real Jira. **Next:** fold in feedback, then commit.
- 2026-07-27 — **Fixed two real JQL bugs from Naveen's live acceptance run, plus small follow-ups
  (still on `feature/one-click-sprint-start`, uncommitted).** Naveen ran the actual one-click flow
  against real Jira — the pending human-acceptance step from the prior entry — and reported the
  generated JQL was wrong, supplying an accurate real sample:
  `type = Story AND project = GM AND "sub-component[dropdown]" IN (DR_GM-Configurator,
  DR_GM-WebsiteSetup) AND fixversion = Release-2026.08.1.0 ORDER BY issuetype ASC`. Root causes in
  `track-jql.mjs`/`issue-type-defaults.mjs`: (1) his instance tags a team's own sub-components via
  a **custom field** (`"sub-component[dropdown]"`, new `SUB_COMPONENT_FIELD` constant), not the
  standard Jira `component` field the spec assumed; (2) field naming (`type`/`fixversion`, not
  `issuetype`/`fixVersion`), clause order (`type → project → component(s) → fixversion`), quoting
  (bare unless a value has whitespace — was always-quoted), and a trailing `ORDER BY issuetype ASC`
  all needed to match his instance's real conventions. Fixed and **re-verified byte-for-byte
  against his exact sample** via a standalone pure-fixture script (not committed). Naveen then sent
  a same-day follow-up: *"Even the external filter should use subcomponent in the filter
  creation"* — confirmed via a clarifying question as an **addition**, not a replacement, to
  decision 7's parent-Component-only External Bug scoping. `buildTrackJql` was generalized from a
  single `componentField`/`componentValues` pair to an ordered `componentClauses: [{ field,
  values }]` list so External Bug now ANDs **both** `component = <parent>` and
  `"sub-component[dropdown]" IN (<team's sub-components>)`; the other 3 tracks pass a
  single-entry array, unaffected in shape. Also shipped, same session: a per-sprint **Edit** button
  in `/admin`'s "Sprints (Gates)" list (Naveen asked how to edit `fixVersions` on an already-ACTIVE
  sprint — it already worked via the dashboard's "Configure Sprint," but wasn't discoverable from
  `/admin`; reused the existing `SprintConfigDialog` edit mode as-is, no server change). Verified:
  `yarn lint` clean; `prisma validate`/`migrate status` up to date (still 5 migrations, no schema
  change); **DB/env-free cold build green — 41 ƒ Dynamic unchanged**, `.env` genuinely moved aside
  and restored; live dev-server smoke confirms the admin Sprints list renders exactly one "Edit"
  button per sprint row. Doc-synced: `one-click-sprint-start.md` (pure-module section, worked
  example, decision 7 amendment, Open risks, Status, new As-built-notes entries);
  `project-overview.md` §5 row + §16 decision entry + master-plan step-10 clause (all
  dated-addendum style, not rewritten) + `Last reviewed` bump to 2026-07-27. **Separately, same
  session but unrelated to this feature:** replaced the generic default Next.js favicon with
  Naveen's supplied Tekion icon (`app/icon.png` + regenerated `app/favicon.ico`), and put the same
  icon (`public/app-icon.png`) at the top of the left-nav sidebar linking to `/` — verified via a
  live `/_next/image` fetch (correct 64×64 render) and a minted-cookie SSR check of the sidebar's
  `<a href="/" aria-label="Sprint Tracker — go to my board">`; doc-synced as a new dated
  `project-overview.md` §11 note. **Still open:** Naveen re-running the live flow to confirm the
  corrected JQL (both fixes) actually returns the right issues in Jira for all 4 tracks. **Next:**
  that confirmation, then commit.
- 2026-07-27 — Planning session (no code): drafted @context/features/leaderboard.md for the
  handwritten "Velocity / LeaderBoard" spec (`context/SprintTracker - Project Spec/
  Velocity:LeaderBoard.jpg`) — a team velocity leaderboard (points ÷ developers) + an overall
  developer leaderboard, both gamified. Ran a clarifying-question pass (3 background Explore
  agents + a Plan-agent design pass) rather than guessing, since the handwritten spec is two
  sentences and left every architecture-determining decision open. Ratified with Naveen: delivered
  points = the existing weighted stage-completion metric (not Jira status); work scope = all work
  (throughput lens); team divisor = a new admin-entered `Team.developerCount` field, not a
  dynamically-derived assignee count; both sprint-scoped and all-time views for both boards;
  visibility gated to a new, deliberately narrower `LEADERBOARD_ROLES = [EM, ED, VIEWER]` (TPM
  excluded, unlike every other role group in `rbac.js`); LEAD/MEMBER get a personal "my stats" card
  only, no rank; and a bundled bugfix (gate manual sync away from `CLOSED` sprints) that turns out
  to eliminate the need for any new snapshot table entirely — `Issue`/`IssueProgress` rows already
  persist per closed sprint, so historical per-developer/per-team data can be computed live once
  that one gap is closed. Full decisions + open risks in the spec file. Picked
  @context/features/leaderboard.md as the current feature. one-click-sprint-start remains **Done**
  (pending Naveen's live JQL re-run confirmation, tracked separately in its own spec file).
- 2026-07-27 — **Implemented leaderboard.md (Velocity / LeaderBoard).** Schema: `Team.developerCount
  Int?` (migration `add_team_developercount`, byte-synced to §9). RBAC: `LEADERBOARD_ROLES = [EM,
  ED, VIEWER]` (deliberately excludes TPM, unlike every other role group) + `hasLeaderboardAccess()`
  in `rbac.js` — page-level, any-team, admin-bypass. Bugfix: `syncTeamSprint` now rejects a `CLOSED`
  sprint with `ConflictError` (409) before touching Jira — protects the frozen historical data this
  whole feature depends on. `metrics.mjs` gained 5 pure functions (`aggregateByDeveloper`,
  `teamVelocityPerDeveloper`, `aggregateTeamAllTime`, `aggregateDeveloperAllTime`, `rankBy`); new
  `lib/leaderboard-data.js` (org-wide reads, 3 batched queries for cross-sprint history — the
  architecture insight that no new snapshot table was needed held up in practice). New page
  `/leaderboard` + `components/leaderboard/{team-leaderboard,developer-leaderboard,
  leaderboard-top-bar}.jsx`; new shared `ui/avatar-chip.jsx` (retrofit into the 3 previously
  copy-pasted inline avatar circles) + `ui/rank-badge.jsx`; new `dashboard/my-stats-card.jsx` wired
  into `/` for LEAD/MEMBER (computed in `app/page.jsx` to avoid a circular import with
  `dashboard-data.js`); `developerCount` admin field in `team-config-dialog.jsx`; sidebar/`AppShell`
  wiring (`hasLeaderboardAccess` threaded through all 5 pages). A design pass via the `impeccable`
  skill's `bolder` playbook added a genuine podium treatment for rank 1 on both boards (accent wash,
  bigger `RankBadge` reusing the house "sweep" sheen from `release-countdown.jsx`, bigger display
  numeral) — reusing only existing tone tokens, so it re-hues correctly under both themes with zero
  new primitives. **Verified:** `yarn lint` clean; `prisma validate`/`migrate status` up to date (6
  migrations); **DB/env-free cold build green — 42 ƒ Dynamic (41 → 42)**, `.env` genuinely moved
  aside twice (pre- and post-design-pass) and restored both times; **26/26 pure-fixture checks**
  for the new metrics functions (hand-computed developer aggregation, all-time sums, rank ties);
  **24/24 SSR/API smoke checks** against a fabricated multi-team/multi-sprint fixture — RBAC gate
  (EM/ED/VIEWER/admin see the board; TPM/LEAD/MEMBER don't), the sync-gate 409 vs. a non-409 on an
  ACTIVE sprint, sprint- and all-time team/developer math hand-verified, the unconfigured-team
  footnote, `MyStatsCard` with no rank/comparison leakage, and the admin `developerCount` PATCH
  taking effect live — fixture torn down to 0 leftovers; visual confirmation via headless-Chrome
  screenshots (temporary `playwright` install, fully removed after) in both Tekion and Modern
  themes. **Found and fixed one real, pre-existing bug along the way** (the sync-gate issue itself
  — flagged during planning, fixed as decision 7) and **discovered one pre-existing, unrelated dev-
  mode quirk** (Next 16.2.9 + Turbopack resolves `redirect()`/`notFound()` to HTTP 200 with correct
  content under `curl`/`fetch` — worked around in the smoke script via content assertions; see the
  spec's As-built notes). **Done.** **Next:** remaining post-v1 ideas — export-embedded AI
  narrative, AI Q&A, stage suggestions, PDF/share for `/bugs`, the `/bugs` ENG-sub-component
  follow-up, and leaderboard rank-delta arrows (all deliberately deferred, not forgotten).
- 2026-07-28 — **Three post-leaderboard fixes/polish items from Naveen, still on
  `feature/velocity-leaderboard` (uncommitted).** (1) **Fixed a real health-status bug**: a sprint
  past its dev-cycle `developmentEnd` could still badge issues "On Track"/"Ahead" and the sprint
  overall "Excellent" even with incomplete work — Naveen's screenshot showed a 93%-complete issue
  reading "On Track" days after the deadline. `getHealthStatus` (`metrics.mjs`) now special-cases
  `asOf > developmentEnd`: an incomplete issue reads **At Risk** (≥90%) or **Behind** (<90%), never
  On Track/Ahead — this cascades correctly into `bandSprintHealth` with zero changes needed there,
  since it already bands off the (now-corrected) per-issue counts. (2) **Replaced the misleading
  "2/7 delivery on track" line** with a full worst-first breakdown (Blocked/Behind/At Risk/On
  Track/Ahead/Done counts) in `MetricGrid`'s Sprint Health card — mirrors the icon+count vocabulary
  `rollup/team-summary-table.jsx`'s `BANDS` already established — plus the same fix in the PDF/PNG
  export's `OverallCard` detail line. (3) **Fixed a missing loader on team/sprint switch**:
  `dashboard.jsx`'s `select()` called `router.push` unwrapped, so `busy` never flipped and the
  `PageLoader` never showed while Next fetched the new board — wrapped in the existing
  `startMutation` transition (the same house pattern `bugs-actions.jsx` already used), and applied
  the identical fix to `rollup-top-bar.jsx`'s and `leaderboard-top-bar.jsx`'s sprint/view selects,
  which had the same gap. (4) **Built the `impeccable`-guided "Story Points Delivered" highlight**
  Naveen asked for by name, with a mid-build clarifying question (placement) that surfaced a
  requirement I hadn't planned for — he wants **Planned points highlighted too, not just
  Delivered** — synthesized into one card showing both as peer-sized numerals (Delivered gets the
  extra glow/count-up per bolder.md's "one decisive move"; Planned stays real-sized but quieter).
  New `StoryPointsHighlight` (server-safe; `bg-accent`/`shadow-brand`/the house "sweep" sheen —
  the proven leaderboard-podium treatment, reused not reinvented) on `/`, `/rollup` (portfolio-wide,
  labeled "N teams"), and `/share/[token]`; all-work `completedPoints`/`points` (matches the
  Leaderboard's basis, not the delivery-lens-only number the old Completion card showed). New
  `useCountTransition` hook + shared `ui/animated-number.jsx`: animates only on a value CHANGE
  while mounted (sync landing, team switch) — first paint (SSR + first hydration pass) always
  renders the real static number with no JS required (animate.md: "keep content visible in the
  default state"), avoiding any flash-then-recount jank; retrofit into `TeamLeaderboard`,
  `DeveloperLeaderboard`, and `MyStatsCard`'s numerals too for one consistent motion language.
  **Hit and fixed a real lint violation along the way**: the hook's first draft mutated a ref and
  called `Date.now()` as bare statements in the hook body, which this repo's React Compiler rules
  (`react-hooks/refs`, `react-hooks/purity`) reject outright — moved all of it inside the
  `subscribe`/`getSnapshot` closures passed to `useSyncExternalStore` (the same escape hatch
  `release-countdown.jsx`'s `useLiveNow` already relies on), which lint accepts. **Verified:**
  `yarn lint` clean; cold DB/env-free `yarn build` green twice (before and after the animation
  work) — **42 ƒ Dynamic unchanged**; hand-computed `getHealthStatus`/`computeSprintMetrics`
  fixture reproducing the screenshot scenario (93%+past-deadline → At Risk, aggregate → At Risk,
  not Excellent); live smoke against Naveen's real synced data via a minted admin cookie on `/`,
  `/rollup`, `/leaderboard` in both themes at desktop and mobile widths (headless Chromium,
  temporary `playwright` install fully removed after); the health/breakdown fix confirmed live
  (Sprint Health correctly reads "Critical" with a `⊘1 ↓4 ⚠1 ✓10` breakdown against real data that
  previously would have shown a rosier picture). **The count-up transition itself** couldn't be
  exercised through the real team-switch UI — headless Chromium's native `<select>` didn't accept
  synthetic changes reliably (confirmed via an A/B revert that the identical unmodified code showed
  the same symptom, ruling out a regression) — so it was isolated and proven via a throwaway test
  route driving `AnimatedNumber` off a plain button click (reliable in headless mode): counted
  smoothly 59→93→131→...→222 with visible ease-out deceleration, then settled exactly at 222; the
  route was deleted after. No schema/migration/route change. **Done.** **Next:** fold these into
  the pending leaderboard commit, then the still-open one-click-sprint-start live re-run and the
  remaining post-v1 ideas listed above.
- 2026-07-28 — **Story Points → Original Estimate fallback (per Naveen: "if a issue/jira item
  doesn't have Story Point we should consider original estimate field from jira").** Real gap:
  `transformJiraIssue` (`lib/jira/transform.js`) defaulted an unpointed issue straight to `0`,
  which silently zeroed it out of velocity, completion %, and — the highest-stakes consumer now
  that it exists — the Leaderboard, understating anyone whose team leaves Story Points blank and
  tracks effort via Original Estimate instead. Asked Naveen to pin the one real ambiguity (time is
  not points) before writing code: he chose **hours ÷ 8 = points (1 point ≈ 1 working day)**. New
  `resolveStoryPoints(rawPoints, rawOriginalEstimateSeconds)`: an explicit, truthy Story Points
  value always wins; otherwise falls back to Jira's standard `timeoriginalestimate` field
  (seconds) → hours ÷ `HOURS_PER_STORY_POINT` (8), rounded to 2 decimals; neither present → `0`
  as before. **An explicit `0` in Story Points is treated the same as "not set"** and still falls
  back — Jira doesn't distinguish blank from a typed zero on this field, and a 0-point issue
  carries no signal either way, so there was nothing to lose by folding that case in. Added
  `timeoriginalestimate` to `buildIssueFields`'s requested field list (it wasn't being fetched at
  all before). Standard Jira field, not per-team configurable like `storyPointsFieldId` — no
  schema/admin change. Applies automatically on next sync (`Issue` cache rows are fully replaced
  every sync, §9) — no backfill needed. Verified: **8/8 plain-Node fixture checks** (explicit
  points win over estimate, fallback math for a 16h/2-day estimate, explicit-0 falls back,
  legacy `customfield_10016` still honored before the fallback, nothing present → 0, partial-day
  rounding for a 3h estimate → 0.38, garbage/negative estimate ignored → 0, `buildIssueFields`
  requests the new field); `yarn lint` clean; **DB/env-free cold build green — 42 ƒ Dynamic
  unchanged** (`.env` genuinely moved aside and restored — no route/schema surface changed, so
  this was mainly confirming the transform still type-checks cleanly through the build). **Done.**
  Rides on `feature/velocity-leaderboard`, folds into the same pending commit as the other
  post-leaderboard fixes above.
- 2026-07-27/2026-07-28 — **Extended the hybrid-seed `StatusStageMapping` defaults with six more
  terminal Jira statuses, in three rounds, each requested directly by Naveen while reading the
  Delivery Matrix against real synced issues** (ad hoc, not planned via `plan-feature` — closes
  decision 2's "rest ships as defaults" gap in bootstrap-seed.md one real status at a time).
  Round 1: `UAT` (FEATURE + TECH_DEBT) and `OEM Review` (SUPPORT + INTERNAL_BUG). Round 2:
  `Close as Duplicate` (SUPPORT + INTERNAL_BUG) and `Support Validation` (SUPPORT only). Round 3:
  `Not Applicable` (FEATURE + SUPPORT + INTERNAL_BUG) and a correction to the pre-existing
  `Testing` row for FEATURE (stageIndex 6 → 9 — it was already the terminal stage for the other
  three workflows via `FOUR_STAGE_STATUS_MAP`, so only FEATURE needed changing). **Before writing
  any row, checked live Tekion Jira** (`searchJiraIssuesUsingJql`) for which issue type/project
  each status actually appears on, rather than guessing — e.g. this is what caught that
  `Support Validation` is exclusive to `Tap Ticket`/ENG (SUPPORT only, not INTERNAL_BUG too, unlike
  its round-2 sibling). For round 1, ratified two scope questions with Naveen up front via
  `AskUserQuestion`: **seed-only** (only newly-synced issues get seeded to Done; the hybrid model's
  "manual edits win" invariant for already-tracked issues stays untouched — no force-override on
  every sync) and **workflow mapping as found in live Jira**, both carried through rounds 2–3
  without re-asking. Pure data change to `prisma/seed.mjs`'s `STATUS_STAGE_SEED` table — **no
  schema, migration, route, or sync-engine code change**; `SUPPORT`/`INTERNAL_BUG` diverged from
  the shared `FOUR_STAGE_STATUS_MAP` alias into two explicit arrays once `Support Validation` made
  them genuinely different. Global `StatusStageMapping` row count: 35 → 39 → 42 → 45. **Verified**
  after every round: `yarn db:seed` against Neon (delete-then-recreate of the `teamId = null` set,
  confirmed via a direct DB read each time) and `yarn lint` clean; closed out with a full
  finish-feature `/verify` pass — `prisma validate` + `migrate status` up to date (6 migrations,
  unchanged), env-free cold `yarn build` green (**42 ƒ Dynamic unchanged**), and a **15/15
  pure-fixture functional check** — not just "the row exists," but `buildSeededStages` +
  `calculateWeightedCompletion` run against the live-persisted mappings and the real `WORKFLOWS`
  weights, asserting every new/changed `(workflow, status)` pair actually resolves to 100%
  completion, plus one sanity control (`Groomed` still does *not* seed to Done). Doc-synced
  @context/features/bootstrap-seed.md (the canonical spec for these defaults, per its own §17
  pointer) — Status extended with the three-round summary, the proposed-defaults tables rewritten
  to match `seed.mjs` exactly, a new As-built note. `project-overview.md` needed no edits — pure
  seed data inside an already-`[BUILT]` hybrid model, no status tag/schema/roadmap-step affected.
  **Done.** Rides on `feature/velocity-leaderboard` as its own isolated, unrelated diff
  (`prisma/seed.mjs` only, touching nothing else on the branch) — not committed, ready as its own
  focused commit whenever Naveen folds in the branch's accumulated work. **Next:** commit
  housekeeping for everything sitting uncommitted on this branch (leaderboard, the three
  post-leaderboard fixes, the story-points fallback, and this), then the still-open
  one-click-sprint-start live re-run and the remaining post-v1 ideas.
- 2026-07-28 — Planning session (no code): drafted @context/features/committed-unplanned-work.md
  from two handwritten notebook pages (`CommittedAndUnplanned-{1,2}.jpg`) via several rounds of
  clarifying questions rather than guessing, since the notes left every architecture-determining
  choice open. Ratified 10 decisions with Naveen: **three-way segmentation** (Committed=`FEATURE`,
  Tech Debt=`TECH_DEBT`, Unplanned Bugs=`SUPPORT`+`INTERNAL_BUG`) **badged as two types** at the
  headline level; **display-only/additive** — zero change to Sprint Health, Completion %, At-Risk,
  or the existing delivery/throughput lens; **capacity compares Committed only** (Tech Debt/
  Unplanned Bugs never get a target); **screens** = `/`, `/rollup`, `/share/[token]`, Export —
  explicitly **NOT** `/leaderboard`; **capacity is per-team PER SPRINT**, needing a new
  `SprintCapacity` join model (not a static `Team` field like `developerCount`, since committed
  capacity shifts release to release); **one admin matrix screen** (sprint picker + one row per
  team) plus a **"duplicate to another sprint"** action (explicitly requested); **admin-only RBAC**
  (matches Sprint config's existing global-admin-only gate, no carve-out); **roll-up portfolio
  total sums whatever teams ARE configured** with an "N of M teams configured" caveat rather than
  hiding; `team-summary-table.jsx` gets **one new column** (Committed/Capacity), not a full
  per-team 3-way breakdown; **duplicate confirms before overwriting** a target sprint that already
  has configured rows. Exploration confirmed no existing per-`workflowType` breakdown exists
  anywhere today (only the binary `DELIVERY_TYPES` set), and pinned exact file:line wiring points
  in `metrics.mjs`, `dashboard-data.js`, `admin-panel.jsx`, and `schema.prisma` before writing the
  spec. Also discovered mid-session: Naveen had committed and merged the entire
  `feature/velocity-leaderboard` branch to `main` in a parallel session (`c8d5bd5`, "Added
  Leadership page.") — this feature branches fresh off `main` instead.
- 2026-07-28 — Picked @context/features/committed-unplanned-work.md as the current feature.
  Created branch `feature/committed-unplanned-work` off `main`. Velocity/LeaderBoard remains
  **Done** (now on `main`).
- 2026-07-29 — **Implemented committed-unplanned-work.** Added `SprintCapacity` (`sprintId`,
  `teamId`, `committedPoints`; `@@unique([sprintId, teamId])`, mirroring `SprintSnapshot`'s shape
  minus the daily axis) via migration `20260728180901_add_sprint_capacity` (+ `capacities`
  relations on `Team`/`Sprint`) — the first schema change since `add_team_developercount`. Added
  `COMMITTED_TYPES`/`TECH_DEBT_ONLY_TYPES`/`UNPLANNED_TYPES` sets + a `segmentTotals` helper to
  `metrics.mjs`, feeding 9 new fields (`committed*`/`techDebt*`/`unplanned*` × points/
  completedPoints/issueCount) onto both `computeSprintMetrics` and `aggregateRollup` — filtering
  the SAME already-materialized `issues` array `DELIVERY_TYPES` already uses, never touching any
  existing field. New `src/lib/schemas/sprint-capacity.js` (a `z.null()`-before-`z.coerce.number()`
  union so a literal `null` clears a row instead of coercing to 0) backs two new admin-only routes:
  `PUT /api/sprints/[sprintId]/capacity` (batched upsert/delete transaction over the whole matrix)
  and `POST …/capacity/duplicate` (copies another sprint's rows in, `[sprintId]` = destination,
  `sourceSprintId` = source). Threaded capacity reads through `getDashboardData` (sibling `capacity`
  prop, same treatment as `snapshots`), `getRollupData` (batched `combinedCapacity` w/
  `configuredTeamCount`/`totalTeamCount` driving a "N of M teams configured" caveat), and
  `buildShareSnapshot`/`getShareData` (frozen shares now pin capacity too, same asOf-pinning
  invariant as the sprint window) + its one call site in the shares route. New
  `src/components/admin/sprint-capacity-config.jsx` (sprint picker defaulting to `ACTIVE`, one
  numeric input per team keyed by `key={selectedSprintId}` to reset on switch/refresh, a "duplicate
  from" picker gated behind a confirm `Dialog` only when the target sprint already has rows) wired
  into `admin-panel.jsx` as a new `Target`-iconed `SectionCard` between Sprints and BugReportConfig;
  `admin/page.jsx` fetches `capacityRows` in its existing `Promise.all`. `StoryPointsHighlight`
  restructured (existing 3-item row wrapped in its own flex container) and grew optional
  `breakdown`/`capacity` props rendering a new chip row below the progress bar — a standalone
  "Committed" chip (`X/Y pts` + `· N capacity` when configured) and a bordered "Tech Debt" +
  "Unplanned Bugs" pair grouped together, delivering decision 1's "two types" framing structurally
  — wired at all three existing call sites (`dashboard.jsx`, `rollup/page.jsx`,
  `share/[token]/page.jsx`) with zero changes needed to `MetricGrid` (deliberately left alone, per
  decision 2). `team-summary-table.jsx` gained one "Committed / Cap" column after "Points done".
  `export-dialog.jsx`'s `SummaryPage` gained a new "Committed / Tech Debt / Unplanned" row of
  `ReportMetricBox`es (capacity threaded as a new prop through `ExportDialog`'s one call site) —
  `exportMetrics` already recomputes via the now-extended `computeSprintMetrics`, so no new export
  metrics logic was needed. No changes to `/leaderboard`, as specced. Verified: `yarn lint` clean;
  `prisma validate`/`migrate status` up to date (**7 migrations**); **DB/env-free cold build green
  — 44 ƒ Dynamic (42 → 44)**, `.env` genuinely moved aside via `mv` and restored; **23/23 pure-Node
  fixture checks** (hand-computed segment sums across all 5 `WorkflowType`s incl. the `CUSTOM`
  edge case landing in none of the three segments, `aggregateRollup` doubling for 2 identical
  teams) **plus a before/after regression diff** proving every pre-existing field
  (`deliveryPoints`/`deliveryCompletedPoints`/`velocityPoints`/`totalIssues`/
  `totalDeliveryIssues` and their rollup equivalents) byte-identical; **32/32 live API-route + SSR
  smoke checks** via real HTTP + minted iron-session cookies against a fully isolated fabricated
  fixture (2 teams, 2 sprints, 1 non-admin member, 1 filter) — non-admin 403 on both new routes,
  404/400 validation gates, a `null` row genuinely clearing (confirmed via a follow-up DB read),
  the duplicate route's same-sprint/unknown-source guards, a happy-path duplicate + a re-duplicate
  proving overwrite semantics, and SSR rendering on `/` (Committed/Tech Debt/Unplanned Bugs chips +
  capacity figure), `/rollup` (new table column, both fabricated teams' rows), and `/admin` (new
  "Committed Capacity" section) — fixture torn down to **0 leftovers** (confirmed by a post-teardown
  count query). Found and fixed two harness bugs along the way, zero app bugs: the dashboard's
  `showWelcome` gate (`filters.length === 0`) initially hid the whole matrix until a bare `Filter`
  row was added to the fixture team, and React SSR's `<!-- -->` comment markers between adjacent
  JSX text nodes (`24<!-- --> capacity`) broke a naive substring assertion until markers were
  stripped before comparing — both are pre-existing repo/framework behaviors, not regressions. One
  pre-existing stale `next-server` process (holding a pre-migration build from the prior day, this
  project's own well-documented "build clobbers `.next`" hazard) was found holding port 3002 and
  restarted mid-verification. Doc-synced project-overview.md (§5 new row, §9 model block + both
  relation lines + rationale bullet, §11 new dated note, §16 new ratified-decision entry, the
  running post-v1 historical clause, `Last reviewed` bump). **Done.** **Not yet done:** a real
  headless-Chrome/`impeccable` visual pass in both themes, and Naveen entering his six real
  capacity numbers via the new admin screen against his real synced teams. **Next:** that
  human-acceptance pass; remaining post-v1 ideas — export-embedded AI narrative, AI Q&A, stage
  suggestions, PDF/share for `/bugs`, a `/bugs` ENG-sub-component follow-up, and leaderboard
  rank-delta arrows.
- 2026-07-29 — **Redesigned `StoryPointsHighlight` as the delivery scoreboard** (same day, per
  Naveen: "extremely important section… every detail in it is represented well"). The chip row
  shipped hours earlier was **replaced, not tweaked** — presentation only, no
  schema/migration/route/dependency change, **44 ƒ Dynamic unchanged**, all three call sites keeping
  their props. Seven choices ratified before any code (full scoreboard footprint · **ink surface**,
  the hero's material rather than the pale accent tint · totals lead · one authored arrival ·
  **Committed branded, the other two neutral** · over-capacity flagged · hover reveals precision).
  As built: a headline delivered/planned pair over a **composition rail** whose segment WIDTH is each
  type's share of planned scope and whose solid FILL is what's delivered, so the rail's lit area *is*
  the headline % — composition and completion in one shape. **Two variants** after Naveen's mid-build
  correction ("it's occupying a lot of real estate" / "in the Rollup screen keep this view, but give
  an option to have condense/relax"): `condensed` (default on `/` and `/share/[token]`) at **148px,
  down from 428px**, and `relaxed` (default on `/rollup`, where the portfolio breakdown IS the page)
  — `/rollup` is the ONLY screen with a **Condensed/Relaxed toggle**, a new client leaf
  `rollup/rollup-story-points.jsx` over `useLocalPref` per §17's ephemeral-pref rule, deliberately
  **per-card** and NOT a revival of the app-wide density toggle retired 2026-07-25. **Palette measured,
  not eyeballed:** the first cut's two greys read as background on ink (6.7:1 and 4.2:1), so Tech Debt
  and Unplanned Bugs took two new theme-neutral tokens — `--on-ink-cat-2` **gold `#e3a72f`** (Naveen,
  pointing at the `/bugs` Ageing ramp: "can we use this colour, I really like these") and
  `--on-ink-cat-3` **rose `#f2a8b6`**; the Ageing ramp is deliberately **not** reused verbatim (authored
  against a white card, its two darkest steps collapse to 3.4:1/2.2:1 on ink, so `--age-*` is
  untouched and this is the same hue re-pitched). **`.sp-stripe` hatching stays** because brand↔cat-3
  is worst-case **ΔE 4.8 under deuteranopia** — texture is that pair's second channel and must not be
  "simplified" away. Knock-on: `--on-ink-warn` became `--on-ink-alert` **red `#ff5f56`**, since amber
  sat ΔE 6.4 from the new gold and would have read as a fourth category. The capacity tick is drawn
  **only when committed scope has overrun** target (a tick pinned to the segment edge would imply
  capacity equals scope — the legend states headroom in words instead); hover-dimming is pure CSS
  `:has()` so the card stays a server component and nothing is hover-only; motion is one ~0.8s
  `sp-draw`/`sp-fill`/`sp-mark` sequence, all `backwards`-filled so it hands the property back and
  never outranks the hover rule. `useCountTransition` gained opt-in `countOnMount` **and a real bug
  fix**: its `getSnapshot` sampled the clock on every call — exactly React's "the result of
  getSnapshot should be cached to avoid an infinite loop" — now computed once per rAF frame and
  cached, fixing **every** caller (both leaderboards and `MyStatsCard`), not just the scoreboard.
- 2026-07-30 — **Ran the finish-feature gate on the whole feature (both passes).** Verified against
  Naveen's real synced data: `yarn lint` clean; `prisma validate`/`migrate status` up to date
  (**7 migrations**); **cold `rm -rf .next` DB/env-free build green — 44 ƒ Dynamic unchanged**, `.env`
  genuinely moved aside via `mv`, confirmed absent mid-build, restored after; **22/22 pure-Node
  fixtures** re-derived for the three segments (all 5 `WorkflowType`s incl. the `CUSTOM` issue landing
  in none of them, `aggregateRollup` doubling, empty-board NaN safety); **26/26 SSR/API smoke** across
  `/`, `/rollup`, `/admin`, the unauth gate and both capacity routes' 401/404s; **19/19 dedicated
  share-path checks** that create one live **and one frozen** share through the real API route — the
  frozen `snapshot` JSON physically **pins capacity** (`keys: sprint, filters, capacity, progress,
  capturedAt`), both variants render condensed, and teardown left **0** leftovers. Two structural
  confirmations worth more than the counts: `metrics.mjs`'s diff is **purely additive — zero removed
  lines** (decision 2's display-only claim proven by construction, not just by fixture diff), and the
  dev server's **captured browser console shows zero** `getSnapshot`/infinite-loop/`Maximum update
  depth` warnings across real page loads, confirming the hook fix in situ. **Closed a human-acceptance
  item:** Naveen has entered his six real capacity numbers (`AAI=24, CALM=24, D360=36, DX=48, INT=24,
  PCX=84`) and they render correctly — the AAI board shows `· 24 cap (on target)` (the equality case)
  and `/rollup`'s portfolio figure reads **240 capacity**, exactly their sum. **Partial visual pass:**
  the Chrome extension is still not connected, so the authed round remains Naveen's; the session-less
  `/share` page was captured via **system Chrome headless** at 1512/900/420px against a temporary live
  share (deleted after) — rail at 24%/30%/46% summing to 100%, gold Tech Debt, hatched rose Unplanned
  Bugs, `24 cap (on target)` in words with **no** tick (correct at target), and a graceful 3-line
  legend reflow at 420px. **Found three harness bugs and zero app bugs** — assertions using
  `"Story Points"` vs the rendered `"Story points delivered"`, the *relaxed* variant's `24 capacity`
  wording asserted against a *condensed* page (whose legend reads `· 24 cap`), and `includedFilterIds`
  sent where the route's contract is `filterIds` (its 400 was correct) — plus a re-confirmation that
  `computeSprintMetrics` is positional with a jiraKey-keyed progress **object**, `aggregateRollup`
  takes a flat **array**, and `velocityPoints` is the throughput **scope** total, not delivered points.
  Also established that the only pre-existing `SharedView` row **expired 2026-07-19**, so its page
  correctly serves the generic expired state — which is indistinguishable from a broken board in a
  substring assertion, hence the freshly-created share pair. **One pre-existing issue observed, not
  fixed (out of scope):** below ~900px every card on a board page overflows horizontally, caused by
  the Delivery Matrix's `min-w-225` rows in `planner-panel.jsx` — **a file this diff never touches**;
  the scoreboard itself is `overflow-hidden` + `min-w-0` and stacks correctly. **One unrelated stray
  edit flagged for Naveen, deliberately not reverted:** `legacy/index.html` (the retired Vite app)
  carries an uncommitted reformat plus a title change to "Tek Tracker" **and a stray `pro` appended
  after `</html>` with the trailing newline lost** — almost certainly an accidental keystroke, and it
  would otherwise ride along in this commit. Docs synced: feature spec Status (both passes) +
  As-built notes, project-overview §5 row / §16 decision register (a dated presentation-only
  amendment, no ratified decision reversed) / the master-plan post-v1 clause, and `Last reviewed`
  bumped to 2026-07-30; §9 re-checked byte-identical against `schema.prisma`. **Done.** **Next:**
  Naveen's Modern-theme + authed visual pass, then the deferred post-v1 ideas — export-embedded AI
  narrative, AI Q&A, stage suggestions, PDF/share for `/bugs`, the `/bugs` ENG-sub-component
  follow-up, and leaderboard rank-delta arrows.
- 2026-07-31 — **Renamed the application to StoryBoard** (was "Sprint Tracker", earlier codename
  "TekTracker"/"Tek Tracker"). Branch `feature/rename-storyboard` off `main`. **Display/branding
  only** — deliberately no schema, route, cookie, or storage-key change, so nobody is logged out
  and no data is orphaned. Impact analysis up front confirmed the name has **zero DB coupling** (no
  rows/enums/slugs/defaults — only a line-1 schema comment), **no env-var-name coupling**, no
  in-repo deploy config, and no lockfile coupling; the Tekion git remote was already
  `naveens_tkinc/storyboard.git`. Edits (22 in-code sites / 12 files + config/doc headers): the 6
  wordmarks (4 top-bars, sidebar wordmark+aria-label, login heading, welcome hero) + the share
  page's two-line `TekTracker / Sprint Tracker` lockup collapsed to a single `StoryBoard`; the 5
  `export const metadata` titles (`layout`, `login`, `leaderboard`, `admin`, `share`);
  `package.json` name → `story-board`; `.env.example` header; `README.md`/`CLAUDE.md` headers +
  vision prose; `prisma/schema.prisma:1` comment (self-heals into the gitignored generated client on
  `prisma generate` — verified clean). **Deliberately left alone** (decision 2): the session cookie
  `sprinttracker_session` (`src/lib/auth.js:22`) and the two `sprintTracker_*` localStorage keys —
  renaming the cookie would force-log-out every user with no dual-read fallback, for zero benefit.
  `legacy/**`, `src/generated/**`, and dated history/decision entries in `context/**` untouched
  (append-don't-rewrite; project-overview.md + CLAUDE.md each got a dated rename note instead, and
  `current-feature.md`'s only old-name matches are historical entries + the real
  `context/SprintTracker - Project Spec/` directory path). **Verified:** `yarn lint` clean (Node
  22); grep sweep of authored `src/` returns **zero** old-name hits; `prisma validate` +
  `migrate status` up to date (**7 migrations, no new migration**); **cold `rm -rf .next`
  DB/env-free build green — 44 ƒ Dynamic unchanged** (`.env` genuinely moved aside via `mv`,
  confirmed absent mid-build, restored after; a stale dev server holding the turbopack cache was
  stopped for the cold build and restarted after — the documented house pattern); runtime smoke on
  the restarted `:3002` server — `/login` renders `<title>Sign in · StoryBoard</title>` + the
  StoryBoard wordmark, the unauth `/share/<bad-token>` page renders
  `<title>Shared sprint view — StoryBoard</title>` + StoryBoard chrome, both with zero
  `Sprint Tracker`/`TekTracker` in rendered HTML. **Not committed** (awaiting Naveen's review + the
  optional external follow-ups: rename the `origin` GitHub repo `Naveen-S/TekTracker`, and swap the
  "T" app icon/favicon for a StoryBoard mark). The stray `legacy/index.html` edit noted in the
  2026-07-30 entry is unrelated and still uncommitted.
- 2026-08-01 — **Ran the finish-feature gate on the StoryBoard rename.** Re-verified end to end on
  Node 22: `yarn lint` clean; grep sweep of authored `src/` (excl. `src/generated/`) returns
  **zero** `Sprint Tracker`/`TekTracker` hits; `prisma validate` + `migrate status` up to date
  (**7 migrations, no new migration** — comment-only schema change); **cold `rm -rf .next`
  DB/env-free build green — 44 ƒ Dynamic unchanged** (`.env` moved aside via `mv`, confirmed absent
  mid-build, restored after; the running `:3002` dev server was stopped for the cold build and
  restarted after — the documented house pattern); runtime smoke on the restarted server —
  `/login` → `<title>Sign in · StoryBoard</title>` + StoryBoard wordmark, unauth
  `/share/<bad-token>` → `<title>Shared sprint view — StoryBoard</title>` + StoryBoard chrome,
  both zero old-name in rendered HTML, root `/` unauth → 200 (login). **Doc-sync (finish gate):**
  extended the rename beyond the plan's original list to two forward-looking prose sites in
  `project-overview.md` (§2 "StoryBoard models these stages", §11 login-page spec text) and the
  three illustrative `.env.example` DB-URL sample names (`sprint_tracker` → `storyboard`) — all
  commented/example values, zero runtime coupling. Canonical docs now carry the old name only in
  the intentional dated rename notes (`project-overview.md` header, `CLAUDE.md` header) and in
  dated `context/**` history; the session cookie + two `sprintTracker_*` localStorage keys remain
  deliberately unchanged. Tracker header rolled forward from the committed-unplanned feature to this
  rename (its detail preserved in @context/features/committed-unplanned-work.md + the History
  above). **Done.** **Next:** commit on Naveen's go-ahead; then the optional external follow-ups
  (rename `origin` GitHub repo, StoryBoard app mark).
- 2026-08-02 — Planning session (no code): drafted @context/features/enhancing-bug-board.md from
  Naveen's handwritten "Enhancing Bug Board" note (`context/SprintTracker - Project Spec/
  Enhancing_Bug_Board.jpg`). Three additions to `/bugs`: (1) an External/Internal/All scope toggle
  driving the whole page with External highlighted, (2) a "Bugs by scrum team" section, (3) a
  per-team → per-developer → inline-issue drill. Explored the full `/bugs` render path, data model,
  and reusable patterns (3 Explore agents); key findings folded into the spec — the bug cache has
  `assigneeName` but **no** `assigneeAccountId` (developers group by display name), and the
  team-distinguishing value lives in the custom `"sub-component[dropdown]"` field the refresh does
  **not** fetch today (the stored `components` string is only the coarse parent). Ran a
  clarifying-question round with Naveen; **5 decisions ratified** (default All + external
  highlighted; instant client-side toggle over three pre-rendered subtrees; read-time FK-less
  sub-component→Team join — the first `BugReport`↔`Team` link; Unassigned bucket for unmapped;
  developer drill = inline list + Jira link). Design direction via the `impeccable` skill (extension
  inside the incumbent visual world — reuse `Panel`/`Bar`/`AvatarChip`/tokens, no `init`). Approved
  plan at `/Users/naveen/.claude/plans/plan-the-feature-in-cozy-sketch.md`.
- 2026-08-02 — Picked @context/features/enhancing-bug-board.md as the current feature; branch
  `feature/enhancing-bug-board` off `main`. StoryBoard rename remains **Done** (on `main`).
- 2026-08-02 — **Implemented + verified enhancing-bug-board.** Schema: `BugReportIssue.subComponent`
  + migration `add_bug_report_issue_subcomponent` (8 migrations). New pure modules
  `bug-report/by-team.mjs` (grouping) + `bug-report/sub-component-field.mjs` (field id + value
  extraction, split out for plain-Node testability); `fetchFields` in `jira/client.js`; `refresh.js`
  captures the sub-component field; `bug-report-data.js` computes three scope views + the read-time
  team join off one issues + one snapshot query. UI: `bug-scope-view.jsx` (context provider + on-ink
  segmented toggle + slot), `bug-team-section.jsx` (team→developer→inline-issue drill), extracted
  `bug-bar.jsx`, restructured `bugs-page.jsx` (three pre-rendered subtrees, static hero + two
  scope-driven slots), `emphasizeScopeId` on `bug-matrix.jsx` + `bug-kpi-cards.jsx`; `Bar`/`AvatarChip`
  roots → `<span>` (valid inside the drill's expand buttons). **Verified:** lint clean; 13/13
  plain-Node fixtures; **cold DB/env-free build green — 44 ƒ Dynamic unchanged**; impeccable detector
  clean; **live SSR + refresh on the real `gm` report** — 155/233 bugs mapped into 6 real teams, page
  renders 200 with the toggle/emphasis/all panels, zero errors. **Real-Jira finding:** field-id
  name-discovery is ambiguous on Tekion's instance (multiple "Sub-component" dropdowns share the
  `sub-component[dropdown]` clause; real values live in `customfield_13108`) → added the
  `JIRA_SUBCOMPONENT_FIELD_ID` env override (decision 6's escape hatch), discovery kept as fallback.
  Doc-synced project-overview §5/§9/§11/§16 + `Last reviewed` 2026-08-03; gm-bug-report.md pointer;
  spec Status + As-built notes. **Done** — pending commit + Naveen's authed visual pass.
- 2026-08-02 — **Follow-on feature (same branch): `/bugs` PDF export with clickable Jira links.**
  Naveen asked to "share this as a PDF, where each link is clickable to go to the jira issues."
  Ratified 3 decisions (downloadable PDF, all links clickable, exports the current scope toggle).
  Drafted @context/features/bug-report-pdf-export.md. Built `bug-export-dialog.jsx` — `BugExport`
  hero button (reads active scope via the new `useBugScope` export) + `BugExportDialog` (offscreen
  A4 print pages → `html2canvas-pro` capture → jsPDF `addImage` → **`overlayLinks`** → save). The key
  addition vs. the sprint export: **clickable links** — the print pages carry real `<a href>` and,
  after each page rasterizes, `pdf.link(x,y,w,h,{url})` annotations are overlaid at each anchor's
  px→mm position, so issue keys open the issue and matrix cells open the JQL search. Print pages:
  summary (KPIs + clickable matrix), by-team (team→dev→issues), oldest table. No new dependency
  (reuses html2canvas-pro + jspdf), no schema/route change. **Verified:** lint clean; **cold
  DB/env-free build green — 44 ƒ Dynamic unchanged**; **real PDF generated in headless Chrome against
  the live `gm` report** — 334 clickable anchors (293 browse + 41 matrix JQL), zero page errors, and
  the downloaded PDF's raw `/URI` annotations confirm the links are embedded + clickable (not a flat
  image). **As-built:** switched PNG → **JPEG 0.92** (a multi-page PNG PDF ran to 175 MB → ~6 MB).
  Doc-synced project-overview §5/§11 + the parked out-of-scope lines in gm-bug-report.md /
  enhancing-bug-board.md flipped to pointers. **Done** — pending commit + Naveen opening a PDF and
  clicking through. (Temp `playwright-core` install used for verification, reverted from the manifest.)
- 2026-08-02 — **PDF export refinements from Naveen's first review** (4 asks, all in
  `bug-export-dialog.jsx`): (1) **spacing/margins** — page padding `p-8` → `px-11 py-10` + roomier
  section rhythm; (2) **team + developer rows clickable to a Jira filter** (`key in (…)`), so the
  by-team "table items" are all clickable, not just issue keys (matrix/filter JQL links 41 → 182);
  (3) **each scrum team starts on a new sheet** — per-team pagination (GM 10 → 20 pages); (4) **the
  trend chart fills the remaining space on sheet 1** — a static print `PrintTrend` (open vs. past-SLA
  over time, reusing `smoothLinePath`/`smoothAreaPath`). Verified by regenerating the real `gm` PDF
  in headless Chrome + screenshotting sheets 1 (KPIs + matrix + trend, clean margins) and 2 (GM
  PreCheckout on its own sheet, team/dev underlined links) — zero page errors, 6 MB. `yarn lint`
  clean; **cold DB/env-free build green — 44 ƒ Dynamic unchanged**. Doc-synced the spec's As-built
  notes. Temp `playwright-core` reverted from the manifest again. **Done** — pending commit +
  Naveen's own click-through.
- 2026-08-03 — **PDF leadership-polish pass** (Naveen reviewed a real export: "padding margin …
  doesn't look accurate, make this leadership shareable ready … pixel perfect"). Fixes in
  `bug-export-dialog.jsx`: (1) **every sheet is a true A4 page** (`h-[1123px]` flex-col
  overflow-hidden) with the **footer pinned to the bottom** (`mt-auto`; print pages `flex-1
  flex-col`) — before, content was top-heavy with the footer floating over a big empty bottom;
  (2) **dropped the duplicate "Total" column** for single-scope exports (per-scope Total == grand
  Total when one scope — `showGrandTotal = scopes.length > 1`); (3) **more generous symmetric
  margins** (`px-13 py-12` ≈ 14mm) + a **taller trend** (190 → 250). Verified by generating the real
  **External** `gm` PDF and reading the rendered A4 pages: sheet 1 full with footer at bottom, single
  Total column, taller trend; sheet 2 = DX team on its own sheet, footer pinned. `yarn lint` clean;
  **cold DB/env-free build green — 44 ƒ Dynamic unchanged**. **Noted (not a bug):** headless-Chrome
  captures collapse inter-word spaces (html2canvas font-metric quirk); Naveen's real-browser export
  renders spaces correctly. Doc-synced the spec. **Done** — pending commit + Naveen re-exporting to
  confirm the polish + spacing in his browser.
- 2026-08-04 — **PDF export reworked to a landscape executive report (parallel session) + finish
  gate.** Discovered on `/finish-feature` that `bug-export-dialog.jsx` + `bugs-page.jsx` had been
  rebuilt (in a parallel session) from the portrait format into a **landscape** A4 executive report:
  a `BugExecutiveSummary` brief + a **risk-ordered** `BugTeamAppendix` (`sortTeamsByRisk`) + an
  **optional** oldest appendix (dialog `Checkbox` + 20/40/60 `Select`), with the naive row-count
  pagination replaced by **height-budgeted** packing in the new pure `lib/bug-report/pdf-layout.mjs`
  (`paginateTeamAppendix`/`chunkRows` — multiple small teams per sheet, large teams split with
  repeated headers; supersedes "each team on its own sheet"). New clickable targets: matrix
  breached-subset + combined-scope cells; PDF `setProperties` metadata; new `ui/checkbox.jsx`.
  Treated as-found (not reverted). **Finish-gate verification (this session):** `yarn lint` clean;
  `prisma validate` + `migrate status` up to date (8 migrations); **cold DB/env-free build green —
  44 ƒ Dynamic unchanged**; runtime smoke — `health/db` ok, authed `/bugs/gm` 200 with the Export
  button + by-team section, 0 errors. Doc-synced: bug-report-pdf-export.md (Status → Done + a
  "Landscape executive rework" As-built section), project-overview §5 + a new §11 dated note, and
  this tracker. **Done.** **Next:** commit on Naveen's go-ahead + his real-browser export check;
  clean the stray `output/`/`tmp/` dirs first.
- 2026-08-04 — Picked @context/features/bug-sprint-ownership.md as the current feature (group `/bugs`
  bugs by Jira Sprint ownership — ours vs dependencies vs no-sprint, config-driven per report). Ran
  3 parallel Explore agents (data model/refresh, read path/UI, admin config) + a clarifying-question
  round; 3 decisions ratified with Naveen — separate "No sprint" group, section **+** top KPI card,
  **include in the PDF export**. Design is a near-exact mirror of the shipped by-team feature.
  **Branch decision (Naveen):** stay on `feature/enhancing-bug-board` — `HEAD == main == ad6cdb7` and
  the enhancing-bug-board + PDF work is uncommitted here, so this coupled follow-on continues on the
  same branch rather than a no-op fresh branch off `main`. Approved plan at
  `/Users/naveen/.claude/plans/i-do-see-one-linear-brooks.md`. enhancing-bug-board + bug-report-pdf-export
  remain **Done** (uncommitted, same branch).
- 2026-08-04 — **Implemented bug-sprint-ownership (group `/bugs` bugs by Jira sprint ownership —
  ours vs dependencies vs no-sprint).** Schema: `BugReportIssue.jiraSprintName` +
  `BugReport.sprintOwnershipPattern` (migration `add_bug_report_sprint_ownership` — 9 migrations,
  §9 byte-synced). New pure `sprint-field.mjs` (`resolveSprintFieldId` + ported `extractSprintName`
  + `DEFAULT_SPRINT_FIELD`) and `sprint-ownership.mjs` (`compileSprintMatcher` glob/prefix/comma-OR
  + `groupBySprintOwnership` cloning by-team.mjs, reusing `isBreached`/`daysOverSla`). `refresh.js`
  resolves the Sprint field id (env `JIRA_SPRINT_FIELD_ID` → `/field` discovery → `customfield_10020`,
  `/field` now fetched **once** and shared with sub-component discovery), appends it to `issueFields`,
  captures `jiraSprintName` in `toBugIssueRow`; `.env.example` documents the override. `bug-report-data.js`
  adds `bySprintOwnership` to each scope view (no extra query). UI: new `bug-sprint-ownership-section.jsx`
  (three callout tiles + bucket → sprint → inline-issue drill, `key in (…)` Jira links, ours-accent/
  dependency-warn), a `Ours / dependencies` KPI card in `bug-kpi-cards.jsx` (row → `xl:grid-cols-7`
  when configured), section placed under the matrix + `exportViews` carry the data (`bugs-page.jsx`).
  PDF: `paginateOwnershipAppendix` in `pdf-layout.mjs` (refactored a shared `packSections`;
  `paginateTeamAppendix` regression-checked) + a `renderPage` branch reusing a **parametrized**
  `BugTeamAppendix` (`title`/`caption`/`subgroupNoun`) — a bucket reads as a "team", a sprint as a
  "developer". Config: `sprintOwnershipPattern` in `bugReportConfigSchema`, persisted in the config
  PUT route's `tx.bugReport.update`, edited via a new "Sprint ownership" admin section (rides the
  existing Save). **Verified:** lint clean; 50/50 plain-Node fixtures + a `paginateTeamAppendix`
  regression; migrate status up to date (9 migrations); cold DB/env-free build green — **44 ƒ Dynamic
  unchanged**; impeccable hook clean on all changed components; **live on the real `gm` report** —
  refresh tagged 145/233 bugs, `GM-*` → Ours 136 · Dependencies 9 (`AEP-*`/`AI-*`/`ZEB-*`) · No sprint
  88, SSR renders the section + KPI + drill, and read-time reclassification proven with no refresh.
  **Found (not a code bug): a stale pre-migration Prisma client** on the running dev server 500'd the
  first refresh (`Unknown argument jiraSprintName`) though the Jira extraction was correct — fixed by
  `prisma generate` + restart (the documented stale-dev-server hazard). The `gm` report is left set to
  `GM-*` (Naveen's requested pattern). Doc-synced project-overview §5/§9(+ER)/§11/§16 + master-plan
  post-v1 clause + `Last reviewed` 2026-08-04, and the spec Status + As-built notes. **Done.**
  **Next:** commit on Naveen's go-ahead (with enhancing-bug-board + PDF, same branch); then his authed
  visual + real-browser PDF pass.
- 2026-08-07 — **Export visual consistency — the sprint export adopts the `/bugs` PDF design system.**
  Per Naveen ("Check the PDF generated in the bugs screen, follow similar color, theme, styling and
  format for all the exports in the app… even the clarity should be very similar"). The app has exactly
  one other export — the sprint board export (`dashboard/export-dialog.jsx`, PDF + PNG) — so scope =
  that one, re-skinned from its old teal/pastel/Manrope portrait look. Ratified 3 decisions via
  `AskUserQuestion`: **portrait (restyle only)** (no landscape flip / no burndown — a faithful restyle
  of existing content), **add clickable Jira key links**, and **extract a shared export kit** (both
  PDFs import it; refactor the just-finished bugs export to use it, verified identical). Built the kit
  — `lib/export/print-theme.mjs` (palette/tones/geometry, lifted verbatim from the bugs export),
  `components/export/print-kit.jsx` (`PrintSheet`/`PrintHeader`/`PrintFooter`/`KpiBox`/`ReportPanel`/
  `ExecutiveReadout`/`KeyLink`), `lib/export/pdf-capture.js` (`captureOptions`/`canvasToPngBytes`/
  `overlayLinks`/`fileStamp`/`safeFilePart`) — then refactored `bug-export-dialog.jsx` onto it
  (mechanical; `PrintHeader` generalized to `eyebrow/pill/title/subtitle/meta`, `PrintFooter` to
  `left/pill`, `grid-cols-3` preserved as `repeat(N, minmax(0,1fr))`) and rebuilt the sprint export's
  `SummaryPage` (PrintHeader + 5 KpiBox tiles + two-up Delivery-readout / Work-composition callout
  panels + Delivery-by-filter card grid) and `IssuesPage` ("WORK BREAKDOWN" appendix: accent filter
  bands + issue rows with clickable `KeyLink` chips, progress pills, health badges, zebra) on the
  PORTRAIT geometry — scale-3 PNG capture + `pdf.setProperties` + `overlayLinks`; PNG variant kept
  (scale 2 for canvas-height safety). Threaded `team` + `jiraBaseUrl` into `ExportDialog`
  (`dashboard.jsx`). Hit + fixed one lint issue (`Date.now()` in a memo → `useState` lazy init, the
  bugs-export pattern) and one **real render defect** caught in the first headless PDF: the long
  sprint-window subtitle wrapped two lines and collided with the gradient rule → `PrintHeader` subtitle
  is now single-line truncate. **Verified:** `yarn lint` clean; `prisma migrate status` up to date (no
  schema change); **cold `rm -rf .next` DB/env-free `yarn build` green — 44 ƒ Dynamic unchanged**
  (`.env` moved aside via `mv`, restored; dev server stopped for the build and restarted); **headless
  Chrome + minted admin cookie against Naveen's real "Configurator & Website Setup" / "August 2026
  Release" board** — sprint PDF is A4 portrait, `setProperties` metadata correct, **20 real clickable
  `/URI` Jira `browse/…` annotations + `/Annots`** (not a flat image), 3 pages, zero page errors;
  page 1/2 rasterized and eyeballed (purple eyebrow, gradient rule, KpiBox row, readout callouts, filter
  cards, blue KeyLink chips); and the refactored **`/bugs` dialog preview is pixel-identical to the
  reference PDF** (regression-clean). Headless captures collapse inter-word spaces (documented
  html2canvas quirk; real-browser export spaces correctly). No schema/route/dependency change. New spec
  @context/features/export-visual-consistency.md; doc-synced project-overview §5 + a dated §11 note +
  `Last reviewed` 2026-08-07. **Done** — pending Naveen's real-browser export acceptance. On
  `feature/enhancing-bug-board` (rides with the uncommitted bug-export work it refactors). **Next:**
  that acceptance, then commit on his go-ahead.
- 2026-08-09 — **Implemented office-infra deployment (Dockerfile + service creation).** Packaged
  StoryBoard as a container for Tekion office infra on branch `feature/office-deployment` (off
  `main` @ `c2a3ea6`): multi-stage `Dockerfile` (`node:22-alpine`, Next.js `output:"standalone"`,
  JFrog npm proxy, migrations left to a separate step, bakes `.env`, `CMD node server.js` on :3000),
  `.dockerignore` (trims `legacy/`/`context/`; **deliberately keeps `.env`**), `output:"standalone"`
  in `next.config.mjs`, a dependency-free liveness route `GET /p/health`, and `DEPLOY.md` runbook;
  curated the RELB-28979 service-creation ticket. **Ratified with Naveen:** dedicated subdomain
  `storyboard.stage.aecloud.io` (app at root, no `basePath`; chosen over the platform-standard
  appRoot subpath twice — fallback documented); internal Tekion Postgres; secrets baked at build
  (Jenkins materializes `.env`); migrations as a separate `yarn db:deploy` step; service name
  `STORYBOARD` (no `_SERVICE` — verified against real RELB tickets); `type: Backend` (Tekion's
  "Frontend" = a static micro-frontend in the `tekion-web` shell; StoryBoard is a standalone SSR
  server + own DB). **Verified** (Node 22): `yarn lint` clean; `prisma validate` + `migrate status`
  up to date (**9 migrations, no schema change**); **env-free cold build green — 45 ƒ Dynamic** (44
  baseline + `/p/health`); standalone bundle **traces the generated Prisma client + `pg`**, boots,
  and serves `/p/health`→200, `/login`→200, `/`→200 with no `.env` (no Docker CLI locally →
  validated via `node .next/standalone/server.js`). Corrected the pasted template's `node:20`
  (project refuses Node 20 — verified engine error) and its missing-Prisma-client runner. Doc-synced:
  new context/features/office-deployment.md, project-overview §8 dated note + `Last reviewed`
  2026-08-09, a CLAUDE.md Structure bullet, this log + the current-feature carry-forward. **Done** —
  packaged, **not deployed**. **Next:** Naveen commits + pushes to `tekion-apps/storyboard` `main`;
  DevOps executes RELB-28979 (host→LB binding, internal Postgres, Jenkins job, cron) + first
  `yarn db:deploy` / `yarn db:seed`.

- **Unplanned work → External / Internal split + a per-team composition chart (2026-08-09).**
  Follow-on to committed-unplanned-work.md, on `feature/unplanned-split-chart` (off `main` @
  `d631492`). The delivery scoreboard's **Unplanned Bugs** segment bifurcates into **External**
  (`SUPPORT`) + **Internal** (`INTERNAL_BUG`) across `/`, `/rollup`, `/share/[token]` and the PDF/PNG
  export. **Additive + presentation only:** `metrics.mjs` gained `external*`/`internal*` fields beside
  the untouched `unplanned*` (before/after fixture diff proved every prior field byte-identical;
  `external + internal == unplanned`); no §12 health/velocity/lens change. The 4th categorical channel
  is a **validated** token `--on-ink-cat-4` orchid `#d385b0` (CIEDE2000 + Machado-2009-CVD sweep —
  worst-case ΔE ≥ 11.6 vs brand-both-themes / gold / rose / alert-red; **purple/violet rejected — it
  collapses against Modern's blue under CVD**), with the encoding **solid = planned work, hatch =
  reactive bug** (`.sp-stripe` rose / new `.sp-stripe-2` orchid), hue sub-dividing the two bugs.
  `compositionBreakdown()` (exported from `story-points-highlight.jsx`) builds the breakdown
  split-or-`unplanned`-fallback so pre-split frozen shares still render. Export "Unplanned bugs"
  readout → two rows. **The chart went through two passes.** First a composition **donut** (two
  concentric rings, both screens, a shared `story-points-scoreboard.jsx` toggle) — Naveen reviewed and
  rejected it: *"the chart representation is not adding any value"* (a donut of the same four numbers
  the rail already shows adds nothing). Replaced by a **per-team composition chart on `/rollup`**
  (`rollup-composition-chart.jsx`): one horizontal stacked bar per team, length ∝ its
  committed+tech-debt+bug load, segments = the four work types, sorted heaviest-first with
  delivered/planned/% per row — the one lens the portfolio totals + aggregate rail can't show (which
  teams carry which kind of work). Toggle became `Condensed · Relaxed · By team` on `rollup-story-points.jsx`
  (over `useLocalPref`); the **board has no chart** (Naveen), just the bifurcated condensed scoreboard;
  the donut, its `variant="chart"` branch, and the shared scoreboard wrapper were removed. Designed
  with the **impeccable** skill. **Lesson:** a chart that only re-encodes numbers already on screen is
  not a value-add — earn it with a new dimension. **Verified:** `yarn lint` clean; additive + partition
  fixtures; cold `rm -rf .next` DB/env-free build green — **45 ƒ Dynamic unchanged** (no new routes);
  no schema change (**9 migrations**); impeccable `detect.mjs` → `[]`; a **headless-Chrome (Playwright)
  screenshot round** on the live PCX/GM ACTIVE sprint (all 4 work types) — `/` (no toggle, bifurcated)
  + `/rollup` By-team (desktop + mobile — PCX tech-debt-heavy, D360/DX bug-heavy at a glance) +
  `/rollup` Relaxed (4-col) all correct. **Done**, uncommitted — pending Naveen's commit + his authed
  visual pass (both themes) and a real-browser PDF export. See context/features/unplanned-split-and-chart.md.

- **Sync Jira status → delivery-matrix stages, per track (2026-08-10).** On
  `feature/sync-stages-from-jira` (off `main` @ `452644e`). Turns the manual per-ticket stage
  checklist into a one-click, per-track action: each delivery-matrix track header (Roadmap / Tech
  Debt / External Bug / Internal Bug) gets a `canWrite`-gated **"Sync stages"** button that pulls the
  latest Jira status for that filter and re-derives every one of its issues' stages from it via
  `StatusStageMapping` — the user-triggered, per-track **overwrite** variant of the create-only sync's
  deferred "re-seed forward" (sync-hybrid-seeding.md decision 5). Naveen's three ratified calls
  (AskUserQuestion): **overwrite-with-confirm** (the confirm names how many tickets carry manual stage
  edits that will be replaced), **a button per track**, **pull-latest-then-map** (a live Jira call
  scoped to the one filter). Derived guards: unmapped statuses are **counted, never wiped**;
  blocked/blockedReason/riskComment preserved; owning workflow honored (one progress row per key);
  CLOSED sprints 409'd; and `updatedById` is **reset to null** on overwrite so re-runs are idempotent
  (only hand-edits made afterward count as "manual" next time). New pure `resolveStageResync`
  (`seeding.mjs`) + `syncFilterStagesFromJira` (`engine.js`, reusing `refreshFilterCache` /
  `buildSeededStages` / `owningWorkflowType`) + `POST .../filters/[filterId]/sync-stages` (writer
  roles) — **45 → 46 ƒ Dynamic**; `dashboard-data.js` exposes `manuallyEdited`; button in
  `planner-panel.jsx`, confirm `<Dialog>` + two-transition handler in `dashboard.jsx`. No
  schema/migration/dependency change (**9 migrations**). Verified: `yarn lint` clean; **cold
  `rm -rf .next` DB/env-free build green — 46 ƒ Dynamic**; **5/5** `resolveStageResync` fixtures;
  **4/4** guard smoke (401 unauth · 403 viewer · 404 unknown filter · 409 CLOSED sprint) with minted
  iron-session cookies against Neon (fixtures torn down); `prisma validate` + `migrate status` clean.
  **Done**, uncommitted — pending Naveen's commit + his real-browser acceptance (live Jira
  status→stages, both themes; the Chrome extension has never been connected). **Next:** commit on
  Naveen's go-ahead; consider an admin editor for `StatusStageMapping` if real Jira status names miss
  the seeded mappings (surfaced via the "unmapped" toast count). See
  context/features/sync-stages-from-jira.md.
