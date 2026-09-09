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

**Done 2026-09-04 · four review fixes (2026-09-07 ×2, 2026-09-09 ×2) · one build-warning fix
2026-09-09 · verified four times.** Code committed as `a79db75` on branch `error-handling`; all four
review fixes, the instrumentation split, and their doc updates are **uncommitted**. Pending Naveen's commit (gitleaks
hook) + real-browser visual acceptance. Full spec + As-built:
@context/features/observability-and-errors.md.

⚠️ **Correction — "0 Node-API warnings" below was false in all three earlier passes.** The build
emitted **four** Edge-runtime warnings from `instrumentation.js` from this feature's landing until
2026-09-09 (the spec's own as-built note 4 recorded them, contradicting its verification blocks).
Fixed by moving all Node-only instrumentation behind `src/instrumentation-node.js`; true as of the
2026-09-09 run. See as-built note 11.

**Suite 2026-09-09 (fourth pass, after the instrumentation split):** lint clean · `prisma validate`
valid + **13 migrations, up to date** · env-free cold build (`.env` **and** `.env.production` moved
aside, absence asserted mid-build) → exit 0, no `Environments:` line, **50 ƒ Dynamic**, 0 static API
routes, **0 Node-API warnings and 0 warning blocks of any kind — genuinely, for the first time** ·
**boot instrumentation 3/3** against a real `next start` (`app.boot` + both probes still fire, so
the Edge/Node split did not silence what it refactored) · **API error-contract smoke 11/11** ·
**pre-auth debug gate 11/11** under `DEBUG_ERRORS=1` (anonymous callers get no `debug`, no stack, no
filesystem path — incl. a real `JIRA_AUTH` failure) · **ErrorLog writer state machine 27/27** pure ·
**redaction 27/27** pure + **4/4 live** (secrets scrubbed out of upstream `error.message`/`.cause`
free text; Jira emails no longer logged in plaintext).

**Final suite 2026-09-07 (re-derived, run after both fixes):** lint clean · **13 migrations** ·
env-free cold build → exit 0, **50 ƒ Dynamic**, 0 static API routes, 0 Node-API warnings · **pure
fixtures 164/164** · **login taxonomy 19/19** · **API smoke 55/55** · **headless browser 11/11** ·
Neon left at 0 fixture rows and 0 ErrorLog rows.

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

**Post-review fix 2026-09-07 (commit pending, on `error-handling` after `a79db75`).** PR review
(`orbit-central[bot]`) correctly found that `DEBUG_ERRORS=1` bypassed the admin gate on the
**pre-auth** login surface: that route never resolves a user, so the flag alone handed anonymous
callers the `debug` stack — contradicting the feature's own "never a stack pre-auth" rule.
`shouldExposeDebug()` now requires `context.userId` for the env-var branch. Reproduced before the
fix and re-checked after (**6/6**: anonymous gets no debug, authenticated non-admin still does);
lint clean, build green at **50 ƒ Dynamic**. Docs realigned (the rule was written as "everyone" in
four places). ⚠️ The review thread was marked **resolved without the code changing** — the finding
would otherwise have been lost.

**Second post-review fix 2026-09-07.** The same review round flagged that the `ErrorLog` writer's
"stop trying" latch treated `P1001`/`P1002` as permanent: a 30-second network partition silenced
error recording for the container's whole lifetime. Also found while fixing it — an *unknown* write
failure retried on every 5xx, the exact storm the old comment claimed to prevent. Both now go
through a pure state machine (`applyWriteFailure` / `isWriterMuted`): schema codes (`P2021`/`P2022`)
latch until the next deploy, everything else takes a 60s cooldown and resumes. Verified **41/41**
pure + **7/7** live against Neon (a real rejected insert mutes rather than latches, and the same
process resumes writing), plus route→ErrorLog end-to-end; lint clean, build green at 50 ƒ Dynamic.

The load-bearing claim, reproduced end to end: each of the five login failures now answers with its
**own** code — `CONFIG_MISSING` (naming the variable) · `JIRA_UNREACHABLE` (naming `ENOTFOUND`) ·
`JIRA_AUTH` · `DB_UNAVAILABLE` · `DB_MIGRATION_MISSING` — every one carrying a `requestId` that also
appears on the `x-request-id` header, in the log line, and in Admin → Recent errors.

**Implemented:** `lib/errors.js` (one `AppError` taxonomy, re-exported from every old module) ·
`lib/log.js` (AsyncLocalStorage context, JSON lines, recursive redaction, `cause`-chain
serialization) · `lib/error-log.js` · `lib/sync/warnings.mjs` · `withRoute` + the envelope in
`route-helpers.js` · Jira timeouts/`classifyFetchFailure`/`errorMessages` capture ·
`instrumentation.js` + `instrumentation-node.js` · `error.jsx`/`global-error.jsx` · `api/diagnostics` · `ErrorLog` (migration 13)
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
  migrations** (`add_error_log`). The 2026-09-09 instrumentation split moved **neither** — it is a
  bundler-boundary refactor with no route, schema, or behavior change (boot hooks re-proved firing).
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
- **`instrumentation.js` is bundled for the Edge runtime too**, even with no Edge routes — and
  **a `NEXT_RUNTIME` guard does not stop it.** Bundling is static: Turbopack follows a dynamic
  `import()` into the Edge graph regardless of the branch guarding it. So **never import a Node-only
  module from `instrumentation.js` — not at the top level, not dynamically, not inside a
  `process.env.NEXT_RUNTIME === "nodejs"` check.** Put it in **`src/instrumentation-node.js`**, the
  single module the guard imports; everything behind that one boundary is excluded from the Edge
  bundle (the pattern Next's own instrumentation guide prescribes). Ignoring this is what printed
  four `A Node.js module is loaded ...` warnings on every build for five days while three
  verification passes recorded "0 Node-API warnings" (fixed 2026-09-09, as-built note 11).
  Corollary: **an unchecked invariant rots.** "0 warnings" was copied forward three times without
  anyone re-reading the build log — grep the log for the claim, don't restate it.
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
