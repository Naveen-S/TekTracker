# Current Feature

**Sync Jira status → delivery-matrix stages, per track**
(@context/features/sync-stages-from-jira.md) — turns the manual per-ticket stage checklist into a
one-click, per-track action. Each delivery-matrix track header (Roadmap / Tech Debt / External Bug /
Internal Bug) gets a `canWrite`-gated **"Sync stages"** button that pulls the latest Jira status for
that filter and re-derives every one of its issues' stages from it via `StatusStageMapping` —
**overwriting** existing rows behind a confirm. It is the user-triggered, per-track overwrite variant
of the create-only sync's deferred "re-seed forward" (sync-hybrid-seeding.md decision 5). Post-v1,
not a master-plan step.

## Status

**Done + verified 2026-08-10** (branch `feature/sync-stages-from-jira`, off `main` @ `452644e`,
**uncommitted** — pending Naveen's commit). Full spec + As-built notes:
@context/features/sync-stages-from-jira.md.

**Naveen's ratified calls (AskUserQuestion):** overwrite-with-confirm (names how many tickets carry
manual stage edits that will be replaced) · a button **per track** · **pull-latest-then-map** (a live
Jira call scoped to the one filter).

**What shipped:**
- `src/lib/sync/seeding.mjs` — new pure `resolveStageResync(...)` → the overwrite/skip/baseline
  decision (unmapped status never wipes an existing row; new key still gets an all-false baseline).
- `src/lib/sync/engine.js` — new `syncFilterStagesFromJira({ teamId, sprintId, filterId, userId })`
  reusing `refreshFilterCache` / `buildSeededStages` / `owningWorkflowType`. Refreshes the one
  filter, then creates/updates `IssueProgress` in one transaction; **resets `updatedById` to null**
  (status-derived → idempotent re-runs) and **preserves** blocked/blockedReason/riskComment; honors
  the owning workflow (one progress row per key); 409s on CLOSED sprints.
- `.../filters/[filterId]/sync-stages/route.js` — new `POST`, writer roles, Jira-error mapping
  (401/502) + `handleRouteError` (404/409). **45 → 46 ƒ Dynamic.**
- `src/lib/dashboard-data.js` — `progressByKey` rows carry `manuallyEdited` (drives the confirm count).
- `planner-panel.jsx` — per-track "Sync stages" button (`RefreshCw`); hidden for CUSTOM/empty tracks.
  `dashboard.jsx` — confirm `<Dialog>` + two-transition handler (mirrors `handleSync`).

**Verified:** `yarn lint` clean; **cold `rm -rf .next` DB/env-free build green — 46 ƒ Dynamic** (was
45; exactly the one new route); **5/5** `resolveStageResync` fixtures; **4/4** guard smoke (401
unauth · 403 viewer · 404 unknown filter · 409 CLOSED sprint) with minted iron-session cookies
against Neon (fixtures torn down); `prisma validate` + `migrate status` clean; **no schema change
(9 migrations)**.

**Next:** commit on Naveen's go-ahead; then his real-browser acceptance (live Jira status→stages,
both themes; the Chrome extension has never been connected). Consider an admin editor for
`StatusStageMapping` if real Jira status names miss the seeded mappings — the "unmapped" toast count
surfaces this. Deferred post-v1 ideas remain (export-embedded AI narrative, AI Q&A, stage
suggestions, a share link for `/bugs`, leaderboard rank-delta arrows).

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-10)**
- **Baseline invariants to preserve:** **46 ƒ Dynamic** routes (45 + this feature's per-track
  `.../filters/[filterId]/sync-stages`; the 45 = 44 + office-deployment `/p/health`), **9 Prisma
  migrations**, Node 22, dev on **:3002**. A feature that changes either count must say so and justify it.
- **`main` is at `452644e`** ("Internal and External bugs bifurcation" — the unplanned-split feature
  is now committed) and includes the bug-board arc (enhancing-bug-board, bug-report-pdf-export,
  bug-sprint-ownership, export-visual-consistency) AND the office-deployment work (`Dockerfile` /
  `.dockerignore` / `output:"standalone"` / `GET /p/health` / `DEPLOY.md`; must land on
  `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **This feature is on `feature/sync-stages-from-jira`** (off `main` @ `452644e`), uncommitted, pending commit.
- **Naveen runs all commits** (the Tekion gitleaks pre-commit hook can't fetch its config from
  Claude's shell). Never auto-commit — hand him the command and ask first (per `ai-interaction.md`).

**Build & verification hazards (each one has burned a session)**
- **Always `rm -rf .next` before the acceptance build.** A warm `.next` reuses stale CSS/source
  chunks and hides real breakage — "build green" over a cached build is not a real pass.
- **Tailwind v4 scans every non-ignored file, incl. `context/**` and `legacy/**`.** Guarded by
  `@source not "../../context"` / `@source not "../../legacy"` in `globals.css`. Never quote an
  arbitrary-property class (e.g. bracketed `stop-color`) verbatim in docs/prose — Tailwind reads it
  as a real class candidate and can emit invalid CSS that 500s every route.
- **Prove the DB/env-free build honestly:** genuinely `mv` `.env` aside (not just shell-unset),
  confirm it's absent mid-build, restore after. The build must pass with `.env` absent.
- **`yarn build` clobbers `.next` and leaves the running dev server 404ing** → after any build,
  clear `.next` and restart the dev server.
- **After a migration, a long-running dev server holds a stale Prisma client** (P2028 / "Unknown
  argument …") → `prisma generate` + restart the dev server before smoke-testing.
- **No test suite (deliberate).** Verify with: pure-Node fixtures for pure logic + SSR/API smoke
  using **minted iron-session cookies** (`sealData`) against Neon (tear fixtures down to 0 rows).
  Visual = **headless Chrome** (the browser extension has never been connected, so an authed
  real-browser visual pass is always **Naveen's** acceptance step). Playwright-core + a cached
  Chromium (`~/Library/Caches/ms-playwright/chromium-*`) are available for scripted screenshots.
- **Two smoke gotchas:** Next 16 + Turbopack **dev** resolves `redirect()`/`notFound()` to HTTP
  **200** — assert on content, not status. RSC flight markup inserts `<!-- -->` between adjacent
  JSX text nodes — strip those before substring assertions.

**Do-not-touch invariants**
- **Never rename the session cookie `sprinttracker_session` or the `sprintTracker_*` localStorage
  keys** — there is no dual-read fallback, so a rename force-logs-out every user (the app was
  renamed to **StoryBoard** display-only for exactly this reason; see §9 note in CLAUDE.md).
- **§12 metric core is sacred** (`metrics.mjs` / `IssueProgress` / `SprintSnapshot`). New
  display/composition features must be **additive only** — prove it with a before/after fixture
  diff showing zero removed/changed pre-existing fields.
- **Read the installed version docs first** — Next 16, Prisma 7, Tailwind v4 all diverge from
  training data (`node_modules/next/dist/docs/`, the `prisma-change` skill, `@theme` CSS config).
- **Append-don't-rewrite** dated entries in `context/**` (rename notes, decision history).

**On-ink categorical palette (delivery scoreboard)**
- Four validated categorical channels on the ink surface: brand-accent (Committed) · gold
  `--on-ink-cat-2` (Tech Debt) · rose `--on-ink-cat-3` (External bugs) · orchid `--on-ink-cat-4`
  `#d385b0` (Internal bugs). **Solid = planned work, hatch = reactive bug** (`.sp-stripe` /
  `.sp-stripe-2`); hue sub-divides. **Purple/violet is NOT available** — it collapses against
  Modern's blue brand under CVD. A 5th category faces an even tighter hue space; reach for a
  texture/second channel before a new hue, and validate ΔE (CIEDE2000 + Machado CVD), never eyeball.

**Open post-v1 backlog (deferred, not forgotten)**
- Export-embedded AI narrative · AI Q&A over sprint data · AI stage suggestions · a share link for
  `/bugs` · leaderboard rank-delta ("moved since last sprint") arrows.

## History

The full chronological development log (legacy Vite/Express era through the entire Next.js
migration and every post-v1 feature) has been archived to
[legacy-history.md](legacy-history.md) to keep this file focused on the current feature.

Append new "Done" entries there, earliest → latest.
