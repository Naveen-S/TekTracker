# Current Feature

**Ask StoryBoard — grounded voice Q&A for leadership**
(@context/features/ask-storyboard.md) — ask a question out loud (desktop panel or the phone's
installable `/ask` page) and hear a short answer grounded only in StoryBoard data: roll-up/program,
team board, bugs, trend, leaderboard, ticket — each behind its existing RBAC gate. Browser speech in,
browser speech out; the server-side `lib/ai` provider answers via a two-round JSON "data pack"
contract. The third §16 AI use case ("Q&A over sprint data"); post-v1, not a master-plan step.

## Status

**Done 2026-10-09 · verified · uncommitted** on `feature/claude-connector`, on top of `bc47524`
(Dialog redesign).

**Verified 2026-10-09:**
- eslint 0 for this tree. Plain `yarn lint` trips only on the nested `.claude/worktrees/*`; see spec
  note 20.
- `prisma validate` passes; **14 migrations, up to date**.
- An **env-free build in a scratch copy with zero `.env*`**: exit 0, **60 ƒ Dynamic**, manifest
  static, **0 warnings**.
- **22/22 runtime smoke** on that build. `/api/ask` returns 401/400/503/404 and `/api/ask/speech`
  401/503; the connector routes, every page authed, and the talk button on with AI on and off with
  AI off.
- Earlier in the arc: the real connector end to end, DeepContext against Naveen's Jira list, the
  one-tap button, and 7/7 chat-persistence browser checks (spec notes 13–19).
- **Not verified:** a real ElevenLabs round-trip, and real phone voice on stage over HTTPS. (A Gemini
  answer was verified 2026-10-09.)
- **2026-10-09, Ask without a Gemini key** (spec note 21): Ask is on when `AI_PROVIDER` is set OR
  Claude analysis is enabled. Verified 6/6 plus a live Connector-only answer in 20.6 s.

**Next:**
- Naveen's commit (gitleaks hook), then his authed acceptance pass.
- Restart `yarn dev` (stale dialog CSS) and re-download connector **1.1.0**.
- Set `ELEVENLABS_*` and `AI_ASK_MODEL` for stage.
- Decide on an Ask glossary for org terms (spec note 16).
- Optional one-line fix: add `.claude/**` to the eslint ignores.

## Goals

- (a) Data packs — `src/lib/ask/packs.js`; `visibleTeamIds` in `src/lib/rbac.js`.
- (b) Orchestration — `src/lib/ask/orchestrate.js` + pure `src/lib/ask/prompt.mjs`, schemas in
  `src/lib/schemas/ask.js`.
- (c) `generateJson({ model, timeoutMs })` + `getAskModel()` (`AI_ASK_MODEL`).
- (d) `POST /api/ask` with a per-user rate limit.
- (e) Desktop: sidebar launcher → `src/components/ask/ask-panel.jsx`.
- (f) Mobile: `src/app/ask/page.jsx`, `src/app/manifest.js`, `appleWebApp`, the AppShell FAB,
  `/login?next=`.
- (g) `src/components/ask/use-speech.js`.

## Notes

- Invariants: **50 → 52 ƒ Dynamic** on `main`; on this branch, **57 → 59** (migrations stay **14**).
  `manifest.js` must build static.
- Gemini's JSON-schema subset has no `oneOf` — the round-1 union is a flat object + `type` enum.
- Mic = secure context + user gesture; iOS speech synthesis must be unlocked inside the tap.
- `visibleTeamIds` has a single definition in `lib/rbac.js`, which `lib/connector/access.js` imports.
- **Connector fallback (as-built 13):** a provider failure hands the round to the asker's Claude
  Connector (`ASK` job, connector 1.1.0 or later, about 23 s for one round and 41 s for two). Users
  on connector 1.0.0 must re-download the script from Settings.
- **Order inverted (as-built 14): Connector FIRST, Gemini second.** Gemini answers when the
  connector is offline, outdated or busy, or fails the round (15 s pickup, 1-minute cap). Measured
  21–27 s for one round and 33 s for two via the connector. A successful Gemini answer wasn't
  verified on 2026-10-05: it returned 503s and timeouts all day.
- **ElevenLabs answer voice (as-built 15):** set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`
  (`ELEVENLABS_MODEL` optional, default `eleven_flash_v2_5`). Without both, Ask uses the browser
  voice. A real round-trip is pending the key.
- **DeepContext fallback (as-built 16):** a `grounded: false` answer gets one `ASK_DEEP` connector
  round scoped to the program, about 60–80 s in all. Org terms ("beta blocker" = label
  `2.0Phase2Blocker`) aren't inferable, so the user must say the label or we add a glossary.
- **Connector 1.1.1 (connector note 19):** fixes a tight re-poll loop while Claude analysis is off,
  which caused the stage 502s. Users should re-download the script after the next deploy; the minimum
  for Ask stays 1.1.0.
- **Ask needs no Gemini key (as-built 21):** `isAskEnabled()` (`lib/ask/availability.js`) gates
  Ask; `aiEnabled` still gates only the AI Digest. With no provider, a user whose connector can't
  answer gets a 409 `CONNECTOR_OFFLINE` naming the fix.
- **Chat kept in the browser (as-built 19):** `chat-store.js` (localStorage
  `sprintTracker_askChat:<email>`, 12 h, cleared by `clearAskChats()` on logout). Pending answers
  survive closing the panel and a reload.

## Also on this branch — Claude Connector (Done 2026-09-29, committed `a18d3bd`)

Per-ticket "Analyse with Claude" (@context/features/claude-connector-analysis.md). Verified then:
57 ƒ Dynamic / 14 migrations, 22 fixtures, 38/38 API smoke, and a real end-to-end run. Still open:
- an authed real-browser pass (Needs-attention and Vulnerability tickets);
- Naveen's run of the office DB bundle for migration 14;
- resume **migrate-on-start** from the stash.

## Also on this branch — Dialog redesign (Done 2026-10-01, committed `bc47524`)

"Refined enterprise" dialogs (@context/features/dialog-redesign.md): the restyled `ui/dialog.jsx`
primitive with the brand hero, a shared kit (`Callout`, `Field`, `RadioCard`, `Segmented`,
`ConfirmDialog`), and all ~19 dialogs swept onto it. Presentation only, with no route or migration.
Fast-forwarded into this branch on 2026-10-06 under the uncommitted Ask work; only `dashboard.jsx`
and three docs overlapped, and they 3-way merged. Still open: Naveen's authed browser pass.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-09-04)**
- **Baseline invariants to preserve:** **60 ƒ Dynamic** routes / **14 Prisma migrations**
  (…`add_claude_connector`, 2026-09-29). The path there: 50 / 13 through `add_error_log`, then the
  Claude Connector (+7 routes / +1 migration), then Ask StoryBoard (+2 routes: `/api/ask` and `/ask`,
  2026-10-05), then the ElevenLabs answer voice (+1: `/api/ask/speech`). Node 22, dev on **:3002**. A feature that changes either count must say so and justify
  it.
- **Claude Connector (2026-09-29):**
  - AI analysis runs on the USER's machine, not the server. StoryBoard only queues jobs and stores
    results. `/api/connector/*` is authenticated by a per-user `sbc_` bearer token (sha256 at rest).
  - The connector must pass `ENABLE_CLAUDEAI_MCP_SERVERS=false` and `--disable-slash-commands`.
    Otherwise every run drags in the user's whole plugin, skill and connector context: 122 tools and
    about $1 per trivial call.
  - Its tool ceiling is enforced locally, so the server can't widen it.
- **Office DB migrations are hand-run (2026-09-29).**
  - Every new migration gets an incremental psql bundle from the `dba-migration-bundle` skill
    (`scripts/dba-migration-bundle.mjs`). Naveen applies it via the jumpserver **before** the image
    rollout.
  - **Office DB head:** 13 migrations (`…add_error_log`, bootstrap 2026-09-22).
  - The bundle for 14 (`…add_claude_connector`) is generated and rehearsed, and is **pending
    Naveen's run**. Once he confirms it, update this head to 14. *(Refreshed and re-rehearsed
    2026-10-09 at `bc47524`; the migration is now committed. Same DDL and checksum.)*
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

**Dialogs (2026-10-01, dialog-redesign.md)**
- New dialogs use `Dialog` with `hero` (or `hero="compact"` when the body is a large preview), a
  `footer` (dismiss, then the primary on the right) and a
  `footerStart` (tertiary actions: pager, copy, remove). The dismiss is always `DialogClose` or
  `useDialog().close`, never the parent's `onClose` directly, which would skip the exit animation.
- **Never hand-roll** a notice box (`Callout`), a label/hint stack (`Field`, `SectionLabel`), a radio
  card (`RadioCard`), an either/or toggle (`Segmented`) or a
  confirm (`ConfirmDialog`). This drift is exactly what the redesign removed.
- **Buttons get a pointer cursor globally** (`globals.css` base layer: `button:not(:disabled)`,
  `[role="button"]:not(:disabled)`), because Tailwind v4 dropped it. Don't add `cursor-pointer` to
  individual buttons.
- `Dialog` always portals to `document.body`, so don't wrap it in `createPortal`. Never give the panel
  a persistent transform: the export dialogs' `fixed` offscreen print sheets live inside it.

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
- Export-embedded AI narrative · ~~AI Q&A over sprint data~~ (built 2026-10-05, Ask StoryBoard) · AI stage suggestions · a share link for
  `/bugs` · leaderboard rank-delta ("moved since last sprint") arrows · external APM/OTel export ·
  `IssueProgress.createdAt` stage provenance (§14.13) · **publish `@tekion/storyboard-connector` to
  JFrog npm** (the connector is a StoryBoard-served script today) · board-level / multi-issue Claude
  analysis (Claude Connector v2).

## History

The full chronological development log (legacy Vite/Express era through the entire Next.js
migration and every post-v1 feature) has been archived to
[legacy-history.md](legacy-history.md) to keep this file focused on the current feature.

Append new "Done" entries there, earliest → latest.
