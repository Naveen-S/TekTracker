# Current Feature

**Scrum-team member roster + auto "Needs attention" (untagged items) board track**
(@context/features/needs-attention-roster.md) — admins set a per-team roster of **member email
addresses**; each team's board then carries an always-present **"Needs attention"** track that
surfaces the team's own Jira items (`assignee in (roster)`) missing a **sub-component or fix version**
— a hygiene surface no existing sub-component-scoped filter can catch. Post-v1, not a master-plan
step. Picked as current because it closes the "orphaned/untagged items are invisible" gap.

## Status

**Done 2026-08-12 — uncommitted** (branch `feature/needs-attention-roster`, off `main` @ `4f4d295`
"Default view."; baseline **47 ƒ Dynamic routes / 10 migrations**). Pending Naveen's commit (gitleaks
hook). Full spec + As-built notes: @context/features/needs-attention-roster.md.

**Verified:** `yarn lint` clean · **7/7 pure fixtures** (JQL builder + the byte-identical §12 no-op
proof) · cold `rm -rf .next` DB/env-free build compiled, **47 ƒ Dynamic unchanged** · `migrate status`
up-to-date, **11 migrations** · **live-Jira E2E** — `assignee in ("naveens@tekion.com")` returned **17
real untagged GM items**, synced + cached, panel rendered with chips · **deletion-regression +
manager-prompt + "View in Jira" link SSR checks pass** on the running dev server (throwaway rows, torn
down to 0) · dev server healthy (`/login` 200, 0 font errors).

**Post-first-run fixes (2026-08-11/12), all shipped + verified:**
- **Severe filter-deletion bug** — `ensure-filter.js` matched the NA row via `WorkflowType.NEEDS_ATTENTION`;
  under a stale client that enum is `undefined`, Prisma strips it, and the roster-empty delete branch
  removed a REAL track. Fixed: string literal `"NEEDS_ATTENTION"` + `deleteMany` scoped by workflowType.
  Deleted Aug/Sep tracks (PCX/DX/INT Aug, CALM Sep) recover via re-running Sprint Start (progress
  reattaches, §9). ⚠️ **still needs Naveen to run that recovery.**
- **`ReferenceError`** — `engine.js` used `WorkflowType.NEEDS_ATTENTION` un-imported → now string literal.
- **Discoverability** — manager-only config prompt on the board when no track exists yet.
- **Server dedupe** of `memberEmails`; **"View in Jira"** deep-link; JSX whitespace fixes.

**Naveen's ratified calls (AskUserQuestion):** filter scope = missing **sub-component OR fix version**
(broad hygiene net) · trigger = **always present, auto-refreshed** by every Sync + the daily cron when
the team has a roster (no button; so **no new API route** — generation folds into `syncTeamSprint`).

## Goals

- **Roster** — `Team.memberEmails String[]` (migration `add_member_emails_and_needs_attention_workflow`,
  10 → 11); zod in `src/lib/schemas/team.js`; edited in `src/components/admin/team-config-dialog.jsx`
  via the existing team POST/PATCH (no route change). Distinct from RBAC `TeamMembership`.
- **JQL** — `buildNeedsAttentionJql` + `emptyClause`/email-quote helpers in
  `src/lib/sprint-start/track-jql.mjs` (guarded null on empty roster/projectKeys).
- **Enum + registry** — `WorkflowType.NEEDS_ATTENTION`; `WORKFLOWS` entry `stages: []`, out of
  `SEEDABLE_WORKFLOW_TYPES` (`src/lib/workflows.mjs`).
- **Auto-generate** — `src/lib/needs-attention/ensure-filter.mjs` (upsert/delete the single NA Filter)
  wired into `src/lib/sync/engine.js` `syncTeamSprint`; NA excluded from progress seeding.
- **Metrics guard** — one additive no-op line at the top of `computeSprintMetrics`
  (`src/lib/metrics.mjs`) excluding NA, shielding all call sites.
- **Render** — `getDashboardData` partitions NA out (`src/lib/dashboard-data.js` + `src/app/page.jsx`);
  new `src/components/dashboard/needs-attention-panel.jsx` below `PlannerPanel` (`/impeccable`).

## Notes

- **§12 metric core is sacred** — the only `metrics.mjs` change is a provably no-op guard (no NA
  filters exist in existing fixtures → byte-identical). Prove with a before/after fixture diff.
- **`prisma-change` for the enum:** keep the migration to the column add + `ALTER TYPE ... ADD VALUE`
  only; do not reference the new value in the same migration. Keep §9 byte-consistent.
- **Counts stay honest:** **47 ƒ Dynamic routes unchanged** (no new route — generation is in
  `syncTeamSprint`); **one additive migration (10 → 11)**.
- **Emails-in-JQL risk (highest):** if Tekion hides assignee emails, `assignee in (emails)` returns
  nothing — validate on Naveen's first live Sync; accountId-resolution fallback documented, out of v1.
- Post-migration dev-server / `rm -rf .next` / DB-free-build hazards below still apply.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-11)**
- **Baseline invariants to preserve:** `main` @ `4f4d295` ("Default view." — the
  `default-team-release` feature is now MERGED) = **47 ƒ Dynamic** routes (46 + `/api/me`; the 46 =
  45 + sync-stages' `.../filters/[filterId]/sync-stages`; the 45 = 44 + office-deployment `/p/health`)
  / **10 Prisma migrations** (9 + `add_user_default_view`). This feature
  (`feature/needs-attention-roster`) adds **no route (stays 47)** and **one migration (10 → 11)** —
  generation folds into `syncTeamSprint`, nothing new under `src/app/api`. Node 22, dev on **:3002**.
  A feature that changes either count must say so and justify it.
- **`main` is at `4f4d295`** ("Default view." — the `default-team-release` feature is now committed;
  the prior tip was `5e96703` "Sync stages"). Main includes the bug-board arc
  (enhancing-bug-board, bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency), the
  unplanned-split, sync-stages, AND the office-deployment work (`Dockerfile` / `.dockerignore` /
  `output:"standalone"` / `GET /p/health` / `DEPLOY.md`; must land on `tekion-apps/storyboard` `main`
  for DevOps to build — RELB-28979).
- **This feature is on `feature/needs-attention-roster`** (off `main` @ `4f4d295`). It adds migration
  #11 (`add_member_emails_and_needs_attention_workflow`) and **no** route.
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
