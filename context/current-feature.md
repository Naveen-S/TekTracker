# Current Feature

**Cutover (migration step 10)** — full spec: @context/features/cutover.md

The final master-plan step (1–8 Done; 9 skipped 2026-07-18): promote `web/` to the repo root so
the Next.js app IS the repository, retire the legacy Vite/Express app into **`legacy/`** (backed
up, **not deleted** — ratified with Naveen 2026-07-18, amending §16's delete-at-parity plan), and
land the deferred Node 22 bump (`.nvmrc` + `engines >=22.12`, delete the `web/.yarnrc`
`ignore-engines` shim). **Zero application-code changes** — file moves + config/docs only; no
schema change, no migration, no new deps.

## Status

**Done 2026-07-18** — the Next.js app now lives at the **repo root**; the Vite prototype is
backed up (startable, Node 20) in **`legacy/`**; Node 22 is the runtime (`.nvmrc` + `engines`,
`.yarnrc` shim gone). Two `git mv` phases (54 + 101 renames, history follows), zero app-code
changes, no schema change/migration. **Verified at root under Node 22.22.2:** lint clean,
`prisma validate`/`migrate status` up to date, **DB/env-free build green (27 ƒ Dynamic — the
step-8 list exactly)**, :3002 smoke (auth gate 307, login 200, share generic page, cron 401,
`health/db` ok on Neon, minted-admin dashboard SSR w/ full chrome), legacy boots on
:3000/:3001. Commits by Naveen (session shell can't run the Tekion gitleaks hook). As-built
deviations in @context/features/cutover.md (notably: `verify-web` skill renamed **`verify`**,
`legacy/**` ESLint-ignored). ⚠️ Pending human acceptance before merge: side-by-side eyeball,
real-Jira UI sync, share/export, day-in-the-life pass. **Next:** post-v1 — trend/burndown UI
from `SprintSnapshot` (step-10 "then" clause), then Gemini; deployment re-point to repo root is
deploy-time.

## Goals

- **(a) Phase 1 — retire:** `git mv` the Vite app (`src/`, `public/`, `index.html`,
  `vite.config.js`, `server.js`, `setup-auth.js`, `package.json`, both lockfiles,
  `.env.example`, `docs/`) → `legacy/`; old root `.gitignore` → `legacy/.gitignore` (minus the
  `.claude/*` rules, which stay at root); plain-`mv` untracked `.env`/`node_modules`/`dist`;
  **delete `.sessions/`** (plaintext tokens, never backed up); add `legacy/README.md` (what it
  is, Node 20, `yarn dev:all` → :3000/:3001).
- **(b) Phase 2 — promote:** `git mv` all of `web/` (incl. dotfiles) → root; delete
  `web/CLAUDE.md`; root `.gitignore` = web's + re-added `.claude/*` / `!.claude/skills/` /
  `.DS_Store`; `mv web/.env` → `.env`; delete `web/node_modules` + `web/.next` (the fresh
  install rebuilds them).
- **(c) Node 22:** `.nvmrc` (v22.22.2 is installed), `engines.node ">=22.12"`, delete `.yarnrc`,
  fresh `yarn install` under 22 (must pass with no engine overrides; postinstall regenerates the
  Prisma client).
- **(d) Config/docs:** `turbopack.root` comment (pin stays — repo remains dual-lockfile);
  package names `sprint-tracker` / `sprint-tracker-legacy`; root `CLAUDE.md`/`AGENTS.md`/
  `README.md` rewrite; `.claude/skills/` `web/`-path sweep; `.env.example` crontab path check;
  project-overview doc-sync (step 10 DONE, §7 retitled legacy, §16 amendments).
- **(e)** Two commits (retire → promote) so rename detection + `git log --follow` stay clean.
- **Acceptance:** at root under Node 22 — lint + `prisma validate`/`migrate status` +
  **DB/env-free build green (27 ƒ Dynamic)**; dev-server smoke on :3002 (auth gate, dashboard
  SSR, share page, cron 401); legacy boots from `legacy/` under Node 20 (:3000/:3001);
  `git log --follow` shows pre-move history; zero load-bearing `web/` refs; `.sessions/` gone.

## Notes

- **gitignore semantics are the sneaky part**: leading-`/` rules are relative to the file's own
  dir — web's file works at root verbatim, but the `.claude/*` allowlist rules must be re-added
  to the root file by hand or they vanish into `legacy/.gitignore`.
- **`git mv` won't move untracked files** (`.env`, `node_modules`, `dist`, `.next`) — handle
  explicitly; verify root `.env` carries DATABASE_URL/secrets/CRON_* after the move (the server
  fails loudly without them, by design).
- **Do NOT add `"type": "module"`** to the promoted package.json — the CJS default is why the
  `.mjs` conventions (workflows/seeding/seed) exist.
- Stop the running :3002 dev server before phase 2 (its cwd disappears); restart from root
  after. Close stale app tabs (export-saga lesson).
- Historical `web/...` paths in context/ docs are **not** rewritten — true when written; a note
  in project-overview maps them to the post-cutover root.
- Naveen's pending human acceptance (side-by-side eyeball, real-Jira UI sync, share/export)
  is recommended **before merge**; legacy stays runnable so cutover doesn't destroy the
  comparison.

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
