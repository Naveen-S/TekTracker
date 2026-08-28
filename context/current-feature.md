# Current Feature

**Roll-up export — leadership PDF/PNG for `/rollup`**
(@context/features/rollup-export.md) — the roll-up was the last major surface with no export path
(`ed-rollup.md` put it out of scope at step 8). One dialog, three variants: **Executive** (portfolio
KPIs, composition band, per-scrum-team effort scorecard, burndown) and **Full detail** (adds every
team's tracks and issue rows, Jira-linked). Three things are chosen at generation time rather than
baked in — the **effort metric**, whether to **emphasise risk**, and **which teams**.

**Velocity variant added 2026-08-28** — a third option, offered only for a **completed** sprint:
per-scrum-team story points **per developer split by work type**, plus the portfolio rate. Driven by
a leadership ask (*"where is that 6SP/Dev going and what we are achieving in that"*), so the answer
is the composition breakdown divided by team size, not a single number. Team sizes are dialog inputs
prefilled from the admin `Team.developerCount`. Drops health, completion, teams-complete and risk.
Post-v1, not a master-plan step.

## Status

**Done 2026-08-28 — uncommitted** (branch `feature/rollup-export`, off `main` @ `ac606eb`). Pending
Naveen's commit (gitleaks hook). Full spec + As-built: @context/features/rollup-export.md.

**Implemented:** `rollup-export.jsx` (client leaf: button, dialog, controls, capture) ·
`rollup-export-pages.jsx` (all print pages + composition bar, burndown SVG, scorecards) ·
`lib/rollup/pdf-layout.mjs` (pure layout, velocity maths, `apportionRounded`) ·
`lib/export/page-packer.mjs` (packer extracted from `lib/bug-report/pdf-layout.mjs`) ·
`WORK_TYPE_PRINT` in `print-theme.mjs` · `developerCount` + `teamSnapshots` selected in
`dashboard-data.js` · mounted in `app/rollup/page.jsx`.

**Verified (full suite, 2026-08-28):** `yarn lint` clean · `prisma validate` valid, **12 migrations
"up to date"** · cold `rm -rf .next` build with **both `.env` and `.env.production` moved aside and
confirmed absent** → exit 0, **49 ƒ Dynamic (unchanged)**, env restored · `/rollup`'s initial payload
references **none** of the 3 chunks holding real html2canvas/jsPDF internals · `/p/health` +
`/api/health/db` **200** (real Neon connectivity) · **no test suite by design**, weight carried by
pure fixtures **65/65 + 88/88** and packer-move parity **byte-identical** · **SSR smoke 20/20**
(authed 200; anon *and* a forged session cookie leak no team, sprint, program, headcount or identity;
unknown sprint id degrades cleanly) · **browser E2E 30/30** (all three variants; velocity disabled on
the still-running September sprint; **no sheet overflows or clips on any variant**) · velocity PDF
one page, landscape A4, `_Velocity_` filename · **cross-check vs `/leaderboard`: all 6 teams agree
exactly**.

**Two correctness properties the velocity report turns on:** (a) the overall per-dev rate divides
**sized teams only on both sides** — with one team unsized that is 29.2 SP/dev (904÷31), not 33.1
(1027÷31), a 13% overstatement of the number leadership quotes; (b) columns are **apportioned
(largest-remainder) so they sum to their row total** — independent rounding printed
`310+413+133+172 = 1028` beside a TOTAL of `1027`, and `39.4` beside `39.5`.

**⚠ The working tree also holds an unrelated, in-progress change that is NOT part of this feature** —
a sync P2028 transaction-timeout fix (`src/lib/sync/engine.js`, `src/lib/sync/seeding.mjs`,
`prisma/seed.mjs`, `context/features/bootstrap-seed.md`, `context/features/sync-stages-from-jira.md`).
**Commit this feature by explicit path, never `git add -A`.**

**Next:** commit (command prepared, Naveen runs it); then his real-browser visual acceptance. Two
open data findings were handed back from the 2026-08-28 audit and are unrelated to this feature —
DX → Tech Debt caching 0 issues after a sync, and CALM's 66 orphaned TECH_DEBT progress rows.

## Goals

- **`RollupExport`** (`src/components/rollup/rollup-export.jsx`) — self-mounting client leaf
  (the `BugExport` / `RollupDigestButton` shape, since `/rollup` is a server component).
- **Print pages** (`src/components/rollup/rollup-export-pages.jsx`) — re-authored, hex-literal,
  A4 landscape; composition bars, a burndown SVG, the scorecard, risk register, detail pages.
- **Pure layout** (`src/lib/rollup/pdf-layout.mjs`) — `defaultRiskEmphasis`, `effortCells`,
  `orderTeamsForReport`, `teamCompositionRow`, `tracksForTeam`, `paginateRollupDetail`.
- **Shared packer** (`src/lib/export/page-packer.mjs`) — `packSections` + `chunkRows` lifted out of
  `lib/bug-report/pdf-layout.mjs` now that a second consumer exists (the same extraction
  `export-visual-consistency.md` performed on the print kit). Guarded by a byte-parity fixture.
- **`WORK_TYPE_PRINT`** in `print-theme.mjs` — the four work-type colours for print.

## Notes

- **§12 metric core untouched** — the export reads `computeSprintMetrics` / `aggregateRollup` output
  and adds nothing to it. No schema change, no new route.
- **One additive data change:** `getRollupData` also returns `teamSnapshots` (raw per-team rows) so a
  team-trimmed report gets a truthful burndown — `combinedSnapshots` has already summed `teamId`
  away, and a portfolio burndown still counting a deselected team would be a silently wrong number.
- **Deliberate deviation:** the on-ink "solid = planned, hatch = reactive bug" texture grammar is
  **not** carried into print — the hatch utilities colour-mix against `--ink` and are wrong on white,
  and the four print hues are far enough apart that texture is not load-bearing for CVD on paper. If
  wanted later, use an SVG `pattern` (proven to survive capture), never a repeating-linear-gradient.
- **Height contract:** the detail pages' row heights (team section 84, track 24, issue 34, body 620)
  are the shared packer's constants. Change one and the print components must follow.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-27)**
- **Baseline invariants to preserve:** `main` @ `ac606eb` ("Polish.", on top of the program-rollup
  merge) = **49 ƒ Dynamic** routes / **12 Prisma migrations** (…`add_program_model`). Node 22, dev on
  **:3002**. A feature that changes either count must say so and justify it. Neither the board-polish
  round nor the 2026-08-27 roll-up export changed either count.
- **`main` is at `08228a1`.** Main includes the bug-board arc (enhancing-bug-board,
  bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency), the unplanned-split,
  sync-stages, default-team-release, needs-attention-roster, program-rollup, AND the
  office-deployment work (`Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health` /
  `DEPLOY.md`; must land on `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **The working branch is `feature/rollup-export`**, cut from `main` @ `ac606eb`, with the roll-up
  export as uncommitted working-tree changes.
- **`src/lib/export/page-packer.mjs` is the shared height-budgeted page packer** (`packSections`,
  `chunkRows` + the row-height constants), used by BOTH the `/bugs` appendix and the roll-up detail
  pages. Its constants are a contract with the print components' `h-[...]` values — change one and
  the other must follow, or packed pages overflow.
- **`src/lib/metrics.mjs` now carries a display-only helper, `formatPoints`** (≤2dp, trailing zeros
  dropped) — the shared boundary for every story-point readout. It is NOT part of §12: never feed
  its result back into a calculation. Use it for any new points display.
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
  confirm it's absent mid-build, restore after. **Move `.env.production` aside too** — Next loads it
  during `next build` and the log line `- Environments: .env.production` otherwise weakens the
  claim (the app reads no `STORYBOARD_*` var, so it is not load-bearing, but the stronger run is
  cheap and is the bar used from 2026-08-27).
- **`yarn build` clobbers `.next` and leaves the running dev server 404ing** → after any build,
  clear `.next` and restart the dev server.
- **After a migration, a long-running dev server holds a stale Prisma client** (P2028 / "Unknown
  argument …") → `prisma generate` + restart the dev server before smoke-testing.
- **No test suite (deliberate).** Verify with: pure-Node fixtures for pure logic + SSR/API smoke
  using **minted iron-session cookies** (`sealData`) against Neon (tear fixtures down to 0 rows).
  Two mechanics worth remembering: a scratch script must live **inside the repo** to resolve its
  deps, and the generated Prisma client is **TypeScript**, so plain Node cannot import it — query
  Neon with raw `pg` (already a dependency via `@prisma/adapter-pg`) instead.
  **Pure `.mjs` modules must use RELATIVE imports, never the `@/` alias**, or the fixtures cannot
  load them.
  Visual = **headless Chrome** (the browser extension has never been connected, so an authed
  real-browser visual pass is always **Naveen's** acceptance step). Playwright-core + a cached
  Chromium (`~/Library/Caches/ms-playwright/chromium-*`) are available for scripted screenshots.
- **Smoke gotchas:** Next 16 resolves `redirect()`/`notFound()` to HTTP **200** — under Turbopack
  **dev** *and* under `next start` (confirmed 2026-08-27; the response is a 200 carrying a
  `NEXT_REDIRECT` payload naming the target). Assert on content, not status. RSC flight markup
  inserts `<!-- -->` between adjacent JSX text nodes — strip those before substring assertions.
  **Scan for float artifacts in VISIBLE text only** (strip `<script>`): raw metric floats legitimately
  sit in the escaped RSC flight payload, because `formatPoints` is a render-time boundary, not a data
  one. **`innerText` respects `text-transform: uppercase`**, so a label written "Include teams"
  matches as "INCLUDE TEAMS".
- **Headless Chromium is available for real-browser checks**, but Playwright 1.62 wants build 1234
  while the cache holds **1187** — pass
  `executablePath: ~/Library/Caches/ms-playwright/chromium_headless_shell-1187/chrome-mac/headless_shell`
  rather than running `playwright install`. This is enough to drive a dialog, assert rendered print
  sheets, and export a real PDF; it does NOT replace Naveen's visual acceptance, since headless
  collapses inter-word spacing.

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
