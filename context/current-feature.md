# Current Feature

**Auth layer (migration step 3)** — full spec:
@context/features/auth-layer.md

Port the prototype's Jira auth (`server.js` → `POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/logout`) to **Next.js 16 Route Handlers** in `web/`, upgraded to the production model:
validate `email + token` against Jira `/myself`, **upsert `User` + `JiraCredential`** with the Jira
token **AES-256-GCM-encrypted at rest** (key from env/secret store), and replace the
`express-session` file store with an **iron-session** cookie whose payload is **`{ userId }` only**
(the token never enters the cookie). First login **reconciles the bootstrap-seeded admin** —
fills the real `jiraAccountId`/`displayName`/`avatarUrl` over the `seed-pending:<email>` placeholder
while preserving `isAdmin`. This is **Production Migration Plan step 3**, resuming the master plan
**in order** ahead of the pulled-forward importer (@context/features/seed.md, step 9), which wants a
real `updatedBy` user + a Team (login + admin provisioning) first.

## Status

**Done 2026-06-29.** Implemented `crypto.js` (AES-256-GCM), `auth.js` (iron-session 8.0.4 +
`getCurrentUser`/`requireUser`), `jira/client.js` (`fetchMyself`/`fetchCloudId`), `schemas/auth.js`,
and `app/api/auth/{login,me,logout}/route.js`; added `iron-session@8.0.4` (exact) +
`JIRA_BASE_URL`/`SESSION_PASSWORD`/`TOKEN_ENCRYPTION_KEY` to `.env.example`. `yarn lint` clean;
`yarn build` green + **DB/env-free** (routes are `ƒ Dynamic`); crypto round-trip/tamper/bad-key tests
pass; dev-server curl confirms the **Next 16 async `cookies()` + iron-session** wiring (login `400`,
me-no-cookie `401`, logout `200` + clearing cookie). Decisions 3–4 resolved, 7–9 implemented as
proposed. Doc-synced project-overview §10/§13/migration-step-3 (§7 kept as legacy). **Login success
path verified end-to-end (2026-06-29, real creds + Neon):** login → `200 {isAdmin:true}` + sealed
30-day cookie; me round-trips; logout → 401; DB shows seed-admin reconciled (real `jiraAccountId`,
`isAdmin` kept) and the token **encrypted at rest** (ciphertext, decrypts back). `cloudId` fell back
to `baseUrl` (tenant_info gave none — fine under token auth). **Next:** @context/features/seed.md
(importer, step 9) or step 4 (Domain APIs). See @context/features/auth-layer.md "As-built notes".

## Goals

- **(a) Crypto — `web/src/lib/crypto.js`** — `encryptToken`/`decryptToken` (AES-256-GCM, random 12-byte
  IV, stored as base64 `iv ‖ authTag ‖ ciphertext`); key from `TOKEN_ENCRYPTION_KEY` (base64 32 bytes);
  **fail loudly** if absent/wrong-length. Pure (no DB/Jira), round-trippable.
- **(b) Session — `web/src/lib/auth.js`** — iron-session config (httpOnly, `sameSite:'lax'`, secure in
  prod, 30-day) + `getSession()`/`getCurrentUser()`/`requireUser()`. Cookie holds **`{ userId }`**;
  identity/`isAdmin` are read **fresh from the DB** each request (RBAC-freshness, decision 8).
- **(c) Minimal Jira client — `web/src/lib/jira/client.js`** — `fetchMyself()` (Basic auth →
  `{baseUrl}/rest/api/3/myself`) + `fetchCloudId()` (`/_edgeProxy/tenant_info`); **all** Jira specifics
  isolated here (§17). Step 5 grows this into the full sync client.
- **(d) Route handlers** — `app/api/auth/{login,me,logout}/route.js`. `login`: zod-validate
  `{ email, token }`, validate via Jira (401 on bad creds), **upsert `User`** (by `email`, don't touch
  `isAdmin`) + **`JiraCredential`** (by `userId`, `encryptedToken` only — never raw), set `{ userId }`
  cookie, return `{ email, displayName, isAdmin, avatarUrl }`. `me`/`logout` keep the prototype's
  contract (`{ error }` bodies, same HTTP statuses).
- **(e) Env + dep** — add to `web/.env.example`: `JIRA_BASE_URL`, `SESSION_PASSWORD` (≥32 chars),
  `TOKEN_ENCRYPTION_KEY` (base64 32 bytes); add `iron-session` (exact-pinned). No `JIRA_CLOUD_ID`.
- **Acceptance:** valid login → `200` + cookie + a `User` (admin reconciled) and a `JiraCredential`
  whose `encryptedToken` is **ciphertext, not the token**; bad creds → `401`, no writes; `me`/`logout`
  behave; `decryptToken(encryptToken(x)) === x`; missing secrets fail loudly; `yarn lint` + `yarn
  build` green + **DB-free**. Verified end-to-end with `curl` (no UI yet — that's step 6).

## Notes

- **Next 16 `cookies()` is async** and its iron-session integration is the piece most likely to differ
  from training data — read the installed `next`/`iron-session` docs (`web/AGENTS.md`) **before**
  writing `auth.js`. Don't assume the call shape.
- `web/.env` is **distinct** from the repo-root `.env` (legacy Vite/Express app); the root file stays
  untouched until cutover. `SESSION_PASSWORD` (cookie sealing) ≠ `TOKEN_ENCRYPTION_KEY` (token-at-rest)
  — two secrets; the old `SESSION_SECRET` is not carried over.
- **Doc-sync (§17):** keep §7 as the **legacy** snapshot (both apps coexist); on landing, mark §13
  item 1 (encrypt-at-rest) implemented in `web/`, item 5 (secrets store) partial, append to the §10
  Auth row, and record migration **step 3** done. "Admin settings / RBAC" stays **[GAP]** — this
  surfaces `isAdmin` + adds `requireUser()` but enforces no gating yet (that's step 4).
- Route Handlers (not Server Actions) per coding-standards (third-party integration + future CLI
  clients) and §8 (keep contracts); `{ success, data, error }` is the **Server Action** shape, used
  later for in-app mutations (step 4), not here.

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
