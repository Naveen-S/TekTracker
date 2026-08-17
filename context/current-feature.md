# Current Feature

**Program grouping + Program roll-up** (@context/features/program-rollup.md) — a first-class
**Program** entity groups scrum teams one level above the team (GM → AI Agentic, DX & SCX, PCX…;
other programs Honda, AEP). Admins CRUD programs + assign each team to one; leadership (ED/TPM/EM/
VIEWER + admin) scope the existing `/rollup` page to a program via a picker to see the aggregate
across **all** its teams — the cross-membership ED/TPM/VP view the roll-up couldn't give before.
Post-v1, not a master-plan step. Picked as current because it closes the "no program-level roll-up"
gap in the leadership-visibility mission (§2.2).

## Status

**Done 2026-08-12 — uncommitted** (branch `feature/program-rollup`, off `main` @ `52d5fc0`
"Need attention."; baseline **47 ƒ Dynamic routes / 11 migrations**). Pending Naveen's commit
(gitleaks hook). Full spec + As-built notes: @context/features/program-rollup.md.

**Verified (finish-feature re-run):** `yarn lint` clean · `prisma validate` + `migrate status`
up-to-date (**12 migrations**) · cold `rm -rf .next` **DB/env-free build** passed with `.env` moved
aside (confirmed absent mid-build), route list shows `/api/programs` + `/api/programs/[programId]` →
**49 ƒ Dynamic** · **SSR/API smoke — 30/30 pass** (minted iron-session cookies vs Neon, torn down to
0, re-run against `next start`): RBAC gating (leadership/admin see programs, member 403), program
CRUD (admin-only, dup→409, bad-key→400), `/rollup?program=` scopes to all program teams incl. one the
viewer isn't on + excludes unassigned, my-teams path byte-unchanged, member `?program=` silently
ignored (200 not 403), team↔program PATCH, DELETE→SetNull, **+ finetuning** (board "{program}
program" chip renders, `/admin` renders with the program include). A transient Google Fonts CDN
outage (v20 Inter woff2 → 404) briefly failed dev + build mid-verify — external, pre-existing (the
font import is in the untouched root layout), cleared on retry.

**Finetuning round (2026-08-13, Naveen's visual review):** (1) loader feedback on Add/Save program
(`ProgressBar` + button spinners); (2) `Select` base box aligned to `Input` (`h-9 rounded-md py-1`) —
app-wide; (3) program badge on the admin team card; (4) "{program} program" chip on the `/` board
hero. Both (3)/(4) fed by a `program {id,name,key}` include on the admin team query + `getMembershipContext`.

**Next:** hand Naveen the SCOPED commit command (exclude the unrelated `DEPLOY.md` +
`office-deployment.md` working-tree edits, which are not this feature's); on merge, delete the branch.

**Naveen's ratified calls (AskUserQuestion):** (1) first-class `Program` model over a text field ·
(2) program picker on the existing `/rollup` (`?program=`), not a separate page · (3) view access =
leadership + admins (`PROGRAM_ROLES = [ED, TPM, EM, VIEWER]`, TPM included; non-leadership `?program=`
silently ignored) · (4) one program per team (`Team.programId`, SetNull).

## Goals

- **Data model** — `Program` model + `Team.programId` (`onDelete: SetNull`) + `@@index`; migration
  `add_program_model` (11 → 12). Pure additive, no enum ALTER. §9 schema + ERD byte-synced.
- **RBAC** — `PROGRAM_ROLES` + `hasProgramAccess(user)` in `src/lib/rbac.js` (mirrors
  `hasLeaderboardAccess`).
- **Schemas** — new `src/lib/schemas/program.js`; `teamFields` gained `programId` (cuid nullish);
  `rollupDigestBodySchema` gained optional `programId`.
- **API** — `src/app/api/programs/route.js` (GET `hasProgramAccess` + POST admin) +
  `[programId]/route.js` (PATCH/DELETE admin). Association reuses team PATCH. ai-digest re-scopes.
- **Data loader** — `getRollupData({ programId })` swaps the team-set source only; returns
  `programs`/`selectedProgram`/`canViewPrograms`. Byte-identical with no `programId`.
- **UI (impeccable)** — program `<Select>` + program-aware hero on `/rollup`; self-contained
  `programs-config.jsx` admin section + Program `<Select>` in `team-config-dialog.jsx`.

## Notes

- **§12 metric core is sacred** — `metrics.mjs`/`aggregateRollup` are **untouched**; a program
  roll-up reuses `aggregateRollup` (it already sums per-team metrics). Additive only.
- **`prisma-change`:** the migration is pure additive (new table + nullable FK + index; no enum
  `ALTER TYPE`). Keep §9 byte-consistent (done).
- **Counts stay honest:** **+2 routes** (`/api/programs`, `/api/programs/[programId]`) → **49 ƒ
  Dynamic** (from 47); **one additive migration (11 → 12)**.
- **Post-migration hazard hit + resolved:** `prisma migrate dev`'s client regen didn't stick and the
  long-running dev server held a stale client (`prisma.program` undefined) → explicit `yarn
  db:generate` + dev restart fixed it. Always regenerate + restart before smoke-testing after a
  migration (see hazards below).

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-12)**
- **Baseline invariants to preserve:** `main` @ `52d5fc0` ("Need attention." — the
  `needs-attention-roster` feature is now MERGED) = **47 ƒ Dynamic** routes / **11 Prisma migrations**
  (…`add_member_emails_and_needs_attention_workflow`). This feature (`feature/program-rollup`) adds
  **2 routes** (`/api/programs`, `/api/programs/[programId]`) → **49 ƒ Dynamic**, and **one migration
  (11 → 12, `add_program_model`)**. Node 22, dev on **:3002**. A feature that changes either count
  must say so and justify it — this one does (program CRUD needs its own routes; team↔program
  association reuses the existing team PATCH).
- **`main` is at `52d5fc0`** ("Need attention."). Main includes the bug-board arc (enhancing-bug-board,
  bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency), the unplanned-split,
  sync-stages, default-team-release, needs-attention-roster, AND the office-deployment work
  (`Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health` / `DEPLOY.md`; must land
  on `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **This feature is on `feature/program-rollup`** (off `main` @ `52d5fc0`). It adds migration #12
  (`add_program_model`) and 2 routes under `src/app/api/programs`.
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
