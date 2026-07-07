# Auth layer (migration step 3)

## Overview

Port the prototype's Jira auth (`server.js` → `POST /api/auth/login`, `GET /api/auth/me`,
`POST /api/auth/logout`) to **Next.js 16 Route Handlers** in `web/`, and upgrade it from the
single-user file-store model to the production model from
[project-overview.md](../project-overview.md) §9/§13/§16:

1. **Validate** `email + token` against Jira `/myself` (unchanged contract).
2. **Persist identity in Postgres** — upsert `User` + `JiraCredential`, with the Jira API token
   **AES-GCM-encrypted at rest** (key from env/secret store). This is §13 hardening item 1 and the
   first time login writes to the DB.
3. **Cookie sessions via iron-session** (decided in the master plan, step 3) replacing
   `express-session` + `session-file-store`. The cookie carries **only the user's id**, never the
   token — downstream Jira calls (step 5) load + decrypt the credential from the DB.

This is **Production Migration Plan step 3**. It is the first feature to put the Feature-3 schema to
work and to make the bootstrap-seeded ADMIN reconcilable: the seed left
`jiraAccountId = "seed-pending:<email>"` (see [bootstrap-seed.md](./bootstrap-seed.md) (b)); **this
feature fills in the real `jiraAccountId`/`displayName`/`avatarUrl` on first login while preserving
`isAdmin`.**

> **Key architectural shift from the prototype.** `server.js` stores the **raw token in the session**
> and every Jira proxy call rebuilds Basic auth from it ([server.js:182-195](../../server.js#L182-L195)).
> The target stores an **encrypted token in `JiraCredential`** and puts only `userId` in the cookie;
> the Jira client (step 5) fetches + decrypts per request. This decouples auth from the proxy and is
> what lets tokens be encrypted at rest and, later, swapped for OAuth (§13) in one place.

## Status

**Done 2026-06-29.** Implemented all of (a)–(e): `web/src/lib/crypto.js` (AES-256-GCM),
`web/src/lib/auth.js` (iron-session 8.0.4 + `getSession`/`getCurrentUser`/`requireUser`),
`web/src/lib/jira/client.js` (`fetchMyself`/`fetchCloudId`/`getJiraBaseUrl` + `JiraAuthError`),
`web/src/lib/schemas/auth.js`, and route handlers `app/api/auth/{login,me,logout}/route.js`. Added
`iron-session@8.0.4` (exact) and the `JIRA_BASE_URL`/`SESSION_PASSWORD`/`TOKEN_ENCRYPTION_KEY`
`.env.example` block. **Verified:** `yarn lint` clean; `yarn build` green and **DB/env-free** (built
with `DATABASE_URL` + all secrets unset; the three routes are `ƒ (Dynamic)`); crypto round-trip +
non-deterministic-IV + GCM tamper-detection + loud-fail-on-bad-key all pass against the real module
bytes; dev-server curl smoke confirms the **Next 16 async `cookies()` + iron-session** integration —
empty login → `400` (zod), `/me` no-cookie → `401`, `/logout` → `200` + `Set-Cookie:
sprinttracker_session=; Max-Age=0; HttpOnly; SameSite=lax`. **Login success path verified
end-to-end (2026-06-29, real creds + Neon):** `login` → `200 { isAdmin:true, displayName, avatarUrl }`
+ a sealed `Fe26.2*…` cookie (`Max-Age` ≈ 30d); `me` round-trips the identity; `logout` → `401`
after. DB confirms **seed-admin reconciliation** (`jiraAccountId` is the real Atlassian id, no longer
`seed-pending:`, `isAdmin` still `true`) and the **token encrypted at rest** (296-char ciphertext, not
plaintext, decrypts back to the raw token; `lastValidatedAt` set). Supersedes [seed.md](./seed.md)
(importer, step 9) as the in-order step 3.

## Decisions

Decisions 1–2 follow the master plan; 5–6 follow §16 provisioning. **3–4 resolved with Naveen
2026-06-29.** **7–9 are PROPOSED** (sensible defaults, flag if you disagree). No open questions block
implementation.

1. **Session: `iron-session` (stateless encrypted cookie), payload = `{ userId }` only.** Matches the
   master plan ("cookie sessions, e.g. iron-session, replacing the file store"). No server-side
   session store (no Postgres `Session` table, no file store). The cookie is sealed with a separate
   `SESSION_PASSWORD`; the Jira token never enters the cookie. *Alternative considered:* a DB-backed
   session table — rejected as unnecessary for a single encrypted-cookie identity.
2. **Token encryption: AES-256-GCM, key `TOKEN_ENCRYPTION_KEY` (base64 32 bytes) from env/secret
   store.** Node built-in `crypto` (no dependency). Stored format in `JiraCredential.encryptedToken`:
   base64 of `iv(12) ‖ authTag(16) ‖ ciphertext`. This realizes §13 item 1 and §16 ("personal Jira
   API tokens, encrypted at rest, AES-GCM, key in a secret store").
3. **`baseUrl` from env; `cloudId` discovered once at login (RESOLVED 2026-06-29).** `cloudId` is a
   tenant **UUID** (e.g. `a436116f-…`), **not** the site URL — and under Basic-auth (personal API
   token) it is **not actually used**: we call `{baseUrl}/rest/api/3/...` directly. It only becomes
   load-bearing under OAuth 3LO (§13, deferred), which addresses Jira as
   `https://api.atlassian.com/ex/jira/{cloudId}/...`. The §9 schema still requires it (non-null), so
   rather than ask for a hand-found UUID env var, **discover it once on login** via the unauthenticated
   `GET {baseUrl}/_edgeProxy/tenant_info` → `{ cloudId }` and store the real value on the credential
   (OAuth-ready). `baseUrl = JIRA_BASE_URL` (e.g. `https://tekion.atlassian.net`). **No `JIRA_CLOUD_ID`
   env var.** *Fallback:* if `tenant_info` is unreachable in our network, store `baseUrl` as a stand-in
   and revisit when OAuth lands.
4. **Response contract: superset of the prototype's (RESOLVED 2026-06-29).** Keep `login`/`me`
   returning `{ email, displayName }` (so the ported React layer changes minimally, §8) **plus**
   `isAdmin` and `avatarUrl`. **`isAdmin` is read straight off the `User.isAdmin` column** (our app's
   own global-admin flag, seeded `true` for `SEED_ADMIN_EMAIL` by bootstrap-seed; default `false`) —
   it is **not** derived from Jira, and it's already on the `User` row we load during login, so
   returning it is free. (Distinct from `TeamMembership.role = ADMIN`, which is team-scoped — see §9.)
   `logout` returns `{ ok: true }`.
5. **`User.email` is the login-provided email; `JiraCredential.jiraEmail` likewise.** Jira `/myself`
   may omit `emailAddress` under privacy settings, so we don't depend on it — we use `accountId`,
   `displayName`, `avatarUrls` from `/myself` and the **login email** for the email columns (same as
   the prototype). Upsert `User` by `email` (unique) to reconcile the seed placeholder.
6. **Non-admin first login is allowed and creates a `User` (isAdmin=false) with no membership.** Per
   §16 provisioning ("users sign in with Jira and wait to be added to a team"). Team-gating is a later
   feature; this feature does not block login on membership.
7. **Route Handlers, not Server Actions, for these three endpoints.** coding-standards.md routes
   "third-party integrations" and "endpoints for future mobile/CLI clients" to API routes, and §8
   says "port every `server.js` route to a Next.js Route Handler … keep the same request/response
   contracts so the React layer changes minimally." Login is a Jira (third-party) integration with an
   existing `fetch('/api/auth/...')` client. So: **Route Handlers keep the prototype's HTTP-status +
   `{ error }`/`{ … }` JSON contract.** The `{ success, data, error }` convention in coding-standards
   is for **Server Actions** — that lands later for in-app mutations (step 4 stage toggles), not here.
8. **Cookie payload stays `{ userId }` only — `isAdmin`/identity are read from the DB per request.**
   This is deliberate for RBAC (§13.3): if `isAdmin` (or, later, team roles) were baked into the
   sealed cookie, revoking an admin wouldn't take effect until the cookie expired (up to 30 days).
   `getCurrentUser()` resolving `userId → User` on each request keeps authz **fresh** at the cost of
   one cheap indexed read. (Also keeps the cookie small and the token out of it.)
9. **Secrets come from Tekion's secret store in prod; `web/.env` (gitignored) only in dev.** §13.5 +
   §16 (app on Tekion internal infra). `SESSION_PASSWORD` and `TOKEN_ENCRYPTION_KEY` are injected by
   the platform in prod, never committed. The legacy Express `SESSION_SECRET` ([server.js:71](../../server.js#L71),
   which silently falls back to `dev-secret-change-in-production`) is **retired** in `web/` — we fail
   loudly instead (acceptance below).

## Requirements

### Scope

**(a) Crypto module — `web/src/lib/crypto.js`**
- `encryptToken(plaintext) → string` and `decryptToken(ciphertext) → string` using AES-256-GCM with a
  fresh random 12-byte IV per call; output/parse the `iv ‖ authTag ‖ ciphertext` base64 format
  (decision 2). Optional AAD = `userId` to bind ciphertext to the user (note it if used; keep simple
  otherwise).
- Read the 32-byte key from `TOKEN_ENCRYPTION_KEY` (base64). **Fail loudly** if missing or not 32
  bytes after decode (assert at first use, not module load, so `yarn build` stays DB-free and
  env-free — see acceptance).
- Pure, no DB, no Jira. Unit-testable in isolation (round-trip `decrypt(encrypt(x)) === x`).

**(b) Session module — `web/src/lib/auth.js`**
- iron-session config (cookie name e.g. `sprinttracker_session`, `password: SESSION_PASSWORD`,
  `cookie: { httpOnly: true, secure: NODE_ENV==='production', sameSite: 'lax', maxAge: 30 days }` —
  mirrors [server.js:99-104](../../server.js#L99-L104)).
- `getSession()` — read/seal the iron-session cookie via `next/headers` `cookies()`.
  **⚠️ Next 16:** `cookies()` is **async** — `await` it; verify the iron-session call shape against
  `node_modules/next/dist/docs/` and the installed `iron-session` (see `web/AGENTS.md`).
- `getCurrentUser()` — resolve the session `userId` to the `User` row (or `null`). This is the
  building block the prototype's `requireAuth` becomes; **`requireUser()`** (throw/401 helper) is the
  guard domain routes (step 4) and the Jira client (step 5) will reuse.

**(c) Minimal Jira client — `web/src/lib/jira/client.js`**
- `fetchMyself({ baseUrl, email, token }) → { accountId, displayName, avatarUrl }` (Basic auth to
  `{baseUrl}/rest/api/3/myself`; throws a typed error on non-2xx → 401 mapping).
- `fetchCloudId({ baseUrl }) → string` — `GET {baseUrl}/_edgeProxy/tenant_info` → `{ cloudId }`
  (unauthenticated; tolerate failure → caller falls back per decision 3).
- Keep all Jira specifics (base URL, Basic-auth construction, endpoints) **isolated in this one
  module** per §17; step 5 expands it into the full sync client. Don't inline these calls in the route.

**(d) Route handlers (ported, same paths/contracts)**
- `web/src/app/api/auth/login/route.js` — `POST`. zod-validate `{ email, token }` via `validate()`
  ([validation.js](../../web/src/lib/validation.js)) + a schema in `src/lib/schemas/auth.js`. On
  valid:
  1. `fetchMyself` → 401 on failure (message identical to prototype:
     "Invalid credentials. Check your Jira email and API token.").
  2. **Upsert `User`** by `email`: set `jiraAccountId` (real, from `/myself`), `displayName`,
     `avatarUrl`; **do not** overwrite `isAdmin` (preserve the seeded flag).
  3. **Upsert `JiraCredential`** by `userId`: `jiraEmail`, `encryptedToken = encryptToken(token)`,
     `baseUrl` (= `JIRA_BASE_URL`), `cloudId` (= `fetchCloudId()`, decision 3),
     `lastValidatedAt = now()`. **Never** write the raw token.
  4. Set the iron-session cookie to `{ userId }`; return `{ email, displayName, isAdmin, avatarUrl }`.
- `web/src/app/api/auth/me/route.js` — `GET`. `getCurrentUser()` → `{ email, displayName, isAdmin,
  avatarUrl }` or `401 { error: 'Not authenticated' }`.
- `web/src/app/api/auth/logout/route.js` — `POST`. Destroy the session cookie; return `{ ok: true }`.
- Keep error bodies in the prototype's `{ error }` shape (400 for missing fields, 401 for bad creds /
  unauthenticated, 500 on unexpected). Mark handlers dynamic (they read cookies/headers) so the build
  never executes them.

**(e) Env + deps**
- Add to **`web/.env.example`** (the `web/` app's own env from Feature 3 — `DATABASE_URL`,
  `SEED_ADMIN_EMAIL`; **distinct** from the repo-root `.env` that feeds the legacy Vite/Express app
  and which stays untouched until cutover): `JIRA_BASE_URL` (e.g. `https://tekion.atlassian.net`;
  REST base is `{JIRA_BASE_URL}/rest/api/3`), `SESSION_PASSWORD` (≥32 chars, iron-session sealing),
  `TOKEN_ENCRYPTION_KEY` (base64 32 bytes; include an `openssl rand -base64 32` hint). **No
  `JIRA_CLOUD_ID`** (discovered at login, decision 3). Note `SESSION_PASSWORD` (cookie sealing) and
  `TOKEN_ENCRYPTION_KEY` (token-at-rest) are **two distinct secrets** (decision 9); the old
  `SESSION_SECRET` is not carried over.
- Add `iron-session` (pin **exact** version per the frozen-versions convention; reconcile lockfile).
  AES-GCM uses Node `crypto` — no new dep.

### Mechanism / gotchas

- **Prisma + Next dynamic:** login/me/logout query Prisma, so they must run at request time only.
  They inherently read cookies/headers (dynamic), so no extra `force-dynamic` is needed, but verify
  `yarn build` does not connect to the DB (the Feature-3 invariant — build passes with `DATABASE_URL`
  unset).
- **Seed reconciliation correctness:** the bootstrap admin row has a `seed-pending:<email>`
  `jiraAccountId`. Upsert-by-`email` updates it to the real id. Watch the `jiraAccountId @unique`
  constraint: a brand-new (non-seeded) user's first login must `create` (not collide). Upsert by
  `email` with `update`/`create` both setting `jiraAccountId` handles both paths. **Known edge:** if a
  user changes their Atlassian email, an upsert-by-`email` would `create` and collide on the existing
  `jiraAccountId`. Out of scope to handle now — note it; revisit if it bites (could reconcile by
  `jiraAccountId` instead, but email is the seed's join key, see decision 5).
- **iron-session under Next 16 async `cookies()`** — the one API most likely to differ from training
  data; check the installed versions before writing (`web/AGENTS.md`).
- **CSRF / CORS posture (§7 → §8):** the legacy split (`fetch(credentials:'include')` from a Vite
  origin → Express on :3001) needs the CORS allowlist + `credentials` dance in
  [server.js:78-87](../../server.js#L78-L87). The `web/` app is a **single same-origin deployable**
  (§8), so that cross-origin surface disappears: the session cookie is first-party, `httpOnly`, and
  `sameSite: 'lax'` — which blocks cross-site POSTs to `login`/`logout` while allowing the app's own
  same-origin calls. No CORS middleware is ported. (If a future external client needs cross-origin
  access, add explicit CORS + CSRF tokens then — not now.)

### Acceptance criteria

- `POST /api/auth/login` with **valid** Jira creds → `200 { email, displayName, isAdmin, avatarUrl }`,
  sets the session cookie, and **persists**: a `User` (seed admin reconciled — real `jiraAccountId`,
  `isAdmin` still true) and a `JiraCredential` whose `encryptedToken` is **ciphertext, not the raw
  token**, with `lastValidatedAt` set.
- `POST /api/auth/login` with **invalid** creds → `401`, **no** DB writes, no cookie.
- `GET /api/auth/me` → identity when the cookie is present, `401` otherwise. `POST /api/auth/logout`
  clears the cookie; a subsequent `/me` is `401`.
- `decryptToken(encryptToken(x)) === x`; the raw token appears **nowhere** in the DB or the cookie.
- Missing/short `TOKEN_ENCRYPTION_KEY` or `SESSION_PASSWORD` **fails loudly** at request time with a
  clear error (not a silent insecure fallback like the prototype's `dev-secret`).
- `yarn lint` + `yarn build` in `web/` stay green and the **build remains DB-free**.
- Verified end-to-end with `curl` against a running `web/` dev server (login → me → logout), since the
  login **UI page** is out of scope (step 6).

### Out of scope

- **Login UI page / React wiring** — that's the UI port (step 6). Test via `curl`/REST here.
- **The Jira proxy/sync routes** (`/api/jira/*`, pagination, field ids) and using the stored
  credential to make Jira calls — step 5. This feature creates only the one-function `/myself` client.
- **RBAC route guards** (admin-only sprint config, ED roll-ups) — consumed later; this feature only
  surfaces `isAdmin` and adds `requireUser()`. Per-route role checks come with steps 4/6.
- **Atlassian OAuth 2.0 (3LO)** — deferred (§13/§16); the `JiraCredential` shape already anticipates
  swapping `encryptedToken` for a refresh token.
- **Token rotation / re-validation cron, multi-site `cloudId` discovery** — note as follow-ups.
- **Importer** ([seed.md](./seed.md)) and **background snapshots** (step 7).

## Doc-sync (§17 — do in the same PR)

When this lands in `web/`, update [project-overview.md](../project-overview.md) — but **keep §7 as-is**
(it is the honest snapshot of the *legacy Vite/Express* app, which still runs plaintext-token sessions
until cutover; both apps coexist per §16). Specifically:
- **§13 "Target hardening" item 1** (encrypt tokens at rest) → mark **implemented in `web/`**
  (AES-256-GCM, `JiraCredential.encryptedToken`); **item 5** (secrets to a managed store) → **partial**
  (`web/` reads from env/secret store, fails loudly; rotation still TODO). Item 2 (OAuth) stays
  deferred; item 3 (RBAC) and item 4 (share links) remain GAP.
- **§10 Auth row** → append "implemented in `web/` via iron-session + AES-GCM (2026-06-29)".
- **§5** has no Auth row and **"Admin settings / RBAC" stays [GAP]** — this feature surfaces `isAdmin`
  and adds `requireUser()` but enforces no admin gating yet (that's step 4). Don't over-claim it.
- **Production Migration Plan step 3** → record done + the as-built decisions (iron-session,
  discovered `cloudId`, superset response, retired `SESSION_SECRET`).
- Record any **as-built deviations** (Next 16 `cookies()` shape, iron-session version quirks, the
  `tenant_info` cloudId call / fallback) in this file, mirroring bootstrap-seed.md's deviations section.

## As-built notes (vs. the spec)

- **iron-session 8.0.4**, called `getIronSession(await cookies(), options)` (the `CookieStore`
  overload). `ttl` set to 30 days; iron-session derives the cookie `Max-Age` from it. The async
  `cookies()` integration worked as the docs describe — no workaround needed.
- **Two thin session wrappers added** beyond the spec's `getSession`/`getCurrentUser`/`requireUser`:
  `createUserSession(userId)` (set `{ userId }` + `save()`) and `destroySession()` (`destroy()`), so
  routes don't repeat the iron-session dance. `requireUser()` throws a new `UnauthorizedError` (for
  step 4/5 to map to 401); it's exported but not yet consumed here.
- **400 body uses zod's combined message** (e.g. `"email: …; token: …"`) rather than the prototype's
  exact "Email and token are required" string — the `{ error }` **shape** is preserved (§8), only the
  text is richer.
- **`JiraAuthError` maps both 401 and 403** from `/myself` to the prototype's
  "Invalid credentials…" 401. Other non-2xx/network errors → 500 "Failed to validate credentials with
  Jira"; config errors (missing `JIRA_BASE_URL`) → 500 "Server auth is misconfigured".
- **All three routes set `export const dynamic = "force-dynamic"`** (matches the `/api/health/db`
  pattern) — belt-and-suspenders so the build never executes them even though `cookies()`/`request`
  already force dynamic.
- **Crypto verified via an ESM-rename harness.** `web/` has no `"type":"module"`, so a standalone
  Node import of `crypto.js` sees it as CommonJS and fails (the same `.js`=CJS gotcha that forced
  `workflows.mjs` in bootstrap-seed); Next/Turbopack compiles it as ESM fine. The unit check copied
  the byte-identical file to `.mjs` to exercise the real algorithm.
- **`secure` cookie attribute is prod-only** (`NODE_ENV === 'production'`) — absent in the dev smoke
  test, as expected.
- **`cloudId` fell back to `baseUrl` in practice.** Against the real Tekion site,
  `GET {baseUrl}/_edgeProxy/tenant_info` did **not** yield a `cloudId`, so `fetchCloudId()` returned
  `null` and the login stored `cloudId = baseUrl` (decision 3's documented fallback). Harmless under
  Basic-token auth (cloudId is unused); **revisit when OAuth 3LO lands** — discover the real tenant
  UUID then (e.g. via `getAccessibleAtlassianResources`) rather than the well-known endpoint.

## References

- @context/project-overview.md (§7 legacy auth, §8 migration guidance — port routes / keep contracts /
  drop `VITE_*` dual mode, §9 `User`/`JiraCredential`, §13 auth hardening, §16 decisions, Production
  Migration Plan step 3)
- @context/coding-standards.md (zod-at-boundaries; API routes for third-party integrations + future
  CLI clients vs Server Actions for in-app mutations; `{ success, data, error }` is the Action shape)
- Source to port: [server.js:197-243](../../server.js#L197-L243) (`login`/`me`/`logout`,
  `requireAuth`, `addJiraHeaders`), [server.js:89-105](../../server.js#L89-L105) (session/cookie opts)
- @context/features/bootstrap-seed.md (the `seed-pending:<email>` placeholder this feature reconciles)
- @context/features/scaffload-prisma.md (Prisma 7 adapter/dotenv pattern; `web/src/lib/db.js`)
- `web/src/lib/validation.js` (the `validate()` boundary helper), `web/AGENTS.md` (Next 16 caveats)
