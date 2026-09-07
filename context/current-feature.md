# Current Feature

**Production observability & error contract**
(@context/features/observability-and-errors.md) — StoryBoard is in production, and a production
incident started from nothing: **four `console.*` calls in the entire `src/` tree**, and every route
answering failures with a bare `{ error: "message" }` — no code, no correlation id, no context.

The trigger was concrete (Naveen, 2026-09-03): *"In prod we don't have Neon. In login failed for
some XYZ reason which is hard to debug."* `api/auth/login` was funnelling **five structurally
different deployment failures** into two strings — a malformed `TOKEN_ENCRYPTION_KEY`, a short
`SESSION_PASSWORD`, an unreachable database, **migrations not deployed**, and blocked egress to
Atlassian — all reported as `"Login failed"`.

The goal, in the user's words: make the **API response itself** carry what's needed, so triage does
not begin at a log aggregator. Post-v1, not a master-plan step.

## Status

**Done 2026-09-04 — verified twice, uncommitted** (branch `feature/observability-and-errors`, off
`main` @ `c8c2731`). Pending Naveen's commit (gitleaks hook) + real-browser visual acceptance. Full
spec + As-built: @context/features/observability-and-errors.md.

**Verified 2026-09-04:** `yarn lint` clean · **pure fixtures 107/107** · **login taxonomy 15/15**
against a real `next start` server (one broken setting per case) · **API smoke 52/52** on Neon
(`main` 45 · `debugflag` 1 · `forced500` 6) · **headless browser 11/11** · `prisma validate` +
`prisma migrate status` **13 migrations, up to date** · cold `rm -rf .next` build with `.env` **and**
`.env.production` moved aside → exit 0, **no `Environments:` line**, **50 ƒ Dynamic**, **0 Node-API
warnings** · fixtures torn down to 0 rows.

**Re-verified 2026-09-07 against an unchanged tree**, with the suite **re-derived from the source
rather than replayed** (the first pass's harness had been deleted): lint clean · `prisma validate` +
**13 migrations** · env-free cold build → exit 0, no `Environments:` line, **50 ƒ Dynamic**, **0
static API routes**, 0 Node-API warnings · **pure fixtures 134/134** (27 checks the first pass
lacked, incl. every class's *readable* name — the minification trap) · **login taxonomy 15/15** ·
**API smoke 51/51** · **headless browser 11/11** · Neon left at **0 fixture rows, 0 ErrorLog rows**.

The load-bearing claim, reproduced end to end: each of the five login failures now answers with its
**own** code — `CONFIG_MISSING` (naming the variable) · `JIRA_UNREACHABLE` (naming `ENOTFOUND`) ·
`JIRA_AUTH` · `DB_UNAVAILABLE` · `DB_MIGRATION_MISSING` — every one carrying a `requestId` that also
appears on the `x-request-id` header, in the log line, and in Admin → Recent errors.

**Implemented:** `lib/errors.js` (one `AppError` taxonomy, re-exported from every old module) ·
`lib/log.js` (AsyncLocalStorage context, JSON lines, recursive redaction, `cause`-chain
serialization) · `lib/error-log.js` · `lib/sync/warnings.mjs` · `withRoute` + the envelope in
`route-helpers.js` · Jira timeouts/`classifyFetchFailure`/`errorMessages` capture ·
`instrumentation.js` · `error.jsx`/`global-error.jsx` · `api/diagnostics` · `ErrorLog` (migration 13)
+ Admin → Recent errors · `CODE · requestId` on the login card and alert dialog with Copy diagnostics.

## Goals

- **The response is the diagnostic.** `{ error, code, requestId, details, debug? }` — `error` keeps
  its exact prior meaning, so no existing client changed.
- **One taxonomy, one mapping.** Every typed error carries its own `code`/`status`; routes stopped
  hand-rolling `instanceof` ladders that only stripped the new fields.
- **Name the cause, not the symptom.** Jira's own `errorMessages`, the offending JQL, the failing
  track, the missing env var, the unapplied migration.

## Notes

- **§12 metric core untouched** — additive everywhere.
- **Two invariants moved and are declared:** **49 → 50 ƒ Dynamic** (`/api/diagnostics`) and **12 → 13
  migrations** (`add_error_log`).
- **`status` is always OUR HTTP status.** An upstream's own status goes to `details.jiraStatus` /
  `details.providerStatus` — echoing Jira's 429 would tell the browser to retry our route.
- **The ErrorLog writer must survive its own table being missing** (migrations are a separate deploy
  step): it falls back to `console.error` and disables itself, never recursing.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-09-04)**
- **Baseline invariants to preserve:** **50 ƒ Dynamic** routes / **13 Prisma migrations**
  (…`add_error_log`). Node 22, dev on **:3002**. A feature that changes either count must say so and
  justify it. Nothing since the board-polish round had, until this feature moved both.
- **`main` is at `c8c2731`** ("Editable filters.") — it carries editable filters, the roll-up export
  (incl. the Velocity variant), the sync-stages P2028 fix, the bug-board arc, the unplanned-split,
  default-team-release, needs-attention-roster, program-rollup, AND the office-deployment work
  (`Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health` / `DEPLOY.md`; must land
  on `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **The working branch is `feature/observability-and-errors`**, cut from `main` @ `c8c2731`.
- **Naveen runs all commits** (the Tekion gitleaks pre-commit hook can't fetch its config from
  Claude's shell). Never auto-commit — hand him the command and ask first (per `ai-interaction.md`).

**Production runtime (do not get this wrong)**
- **Production is internal Tekion Postgres; Neon is the dev/local database only.** Reason about
  production failures with internal-Postgres shapes: an `sslmode` mismatch is a connection failure
  (`DEPLOY.md` §4), and **migrations are a separate `yarn db:deploy` step that can simply not have
  run** (§5) — which is why `P2021` maps to its own `DB_MIGRATION_MISSING` code.
- **Egress to `tekion.atlassian.net` is not guaranteed** from the internal cluster. Every Jira call
  now has a timeout and a `cause`-chain classifier, because blocked egress used to HANG.
- **`secure: true` cookies over plain HTTP** make login answer 200 and bounce the user back to
  `/login` with no error anywhere. `/api/diagnostics` reports the mismatch; the login route warns.

**The error contract (use it; don't route around it)**
- **`withRoute("name", handler)` wraps every route handler.** It mints/adopts the request id, opens
  the log context, times the call, maps throws and sets `x-request-id`. New routes use it.
- **Throw a typed error from `lib/errors.js`** (or the Jira/AI subclasses) rather than hand-rolling
  `Response.json({ error }, { status })` — a hand-rolled response silently drops `code`, `requestId`
  and `details`, which is exactly what five routes were doing before this feature.
- **`logger` + `setLogContext`** (`lib/log.js`) are the only logging. Never `console.*` in `src/`
  except inside `error-log.js`'s own failure path (which must not recurse).
- **Secrets are scrubbed by `redact()`**, which gates logs AND `ErrorLog.details`. A key matching
  `/token|secret|password|authorization|cookie|api[-_]?key|credential/i` is redacted **when its
  value is a string** — booleans pass, so env-presence reporting still works.

**Build & verification hazards (each one has burned a session)**
- **`prisma migrate dev` does NOT reliably regenerate the client.** After any migration run
  `prisma generate` explicitly and rebuild, or the generated client silently lacks the new model
  (`prisma.errorLog` was `undefined` and every write failed quietly, 2026-09-04).
- **A production build MINIFIES class names.** Never derive a user-visible or logged name from
  `new.target.name` / `constructor.name`; set it explicitly. Dev never shows this — only a smoke
  against `next start` does.
- **`instrumentation.js` is bundled for the Edge runtime too**, even with no Edge routes. Node-only
  APIs referenced there (or in anything it imports) warn at build; use `console` over
  `process.stdout`, and read `process.version` off `globalThis`.
- **Next 16 refuses a second `next dev` for the same directory.** To smoke against a server with
  modified env, build once and run `next start -p <port>` with env overrides (real env vars beat
  `.env`). This also exercises production mode, which is where minification bugs surface.
- **Always `rm -rf .next` before the acceptance build**; a warm `.next` hides real breakage. And
  `rm -rf .next` FAILS while a dev server is writing to it — stop the server first.
- **Tailwind v4 scans every non-ignored file, incl. `context/**` and `legacy/**`.** Guarded by
  `@source not` in `globals.css`. Never quote an arbitrary-property class verbatim in prose.
- **Prove the DB/env-free build honestly:** genuinely `mv` `.env` **and** `.env.production` aside,
  confirm absent mid-build, restore after.
- **`yarn build` clobbers `.next` and leaves a running dev server 404ing** → after any build, clear
  `.next` and restart the dev server.
- **No test suite (deliberate).** Verify with: pure-Node fixtures for pure logic + SSR/API smoke
  using **minted iron-session cookies** (`sealData`) against Neon (tear fixtures down to 0 rows).
  A scratch script must live **inside the repo** to resolve its deps; the generated Prisma client is
  **TypeScript**, so plain Node cannot import it — query Neon with raw `pg`, or use
  `tsx --tsconfig jsconfig.json` plus `const mod = await import(…); mod.default ?? mod`.
  **Pure `.mjs` modules must use RELATIVE imports, never the `@/` alias.**
  Visual = **headless Chrome** (`playwright-core` 1.62 wants Chromium 1234 but the cache holds
  **1187** — pass `executablePath:
  ~/Library/Caches/ms-playwright/chromium_headless_shell-1187/chrome-mac/headless_shell`). An authed
  real-browser visual pass is always **Naveen's** acceptance step.
- **Smoke gotchas:** Next 16 resolves `redirect()`/`notFound()` to HTTP **200** — assert on content,
  not status. RSC flight markup inserts `<!-- -->` between adjacent JSX text nodes. Scan for float
  artifacts in VISIBLE text only. `innerText` respects `text-transform: uppercase`.
- **Jira's `/search/jql` answers 200-with-zero-results for an unknown project** — only a
  SYNTACTICALLY invalid JQL produces the 400 + `errorMessages` path. Matters when testing Jira
  error handling, and it is also why a mistyped sub-component empties a track silently (§14.14).

**Do-not-touch invariants**
- **Never rename the session cookie `sprinttracker_session` or the `sprintTracker_*` localStorage
  keys** — there is no dual-read fallback, so a rename force-logs-out every user.
- **§12 metric core is sacred** (`metrics.mjs` / `IssueProgress` / `SprintSnapshot`). New
  display/composition features must be **additive only**.
- **`src/lib/export/page-packer.mjs` is the shared height-budgeted page packer** — its constants are
  a contract with the print components' `h-[...]` values.
- **`formatPoints` (`metrics.mjs`) is the display boundary for every story-point readout** — never
  feed its result back into a calculation.
- **`buildFilterPayload` (`lib/filters/edit.mjs`) is the SINGLE body shaper** for the filter create
  and patch routes; its two source columns are asymmetric on purpose.
- **Read the installed version docs first** — Next 16, Prisma 7, Tailwind v4 all diverge from
  training data (`node_modules/next/dist/docs/`, the `prisma-change` skill, `@theme` CSS config).
- **Append-don't-rewrite** dated entries in `context/**`.

**On-ink categorical palette (delivery scoreboard)**
- Four validated categorical channels on the ink surface: brand-accent (Committed) · gold
  `--on-ink-cat-2` (Tech Debt) · rose `--on-ink-cat-3` (External bugs) · orchid `--on-ink-cat-4`
  `#d385b0` (Internal bugs). **Solid = planned work, hatch = reactive bug** (`.sp-stripe` /
  `.sp-stripe-2`); hue sub-divides. **Purple/violet is NOT available** — it collapses against
  Modern's blue brand under CVD. A 5th category faces an even tighter hue space; reach for a
  texture/second channel before a new hue, and validate ΔE (CIEDE2000 + Machado CVD), never eyeball.

**Open post-v1 backlog (deferred, not forgotten)**
- Export-embedded AI narrative · AI Q&A over sprint data · AI stage suggestions · a share link for
  `/bugs` · leaderboard rank-delta ("moved since last sprint") arrows · external APM/OTel export ·
  `IssueProgress.createdAt` stage provenance (§14.13).

## History

The full chronological development log (legacy Vite/Express era through the entire Next.js
migration and every post-v1 feature) has been archived to
[legacy-history.md](legacy-history.md) to keep this file focused on the current feature.

Append new "Done" entries there, earliest → latest.
