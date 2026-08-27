# Current Feature

**Board polish — points display boundary, Jira quick-links, shared program chip**
(@context/features/board-polish-points-and-links.md) — a small cross-cutting polish round picked up
after the program-rollup merge: a single `formatPoints` display boundary that stops IEEE-754 float
artifacts (`41.260000000000005`) reaching any points readout; a `buildJiraSearchUrl` seam behind a
per-track **copy-Jira-link** button on the board's filter cards; and one shared `ProgramChip`
replacing the two divergent inline program pills. Post-v1, not a master-plan step.

## Status

**Done 2026-08-27 — uncommitted** (branch `program-wise-roll-up`, currently **level with `main` @
`08228a1`** — no commits ahead, only working-tree changes). Pending Naveen's commit (gitleaks hook).
Full spec + As-built notes: @context/features/board-polish-points-and-links.md.

**Verified:** `yarn lint` clean · `prisma validate` + `migrate status` up-to-date (**12 migrations —
unchanged, no schema change**) · cold `rm -rf .next` **DB/env-free build** at a stricter bar than
prior rounds — **both `.env` and `.env.production` moved aside** and confirmed absent mid-build (the
app reads no `STORYBOARD_*` var, so that file was never load-bearing) → exit 0, **49 ƒ Dynamic —
unchanged, no new route** · **pure fixtures 24/24** (`formatPoints` artifact shapes, ≤2dp ceiling,
integers/halves untouched, defensive `null`/`NaN`/`""`; `buildJiraSearchUrl` precedence + all null
paths) · **SSR smoke 21/21** (`next start` + minted iron-session cookie vs Neon, read-only): both
hero chips render and the chip is correctly absent on the unscoped roll-up; 4 copy buttons = exactly
CALM's 4 delivery filters (the 5th, `NEEDS_ATTENTION`, is partitioned out); admin focus-ring +
`bg-info-soft` tile render; **zero** float artifacts in any rendered page; auth gate leaks no team,
sprint, program or user data.

**Two findings worth carrying forward:** (1) a scan of **all 572 live issues found 0 artifacts
today** at every aggregation level — the inexact sources `0.13`/`0.38` are present but small sums
still print clean, so this round is warranted **hardening, not a visible-bug fix** (`41 + 2×0.13` →
`"41.260000000000005"` proves the mechanism); (2) **Next 16 returns HTTP 200 for `redirect()` under
`next start`, not only Turbopack dev** — the carry-forward note below under-scoped this and it cost
three false smoke failures.

**Next:** hand Naveen the commit command. Note the branch is level with `main`, so this can either
land on a fresh `fix/board-polish` branch (house convention per `ai-interaction.md`) or be committed
where it stands — **his call**. Visual acceptance (copy button + toast, both hero chips) is his step.

## Goals

- **`formatPoints`** in `src/lib/metrics.mjs` — display-only, ≤2dp, trailing zeros dropped; applied
  at every points readout. **Purely additive** (10-line insertion; no existing metric touched).
- **`buildJiraSearchUrl`** in `src/lib/jira/url.js` + a per-track copy button in `filter-panel.jsx`.
- **`ProgramChip`** in `src/components/ui/program-chip.jsx`, used by `hero.jsx` + `rollup/page.jsx`.
- **Admin polish** — focus ring + `title` on delete-program, `role`/`aria-live` on the status line,
  `bg-info-soft` icon tile, badge cleanup.

## Notes

- **§12 metric core untouched** — `formatPoints` is applied strictly at render and must never be fed
  back into a calculation. §12 of `project-overview.md` now carries an explicit note saying so.
- **Deliberately not done:** the duplicated inline Jira-URL construction in
  `needs-attention-panel.jsx` and the bug-report components was **not** migrated onto
  `buildJiraSearchUrl` — out of scope; do it when one of those files is next touched.
- **Known minor a11y weakness (left as-is):** `programs-config.jsx`'s status live region mounts
  *with* its message (`{status && …}`), which some screen readers announce unreliably. The
  `role="alert"` error path is announced on insertion by modern SRs, so the important case works;
  hoisting an always-present wrapper would add an empty `mb-3` paragraph. Revisit if that section
  grows more messaging.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-27)**
- **Baseline invariants to preserve:** `main` @ `08228a1` (merge of `bb26f28` "Program wise
  rolllup." — **program-rollup is now MERGED**) = **49 ƒ Dynamic** routes / **12 Prisma migrations**
  (…`add_program_model`). Node 22, dev on **:3002**. A feature that changes either count must say so
  and justify it. The 2026-08-27 board-polish round changed **neither** (no schema change, no new
  route) — display-boundary + shared-component work only.
- **`main` is at `08228a1`.** Main includes the bug-board arc (enhancing-bug-board,
  bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency), the unplanned-split,
  sync-stages, default-team-release, needs-attention-roster, program-rollup, AND the
  office-deployment work (`Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health` /
  `DEPLOY.md`; must land on `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **The working branch `program-wise-roll-up` is currently LEVEL with `main`** — no commits ahead,
  only uncommitted working-tree changes. Branch before committing new work if following the house
  convention in `ai-interaction.md`.
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
  Visual = **headless Chrome** (the browser extension has never been connected, so an authed
  real-browser visual pass is always **Naveen's** acceptance step). Playwright-core + a cached
  Chromium (`~/Library/Caches/ms-playwright/chromium-*`) are available for scripted screenshots.
- **Two smoke gotchas:** Next 16 resolves `redirect()`/`notFound()` to HTTP **200** — under
  Turbopack **dev** *and* under `next start` (confirmed 2026-08-27; the response is a 200 carrying a
  `NEXT_REDIRECT` payload naming the target). Assert on content, not status. RSC flight markup inserts `<!-- -->` between adjacent
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
