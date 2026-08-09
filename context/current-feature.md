# Current Feature

**Bug Board — group bugs by Sprint ownership (ours vs dependencies)**
(@context/features/bug-sprint-ownership.md) — the next follow-on in the `/bugs` arc, on the same
`feature/enhancing-bug-board` branch (uncommitted, tightly coupled). Within each scope
(External/Internal/All), call out and group bugs by their Jira **Sprint field**: **ours** (sprint
name matches a per-report pattern like `GM-*`) vs **dependencies** (other teams' sprints) vs **no
sprint** — config-driven per report. Post-v1, not a master-plan step.

**Also uncommitted on this branch (Done, pending Naveen's commit):** enhancing-bug-board.md (scope
toggle + Bugs-by-scrum-team drill) and bug-report-pdf-export.md (landscape executive PDF; finish gate
2026-08-04 — lint clean, 8 migrations, cold DB/env-free build green 44 ƒ Dynamic). Stray untracked
`output/` and `tmp/` dirs from a parallel session should be cleaned/ignored before committing.

## Status

**Done + verified 2026-08-04** (branch `feature/enhancing-bug-board`, **uncommitted**). Full spec +
As-built notes: @context/features/bug-sprint-ownership.md.

**Verified:** `yarn lint` clean; **50/50 plain-Node fixtures** + a `paginateTeamAppendix` regression;
`prisma migrate status` up to date (**9 migrations**); **cold `rm -rf .next` DB/env-free build green —
44 ƒ Dynamic unchanged** (no new routes); impeccable design hook clean on every changed component;
**live real-Jira refresh + SSR on the real `gm` report** — set `GM-*`, refresh tagged **145/233** bugs'
`jiraSprintName` → **Ours 136 · Dependencies 9 · No sprint 88**, and read-time reclassification proven
across pattern changes with **no refresh** (`GM-*, AEP-*` → 141/4/88; `AEP-*` → 5/140/88; empty →
hidden). The `gm` report is left configured with `GM-*` (the requested pattern).

**Next:** commit on Naveen's go-ahead (this + enhancing-bug-board + PDF all ship together from the
same branch; clean the stray `output/`/`tmp/` dirs first); then Naveen's authed visual pass + a
real-browser PDF export to see the ownership appendix. Deferred post-v1 ideas remain (export-embedded
AI narrative, AI Q&A, stage suggestions, a share link for `/bugs`, leaderboard rank-delta arrows).

**Branch decision (Naveen, 2026-08-04):** **stayed on `feature/enhancing-bug-board`** — `HEAD == main
== ad6cdb7`, the enhancing-bug-board + PDF work is uncommitted here, and this feature builds directly
on it (same `/bugs` page, KPI cards, PDF export, `refresh.js`, `schema.prisma`), so a fresh branch
off `main` would isolate nothing.

Within each scope (External/Internal/All), the page gains a config-driven **"ours vs dependencies"**
grouping keyed on the Jira **Sprint field** — a per-report `sprintOwnershipPattern` (e.g. `GM-*`):
1. **Ours** (sprint name matches the pattern) → **Dependencies** (has a sprint, no match) → **No
   sprint** (field empty, its own group + a hygiene signal). Ours in accent, Dependencies in warn.
2. Surfaced as a **drill section** (bucket → sprint → inline issues, Jira links) **+ a top KPI card**,
   both scope-toggle-aware for free, **plus an appendix in the PDF export** (clickable links).
3. **Read-time, config-driven** (mirrors the by-team join): new raw-fact column
   `BugReportIssue.jiraSprintName`, computed against the pattern at read time — a config edit
   re-renders instantly, no Jira refresh needed.

## Goals

- **(a) Schema** — `BugReportIssue.jiraSprintName String?` (raw fact) + `BugReport.sprintOwnershipPattern
  String?` (config); migration `add_bug_report_sprint_ownership`; §9 byte-synced. `prisma/schema.prisma`.
- **(b) Refresh** — new pure `src/lib/bug-report/sprint-field.mjs` (`resolveSprintFieldId`,
  `extractSprintName`, `DEFAULT_SPRINT_FIELD`); `refresh.js` resolves the sprint field id (env
  `JIRA_SPRINT_FIELD_ID` → `/field` discovery → `customfield_10020`), appends to `issueFields`, sets
  `jiraSprintName` in `toBugIssueRow`; documented in `.env.example`. Missing field → null, never throws.
- **(c) Pure logic** — new `src/lib/bug-report/sprint-ownership.mjs` (`compileSprintMatcher`,
  `groupBySprintOwnership`), reusing `isBreached`/`daysOverSla` from `matrix.mjs`.
- **(d) Read path** — `src/lib/bug-report-data.js`: `buildView` adds `bySprintOwnership` (no extra query).
- **(e) UI** — new `src/components/bugs/bug-sprint-ownership-section.jsx` (clone `bug-team-section.jsx`:
  split-header + bucket → sprint → issue drill); `ownership` card in `bug-kpi-cards.jsx`; wire both +
  `exportViews` in `bugs-page.jsx` (section directly under the matrix). No new routes/pages (44 ƒ
  Dynamic unchanged).
- **(f) PDF** — ownership appendix in `bug-export-dialog.jsx` + pagination in `pdf-layout.mjs`.
- **(g) Config** — `sprintOwnershipPattern` in `bugReportConfigSchema` (`src/lib/schemas/bug-report.js`),
  persisted in the config PUT route, edited via a new "Sprint ownership" section in
  `src/components/admin/bug-report-config.jsx`.

## Notes

- **Read installed docs first** (versions differ from training data): Prisma 7 additive migration
  (`prisma-change` skill, `yarn db:migrate`, never `db push`); Next 16 RSC server-component-as-prop
  pattern (reuse the existing `bug-scope-view.jsx` slot mechanism — the section lives in the
  per-scope pre-rendered body subtree); Tailwind v4 `@theme`.
- **Matcher semantics** — `*` wildcard; a pattern with no `*` ⇒ prefix; comma/newline-separated
  patterns OR'd; case-insensitive, anchored.
- **Sprint field id ≠ JQL display name** — the REST `fields` param needs `customfield_XXXXX`; resolve
  env `JIRA_SPRINT_FIELD_ID` → `/field` discovery (name/clause "sprint") → `customfield_10020`.
  `extractSprintName` (ported from `transform.js:67-81`) handles array-of-sprints / single object /
  legacy `name=...` string / null defensively.
- **Read-time derivation, config-driven, hidden when unset** — cache stays a dumb Jira mirror; a
  config edit re-renders instantly (matrix.mjs / by-team.mjs precedent). `metrics.mjs`/`IssueProgress`/
  sprint data untouched (§12 purity). Existing cached bugs read "No sprint" until the next Refresh
  repopulates `jiraSprintName`.
- **Bug cache has `assigneeName` but no `assigneeAccountId`** (unchanged) — not needed here; grouping
  is by sprint, the drill sub-level is by sprint name.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-08-09)**
- **Baseline invariants to preserve:** **44 ƒ Dynamic** routes, **9 Prisma migrations**, Node 22,
  dev on **:3002**. A feature that changes either count must say so and justify it.
- **Uncommitted on `feature/enhancing-bug-board`:** four coupled features ship together —
  enhancing-bug-board, bug-report-pdf-export, bug-sprint-ownership, export-visual-consistency
  (`HEAD == main == ad6cdb7`). Clean the stray `output/` and `tmp/` dirs before committing.
- **Uncommitted on `feature/office-deployment`** (off `main`, parallel/unrelated): office-infra
  deployment — `Dockerfile` / `.dockerignore` / `output:"standalone"` / `GET /p/health` / `DEPLOY.md`
  (adds one route → **45 ƒ Dynamic on this branch**). Done + verified 2026-08-09; see
  context/features/office-deployment.md. Must land on `tekion-apps/storyboard` `main` for DevOps to
  build (RELB-28979).
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
  real-browser visual pass is always **Naveen's** acceptance step).
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

**Open post-v1 backlog (deferred, not forgotten)**
- Export-embedded AI narrative · AI Q&A over sprint data · AI stage suggestions · a share link for
  `/bugs` · leaderboard rank-delta ("moved since last sprint") arrows.

## History

The full chronological development log (legacy Vite/Express era through the entire Next.js
migration and every post-v1 feature) has been archived to
[legacy-history.md](legacy-history.md) to keep this file focused on the current feature.

Append new "Done" entries there, earliest → latest.
