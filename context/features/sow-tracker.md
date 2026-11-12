# SOW tracker — a phase-journey view for fixed-timeline projects (`/sow`)

## Overview

A SOW / program project runs on a **fixed timeline** (Dev end → Internal QA → UAT → Private Prod →
Go/No-Go → launch) and spans epics, stories, tech stories, RELB tickets, QA bugs, UAT issues and
other teams' tickets. No scrum board shows that in one place; today it lives in a pptx
(`context/SprintTracker - Project Spec/ConfiguratorAI_High_Level_Project_Plan.pptx`, with Naveen's
notes in `SOW.jpg` / `SOW2.jpg`). This feature adds `/sow`: one page per SOW showing where the
project is on its journey, a weighted progress number, and every kind of ticket grouped clearly.
The first SOW is **Configurator AI** (Jira filter 71390).

Post-v1 feature, not a migration-plan step. Touches project-overview §5, §9, §11, §13, §16.

> **Third non-sprint read path** (after `/bugs` and `/security`), on the same shape: an admin
> config row, a replace-on-refresh mirror of **raw Jira facts only**, read-time classification in
> pure modules, a daily snapshot. A SOW sits **outside every scrum board**: it joins nothing in the
> sprint spine, and §12 metrics are untouched. After a successful pilot the work moves to a scrum
> team's regular Roadmap track; the SOW is then marked Completed.

## Status

**Done 2026-11-12.** Jira **GM-11784**, branch `feature/GM-11784-sow-tracker` (cut from `main` @
`9d53308`; built in the worktree `.claude/worktrees/sow-tracker`, moved to the main checkout
2026-11-12 by patch with an identical tree hash). Six rounds over 2026-11-10/11, below. Built and
verified, **not yet committed** (Naveen commits: the gitleaks hook can't run from Claude's shell).

- **What shipped:** migration 17 `add_sow_tracker` (`Sow`, `SowPhase`, `SowPlanItem`, `SowRisk`,
  `SowIssue`, `SowSlackIssue`, `SowFeedItem`, `SowSnapshot`, `SowShare`, `Program.sows`); pure
  `src/lib/sow/{defaults,classify,progress,timeline,template,charts,slack,knowledge}.mjs`; server
  `src/lib/sow/{refresh,data,write,slack-sync}.js`; 10 API routes under `src/app/api/sows/**`; pages
  `/sow`, `/sow/[slug]`, `/sow/share/[token]`; `src/components/sow/*`; the `SLACK_SYNC` job kind and
  connector **1.2.1**; the Ask `sow` pack + SOW deep round (`src/lib/ask/*`); the sidebar
  "Claude Code" item with a live connection dot; the daily cron step; the Configurator AI seed.
- **Final verification (2026-11-12, main checkout, Node 22):** lint **0**; `prisma validate` ok,
  **17 migrations** up to date, **no drift** (`migrate diff` vs the database); cold env-free build
  (`.env` and `.env.production` moved aside, `.next` removed) exit 0, **80 ƒ Dynamic, 0 warnings**;
  **36/36 pure fixtures** (kind rules, dependency flag, status-name credit, weighted progress, epic
  roll-up, snapshot values, slips, launch gate, Slack status and overrides, file-description merge,
  feed keys, Confluence sections and question matching, template); `next start` smoke **19/19**
  (health; `/sow`, `/sow/[slug]`, `/settings` "Claude Code"; 401 unauthenticated; 400 bad bodies;
  404 unknown SOW; generic page for a bad share token; **403 on create, patch, plan, refresh, Slack
  sync and share for a throwaway non-admin**, deleted afterwards, 0 left; 409 Slack sync with the
  connector offline). One smoke expectation of mine was wrong (`GET /api/sows` → 405: the route only
  has POST) and is not counted.
- **Earlier rounds (recorded in each round below):** a real Jira refresh of filter 71390; real
  Slack syncs of all three channels through the connector; live Ask answers from the pack, the
  primary pages and the deep round; headless renders at 390 and 1440 in both themes with 0 overflow
  and 0 console errors; share-page privacy checked.
- **Verified by Naveen (2026-11-11):** the authed browser pass and a real PDF.
- **Office DB bundle:** `output/storyboard-dba-migration-2026-11-11-add_sow_tracker/` (migration 17
  + `02b-seed.sql`, Configurator AI create-only), REHEARSAL PASSED. **Pending Naveen's run** before
  the image rollout; the office head is 16 until he confirms it.
- **Pending:** Naveen's commit and PR; the office bundle; connector 1.2.1 on his laptop.

## Round 2 (Naveen, 2026-11-10)

Feedback on round 1: too list-like; leadership needs the picture at a glance, as visual as
possible, with every detail one click away. Ratified by AskUserQuestion:

- R1. **One-screen overview + drill-in.** A side panel opens behind every tile; `?panel=` links to
  one (`phase:<id>`, `epic:<key>`, `ticket:<key>`, `stage:<key>`, `person:<name>`, `risks`, `deps`,
  `docs`, `loose`).
- R2. **Four lead visuals:** a date-scaled timeline with a today line and gate diamonds (a hollow
  diamond marks a slipped gate's baseline); weighted progress by day against a straight-line plan;
  a scope map (one square per ticket, by epic, four states with their own shapes); an issue funnel
  (pre-QA Slack → internal QA → UAT) with raised/closed bars per day, plus open work per person.
- R3. **The pre-QA Slack channel is read through the Claude Connector**, not a bot token
  (`SLACK_SYNC` job kind, connector 1.2.0, two read-only Slack tools).
- R4. **Slack issue status = reactions, with an admin override** (`:ack:` / `:eyes:` acknowledged,
  `:white_check_mark:` fixed, `:no_entry_sign:` not an issue; a linked Jira ticket that is done is
  fixed; the override wins).
- R5. **Reading list** (`Sow.references`): Naveen shared the Configurator AI Confluence folder
  (40 pages) for Perf, QA and new joiners; 15 pages and 4 repos are seeded, editable in Settings.

## As-built notes

1. **Credit by status name before category.** Tekion files "Groomed" under Jira's in-progress
   category; by category alone Configurator AI read 40% with nothing started. `STATUS_NAME_CREDIT`
   (Groomed 0, Dev In Progress 0.4, Code Review 0.7, In QA 0.85, Testing/UAT 1) are code defaults,
   not per-SOW. Amends decision 5's "credit by status category".
2. **Phases carry current dates only** (decision 14); baseline lives on plan items.
3. **A phase that ended with plan items still open** reads amber, never "done".
4. **Export is PDF only.** PNG was planned and is not built.
5. **A Slack post is an issue when the extraction flags it or it carries a session id** — not
   "has media", which the plan proposed: three scope questions had screenshots. The flag is sticky
   across re-syncs, because the extraction's call wavers between runs (12 then 10 of the same 23).
6. **Slack gives no time for a fix**, so the per-day "closed" bars count Jira bugs only.
7. **Thread links need `SLACK_WORKSPACE_URL`** (e.g. `https://tekion.slack.com`); unset, the
   Thread link is hidden.
8. **The plan curve is drawn against overall weighted progress**, while health is judged on
   planned scope (stories + tech). They agree until bugs arrive, and bugs weigh little.
9. **The Slack sync loads claude.ai connectors for that one run** (~180k tokens of tool context,
   $0.18–0.21 on Haiku). It is the only job kind that does.
10. **Signed-in viewers receive the SOW's JQL, kind rules and Slack text** in the page data; the
    public share page receives none of them (verified).
11. **The schema changes were folded into migration 17 twice** on dev (Slack table, then
    `references`); the second time by `ALTER` + checksum update, no drift.
12. **Migration 17 was amended four times before commit** (Slack issues, `references`, the
    `files`/`authorId` attachment columns and `SowFeedItem`, then `knowledge`), each by `ALTER` on
    dev plus a `_prisma_migrations` checksum update, never `db push`. Safe only because the
    migration has never left dev; the office bundle was regenerated after the last change. Once it
    is applied anywhere else, a change needs migration 18.
13. **Connector 1.2.1, not 1.2.0.** Slack sync needs `MCP_CONNECTION_NONBLOCKING=false` (the
    claude.ai Slack connector otherwise reports "pending" at start and the run reads nothing), so
    `SLACK_MIN_CONNECTOR_VERSION` is 1.2.1. Analyses and Ask still work on 1.1.0+.
14. **Ask reads StoryBoard's own copy of the primary pages** (`Sow.knowledge`) rather than relying
    on ORBIT DeepContext, which had not indexed the new Repositories page. Matching is by word
    overlap with heading matches counted three times — no embeddings.
15. **Branch renamed** from `feature/sow-tracker` to `feature/GM-11784-sow-tracker` to carry the
    Jira key (never pushed under the old name).

## Round 3 (Naveen's review, 2026-11-11)

- **Progress chart fixed.** It scaled with its panel, so axis text grew to headline size on a wide
  panel; it is now drawn at the measured pixel width with 11–12 px type. The hover line is in the
  accent colour and hidden on today's line. A real bug surfaced with the second day's reading: the
  actual line was handed `[x, y]` pairs where `smoothLinePath` takes `{ x, y }` (a NaN path). Fixed.
- **Watch list colours:** risks red with an open blocker, else amber; dependencies blue.
- **Screenshots: link + description** (AskUserQuestion). Slack files are private and the connector
  can show an image to Claude but cannot pass the file on, so no image is stored. Each post keeps
  its attachments (`SowSlackIssue.files`, `authorId`, folded into migration 17); during the sync
  Claude reads each issue screenshot once with `slack_read_file` and writes what is on screen
  (≤ 200 characters, quoting visible error text). Described files are not read again; undescribed
  images on known issues are named in the next prompt. "Open in Slack" needs `SLACK_WORKSPACE_URL`.
  Measured: first sync with 8 screenshots $0.29 and 98 s; a re-sync $0.20.
- **An empty read now fails.** One sync returned no posts in 9 seconds and was stamped as synced;
  a sync that returns nothing for a channel that has posts is now a failed job that changes nothing.
- **Channel name guard:** the extraction once answered the channel's ID as its name; IDs are not
  stored as names.
- **Verification:** 4 more fixtures (32 in all); signed-in page carries a description and the
  public share page carries no description or file name; chart rendered at 316, 429 and 820 px
  wide, 11 px type, 0 console errors; lint 0; no drift; env-free build 79 ƒ, 0 warnings.
- **Not verified:** the "Open in Slack" links (no workspace URL set on dev); a real PDF download.

## Round 4 (Naveen, 2026-11-11) — docs-and-decisions channels

"Can we have an option to connect other Slack channels just for the docs and decisions."

- **Settings → "Docs & decisions channels"**: Slack channel IDs (`Sow.feedChannels`, each with its
  name, last read and last error). Seeded for Configurator AI: #configurator-ai (`C0BQ6HUJHQE`)
  and #configurator_ai_oem_agentic_framework (`C0BREF9BP4N`). The pre-QA channel field is now
  labelled "Pre-QA issues channel".
- **What is extracted:** DECISION (scope in or out, approach chosen, date or plan agreed, owner
  assigned — not questions or unconfirmed proposals) and DOC (a shared link: Confluence, Google or
  SharePoint, Figma, PRs, dashboards, recordings). Up to 15 discussion threads per channel are
  read for decisions reached there. Stored in `SowFeedItem` with a stable key (a doc by its link,
  a decision by its order within its message), so re-syncs update in place and keep `hidden`.
- **One Sync Slack = a batch:** the issues channel, then each docs-and-decisions channel, one
  connector job each, run in sequence (finishing a step queues the next; a queued job waiting
  over a minute is failed as abandoned, so they cannot all be queued at once). The page shows
  "Reading #channel (2 of 3)…". A failed step is recorded on its channel and the batch moves on.
- **Empty reads:** the Slack connector sometimes fails to load in a headless run and Claude
  answers without reading (seen three times, ~10 s and ~$0.01). Any empty read is now a failure
  — never stamped as synced — and that step is retried once automatically. Seen working live:
  #config-ai-all came back empty, was retried, and read 23 posts.
- **UI:** a "Decisions" row on the watch list (count + latest) opens a **Decision log** drawer
  grouped by month, each with context, who, when, channel and a link to the message; the Docs
  panel gains a "Shared in Slack" section (links already on the curated list are not repeated).
  Admins can Hide / Restore any item. "Risks & decisions" is now "Risks & blockers".
- **Privacy:** signed-in viewers only; hidden items reach admins only; the public share page and
  the PDF carry none of it (verified).
- **Measured:** a full first read of #configurator-ai (122 messages) $0.37 and 2.4 min; a three-
  channel re-sync ~3.5 min and ~$0.55. 23 decisions and 15 docs on dev after two syncs.
- **Extraction varies between runs** (the same 14-day window gave 14, then 19 decisions in
  #configurator-ai). Hide is the correction; a decision dropped by a later run within the window
  is removed.
- **Verified:** 5 more fixtures (37 in all); a real three-channel sync twice; a forced empty
  read retried once then failed cleanly; smoke 11/11 (hide/restore RBAC, viewer vs admin data,
  duplicate channel ids, share-page privacy); renders at 390 and 1440 in both themes, 0 errors;
  lint 0; no drift; env-free build **80 ƒ**, 0 warnings.

## Round 5 (Naveen, 2026-11-11) — Ask StoryBoard + decision-log recall

- **Ask StoryBoard answers about a SOW** — a `sow` data pack, and a deep round grounded in the
  SOW's Confluence pages, repos and Jira. Detail in ask-storyboard.md, amendment 2026-11-11.
- **Root cause of empty Slack reads found.** claude.ai connectors connect in the background; a
  headless run whose first turn comes before Slack is "connected" has no Slack tools and returns an
  empty structured result at once (~5–10 s, ~$0.01). Seen in about one run in four, and three times
  in a row once. `MCP_CONNECTION_NONBLOCKING=false` makes Claude Code wait: Slack was connected at
  start in 6/6 probes and every step of the next real sync read first time. **Connector 1.2.1**
  sets it for Slack syncs; Slack sync now requires 1.2.1. The empty-read failure + one retry stays
  as a safety net.
- **Decision recall:** one run finds a different subset of a long channel's decisions (22, 30 and
  19 for the same #configurator-ai history), and a re-sync used to delete what it missed within
  its window. Now: feed items are only ever **added or refreshed, never removed by a sync** (Hide
  is the correction); feed channels run at **medium** effort with an "be exhaustive" instruction;
  and each feed channel gets a **full-history re-read every 7 days** (`lastFullReadAt`), 14-day
  windows in between. After one more real sync: 30 decisions and 22 docs (from 23 / 15), including
  the chat-layout decision that had been missed. A three-channel sync now takes ~5 min / ~$0.50.
- **Channel names:** a name already known wins on re-sync (the extraction once returned
  "configurator-ai-oem-agentic-framework (C0BREF9BP4N)"); a trailing "(ID)" is stripped.
- **Testing note:** my end-to-end tests swapped the hash on Naveen's own ConnectorToken; his live
  connector got a 401 and exited by design. Future tests pair a throwaway user instead.
- **Verified:** lint 0; no drift; env-free build 80 ƒ / 0 warnings; five live Ask questions
  through the connector and two through the server provider; a live three-channel sync on 1.2.1.

## Round 6 (Naveen, 2026-11-11) — primary Confluence pages for Ask

Naveen: "Repo details, services list and all the other key information about Configurator AI is
in this confluence … use this as well for Ask StoryBoard answering", then the "Configurator – An
Overview" page and the stage / preprod / prod links.

- **Reading list:** both pages are **primary sources** ("Start here" badge); the four repo names I
  had guessed (two were wrong) are replaced by the **16 repositories** from the page's inventory
  table, each with a note (area, what it does, Jira, people); an **Environments** group holds the
  three configurator links. References gained `note` and `primary` (editable in Settings). 36 entries.
- **Why StoryBoard keeps its own copy:** ORBIT DeepContext had not indexed the new Repositories
  page ("returned no content"), so the deep round could not use it. Now every Refresh Jira (and the
  nightly refresh) reads each primary page through the Confluence API on the same Atlassian
  credential, splits it into sections at its headings (`lib/sow/knowledge.mjs`, tables kept one row
  per line) and stores them in `Sow.knowledge` (folded into migration 17). A failed read keeps the
  previous copy with the error shown in the Docs panel; it never fails the Jira refresh.
- **Ask:** the sow pack carries the sections that best match the question (heading matches count
  three times; ≤ 10 000 characters) plus each page's table of contents; repo notes answer "which
  repo / who / which tickets" directly. The deep round reads the primary page first and gets exact
  `owner/repo` names. The page text never reaches the browser.
- **Verified live through Naveen's connector:** the stage agentic API URL and prod status (answered
  from the Repositories page's Environments section — this had failed in the deep round), the stage
  link, the two APIs that fire on model-page load (Overview page), and all seven MCP tools with
  their backing services — each grounded, ~20 s, no deep round. 9 more fixtures (46 in all).
- **Office bundle regenerated** (the migration's checksum changed with the new column) and
  re-rehearsed: REHEARSAL PASSED; the seed now carries the 36-entry reading list.

## Not built (asked for, parked)

- Nightly Slack sync (a connector is a laptop); admin-editable templates; scenario toggles.

## Decisions

Ratified with Naveen 2026-11-10 (three AskUserQuestion rounds):

1. **Many SOWs, each optionally linked to a `Program`** (`Sow.programId`, SetNull). A list page and
   one page per SOW.
2. **Access:** any signed-in user views; **global admins** create, edit and refresh. No role
   groups ("no access control for now; decided later").
3. **One Jira filter or JQL per SOW, auto-classified** into kinds by ordered, editable rules.
4. **Default kind rules, by project and issue type, first match wins:** project RELB → *RELB*;
   GMDRP → *UAT issue*; ENG → *External bug*; type Bug → *Internal bug*; Epic → *Epic*; Story →
   *Story*; Tech Story / Task / Sub-task → *Tech*; anything else → *Unclassified* (always shown,
   never hidden). GMDRP and ENG are guesses Naveen accepted; they are per-SOW config.
   **Dependency is a flag, not a kind:** a ticket whose project is outside the SOW's
   `homeProjectKeys` and is not matched by a project rule (so AIPL, ZEB; not RELB/GMDRP/ENG).
5. **Progress is weighted, and epics roll up from their children.** Default weights (per SOW):
   Story 5, Tech 3, RELB 2, Internal bug 1, UAT issue 1, External bug 1, Unclassified 1. Credit by
   Jira status category: to-do 0, in-progress 0.5, done 1. `% = Σ(weight × credit) ÷ Σ weight`.
   An Epic is never counted itself; its % is its descendants'. Naveen's reason: by plain count,
   a wave of QA bugs would wrongly pull completion down. A bug counter (open / total) sits beside
   the headline.
6. **Timeline: one plan, baseline vs current date** on each plan item; a slip reads "+18 d". Item
   status (Not started / In progress / Done / At risk) is set by hand.
7. **Extras in v1:** manual tracker rows, risks & blockers, a cross-team dependencies panel,
   PDF/PNG export, and a **public share link** (live, optional expiry, revocable).
8. **Layout: phase journey** — phases as a stepper; the active phase opens to its work.
9. **Creation: one built-in standard template + Duplicate.** "New SOW" asks for name, program,
   source, start and launch dates; phases, plan items, rules and weights come from the template,
   spaced across the dates. "Most SOWs follow a similar pattern, so make it extremely easy."
10. **Seed "Configurator AI"** with filter 71390 and the deck's **Option 1** dates (1st Private
    Prod Dec 18).

PROPOSED (Claude; defaults taken, not blocking):

11. **Refresh** = the daily cron plus an admin Refresh button, on the service credential
    (`resolveRefreshAuth`), like `/security`. Fetch first, then replace atomically; a failure
    keeps the old mirror and records `lastRefreshError`.
12. **Milestones and manual tracker rows are one table** (`SowPlanItem`; `isGate` marks the
    diamonds on the journey). An item may carry a `jiraKey`; it then shows that ticket's live %.
13. **Every plan item belongs to a phase.** A phase lists the ticket kinds that surface in it
    (template: Development ← Epic/Story/Tech; Internal QA ← Internal bug; UAT ← UAT issue;
    Private Prod ← RELB + External bug). Kinds no phase claims show under "Other tickets".
14. **Phases carry current dates only**; baseline lives on plan items, where slips are read.
    *Alternative considered:* baseline on phases too — double entry for little signal.
15. **Health is derived, not hand-set:** scope progress (Story + Tech) against time elapsed in
    the phases that own those kinds, the board's bands (−10 / −25); raised to at least At risk by
    an At-risk or overdue plan item or an open Blocker.
16. **Dates are calendar days** (stored UTC midnight, compared as `YYYY-MM-DD` in
    `Asia/Kolkata`), so no time-zone drift (the support-oncall lesson).
17. **Share links are live only** (no frozen snapshot) and show everything on the page except
    edit controls. 192-bit token (`generateShareToken`).
18. **A daily `SowSnapshot`** (progress % + per-kind totals) for "vs last week".

## Requirements

### Scope

- (a) **Schema** `prisma/schema.prisma` + migration `add_sow_tracker` (17): `Sow`, `SowPhase`,
  `SowPlanItem`, `SowRisk`, `SowIssue`, `SowSnapshot`, `SowShare`; `Program.sows`.
- (b) **Pure logic** `src/lib/sow/{defaults,classify,progress,timeline,template}.mjs` (relative
  imports only).
- (c) **Zod** `src/lib/schemas/sow.js`.
- (d) **Server** `src/lib/sow/{refresh,data,write}.js`.
- (e) **API** (`withRoute`; mutations `requireAdmin`): `api/sows` (POST, incl. `duplicateOf`),
  `api/sows/[sowId]` (PATCH, DELETE), `…/refresh` (POST), `…/plan` (PUT, replace-all),
  `…/risks` (PUT, replace-all), `…/shares` (GET, POST), `…/shares/[shareId]` (DELETE).
- (f) **Pages** `src/app/sow/page.jsx`, `src/app/sow/[slug]/page.jsx`, public
  `src/app/sow/share/[token]/page.jsx`.
- (g) **Components** `src/components/sow/*`: journey stepper, hero, phase panels, epic rows, kind
  bars, dependencies, risks, list cards, dialogs (new / settings / plan / risks / share / export).
- (h) **Export** A4 landscape PDF/PNG on the shared export kit.
- (i) **Wiring:** sidebar item, cron step (`src/lib/cron/daily.js`), create-only seed
  (`prisma/seed.mjs`).

### Mechanism / gotchas

- Next 16: `params` / `searchParams` are Promises. Read `node_modules/next/dist/docs/` before
  touching routing.
- `prisma migrate dev` does not reliably regenerate the client: run `prisma generate` after.
- The mirror stores `statusCategory` as Jira's **key** (`new` / `indeterminate` / `done`), the
  `SecurityIssue` convention, not the display name `BugReportIssue` stores.
- An epic's children are found by walking `parentKey` up to an Epic-kind ticket **in the mirror**
  (a sub-task under a story still rolls into the story's epic). The epics' own parent
  (GMDRP-42935) is outside the filter and is ignored.
- The public share page must not call anything session-bound; it reads by token only.
- Tailwind v4 scans `context/**`: never quote an arbitrary-property class in this file.

### Acceptance criteria

- `yarn lint` clean on `src/`; `prisma migrate status` up to date at **17**; cold env-free Node 22
  build green with **0 warnings**; route count declared.
- Pure fixtures: rule order, weighted %, epic roll-up, a bug wave barely moving the headline,
  slip, phase state, template layout.
- A real refresh of filter 71390 mirrors its tickets; the page's weighted % equals a hand count.
- API smoke with minted cookies: non-admin 403 on every mutation; reads 200; share token valid,
  expired, revoked; a failed refresh keeps the mirror.
- Headless renders at 390 and 1440, Tekion and Modern: no overflow, no console errors.

### Out of scope

Admin-editable templates; scenario toggles (Option 1 vs 2 side by side); per-ticket SDLC stages;
an Ask StoryBoard data pack; "Analyse with Claude" on SOW rows; any Jira write; finer access
control; frozen share snapshots.

## Doc-sync (§17 — same PR)

- §5 feature row; §9 schema block + ER diagram + rationale bullet; §11 build-log row; §13 note on
  the new public token surface; §16 decision entry. `current-feature.md` invariants (routes,
  migrations). Do **not** claim RBAC beyond "admins edit", and do not claim the office DB has
  migration 17 until Naveen runs the bundle.

## References

- @context/features/security-vulnerability-tracker.md, @context/features/gm-bug-report.md (the
  mirror + read-time pattern); @context/features/share-view-export.md (token links);
  @context/features/rollup-export.md (landscape export).
- `src/lib/security/refresh.js`, `src/lib/jira/refresh-auth.js`, `src/lib/jira/client.js`
  (`searchIssues`, `fetchFilter`), `src/lib/share-token.js`, `src/lib/export/*`,
  `src/components/export/print-kit.jsx`, `src/app/security/page.jsx`, `src/app/share/[token]`.
