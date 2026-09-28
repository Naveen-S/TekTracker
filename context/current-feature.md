# Current Feature

**Brand refresh — Jigsaw logo + "Every piece. One picture."**
(@context/features/brand-logo-tagline.md) — StoryBoard was renamed on 2026-07-31 but still shipped
the placeholder teal "T" icon and a one-colour wordmark. Naveen picked from the brand board PDF:
Concept A (the Jigsaw), the tagline *"Every piece. One picture."*, and the two-tone wordmark with a
serif tagline. Presentation-only; post-v1, not a master-plan step.

## Status

**Done 2026-09-29 · verified · uncommitted.** Branch `feature/brand-jigsaw`, cut from `main` @
`03602d7` (the migrate-on-start work is in Naveen's stash, not on this branch). Final /finish-feature
pass: lint exit 0 · 13 migrations, up to date · cold env-free build (`.env` + `.env.production` moved
aside) → exit 0, **50 ƒ Dynamic**, **0 warnings** (log grepped) · `next start` smoke: `/login` carries
the tagline + exactly two `rel="icon"` links, `/icon.svg` · `/favicon.ico` · `/app-icon.png` 200,
`/p/health` 200, `/api/auth/me` 401. **Loader reworked the same day** (Naveen: unattractive + jumped
when the label/seconds appeared): mark-only centring with the text hung below and the timer line
reserved (mark box measured identical in all three text states), a ghost picture + teal halo,
dissolve-in-place choreography; re-verified — lint 0, 13 migrations up to date, env-free cold build
exit 0 at **50 ƒ Dynamic** / 0 warnings, all four `jigsaw-*` keyframes emitted, `next start` smoke
green. **Next:** Naveen's commit (gitleaks hook; leave the untracked
launch-video / migrate-on-start files out) + authed real-browser acceptance, then resume
**migrate-on-start** from the stash.

**Implemented:** `src/components/ui/brand.jsx` (`BrandMark`, `Wordmark`, `BrandTagline`,
`BRAND_TAGLINE`) · Instrument Serif → `--font-tagline` · sidebar, login card, four mobile top bars,
share header, welcome hero · bare mark on the ink sidebar · adaptive `src/app/icon.svg` favicon (replaces the deleted `icon.png`) + light-tone `favicon.ico` Safari fallback · `public/app-icon.png` keeps the tile. · **`BrandLoader`** — the jigsaw assembling itself — in the `PageLoader` veil (all 5 call sites) + the AI digest wait; button spinners stay rings.

**Verified:** lint clean · 13 migrations · env-free cold build → exit 0, **50 ƒ Dynamic**, 0 warnings
· headless visual pass (login, board desktop + mobile, roll-up mobile; Tekion + Modern) · icons
served.

## Notes

- **§12 metric core untouched**; no schema or route change — both invariants hold.
- The mark's colours are fixed; only "Board" follows the theme (`primary`, or `on-ink-accent` on ink).
- Out of scope: export PDF footers/metadata, error pages.

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
- **Never put a `try/catch` inside a `withRoute` handler just to call `handleRouteError`.** Returning
  a `Response` from the catch sends the request through `withRoute`'s **success** path, so one
  failing request logs BOTH `route.rejected`/`route.error` **and** `route.ok` with the failing
  status — anything keyed on `route.ok` then counts failures as successes — and it bypasses
  `isFrameworkSignal`. Just throw; `withRoute` maps, logs and records. 34 files / 54 handlers were
  swept of this on 2026-09-10; `grep -rn "return handleRouteError" src/app/api` must stay empty.
- **`isFrameworkSignal` lives in `lib/errors.js`** and is imported by BOTH `withRoute` and
  `onRequestError`. `redirect()`/`notFound()` throw errors whose digest starts with `NEXT_`; they are
  control flow, never incidents. Keep one definition — two would drift.
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
