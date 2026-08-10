# Current Feature

**Unplanned work → External / Internal split + a per-team composition chart**
(@context/features/unplanned-split-and-chart.md) — a follow-on to committed-unplanned-work.md.
The delivery scoreboard's **Unplanned Bugs** segment bifurcates into **External** (`SUPPORT`) +
**Internal** (`INTERNAL_BUG`) across `/`, `/rollup`, `/share/[token]` and the PDF/PNG export, and
`/rollup` gains a **"By team" chart** (toggle `Condensed·Relaxed·By team`) showing which teams carry
which kind of work. (A composition **donut** shipped first and was dropped on Naveen's review — it
only re-drew the rail's composition; the board has no chart.) Presentation + additive metric fields
only. Post-v1, not a master-plan step.

## Status

**Done + verified 2026-08-09** (branch `feature/unplanned-split-chart`, off `main` @ `d631492`,
**uncommitted** — pending Naveen's commit). Full spec + As-built notes:
@context/features/unplanned-split-and-chart.md.

**What shipped:**
- `metrics.mjs` gains `external*`/`internal*` fields (SUPPORT / INTERNAL_BUG) beside the untouched
  `unplanned*` — additive, before/after fixture diff clean, `external + internal == unplanned`.
- Scoreboard `StoryPointsHighlight`: 4-category rail (condensed) + 4-column relaxed grid; shared
  `CompositionLegend`; exported `compositionBreakdown()` helper (split-or-`unplanned`-fallback for
  pre-split frozen shares). No chart variant here — the board is the plain condensed scoreboard.
- `/rollup` "By team" chart: new `rollup-composition-chart.jsx` (one stacked bar per team by
  committed/tech-debt/bug load, sorted heaviest-first) + `rollup-story-points.jsx` owns the
  `Condensed · Relaxed · By team` toggle over `useLocalPref`. Representation follows the `/bugs`
  per-team grammar (full-width track lane + partial fill + right-hand total, roomy rows) and reuses
  the scoreboard's `.sp-board`/`.sp-part` **hover-isolation** — hovering a work type (or legend chip)
  keeps it lit across every team while the rest dim (zero new CSS).
- Export "Unplanned bugs" readout → two rows (External / Internal). `/` + `/share` wired via
  `compositionBreakdown`.
- Palette: validated token `--on-ink-cat-4` orchid `#d385b0` (CVD sweep — purple rejected vs Modern
  blue); encoding **solid = planned work, hatch = reactive bug** (`.sp-stripe` / `.sp-stripe-2`).
- **Dropped:** the first-pass composition donut + the board view toggle + the shared
  `story-points-scoreboard.jsx` wrapper (Naveen: the donut "isn't adding value" — it re-drew the rail).

**Verified:** `yarn lint` clean; additive + partition fixtures pass; **cold `rm -rf .next` DB/env-free
build green — 45 ƒ Dynamic unchanged** (44 + office-deployment `/p/health`; no new routes); no schema
change (**9 migrations**); impeccable `detect.mjs` → `[]`; **headless-Chrome (Playwright) screenshot
round** on the live PCX/GM ACTIVE sprint (all 4 work types) — `/` (no toggle, bifurcated) + `/rollup`
By-team (desktop + mobile — PCX tech-debt-heavy, D360/DX bug-heavy at a glance) + `/rollup` Relaxed
(4-col) all read correctly.

**Next:** commit on Naveen's go-ahead; then his authed visual pass (both themes) + a real-browser PDF
export. Deferred post-v1 ideas remain (export-embedded AI narrative, AI Q&A, stage suggestions, a
share link for `/bugs`, leaderboard rank-delta arrows).

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-09)**
- **Baseline invariants to preserve:** **45 ƒ Dynamic** routes (44 + office-deployment `/p/health`),
  **9 Prisma migrations**, Node 22, dev on **:3002**. A feature that changes either count must say
  so and justify it.
- **`main` is at `d631492`** and now includes the previously-uncommitted bug-board arc
  (enhancing-bug-board, bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency) AND
  the office-deployment work (`Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health`
  / `DEPLOY.md`; must land on `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **This feature is on `feature/unplanned-split-chart`** (off `main`), uncommitted, pending commit.
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
