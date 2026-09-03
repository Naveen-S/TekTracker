# Current Feature

**Editable sprint filters (tracks)**
(@context/features/editable-filters.md) — a board track could be added, removed and reordered but
never **corrected**: a typo, a repointed Jira filter, a JQL needing one more clause, or a track
created under the wrong workflow all forced delete-and-recreate, losing its place in the order and
its accent colour. A pencil on each Connected-JQL card now opens the *same* dialog that creates a
track, prefilled.

Almost entirely UI: `PATCH …/filters/[filterId]` shipped at step 4 (`domain-apis.md`) and had **no
caller** until now. Three ratified calls: the pencil lives on the **sidebar card**; **name, source
(Filter ID ↔ JQL), workflow type and accent colour** are all editable; and the board **re-syncs only
when the source or workflow type changed** — a rename or recolour is a lone PATCH. Post-v1, not a
master-plan step.

## Status

**Done 2026-09-02 — verified twice, uncommitted** (branch `feature/editable-filters`, off `main` @
`e6fd115`). Pending Naveen's commit (gitleaks hook). Full spec + As-built:
@context/features/editable-filters.md.

**Re-verified 2026-09-02 from scratch** — the first pass's scratch harnesses were gone, so the suite
was **re-derived from the source rather than replayed**: `yarn lint` clean · **pure fixtures 25/25** ·
**API smoke 29/29** · **headless browser 10/10** · `prisma validate` valid + **12 migrations, up to
date** · cold `rm -rf .next` build with both env files aside → exit 0, **no `Environments:` line**,
**49 ƒ Dynamic** · Neon left at **42 filters, 0 fixture rows**. The load-bearing claim reproduced
independently: a rename puts **exactly one `PATCH` and no `POST …/sync`** on the wire. Two checks the
rewrite added: **global admin is not a carve-out** on the `NEEDS_ATTENTION` guard (it sits after RBAC
and before `parseJsonBody`, so an admin edit of that track is a 400 too — deliberate, it is generated
data), and **`sortOrder` survives a workflow change**, not merely a rename.

**Implemented:** `filter-dialog.jsx` (the renamed `add-filter-dialog.jsx`, generalized to
`FilterDialog` — create + edit, accent swatch row, stage-shrink warning) · `lib/filters/edit.mjs`
(pure `buildFilterPayload` / `buildFilterPatch`) · pencil in `filter-panel.jsx` · `editingFilter` +
`handleEditFilter` in `dashboard.jsx` · `NEEDS_ATTENTION` guards on the PATCH route.

**Verified (first pass, 2026-08-28):** `yarn lint` clean · **pure fixtures 23/23** (every produced body re-parsed through the
real `filterCreateSchema`/`filterPatchSchema`) · **API smoke 23/23** on dev + Neon with minted
iron-session cookies (NA guards both directions → 400 · MEMBER *and* VIEWER → 403 · cross-team id →
404 · anonymous → 401 · fixtures torn down to 0 rows) · **headless browser 28/28** (viewer sees no
pencil; prefill; shrink warning with both stage counts; save renames the sidebar card *and* the
matrix header, repaints the accent dot, persists; Cancel discards) · **exactly one PATCH and no
`POST …/sync` on the wire for a rename** — the direct evidence for decision 3 · cold `rm -rf .next`
DB/env-free build with `.env` **and** `.env.production` moved aside → exit 0, **49 ƒ Dynamic
(unchanged)** · `prisma migrate status` **12 migrations (unchanged)**.

**Three findings worth carrying forward:** (1) the planned payload rule was wrong — always nulling
the unused source column would have **wiped the sync-resolved `jql` off every JIRA_FILTER track on a
plain rename**, blanking the card's query line until the next sync; the two columns are deliberately
asymmetric now. (2) `tsx` can only import `src/lib/schemas/*.js` with `--tsconfig jsconfig.json`
**and** `const mod = await import(…); mod.default ?? mod` — worth the trouble, since it let the
fixtures validate against the real zod schemas rather than a hand-copied shape. (3) The success
toast can be **swallowed on a slow dev refresh** (deferred behind the second `startMutation` while
its own 3s dismiss timer runs from call time; dev refreshes measured 3–4s) — pre-existing and shared
with `handleAddFilter`/`handleSaveRiskComment`, so it was recorded, not "fixed".

**Next:** Naveen's commit. The tree holds **two** finished features — editable filters and the
2026-08-29 export type-weight pass (`print-kit.jsx`, `rollup-export-pages.jsx`, `rollup-export.md`) —
so it is two commits, not one. Visual acceptance in a real browser is his step.

## Goals

- **One dialog for both modes** — `FilterDialog`, so create and edit can never drift apart in
  validation, copy or layout.
- **`buildFilterPayload` shared by create and edit** (`src/lib/filters/edit.mjs`), so the body
  shape is written once.
- **`needsResync` as an explicit verdict**, not an implicit "always sync" — the rename path must
  not pay for a Jira round-trip.

## Notes

- **§12 metric core untouched** — no schema change, no new route, no migration (49 ƒ Dynamic / 12
  migrations, both unchanged).
- **The two source columns are asymmetric on purpose.** A JQL track sends `jiraFilterId: null`
  (`buildJiraSearchUrl` prefers the id, so a leftover one mislinks the card); a JIRA_FILTER track
  does not send `jql` at all (that column is the JQL sync last resolved *from* the filter — derived
  display data, not user input).
- **`sortOrder` is deliberately not re-derived** when the workflow type changes: priority insertion
  is a create-time concern, order is user-owned once dragged.
- **The stage re-shape still happens in sync**, not in the PATCH — `reshapeStageCompletion` in
  `syncTeamSprint` step 4. The dialog only *warns* when the new workflow has fewer stages.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-09-02)**
- **Baseline invariants to preserve:** **49 ƒ Dynamic** routes / **12 Prisma migrations**
  (…`add_program_model`). Node 22, dev on **:3002**. A feature that changes either count must say so
  and justify it. Nothing since the board-polish round has — not the roll-up export (incl. the
  Velocity variant), not the sync P2028 fix, not editable filters.
- **`main` is at `e6fd115`** ("Roll up export.", on top of `ac606eb` "Polish.") — it carries the
  whole roll-up export **and** the sync-stages P2028 fix + the `Security Validation` seed row, which
  Naveen committed together. Main also includes the bug-board arc (enhancing-bug-board,
  bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency), the unplanned-split,
  sync-stages, default-team-release, needs-attention-roster, program-rollup, AND the
  office-deployment work (`Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health` /
  `DEPLOY.md`; must land on `tekion-apps/storyboard` `main` for DevOps to build — RELB-28979).
- **The working branch is `feature/editable-filters`**, cut from `main` @ `e6fd115`, carrying **two**
  finished-but-uncommitted features in one tree: editable filters, and the 2026-08-29 export
  type-weight pass (`src/components/export/print-kit.jsx`,
  `src/components/rollup/rollup-export-pages.jsx`, `context/features/rollup-export.md`). Both are
  verified; they are **two commits**, not one. `add-filter-dialog.jsx → filter-dialog.jsx` is already
  staged as a rename — keep `git mv`'s rename detection intact when staging the rest.
- **A track edit re-syncs only when it changes what the track pulls** (`lib/filters/edit.mjs` →
  `buildFilterPatch().needsResync`). `buildFilterPayload` is the SINGLE body shaper for both the
  create and patch routes — send new filter fields through it, and mind that the two source columns
  are asymmetric on purpose (a JIRA_FILTER track's `jql` is sync-owned derived data; never null it).
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
