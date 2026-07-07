# Current Feature

**UI port — login + team dashboard + minimal admin (migration step 6a)** — full spec:
@context/features/ui-port.md

Make everything built in steps 1–5 visible: port the prototype's UI to `web/` on **server data**
(retiring `usePersistedSprintState`; localStorage keeps only density/collapse). `/login` (ported
LoginForm), `/` dashboard as a **server component** (Prisma reads + pure `metrics.mjs` port of
`computeSprintMetrics`; team/sprint via `?team=&sprint=` searchParams) with client leaves calling
the step-4/5 routes (`PUT` progress w/ server-owned cascade, filter CRUD + reorder, `POST …/sync`),
re-skinned with Tailwind v4 + hand-written shadcn-style components; and a thin **`/admin`** page
(teams/members/sprints over the existing APIs) so a fresh DB is usable end-to-end. RBAC-aware
chrome (VIEWER read-only, admin-only Configure Sprint), server-enforced always. **Split decision:**
this is 6a — the EM/Lead daily loop; the ED multi-team roll-up is 6b, its own feature.
Acceptance includes the deferred **real-Jira re-verification** (fresh token → login UI → Sync →
real issues), per Naveen 2026-07-07.

## Status

**Planned 2026-07-07.** Spec drafted with 9 PROPOSED decisions (server-component reads via Prisma +
client `fetch` writes to existing routes, no Server Actions in 6a; `?team=&sprint=` searchParams
routing; per-page auth gate, no middleware; pure `metrics.mjs` port; hand-written shadcn-style
components, no new deps; add-filter = CRUD POST + immediate sync; RBAC-aware chrome with server
enforcement unchanged; exactly two localStorage prefs, `?share=` restore not ported; legacy app
untouched). Not started. ⚠️ Real-data acceptance still needs Naveen's fresh Jira token (stored one
is dead — sync-hybrid-seeding.md).

## Goals

- **(a) Metrics — `web/src/lib/metrics.mjs`** — pure port of `computeSprintMetrics`/health/velocity
  (§12) onto new shapes (Issue cache + IssueProgress joined by jiraKey; Prisma enums); plain-Node
  testable; fixture-checked against the prototype's outputs.
- **(b) Data assembly — `web/src/lib/dashboard-data.js`** — server-only: (userId, team?, sprint?) →
  my teams+roles, selected team/sprint defaults, ordered filters+issues, progress, metrics.
- **(c) Pages** — `/login` (ported LoginForm, §11 copy); `/` dashboard server component (TopBar w/
  team+sprint selectors + search + Add filter + Sync; Hero w/ days-left, density, admin-only
  Configure Sprint; MetricGrid; FilterPanel sidebar + PlannerPanel Delivery Matrix w/ stage
  checkboxes, health chip, blocked); `/admin` (admin-gated thin forms: teams, members-by-email,
  sprints + state). Client leaves fetch existing routes then `router.refresh()`.
- **(d) Modals** — AddFilter (POST + sync, decision 6), SprintConfig (admin), Alert. No Export/Share
  (step 8).
- **Acceptance:** full UI flow on dev+Neon (provision → filter → sync → matrix → stage cascade →
  blocked → reorder → density/collapse reload; VIEWER read-only; non-admin no `/admin`); metrics
  fixture parity; lint/build green + DB/env-free; **Naveen: fresh token → UI login → real sync**.

## Notes

- **Next 16: `searchParams`/`cookies()` are async** — re-read the installed docs before the page
  shells (same discipline as steps 3–5).
- Stage toggles send target state; the server owns the cascade (step 4) — optimistic update, then
  `router.refresh()` reconciles.
- Density/collapse: read localStorage after mount (SSR-safe defaults) — no hydration mismatch.
- Empty states: no membership → "ask an admin" panel; no filters → welcome hero (prototype parity).
- **Doc-sync (§17):** §5 UI-row notes, §11 re-skin note, §13.3 UI gating, master-plan step 6 →
  partial (6a done, ED roll-up = 6b outstanding).

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
