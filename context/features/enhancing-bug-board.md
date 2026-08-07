# Enhancing the Bug Board — scope toggle, by-team grouping, per-developer drill

## Overview

Three additions to the existing `/bugs` leadership dashboard
(@context/features/gm-bug-report.md, shipped 2026-07-21), from Naveen's handwritten "Enhancing Bug
Board" note (`context/SprintTracker - Project Spec/Enhancing_Bug_Board.jpg`):

1. **A scope toggle (External / Internal / All).** The board shows two bug universes side by side
   today with no way to focus. External bugs are "extremely important and need to be highlighted."
   Add a segmented toggle that drives the **whole** page — matrix, KPI cards, every chart, and the
   two new sections below — with External given a persistent, restrained visual emphasis.
2. **A new "Bugs by scrum team" section** — group the report's bugs by scrum team, derived from each
   bug's Jira **sub-component** and the `JiraSubComponent → Team` catalog teams already claim in
   `/admin`.
3. **A per-team → per-developer → issue drill** — ranked horizontal bars per team; click a team to
   reveal a per-developer breakdown; click a developer to expand their bugs inline plus a Jira link.

This is an **Operate**-mode surface — scanability, consistency, and reusing the established language
outrank expression. Every addition reuses the incumbent primitives (`Panel`, `Bar`, `Legend`,
`AvatarChip`, `HeroShell`, the ink pressure-bar grammar) and the computed-in-`globals.css` token
system. Touches project-overview §5, §9, §11, §16.

> **Key architectural first: the `BugReport` cluster gains a link to the `Team` catalog.** §9's
> rationale states the bug-report models are "deliberately unlinked from `Team`/`Sprint`" — a bug
> report has no sprint, no stages, no per-issue lifecycle. Enhancement 2 crosses that boundary, but
> honors its *spirit*: the link is a **read-time, FK-less string join** (bug's `subComponent` →
> `JiraSubComponent.name` → `teamId`), exactly like `Issue ↔ IssueProgress` (joined by `jiraKey` at
> read time, §9) and the existing read-time band/category/SLA classification (gm-bug-report decision
> 12). The cache stays a dumb Jira mirror; the only schema change is one raw-fact column. Team
> membership is resolved on every render from the catalog, so an admin claiming a sub-component
> re-renders the section instantly with no Jira refresh — the same instant-config property the whole
> `/bugs` classifier already has.

**Roadmap position:** post-v1, not a master-plan step (the plan is complete). Requested by Naveen
2026-08-02, an enhancement of an existing `[BUILT]` feature.

## Status

**Done 2026-08-04** (uncommitted, branch `feature/enhancing-bug-board`; finish gate 2026-08-04 —
`yarn lint` clean, cold DB/env-free build green **44 ƒ Dynamic**, migrations up to date, runtime
smoke green). Verified end-to-end against Naveen's real `gm` report.

Implemented: (a) `BugReportIssue.subComponent` + migration `add_bug_report_issue_subcomponent`
(8 migrations); (b) `fetchFields` in `jira/client.js` + pure `bug-report/sub-component-field.mjs`
(field-id resolution + value extraction) wired into `refresh.js`; (c) pure `bug-report/by-team.mjs`
(`buildSubComponentTeamMap`/`buildSlaByScope`/`groupByTeam`); (d) `bug-report-data.js` computing the
three scope views + the read-time team join off one issues + one snapshot query; (e) UI — new
`bug-scope-view.jsx` (context provider + on-ink segmented toggle + slot), `bug-team-section.jsx`
(team → developer → inline-issue drill), extracted `bug-bar.jsx`, restructured `bugs-page.jsx`
(three pre-rendered subtrees, static hero + two scope-driven slots), `emphasizeScopeId` on
`bug-matrix.jsx` + `bug-kpi-cards.jsx`.

**Verified:** `yarn lint` clean; **13/13 plain-Node fixtures** (by-team grouping + field
discovery/extraction); `prisma migrate status` up to date; **cold `rm -rf .next` DB/env-free build
green — 44 ƒ Dynamic unchanged**; impeccable `detect.mjs` clean on all 8 changed components.
**Live SSR + refresh against the real `gm` report** (233 bugs, minted admin cookie): `/bugs/gm`
renders 200 with the toggle (3 segments), the External emphasis, all panels, and the by-team
section — zero errors. After wiring the field-id override (below), a real refresh populated
`subComponent` on **155/233** bugs and the by-team join produced the real distribution — GM
PreCheckout 54 · D360 33 · DX 26 · Agentic AI 21 · Configurator 9 · GM Integrations 8 · Unassigned
82 (78 untagged + 4 unclaimed), summing to 233.

⚠️ **Pending:** commit; Naveen's authed visual pass in both themes (the browser extension isn't
connected — SSR/headless only so far); doc-sync finalisation.

## As-built notes (vs. the plan)

- **Field-id discovery was ambiguous on the real instance — added a `JIRA_SUBCOMPONENT_FIELD_ID`
  env override (decision 6's escape hatch, now load-bearing).** Tekion's Jira exposes ~35
  "sub-component"-ish custom fields, and **two of them share the JQL clause `sub-component[dropdown]`**
  — `customfield_13108` ("Sub-component") and `customfield_29090` ("Sub-Component"). Name-discovery's
  `find` returned the empty twin, so the first real refresh wrote `subComponent = null` for all 233
  bugs. Probing sample bugs showed the real values live in **`customfield_13108`** (14/25 external,
  21/25 internal populated). Fix: `refresh.js` uses `JIRA_SUBCOMPONENT_FIELD_ID` when set (skips
  discovery entirely), discovery is the fallback, and either failing leaves `subComponent` null →
  Unassigned (never fatal). Documented in `.env.example`; set to `customfield_13108` in the dev
  `.env`. A per-report admin field remains a possible future upgrade, but a single per-instance env
  value is the right shape (the field id is a Jira-instance fact, not per-report).
- **The two pure helpers live in `sub-component-field.mjs`, not `refresh.js`** — split out so they
  are plain-Node testable (refresh.js pulls in Prisma), the `matrix.mjs`/`seeding.mjs` precedent.
- **`Bar` and `AvatarChip` roots changed `<div>` → `<span>`** (flex/grid spans, identical rendering)
  so both are valid PHRASING content nested inside the drill's expand `<button>`s — a `<div>` in a
  `<button>` is invalid HTML. Verified no visual change in their existing callers.
- **The scope toggle is a React Context + two slots, not one wrapper.** The toggle and the pressure
  bar stay in the STATIC hero (the report switcher/Refresh state and the hero must survive a scope
  change), the body is below it, so a `BugScopeProvider` wraps the page and each reactive region is a
  `BugScopeSlot` mounting the selected pre-rendered subtree. `BugReferenceLinks` (scope-agnostic) is
  kept static below the body slot rather than tripled.
- **The stale-dev-server Prisma client bit again** mid-verification (the documented repo hazard): a
  refresh 500'd with `Unknown argument subComponent` until `yarn db:generate` + a dev-server restart.
- **Catalog data quirk (not this feature's bug):** one claimed sub-component is stored with literal
  quotes — `"DR_GM-SC_F&I_Forms"` — so its bugs won't match the un-quoted Jira value and fall to
  Unassigned until the catalog name is corrected in `/admin`.

## Decisions

Decisions 1–5 are **ratified (Naveen 2026-08-02)** via the plan-approval question round. Decisions
6–9 are **PROPOSED** with a default and alternatives; none block implementation.

1. **Default view = All, External highlighted (ratified).** The board opens showing both scopes side
   by side (today's behavior); External leads and carries a persistent, restrained accent (not a
   default-to-External-only view). The toggle then narrows to External-only or Internal-only, and it
   governs the **entire** page — matrix, KPI cards, all charts, and the by-team/by-developer
   sections. *Alternative considered:* default to External-only — rejected, leadership wants the
   full picture on open, and the emphasis channel already makes External prominent.
2. **Instant client-side toggle, no network (ratified).** The three scope views (All / External /
   Internal) are **pre-rendered server-side** in `bugs-page.jsx` and handed as subtree props to a
   thin client switcher (`BugScopeView`) that mounts only the selected one. The existing panels stay
   **server components** (no conversion), classification stays server-side, and the drill-down
   `cellJql` closures are called during server render (their string output is baked into the markup),
   so nothing non-serializable crosses the boundary. Accepted tradeoff: ~3× the RSC payload (counts +
   SVG markup — small). *Alternative considered:* `?scope=` searchparam with a server re-render (the
   leaderboard/rollup idiom) — simpler but a ~100–300ms loader on every switch; kept as the documented
   fallback if the 3× payload ever bites.
3. **Team of a bug = its sub-component → `JiraSubComponent.teamId`, resolved at read time
   (ratified).** Requires the bug refresh to start capturing the custom `"sub-component[dropdown]"`
   Jira field — **not fetched today**. The stored `components` string is only the coarse *parent*
   Component (e.g. every GM bug is `DR_GM`), which cannot distinguish teams; the team-distinguishing
   value lives in the custom sub-component field (established by one-click-sprint-start.md). Mapping
   is a read-time join against the existing catalog, not a stored `teamId` — consistent with decision
   12's classify-at-read-time model. *Alternative considered:* denormalize `teamId` onto the cache at
   refresh — rejected, it would make catalog edits require a refresh and break the dumb-mirror
   invariant.
4. **Unmapped bugs → an "Unassigned / Untagged" bucket (ratified).** Bugs with no sub-component, or a
   sub-component no team has claimed, render in a final bucket alongside the teams — never hidden.
   It doubles as the data-hygiene signal for ENG/external issues missing a sub-component tag (the
   parked "call out ENG issues with no sub-component tag" idea, satisfied structurally). *Alternative
   considered:* exclude unmapped from the section — rejected, hiding a leadership number is a lie
   (the decision-17 posture).
5. **Developer drill = inline issue list + Jira link (ratified).** Clicking a developer expands an
   inline list of their bugs on the page (key, title, priority, status, days-over-SLA), each key
   linking to Jira `browse/KEY`, plus a "View all N in Jira →" link. Developers group by **assignee
   display name** — the bug cache has `assigneeName` but no `assigneeAccountId` (unlike the sprint
   `Issue`/leaderboard path). Acceptable for display; renames/collisions aren't stable (decision 8).
6. **PROPOSED — sub-component custom-field id resolved by discovery.** The REST `fields` param needs
   the field's id (`customfield_XXXXX`), not the JQL display name. Default: discover it once per
   refresh run via `GET /rest/api/3/field`, matching the existing `SUB_COMPONENT_FIELD` constant
   (`"sub-component[dropdown]"`) / display name, caching for the run. *Alternatives:* a per-report
   `subComponentFieldId` config column (explicit, no discovery fragility) or a hardcoded env — kept
   as an escape hatch if discovery proves unreliable on Naveen's instance; default ships with no
   admin change.
7. **PROPOSED — by-team is read-time only, no history.** No new `BugReportSnapshot` rows or columns;
   the section computes from the cached issues on every render like the matrix. *Alternative:* a
   per-team daily snapshot for a team trend — parked (the note asks for a current snapshot, not a
   team trend); the existing snapshot spine is untouched.
8. **PROPOSED — the whole page follows the toggle, expand state resets on switch.** Since each scope
   view is a separately-mounted subtree (decision 2), switching scope remounts the by-team section,
   resetting any expanded team/developer. Acceptable / arguably desirable (a fresh lens). *Alternative:*
   lift expand state above the switcher to persist it — rejected as needless complexity.
9. **PROPOSED — no admin surface change.** Team mapping reuses the existing `/admin` "Jira components"
   catalog (`JiraComponent`/`JiraSubComponent`, teams claim sub-components). No new config UI ships.

## Requirements

### Scope

**(a) Schema + migration (`prisma-change` workflow)**
- Add **`subComponent String?`** to `BugReportIssue` (`prisma/schema.prisma`) — a raw Jira fact
  (decision 12), possibly comma-joined if multi-valued.
- Migration `add_bug_report_issue_subcomponent` via `yarn db:migrate` (never `db push`).
- §9 updated byte-consistent (Prisma block + the entity-rationale bullet noting the read-time Team
  join). No other schema change; **no snapshot columns** (decision 7).

**(b) Jira client + refresh — capture the sub-component field**
- `src/lib/jira/client.js`: add `fetchFields(auth)` (`GET /rest/api/3/field`) — Jira specifics stay
  isolated here (§17).
- `src/lib/bug-report/refresh.js`:
  - Resolve the sub-component field **id** once per run (decision 6), matching `SUB_COMPONENT_FIELD`
    from `src/lib/jira/issue-type-defaults.mjs`. Cache for the run.
  - Add the id to each scope's `searchIssues` `fields` list; in `toBugIssueRow`, read `fields[id]`
    (dropdown → `{ value }`, or an array, or a cascading `{ value, child }`) → `subComponent` string
    defensively.
  - Field-not-found, or absent on an issue ⇒ `subComponent = null` (→ Unassigned bucket). **Never
    throw** — the refresh still succeeds (decision 17 stays intact). Replace-on-refresh means it
    populates on the next refresh; no backfill.

**(c) Pure logic — new `src/lib/bug-report/by-team.mjs`** (plain-Node testable, no Prisma/fetch —
the `matrix.mjs`/`metrics.mjs` precedent)
- `buildSubComponentTeamMap(subComponentRows)` → `Map(norm(name) → { teamId, teamKey, teamName })`.
- `groupByTeam(issues, teamMap, slaByScope, asOf)` → teams sorted by open count desc, **Unassigned
  bucket last**: `[{ teamKey, teamName, isUnassigned, count, breachedCount, developers: [{ name,
  count, breachedCount, issues: [{ jiraKey, title, priority, jiraStatus, daysOverSla, scopeId }] }]
  }]`. Reuses `isBreached`/`daysOverSla` from `matrix.mjs`. Input issues are already scope-filtered,
  so grouping is scope-aware for free.

**(d) Read path — `src/lib/bug-report-data.js`**
- Load the catalog once: `prisma.jiraSubComponent.findMany({ include: { team: { select: { id, key,
  name } } } })` → `buildSubComponentTeamMap`.
- Compute **three scope views**. For `scope ∈ {all, external, internal}`: filter `issues` (all vs by
  `scopeId`), then `buildMatrix` (config trimmed to that scope for single-scope views),
  `agingBuckets`, breached list, `groupByTeam`, and trend (parameterize the internal `buildTrendSeries`
  to sum across scopes for `all` or filter by `scopeKey` for a single scope). **One issues query +
  one snapshot query**, sliced three ways — no extra DB round-trips.
- Return `{ report, reports, configured, jiraBaseUrl, externalScopeId, views: { all, external,
  internal }, cellJql, cellBreachedJql }`. A view is `null` when the report lacks that scope
  (external-only reports still render; the toggle shows only the scopes that exist, + All when >1).

**(e) Components** (`src/components/bugs/`)
- **New `bug-scope-view.jsx` (client)** — the switcher. Receives the three pre-rendered subtrees +
  `availableScopes` + `defaultScope="all"`; renders the segmented toggle (External emphasized) and
  mounts only the selected subtree. The only place the toggle lives.
- **New `bug-team-section.jsx` (client)** — the by-team drill (team bars → developer bars → inline
  issue list + Jira link); `useState` for expanded team/developer sets. The developer "view all"
  link uses `key in (...)` over that developer's cached keys (precise — no ambiguous assignee-name
  JQL).
- **Extract `Bar` + `Legend`** from `bug-charts.jsx` into new `bug-bar.jsx`, imported by both the
  charts and the team section (minor refactor, behavior unchanged).
- **Modify `bugs-page.jsx`** — pre-render the three scope subtrees (pressure bar + KPI cards + matrix
  + charts + by-team section + ticket table, each from its view's data) and wrap them in
  `BugScopeView`; keep the hero title/owner/actions row + `lastRefreshError` banner static above. The
  scope-dependent pressure bar moves from a static `HeroShell` child into the switched region (kept
  on an ink surface).
- **Modify `bug-matrix.jsx` + `bug-kpi-cards.jsx`** — accept an `emphasizeScopeId` (the external
  scope) for the All view: a restrained accent left-spine on the External column group + External-first
  KPI per-scope detail.
- **Pages** `src/app/bugs/page.jsx` + `[slug]/page.jsx`: unchanged (toggle is client-side, no
  `searchParams`). **No new API routes, no new pages → 44 ƒ Dynamic unchanged.**
- **No admin surface change** (decision 9).

### Mechanism / gotchas
- **Read the installed docs first** — Next 16 (`node_modules/next/dist/docs/`, AGENTS.md) for the
  RSC "pass a server component as a prop to a client component" pattern (decision 2), Prisma 7 for
  the additive migration, Tailwind v4 `@theme` for any token use. All three differ from training data.
- **Design authority is the incumbent `/bugs` code** — reuse `Panel`/`Bar`/`Legend`/`AvatarChip`,
  the `bg-danger` under-rail grammar, the `--chart-cat-1`/`--age-*`/`--on-ink-*` tokens; colors are
  computed in `globals.css`, never picked in components (dataviz discipline already in `bug-charts.jsx`).
- **The custom-field id is not the JQL display name** — JQL uses `"sub-component[dropdown]"`, the
  REST `fields` param needs `customfield_XXXXX`; resolve by discovery (decision 6), handle the
  dropdown value shape defensively.
- **Assignee grouping keys on display name** (no `assigneeAccountId` on the bug cache) — group by
  `assigneeName`, `null → "Unassigned"` at the developer level too.
- **`asOf` discipline** — the by-team grouping and its breach/aging use the single request-time
  `asOf` already threaded through `getBugReportData` (the step-8 precedent); a render can't straddle
  midnight.
- **Metrics purity** — nothing here reads or writes `metrics.mjs`, `IssueProgress`, or sprint data;
  §12 numbers cannot move. The only cross-domain read is the `JiraSubComponent` catalog (read-only).
- **Build stays DB/env-free** — no env reads at module load in any new file.

### Acceptance criteria
- `yarn lint` green; `prisma validate` + `migrate status` up to date (**8 migrations**);
  **cold `rm -rf .next` DB/env-free build green — 44 ƒ Dynamic unchanged** (`/verify`; house
  pattern: `.env` moved aside via `mv`, dev server stopped for the cold build, restarted after).
- **Plain-Node fixtures** (scratchpad, no DB) for `by-team.mjs`: sub-component→team mapping
  (case/space-insensitive); the Unassigned bucket for both a `null` sub-component and an unclaimed
  one; developer grouping by name incl. a null-assignee "Unassigned" developer; per-team and
  per-developer breach counts; scope-filtered grouping; worst-first ordering with Unassigned last.
  Plus a field-discovery unit over a mock `/field` payload (found, not-found, alternate casing).
- **SSR/API smoke on dev + Neon** (minted-cookie, fabricated report + sub-component-tagged issues + a
  claimed team + one unclaimed/untagged issue, teardown to 0 rows): a refresh **capturing
  `subComponent`**; all three scope views present in the payload with correct per-scope
  matrices/KPIs/charts; by-team grouping with the Unassigned bucket; developer drill data + `key in
  (...)` and `browse/KEY` hrefs; External-emphasis markup present in the All view and absent in
  single-scope views. Re-check against Naveen's real `gm` report if a team has claimed sub-components.
- **Headless-Chrome visual pass** at 1512px + 420px in **both** Tekion and Modern themes — toggle all
  three scopes, expand a team then a developer; then `node <impeccable>/scripts/detect.mjs --json`
  over the changed component files.

### Out of scope
- **Per-team bug trend history** — decision 7 keeps by-team read-time only; a team-trend snapshot is
  its own feature.
- **Adding `assigneeAccountId` to the bug cache** — would stabilize developer identity (decision 5);
  a small refresh/schema follow-up, not this change.
- **~~PDF export~~ + PNG/share tokens for `/bugs`** — **PDF export DONE 2026-08-02**
  (context/features/bug-report-pdf-export.md, with clickable Jira links); PNG + a `SharedView`
  share-link remain parked.
- **A dedicated admin editor for bug↔team mapping** — reuses the existing catalog (decision 9); a
  bespoke editor is unnecessary.
- **AI narrative over the by-team breakdown** — the `lib/ai/` platform is its home; parked with the
  other AI ideas.

## Doc-sync (§17 — same change)
- **§9** — the new `BugReportIssue.subComponent` column (byte-consistent with `schema.prisma`) + an
  entity-rationale note that the bug cache now carries a **read-time, FK-less** join to `Team` via
  the sub-component catalog (amending the "deliberately unlinked" bullet without contradicting it).
- **§5** — extend the "Bug report dashboards" row (scope toggle + by-team drill).
- **§11** — a `/bugs` layout note: the scope toggle as a page lens + the by-team → developer drill.
- **§16** — append the 2026-08-02 ratified decisions (scope toggle default, instant client toggle,
  read-time team join, Unassigned bucket, developer drill).
- **`context/features/gm-bug-report.md`** — an "Enhancements (2026-08)" section referencing this spec.
- **`context/current-feature.md`** — Status + History per the `finish-feature` ritual.
- **Don't over-claim** — if the drill or a panel lands partially, mark **[PARTIAL]** and name what's
  missing; don't claim by-team parity against real Jira until a real `gm`-report run with claimed
  sub-components has been done (until then it's "verified against fixtures + fabricated data").

## References
- `context/SprintTracker - Project Spec/Enhancing_Bug_Board.jpg` — the source note.
- @context/features/gm-bug-report.md — the incumbent feature: models, `matrix.mjs`, refresh,
  read-time classification (decision 12), the panel set, drill-down JQL idiom.
- @context/features/one-click-sprint-start.md — the `JiraComponent`/`JiraSubComponent`/`teamId`
  catalog + the custom `"sub-component[dropdown]"` field convention (`SUB_COMPONENT_FIELD`).
- @context/features/leaderboard.md — `aggregateByDeveloper`, `AvatarChip`, `rankBy` — the
  per-developer aggregation + render precedent (bug path keys on `assigneeName`, not accountId).
- @context/project-overview.md — §5, §9 (Prisma block + ER diagram + `Issue↔IssueProgress`
  decoupling rationale), §11, §12 (purity), §16, §17.
- `src/lib/bug-report/matrix.mjs` (`buildMatrix`, `isBreached`, `daysOverSla`, `cellJql`,
  sentinels), `src/lib/bug-report-data.js` (`getBugReportData`, `buildTrendSeries`),
  `src/lib/bug-report/refresh.js` (`BUG_ISSUE_FIELDS`, `toBugIssueRow`),
  `src/lib/jira/client.js` (`searchIssues`, `fetchFilter`), `src/lib/jira/issue-type-defaults.mjs`
  (`SUB_COMPONENT_FIELD`), `src/lib/sprint-start/track-jql.mjs` (`groupSubComponentsByComponent`).
- `src/components/bugs/{bugs-page,bug-charts,bug-matrix,bug-kpi-cards,bug-pressure-bar,bug-lists,panel}.jsx`,
  `src/components/rollup/rollup-story-points.jsx` (segmented-pill toggle grammar),
  `src/components/leaderboard/developer-leaderboard.jsx`, `src/components/ui/avatar-chip.jsx`,
  `src/lib/chart-path.mjs`.
