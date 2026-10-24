# Current Feature

**Security Vulnerability Tracker v1 — read-only all-programs remediation dashboard (`/security`)**
(@context/features/security-vulnerability-tracker.md). Ports the read side of the claude.ai
artifact "Programs Team Vulnerability Tracker" (v32) into StoryBoard, so leadership sees one set
of server-computed numbers instead of per-viewer connector math. All six programs (DR_GM,
AEPlatform, DR_Honda, Fleet_Honda, DigitalRetailing, DR_Ford) plus an "All programs" rollup.
**No Jira writes:** triage and apply stay in the artifact. Picked next because the weekly
security email links to an artifact that most viewers see as "Unavailable".

## Status

**Done 2026-10-21 — PR 1 (spec items a–f) · verified · uncommitted** on
`feature/security-tracker-dashboard` (cut from `main` @ `6ace5c0`). Clarifications C1–C10 and
as-built notes 1–13 are in the spec.

**Verified 2026-10-20:**
- 16 pure fixture groups pass; `vocab.mjs` passes against the three live Confluence pages.
- **Live refresh:** 1,451 issues, 7 snapshots. **DR_GM 772/959 and portfolio 1,074/1,382 match the
  18 Oct reference exactly.**
- **18/18** page + API smoke; a fetch-recorded nightly run hit Atlassian with **only GET + POST
  `/search/jql`**.
- Headless 1440 / 390 px with 0 overflow; cold env-free build exit 0, **65 ƒ Dynamic**, 0 warnings;
  **15 migrations** up to date; lint 0 for the project tree.

**Review rounds 2026-10-20/21** (spec as-built 14–18):
- progress first, with a hoverable chart, and Path to zero beside it on wide screens;
- the vulnerability donut;
- the risk register collapsed at the bottom; the triage queue removed;
- the artifact palette, a polish pass, and a StoryBoard | Artifact look toggle.

**Final verification 2026-10-21:** 20/20 smoke; lint 0; 15 migrations up to date; env-free build
65 ƒ / 0 warnings; headless 390 / 1440 / 2240 px, both looks and themes, 0 overflow and 0 errors.

**Next:**
- Naveen runs the office DB bundle for migration 15 (`00` → `01` → `02` → `02b`) **before** the image
  rolls out (generated + rehearsed 2026-10-20; see the spec Status).
- Naveen's commit (gitleaks hook), authed browser pass, and the same-morning parity check against
  the artifact (expect C5/C6 differences: DR_GM pipeline 176 vs the artifact's ~183).
- Set `workbenchUrl` in Admin → Security tracker.
- Then the **Modern = artifact theme** (`feature/modern-artifact-theme`, branched from this branch
  once it is committed). Decided 2026-10-21: light artifact headers on every page, theme-level
  depth, and the theme replaces /security's look toggle.
- Then PR 2 (`feature/security-tracker-updates`, copy-only leadership updates).

## Goals

- (a) Schema: migration `add_security_tracker` (14 → **15**) adds `SecurityTrackerSettings`
  (singleton), `SecurityProgram`, `SecurityIssue` (raw-fact mirror, + `statusCategoryChangedAt`),
  `SecuritySnapshot` (per program + `__all__`) and `SecurityRelease`. Keep it in sync with §9 and
  the ERD.
- (b) Pure libs: `src/lib/security/{classify,aggregate,risks,vocab}.mjs`. Server code:
  `src/lib/jira/confluence.js`, `src/lib/security/{refresh,vocab-refresh,data}.js`, and the
  security step in `src/lib/cron/daily.js`. `resolveRefreshAuth` moves into a shared helper.
- (c) Routes: `src/app/security/page.jsx`, plus `api/security/{refresh,settings,programs,
  programs/[programId]}`, all wrapped in `withRoute`.
- (d) UI: `src/components/security/*`, with the risk register built from
  `context/features/security-risk-register-mockup.html`. Admin card:
  `src/components/admin/security-config.jsx` (lean forms, C4). Sidebar entry "Security".
- (e) `ERROR_CODES`: `SECURITY_REFRESH_FAILED` and `SECURITY_VOCAB_UNAVAILABLE`. No new env vars.
- (f) Seed: the settings singleton, six programs and the 2026 release calendar, all create-only.

## Notes

- **Read-only, enforced:** only GET plus the existing POST `/search/jql` may reach Atlassian.
  Before each PR, grep the diff for `PUT`, `/comment`, `/transitions` and `editIssue`.
- **Deliberate parity divergences from the artifact:**
  - C5: NON_DR_GM is excluded everywhere, so the DR_GM pipeline will read below 182.
  - C6: 5 coverage buckets, and `noFixVersion` includes `*_BREACHED` items.
  - Write both up in as-built notes; the parity check is Naveen's.
- **`labels != X` drops unlabelled issues:** always write `(labels IS EMPTY OR labels != X)`.
- `searchIssues({ maxIssues: 5000 })` for security queries only. `SEARCH_MAX_ISSUES = 2000` stays.
- Atlassian calls are serial. A failed refresh keeps the previous mirror and records
  `lastRefreshError`.
- Next 16: `params` is async. Prisma 7: run `prisma generate` after `migrate dev`. Tailwind v4: no
  inline styles. The page must work at phone width.
- **Invariants to record:** 15 migrations. The ƒ Dynamic count = the `main` baseline plus the new
  route files and `/security`; count it on `main` before adding routes.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-09-04)**
- **Baseline invariants to preserve:** **65 ƒ Dynamic** routes / **15 Prisma migrations**
  (…`add_security_tracker`, 2026-10-20). The path there: 50 / 13 through `add_error_log`, then the
  Claude Connector (+7 routes / +1 migration), then Ask StoryBoard (+2 routes: `/api/ask` and `/ask`,
  2026-10-05), then the ElevenLabs answer voice (+1: `/api/ask/speech`) — 60 / 14 on `main` @
  `6ace5c0` — then the security tracker (+5: `/security` + four `/api/security/*`, +1 migration). Node 22, dev on **:3002**. A feature that changes either count must say so and justify
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
  - **Office DB head:** 14 migrations (`…add_claude_connector`), confirmed by Naveen 2026-10-20.
  - The bundle for 15 (`…add_security_tracker`, + `02b-seed.sql`) is generated and rehearsed
    (2026-10-20) and **pending Naveen's run**. Once he confirms it, update this head to 15.
  - The bundle for 14 (`…add_claude_connector`) has been **run by Naveen** (confirmed 2026-10-20).
    *(It was refreshed and re-rehearsed 2026-10-09 at `bc47524`, with the same DDL and checksum.)*
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
