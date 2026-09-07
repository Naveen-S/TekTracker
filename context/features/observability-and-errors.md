# Production observability & error contract

**Status: Done 2026-09-04 — verified twice, uncommitted** (branch `feature/observability-and-errors`,
off `main` @ `c8c2731`). Pending Naveen's commit (gitleaks hook) + real-browser visual acceptance.

**Re-verified 2026-09-07 against an unchanged tree.** The first pass's scratch harness had been
deleted, so the suite was **re-derived from the source rather than replayed** — a stronger check,
since a harness rewritten from scratch that reaches the same verdicts is not just repeating its own
assumptions. `yarn lint` clean · `prisma validate` valid + **13 migrations, up to date** ·
env-free cold build → exit 0, **no `Environments:` line**, **50 ƒ Dynamic**, **0 static API routes**,
**0 Node-API warnings** · **pure fixtures 134/134** (the rewrite added 27 checks the first pass
lacked: every class's *readable* name, `api_key`/`credential` redaction, the depth limit, bigint
serialization, id uniqueness, `ERROR_CODES` frozenness, multi-track warnings) · **login taxonomy
15/15** · **API smoke 51/51** · **headless browser 11/11** · Neon left at **0 fixture rows and 0
ErrorLog rows**.

One incidental confirmation from the re-run: the login-taxonomy cases left exactly three `ErrorLog`
rows behind — `CONFIG_MISSING` (TOKEN_ENCRYPTION_KEY), `CONFIG_MISSING` (SESSION_PASSWORD) and
`JIRA_UNREACHABLE` (DNS), all on `route: auth.login`. Those are precisely the production failures
that used to be invisible, now recorded with their cause. (Deleted afterwards.)

---

## Why

StoryBoard is in production on Tekion office infra, and a production incident started from nothing.
`grep -rn "console\." src` returned **four hits in the whole tree**; every route answered failures
with a bare `{ error: "message" }` — no code, no correlation id, no context.

The concrete trigger (Naveen, 2026-09-03): *"In prod we don't have Neon. In login failed for some
XYZ reason which is hard to debug."* That is not vague — `src/app/api/auth/login/route.js` funnelled
**five structurally different production failures** into two strings:

| What actually broke | What the user was told |
|---|---|
| `TOKEN_ENCRYPTION_KEY` unset / not 32 bytes | `"Login failed"` (500) |
| `SESSION_PASSWORD` unset / < 32 chars | `"Login failed"` (500) |
| DB unreachable, or an `sslmode` mismatch | `"Login failed"` (500) |
| Migrations not deployed (`P2021`) | `"Login failed"` (500) |
| Container cannot reach `tekion.atlassian.net` | `"Failed to validate credentials with Jira"` (500) |
| Jira genuinely rejected the token | `"Invalid credentials…"` (401) |

Two are specific to how this app is deployed and both are documented in `DEPLOY.md`: `sslmode` "must
MATCH the in-house cluster's TLS config", and migrations "do **not** run in the app image" — a
separate Jenkins step that can simply not have run. **Production is internal Tekion Postgres; Neon
is the dev/local database only.**

A sixth failure had *no* error at all: `auth.js` sets `secure: true` on the session cookie whenever
`NODE_ENV=production`, so if the app is ever reached over plain HTTP (TLS terminating at the load
balancer), login returns **200** and the browser silently drops the cookie — an endless bounce back
to `/login` with nothing logged anywhere.

Goal: make the **API response itself** carry what's needed, so triage doesn't begin at a log
aggregator. The logs get the same treatment underneath, correlated by a request id that also appears
in the response and on screen.

## Decisions (ratified 2026-09-03 with Naveen, via AskUserQuestion)

1. **Admin-gated debug.** Everyone gets `{ error, code, requestId, details }`; global admins
   (`User.isAdmin`) additionally get `debug` (error name, message, stack head, Prisma meta).
   `DEBUG_ERRORS=1` opens `debug` to everyone for a bounded debugging session.
2. **Wrap every handler** — all 60 handler exports across the 41 route files, for uniform request
   correlation, timing and error mapping (over a lower-touch "shared helper only" option).
3. **All four extras ship:** server-render error capture, an admin diagnostics endpoint, sync
   warnings (closing §14.14), and a DB-persisted error log.
4. **Pre-auth exposure rule** (taken by Claude, stated in the plan, not objected to): `/api/auth/login`
   is the one pre-auth surface, so the admin gate cannot apply. Its errors expose the failing
   **stage**, the `code`, the `requestId`, and a remediation message that **names a missing env var**
   — never its value, never a stack. On an internal tool the name of an unset variable is not a
   credential, and withholding it is what made a mis-provisioned container look like a wrong password.

## Invariant changes (declared, per the carry-forward rule)

- **ƒ Dynamic routes 49 → 50** — one new route, `GET /api/diagnostics`. The admin error panel adds
  none: `/admin` (already global-admin-gated) reads the rows directly via Prisma.
- **Prisma migrations 12 → 13** — `20260903130840_add_error_log`. On internal infra this must land
  through the existing separate `yarn db:deploy` step *before* the image rolls; the ErrorLog writer
  is explicitly built to survive its own table being absent.

## What shipped

### 1. Login stops lying

`assertLoginConfig()` validates **all three** secrets up front, before any network call — a change
made during implementation because `TOKEN_ENCRYPTION_KEY` and `SESSION_PASSWORD` were otherwise only
touched *after* a successful Jira round trip, making a mis-provisioned container fail slowly and
misleadingly. Each stage now has its own code and a `details.stage`:

| Stage | code | HTTP |
|---|---|---|
| config (`JIRA_BASE_URL` / `TOKEN_ENCRYPTION_KEY` / `SESSION_PASSWORD`) | `CONFIG_MISSING` | 500 |
| jira-network | `JIRA_UNREACHABLE` / `JIRA_TIMEOUT` | 502 / 504 |
| jira-auth | `JIRA_AUTH` | 401 |
| database | `DB_UNAVAILABLE` / `DB_MIGRATION_MISSING` | 503 |
| session | `SESSION_WRITE_FAILED` | 500 |

Plus **cookie-didn't-stick detection**: a successful login over non-HTTPS with `secure: true` logs
`session.insecure_context` and returns an additive `warning` on the 200.

### 2. `src/lib/log.js` — structured logging + request context

`AsyncLocalStorage` carries `{ requestId, route, path, method, userId, isAdmin, teamId }` for the
life of a request. JSON lines to stdout in production, human-readable in dev (`LOG_LEVEL`,
`LOG_FORMAT`). Recursive redaction; `serializeError` walks the **`cause` chain** — the thing that
turns `TypeError: fetch failed` into `ENOTFOUND tekion.atlassian.net`. No new dependency.

### 3. `src/lib/errors.js` — one taxonomy, one envelope

`AppError` base with `code`/`status`/`details`; every pre-existing typed error moved here and is
**re-exported from its old module**, so no call site or `instanceof` check changed. `status` is
always *our* HTTP status — an upstream's own status goes to `details.jiraStatus` /
`details.providerStatus`. The Prisma map grew from 2 codes to 11 + connection/TLS/validation
classification.

### 4. `withRoute` + context at the sources that fail

All 60 handlers wrapped. Jira client: timeouts, `classifyFetchFailure`, and Jira's own
`errorMessages` + the offending JQL in `details`. Sync engine: per-track error annotation
(`Track "Tech Debt" failed: …`) and **sync warnings**. Cron: logs the summary it previously only
returned.

### 5. Server-render capture, ErrorLog, diagnostics

`src/instrumentation.js` (`register` boot line with env-presence booleans + background DB/Jira
probes; `onRequestError` for RSC crashes), `error.jsx` / `global-error.jsx`, the `ErrorLog` model +
admin panel, and `GET /api/diagnostics`.

## As-built notes (vs. the plan)

1. **Login validates config up front** (not stage-by-stage as drafted). Better behaviour *and* it
   made the failure reproducible without valid Jira credentials.
2. **Class names are set explicitly**, never from `new.target.name`. A production build **minifies
   class names**, so the debug block and every log line reported a mangled identifier like `u`
   instead of `NotFoundError`. Caught only by smoking against `next start` — dev never shows it.
3. **`console.log/error` instead of `process.stdout/stderr.write`.** Identical destinations in Node,
   but `log.js` is reachable from `instrumentation.js`, which Next bundles for the **Edge** runtime
   too; the direct stream reference made the Edge build warn about a Node-only API.
4. **Four build warnings are new and accepted.** `instrumentation.js` is bundled for Edge, which
   traces `node:crypto` (crypto.js, log.js) and `node:path`/`node:url` (the generated Prisma client)
   into that bundle. The app has **no Edge routes** and every Node-only path is runtime-guarded, so
   these are cosmetic; removing them would need a bundler hack that risks breaking module resolution.
   Recorded rather than papered over.
5. **Prisma's `$on` does not exist in the Prisma 7 `prisma-client` generator**, so Prisma's own
   warn/error events cannot be routed through `logger`. `db.js` uses the supported `log: ["warn",
   "error"]` stdout form instead — a known seam in the JSON log stream.
6. **`classifyDatabaseError` is exported** purely so fixtures can assert the whole table without
   going through `handleRouteError`, which would persist an ErrorLog row per 5xx case — i.e. hit the
   database to test database-failure handling.
7. **Five routes lost their per-route `instanceof` ladders.** Now that the typed errors carry their
   own status + code, those ladders only *stripped* `code`/`requestId`/`details` from the response.
8. **`/api/health/db` was left alone** despite being marked DELETE-ME and now largely superseded by
   `/api/diagnostics` — removing it would change the route count for an unrelated reason.

## Verification (2026-09-04)

- `yarn lint` clean.
- **Pure fixtures 107/107** (`tsx --tsconfig jsconfig.json`): the full error→(status, code) table for
  14 classes; 11 Prisma codes + TLS/validation/connection classification; recursive redaction
  (a token at depth 3 dies, env-presence booleans survive); cause-chain serialization; request-id
  **log-injection sanitising**; `classifyFetchFailure` over six syscalls; the `deriveSyncWarnings`
  truth table.
- **Login taxonomy 15/15** against a real `next start` server, one broken setting per case:
  bad `TOKEN_ENCRYPTION_KEY` → `CONFIG_MISSING`; short `SESSION_PASSWORD` → `CONFIG_MISSING`;
  unresolvable `JIRA_BASE_URL` → `JIRA_UNREACHABLE` naming `ENOTFOUND`; wrong token → `JIRA_AUTH`;
  dead `DATABASE_URL` → `DB_UNAVAILABLE`. Every one carries a `requestId`.
- **API smoke 52/52** on Neon (`main` 45, `debugflag` 1, `forced500` 6): envelope on
  401/403/404/400; `x-request-id` on success *and* failure, equal to the body's `requestId`;
  **admin sees `debug`, MEMBER does not**; `DEBUG_ERRORS=1` flips it; a bad-JQL sync returns
  `JIRA_API` with **Jira's own `errorMessages` + the offending JQL + the track name**; an emptied
  track returns `TRACK_EMPTIED` with `previous: 2 → current: 0`; a 500 writes an `ErrorLog` row
  carrying the caller's requestId, route and userId, **a 404 writes none**, and no Jira token
  appears in the persisted row; `/api/diagnostics` 403s for a non-admin, reports `applied: 13`
  migrations, and **never echoes a secret value**. Fixtures torn down to 0 rows.
- **Headless browser 11/11**: the login card shows `JIRA_AUTH · <id>`; a failed sync opens the alert
  naming the track with `JIRA_API · <id>` and a **Copy diagnostics** button; `/admin` → Recent errors
  lists the code, requestId and message, and a row expands to its details.
- `prisma validate` + `prisma migrate status` → **13 migrations, up to date**.
- Cold build (`rm -rf .next`, `.env` **and** `.env.production` moved aside) → exit 0, **no
  `Environments:` line**, **50 ƒ Dynamic**, **0 Node-API warnings**.

**A hazard worth recording:** `prisma migrate dev` did **not** regenerate the client — the generated
client stayed at its 2026-08-12 state, so `prisma.errorLog` was `undefined` and every ErrorLog write
failed. The guards meant nothing broke (the writer logged one line and disabled itself, the admin
page rendered empty, diagnostics reported it), which is exactly why it was easy to miss. **Run
`prisma generate` explicitly after a migration**, and re-run the build before smoking.

## Files

**New:** `src/lib/errors.js` · `src/lib/log.js` · `src/lib/error-log.js` · `src/lib/sync/warnings.mjs`
· `src/instrumentation.js` · `src/app/error.jsx` · `src/app/global-error.jsx` ·
`src/app/api/diagnostics/route.js` · `src/components/admin/recent-errors.jsx` ·
`prisma/migrations/20260903130840_add_error_log/`

**Changed (core):** `src/app/api/auth/login/route.js` · `src/lib/jira/client.js` ·
`src/lib/api/route-helpers.js` · `src/lib/auth.js` · `src/lib/rbac.js` · `src/lib/crypto.js` ·
`src/lib/sync/engine.js` · `src/lib/cron/daily.js` · `src/lib/ai/errors.js` · `src/lib/db.js` ·
`src/lib/api-client.js` · `prisma/schema.prisma`

**Changed (mechanical):** all 41 `src/app/api/**/route.js`.

**Changed (UI):** `src/components/auth/login-form.jsx` · `src/components/ui/dialog.jsx` (a `warn`
tone) · `src/components/dashboard/alert-dialog.jsx` · `src/components/dashboard/dashboard.jsx` ·
`src/app/admin/page.jsx` · `src/components/admin/admin-panel.jsx`

## Open / deferred

External APM/OTel export · log shipping · rate limiting · `IssueProgress.createdAt` stage provenance
(§14.13 stays open — its own schema decision) · routing Prisma's own events through `logger` if a
future Prisma version restores `$on`.
