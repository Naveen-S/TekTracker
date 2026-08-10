# Current Feature

**Default scrum team & release (per-user board default)**
(@context/features/default-team-release.md) — each user can pin a **default team + release** so the
board (`/`) opens on their own board instead of the alphabetically-first team + ACTIVE gate. Resolved
**server-side** (a per-user pref on the `User` row, not localStorage) so it's flash-free and syncs
across devices; set via a **star** in the top bar. Post-v1, not a master-plan step.

## Status

**Done + verified 2026-08-11** (branch `feature/default-team-release`, off `main` @ `5e96703`
"Sync stages", **uncommitted** — pending Naveen's commit). Full spec + As-built notes:
@context/features/default-team-release.md.

**Naveen's ratified calls (AskUserQuestion):** pin **team + the exact release** (honored even once
CLOSED; falls back to ACTIVE only if the pinned release is deleted) · set it via a **star** in the
top bar (pin current view / click again to clear; filled = current view is the default).

**What shipped:**
- `prisma/schema.prisma` — two nullable `User` columns `defaultTeamId`/`defaultSprintId` (bare ids,
  no FK; migration `add_user_default_view`, **9 → 10 migrations**). §9 kept byte-consistent.
- `src/lib/dashboard-data.js` — team default resolved before `teams[0]`; `getSprintSelection` gained
  an optional `fallbackSprintId` (above the ACTIVE default, matched by id so a **CLOSED pin wins**),
  passed ONLY by `getDashboardData` (`/rollup`+`/leaderboard` call it with one arg, unchanged);
  returns a board-only `defaults: { teamId, sprintId }`.
- `src/lib/schemas/user.js` + `src/app/api/me/route.js` — new self-service `PATCH /api/me`
  (`requireUser`; sets/clears/omits each half independently; 403 on pinning a non-member team) — the
  app's **first `User`-self-mutation route** (**46 → 47 ƒ Dynamic**).
- `top-bar.jsx` — `Star` toggle after the sprint select (filled `text-primary` when default,
  `aria-pressed`); `dashboard.jsx` — `isDefaultView` + `setDefaultView` (PATCH → `router.refresh()`
  + success toast, house two-transition pattern).

**Verified:** `yarn lint` clean; **cold `rm -rf .next` DB/env-free build green — 47 ƒ Dynamic** (base
46 + the one new `/api/me`); **13/13 SSR+API smoke** (minted iron-session cookie, real Neon, fixtures
torn down to 0) — SSR of `/` selects the pinned team (not alphabetical-first) + pinned CLOSED gate
over a newer ACTIVE gate, and flips to alphabetical-first when cleared; `PATCH /api/me`
401-unauth / 400-empty / 403-non-member / 200-set(persisted) / 200-clear(nulls); `prisma validate` +
`migrate status` clean.

**Next:** commit on Naveen's go-ahead; then his real-browser acceptance (star fills on the default
view; sidebar "My board" / logo / bare `/` land on the pinned team + release; toggle-off clears; both
Tekion + Modern themes — the Chrome extension has never been connected). ⚠️ A pre-existing dev server
on **:3002** is stale post-migration (old Prisma client) — restart it (`prisma generate` + restart)
before manual testing. Deferred post-v1 ideas remain (export-embedded AI narrative, AI Q&A, stage
suggestions, a share link for `/bugs`, leaderboard rank-delta arrows).

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-10)**
- **Baseline invariants to preserve:** **47 ƒ Dynamic** routes on this branch (main @ `5e96703` = 46,
  which is 45 + sync-stages' `.../filters/[filterId]/sync-stages`; the 45 = 44 + office-deployment
  `/p/health`) + this feature's `/api/me`; **10 Prisma migrations** on this branch (main = 9 +
  `add_user_default_view`), Node 22, dev on **:3002**. A feature that changes either count must say so
  and justify it.
- **`main` is at `5e96703`** ("Sync stages" — the per-track Sync-stages feature is now committed; the
  prior tip was `452644e` "Internal and External bugs bifurcation"). Main includes the bug-board arc
  (enhancing-bug-board, bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency), the
  unplanned-split, sync-stages, AND the office-deployment work (`Dockerfile` / `.dockerignore` /
  `output:"standalone"` / `GET /p/health` / `DEPLOY.md`; must land on `tekion-apps/storyboard` `main`
  for DevOps to build — RELB-28979).
- **This feature is on `feature/default-team-release`** (off `main` @ `5e96703`), uncommitted, pending
  commit. It adds migration #10 (`add_user_default_view`) and route #47 (`/api/me`).
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
