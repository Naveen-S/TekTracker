# Current Feature

**Fix: Sync Jira honours completed and Blocked Jira statuses**
(@context/features/sync-jira-status-rules.md, **GM-11768**). The top-level Sync Jira completes the checklist of
any issue in UAT, Testing, Support Validation, Support Clarification, Won't Fix or Not Applicable
(plus Done / Closed / Released), and a Jira "Blocked" status turns the issue's health Blocked. The
per-track "Sync stages" applies the same rules (Naveen, 2026-11-05).

## Status

**Done 2026-11-10 · verified · uncommitted** on `fix/GM-11768-sync-jira-status-rules` (off `main` @ `9d53308`).
- **Verification:** `eslint src` 0; `prisma validate` + `migrate status` up to date (**16
  migrations, no schema change**); clean env-free Node 22 build exit 0, **67 ƒ**, 0 warnings;
  **15/15 pure fixtures**; **31/31 runtime smoke** against real Jira + Neon on a throwaway team,
  torn down to 0 rows.
- **No office DB bundle needed** (no migration, no seed change).
- **Pending:** Naveen's authed Sync Jira / Sync stages on a real team; the commit.

**Next:** Naveen commits this fix and runs the still-pending migration-16 office bundle (Support
on-call), then the carried-over security-tracker items (parity check, `workbenchUrl`, PR 2).

The previous feature (Support on-call) merged to `main` as `9d53308` (#9); its migration-16 office
bundle is still pending Naveen's run (see Carry-forward).

## Previous feature goals (Support on-call)

- **Schema** (`prisma/schema.prisma`): `SupportPoc` (team, sprint) + `Team.onCallHeadcount`;
  migration 16.
- **Pure logic** (`src/lib/oncall/rotation.mjs`, `pulse.mjs`): current rotation, window label,
  cap, bug pulse.
- **Zod** (`src/lib/schemas/oncall.js`, `team.js`): list rules (≤ 1 Primary, unique emails, ≤ 50).
- **API** `PUT /api/teams/[teamId]/sprints/[sprintId]/oncall`: replace-all, `TEAM_MANAGER_ROLES`,
  cap, CLOSED → 409.
- **Loader** (`src/lib/oncall/data.js`): every team, batched; editor-only suggestions.
- **UI**: `/oncall` (`src/app/oncall/*`, `src/components/oncall/*`), edit dialog, admin headcount
  field, sidebar item, board-hero chip.
- **Redaction** (`src/lib/log.js`): `phone` on the key list.
- **Roster contacts** (`RosterContact`, `src/lib/teams/roster-contacts.js`, team POST/PATCH,
  admin dialog) + the POC member picker; **themed `Select`** (`src/components/ui/select.jsx`).

## Notes

- **Sprint dates are IST midnights stored as 18:30Z.** Format sprint dates in local time (like
  `formatDate`); a UTC-pinned label reads one day early.
- **A running dev server caches the Prisma client.** After a migration, it throws "Unknown field"
  until restarted. Smoke against a scratch-copy `next start` instead of stopping Naveen's server.
- **The on-call PUT never logs its body**; `phone` redaction is the safety net.
- **Viewers never receive a team's roster:** `suggestions` is null unless `canEdit`.

## Carry-forward — critical for any new feature

Durable, cross-cutting knowledge distilled from the archived log so it isn't missed. (One-off
details live in [legacy-history.md](legacy-history.md); house conventions live in `CLAUDE.md` +
`context/coding-standards.md` + `context/ai-interaction.md` — this is the operational hard-won
layer that sits between them.)

**Repo / branch state (2026-09-04)**
- **Baseline invariants to preserve:** **67 ƒ Dynamic** routes / **16 Prisma migrations**
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
  - **Office DB head:** 15 migrations (`…add_security_tracker`), confirmed by Naveen 2026-11-01.
    *(It was 14 (`…add_claude_connector`) as of 2026-10-20; the bundle for 15, + `02b-seed.sql`,
    has since been run.)*
  - The bundle for 16 (`…add_support_oncall`, incl. `RosterContact`) is generated and rehearsed
    (2026-11-01, `output/storyboard-dba-migration-2026-11-01-add_support_oncall/`) and **pending Naveen's run**. Once he confirms it, update this
    head to 16.
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
