# Current Feature

**SOW tracker — a phase-journey view for fixed-timeline projects at `/sow`**
(@context/features/sow-tracker.md). One page per SOW / program project (first: **Configurator AI**,
Jira filter 71390), outside every scrum board: a phase stepper with gate milestones, a weighted
progress % whose epics roll up from their children, tickets auto-classified into kinds, manual
tracker rows, risks, cross-team dependencies, a PDF export and a public share link. Post-v1
feature (not a migration-plan step), picked because the Configurator AI SOW is in flight and is
tracked in a pptx today.

## Status

**Done 2026-11-12 · verified · uncommitted**, on `feature/GM-11784-sow-tracker` (Jira **GM-11784**),
now in the **main checkout** (moved from the worktree `.claude/worktrees/sow-tracker` by patch,
identical tree; the worktree is detached and can be removed once the commit lands). Cut from `main`
@ `9d53308`.
- **Verification (2026-11-12):** lint 0; 17 migrations, up to date, no drift; cold env-free Node 22
  build **80 ƒ / 0 warnings**; **36/36 pure fixtures**; `next start` smoke **19/19**, including 403
  on every admin write for a throwaway non-admin (deleted, 0 left).
- **Done (Naveen 2026-11-11):** the authed pass and the PDF.
- **Pending:**
  - Naveen's commit and PR "GM-11784 - Feature/sow tracker";
  - running the migration-17 office bundle
    (`output/storyboard-dba-migration-2026-11-11-add_sow_tracker/`, 00 → 01 → 02 → 02b) before the
    image rollout;
  - connector 1.2.1 on his laptop.

**Next:** Naveen commits and runs the migration-17 bundle. Then the carried-over items: the
security-tracker parity check against the artifact and `workbenchUrl`, then PR 2
(`feature/security-tracker-updates`). SOW follow-ups parked in the spec: nightly Slack sync and a
PNG export.

## Previous feature goals (Support on-call)

- **Schema** (`prisma/schema.prisma`): `Sow`, `SowPhase`, `SowPlanItem`, `SowRisk`, `SowIssue`,
  `SowSnapshot`, `SowShare`; migration 17 `add_sow_tracker`.
- **Pure logic** (`src/lib/sow/*.mjs`): kind rules, weighted progress + epic roll-up, timeline
  (phase state, slip, health), the standard template.
- **Zod** (`src/lib/schemas/sow.js`).
- **Server** (`src/lib/sow/{refresh,data,write}.js`): mirror refresh, page loader, writes.
- **API** `api/sows/**`: create/duplicate, patch/delete, refresh, plan PUT, risks PUT, shares.
- **Pages** `/sow`, `/sow/[slug]`, public `/sow/share/[token]`; **components** `src/components/sow/*`.
- **Export** (A4 landscape) on the shared export kit.
- **Wiring:** sidebar item, daily cron step, create-only seed of Configurator AI.

## Notes

- **Mirror = raw Jira facts only**; kind, dependency flag and progress are read-time.
- `statusCategory` is stored as Jira's **key** (`new` / `indeterminate` / `done`).
- **Dates are calendar days** (UTC midnight in the DB, compared as `YYYY-MM-DD` in IST).
- Any signed-in user reads; **global admins** write. The share page reads by token only.
- Invariants this moved: **67 → 80 ƒ Dynamic**, **16 → 17 migrations**.
- **Slack is read by an admin's Claude Connector** (job kind `SLACK_SYNC`, connector 1.2.1); the
  server has no Slack token. Set `SLACK_WORKSPACE_URL` for thread links.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-09-04)**
- **Baseline invariants to preserve:** **80 ƒ Dynamic** routes / **17 Prisma migrations** once
  `feature/GM-11784-sow-tracker` merges (…`add_sow_tracker`, 2026-11-10/11: 3 pages + 10 API routes, +1 migration);
  `main` is at 67 / 16
  (…`add_support_oncall`, 2026-10-24: `/oncall` + its PUT route, +1 migration, on top of 65 / 15 at
  …`add_security_tracker`, 2026-10-20). The path there: 50 / 13 through `add_error_log`, then the
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
  - **Office DB head:** 16 migrations (`…add_support_oncall`), confirmed by Naveen 2026-11-11.
    *(It was 15 (`…add_security_tracker`) as of 2026-11-01; the bundle for 16 has since been run.)*
  - The bundle for 17 (`…add_sow_tracker`, + `02b-seed.sql` creating the Configurator AI SOW) is
    generated and rehearsed (2026-11-11,
    `output/storyboard-dba-migration-2026-11-11-add_sow_tracker/`) and **pending Naveen's run**.
    Once he confirms it, update this head to 17.
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
- 2026-10-24 — Picked context/features/support-oncall.md as the current feature (per-sprint Support POCs + Primary, `/oncall` directory with a bug pulse).
- 2026-10-24 — **Implemented the Support on-call directory.**
  - **What shipped:**
    - `SupportPoc` (team, sprint) + `Team.onCallHeadcount` (migration `add_support_oncall`, **16**);
    - pure `lib/oncall/{rotation,pulse}.mjs`;
    - the replace-all `PUT …/oncall` (`TEAM_MANAGER_ROLES`, cap, ≤ 1 Primary, CLOSED → 409);
    - the batched `getOnCallData` (roster sent only to editors);
    - `/oncall` with program-grouped cards (Primary first, tel/mailto/copy, modules, bug pulse "as on
      the board", search, sprint picker, `?team=` focus ring);
    - the edit dialog, admin headcount field, sidebar item and board-hero "On call" chip;
    - `phone` on the redactor list.
  - **Verification:**
    - lint 0; 16 migrations up to date;
    - cold env-free Node 22 build: **67 ƒ**, 0 warnings;
    - 12 pure fixtures + 7 zod checks; **28/28 API/page smoke** (incl. a live-team pulse equal to an
      SQL hand count);
    - phone redacted in `ErrorLog`;
    - 24 headless renders with 0 overflow and 0 errors.
  - **As-built:**
    - stacked on `feature/modern-artifact-theme` (not yet merged);
    - the rotation window is local-time because IST-midnight dates read a day early in UTC;
    - plain program headings rather than `ProgramChip`;
    - no mobile top-bar link (gap noted).
  - **Done.**
  - **Next:** Naveen's authed pass and commit, then the migration-16 DB bundle.
- 2026-10-25 — **Extended the on-call feature (Naveen).**
  - **What shipped:**
    - an `/oncall` program picker (client-side filter, `?program=`, opens on the viewer's own
      program, search spans all programs);
    - `RosterContact` (email-keyed name + phone), folded into migration 16 after reverting it on
      Neon (0 rows lost; still 16 migrations), saved through the team POST/PATCH as
      `rosterContacts` in one transaction;
    - a "Contact details" list in the admin team dialog;
    - a "Person" picker in the POC dialog (roster ∪ members, signed in or not; a pick fills name +
      phone; duplicates disabled; "Someone not on the roster…" for typed emails);
    - the shared `Select` rebuilt as a themed drop-in across all 30 dropdowns (portal list, filter
      box above 8 options, hints, keyboard, Esc-safe inside dialogs), plus `aria-label`s on three
      admin selects that had none.
  - **Verification:** lint 0 on `src/`; env-free Node 22 build 67 ƒ / 0 warnings; 18/18 roster
    API + loader checks; 28/28 on-call smoke; 23/23 program-picker checks; headless picker,
    admin-dialog and dialog-dropdown flows; app-wide dropdown sweep at 390/1440 in both themes;
    redaction re-checked; fixtures torn down to 0.
  - **Noticed, not changed:** 10 §9 models differ from `schema.prisma` in comment wording only
    (fields identical, already on `main`); `yarn lint` also scans `.claude/worktrees/` from another
    session (794 problems there, 0 in `src/`).
  - **Next:** Naveen's authed pass and commit; the migration-16 office bundle (now including
    `RosterContact`).
<<<<<<< HEAD
- 2026-11-10 — Planning session with Naveen (three question rounds): drafted @context/features/sow-tracker.md and picked it as the current feature (SOW phase-journey tracker at `/sow`; first SOW Configurator AI).
- 2026-11-10 — **Built the SOW tracker (two rounds).**
  - **Round 1:** `Sow` + phases, plan items, risks, a raw Jira mirror, snapshots and share links
    (migration `add_sow_tracker`, **17**); pure `lib/sow/*.mjs` (kind rules, weighted progress with
    epic roll-up, timeline, template); refresh on the service credential; create / duplicate,
    settings, plan and risks dialogs; public share link; landscape PDF; sidebar item; cron step;
    Configurator AI seeded from the deck (Option 1 dates) and refreshed from filter 71390.
  - **Round 2 (Naveen's feedback):** the page became a visual overview — date-scaled timeline,
    progress vs plan, scope map, issue funnel, people load, watch list — with a drill-in panel
    behind every tile; pre-QA issues read from Slack through the Claude Connector (`SLACK_SYNC`,
    connector 1.2.0) with reaction-based status and an admin override; a reading list of the
    Confluence folder and repos.
  - **Verification:** lint 0; 17 migrations, no drift; env-free build **79 ƒ**, 0 warnings; 28
    fixtures; smoke 51/52 + 21/21; real Jira refresh and real Slack sync; headless renders clean.
  - **As-built:** credit by Jira status name (Groomed counted as in-progress by category);
    PDF only, no PNG; a real PDF download not checked.
  - **Next:** Naveen's authed pass and commit; the migration-17 office bundle; then the parked
    multi-channel feed and Ask grounding.
- 2026-11-11 — **SOW tracker round 3 (Naveen's review).** Progress chart drawn at real pixel size
  (it scaled its text with the panel) and its two-reading NaN path fixed; distinct watch-list
  colours for risks and dependencies; Slack attachments kept per post with a Claude-written
  description of each issue screenshot and an "Open in Slack" link (connector ceiling now three
  read-only Slack tools; no image stored); an empty Slack read now fails instead of stamping a
  sync. Verified: 32 fixtures, share-page privacy, chart at three widths, lint 0, no drift,
  env-free build 79 ƒ / 0 warnings. Next: unchanged (authed pass, commit, migration-17 bundle).
- 2026-11-11 — Sidebar "Settings" renamed **"Claude Code"** with a live Connected / Not connected
  indicator (`use-connector-status.js`, polls `GET /api/me/connector` every 20 s); `/settings` hero
  and title follow, URL unchanged. Done on `feature/GM-11784-sow-tracker` alongside the SOW work. Verified:
  lint 0; headless renders of connected, not-connected and collapsed states in both themes.
- 2026-11-11 — **SOW docs-and-decisions channels (round 4).** Extra Slack channels per SOW read
  only for decisions and shared documents (`SowFeedItem`, folded into migration 17); one Sync
  Slack runs every channel in sequence; empty reads fail and retry once; Decision log drawer and
  "Shared in Slack" docs, admin Hide / Restore. Configurator AI has #configurator-ai and
  #configurator_ai_oem_agentic_framework. Verified: real three-channel syncs, 37 fixtures, smoke
  11/11, lint 0, no drift, env-free build 80 ƒ / 0 warnings.
- 2026-11-11 — **SOW round 5: Ask StoryBoard + Slack fixes.** Ask StoryBoard gets a `sow` data pack
  and, for SOW questions, a DeepContext round over the SOW's Confluence pages, repos and Jira.
  Empty Slack reads root-caused (claude.ai connectors connect in the background) and fixed in
  connector 1.2.1 (`MCP_CONNECTION_NONBLOCKING=false`); decisions and docs now accumulate across
  syncs with a weekly full re-read. Verified: lint 0, no drift, env-free build 80 ƒ / 0 warnings,
  live Ask answers via connector and provider, a live three-channel sync on 1.2.1.
- 2026-11-11 — Office DB bundle for migration 17 generated and rehearsed
  (`output/storyboard-dba-migration-2026-11-11-add_sow_tracker/`, + `02b-seed.sql` for the
  Configurator AI SOW): REHEARSAL PASSED; the seed's GM program link checked on dev in a rolled-back
  transaction. Office head confirmed at 16 by Naveen. Pending his run, before the image rollout.
- 2026-11-11 — **SOW round 6: primary Confluence pages for Ask.** "Repositories, Services and
  Request Templates" and "Configurator – An Overview" are primary sources: read on every Refresh
  Jira into `Sow.knowledge` (folded into migration 17) and sent to Ask by matching section; the 16
  real repos (with notes) and the stage/preprod/prod links join the reading list. Office bundle
  regenerated and re-rehearsed (REHEARSAL PASSED). Verified: 46 fixtures, lint 0, no drift,
  env-free build 80 ƒ / 0 warnings, four live Ask answers grounded from the pages.
- 2026-11-11 — Jira **GM-11784** "StoryBoard - SOW Tracker" created (Tech Story under GM-9485, DR_GM) for the commit and PR; `Task` is now restricted to Delivery Managers in GM.
- 2026-11-12 — **Implemented the SOW tracker (GM-11784).**
  - **What shipped:** `/sow`, `/sow/[slug]` and `/sow/share/[token]` over migration 17
    `add_sow_tracker` (9 models), pure `lib/sow/*.mjs`, 10 `/api/sows/**` routes, the `SLACK_SYNC`
    connector job (1.2.1), docs-and-decisions channels, a reading list with StoryBoard's own copy of
    the primary Confluence pages, the Ask `sow` pack and SOW deep round, and the sidebar
    "Claude Code" item with a connection dot.
  - **Verification:** lint 0; 17 migrations, no drift; env-free build 80 ƒ / 0 warnings; 36/36
    fixtures; `next start` smoke 19/19 incl. non-admin 403s; earlier rounds' live Jira, Slack and Ask
    runs and headless renders.
  - **As-built:** status-name credit before category; migration 17 amended four times on dev by
    `ALTER` + checksum (never left dev; bundle regenerated); connector 1.2.1 for Slack; PDF only;
    branch renamed to carry the Jira key and moved from the worktree to the main checkout.
  - **Done.**
  - **Next:** Naveen's commit and PR; the migration-17 office bundle; connector 1.2.1.
=======
- 2026-11-05 — **Fix: Sync Jira honours completed and Blocked Jira statuses** (sync-jira-status-rules.md). Completed statuses check every stage (new rows, per-track Sync stages, and a forward-complete of existing rows on Sync Jira); Jira Blocked → `blocked` with reason "Blocked in Jira", lifted only when the sync set it. 13/13 fixtures, env-free build 67 ƒ / 0 warnings, no migration. **Next:** Naveen's authed sync and commit.
- 2026-11-05 — **Same rules in the per-track Sync stages (Naveen).** The Blocked rule is shared (`resolveBlockedRule`); a Blocked status keeps its stages and is no longer reported as unmapped. 15/15 fixtures, env-free build 67 ƒ / 0 warnings.
- 2026-11-10 — **Implemented the Sync Jira status rules fix** (sync-jira-status-rules.md).
  - **What shipped:** `COMPLETED_JIRA_STATUSES` / `BLOCKED_JIRA_STATUSES` / `JIRA_BLOCKED_REASON`
    + `resolveBlockedRule` / `resolveStatusRules` in `lib/sync/seeding.mjs`; both
    `syncTeamSprint` and `syncFilterStagesFromJira` apply them; toast counts on the board.
  - **Verification:** `eslint src` 0; schema valid, 16 migrations up to date; clean env-free build
    67 ƒ / 0 warnings; 15/15 fixtures; **31/31 runtime smoke** (real Jira read-only + Neon, `next
    start` of a scratch copy: 401s, forward-complete, Blocked set / hand block kept / own block
    lifted, idempotent re-sync, Sync stages parity); torn down to 0 rows.
  - **As-built:** Done / Closed / Released added to the six requested statuses; status-derived
    writes reset `updatedById`; live Jira had moved two fixture issues to UAT / Done, so the smoke
    asserts on live status; §14.13's provenance gap now covers the always-on sync too (noted).
  - **Done.**
  - **Next:** Naveen's authed pass and commit; the migration-16 office bundle.
>>>>>>> tekion/main
