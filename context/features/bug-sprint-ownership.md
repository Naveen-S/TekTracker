# Bug Board — group bugs by Sprint ownership (ours vs dependencies)

> Status: **Done 2026-08-04.** Branch: `feature/enhancing-bug-board` (continues the same uncommitted
> /bugs arc — decided with Naveen 2026-08-04; the next follow-on after enhancing-bug-board.md +
> bug-report-pdf-export.md, both Done-pending-commit on the same branch). Post-v1, not a master-plan
> step. **Uncommitted, pending Naveen's commit.**
>
> **Implemented:** schema (`BugReportIssue.jiraSprintName` + `BugReport.sprintOwnershipPattern`,
> migration `add_bug_report_sprint_ownership` — 9 migrations); pure `sprint-field.mjs`
> (`resolveSprintFieldId`/`extractSprintName`) + `sprint-ownership.mjs`
> (`compileSprintMatcher`/`groupBySprintOwnership`); `refresh.js` resolves the sprint field id
> (env → `/field` discovery → `customfield_10020`, `/field` fetched once, shared with the
> sub-component discovery) and captures `jiraSprintName`; `bug-report-data.js` adds `bySprintOwnership`
> to each scope view; new `bug-sprint-ownership-section.jsx` (callout tiles + bucket → sprint → issue
> drill) + a KPI card in `bug-kpi-cards.jsx` + wiring in `bugs-page.jsx`; PDF ownership appendix
> (`paginateOwnershipAppendix` in `pdf-layout.mjs` + a `renderPage` branch reusing the parametrized
> `BugTeamAppendix`); config (`bugReportConfigSchema` + config PUT route + a "Sprint ownership"
> admin section); `JIRA_SPRINT_FIELD_ID` in `.env.example`.
>
> **Verified:** `yarn lint` clean; **50/50 plain-Node fixtures** (`sprint-field` extraction/discovery,
> matcher glob/prefix/comma, bucketing, breach reuse, empty-pattern → `configured:false`, sort order,
> `paginateOwnershipAppendix`) **+ a `paginateTeamAppendix` regression** (still risk-sorts, `type:teams`);
> `prisma migrate status` up to date (**9 migrations**); **cold `rm -rf .next` DB/env-free build green —
> 44 ƒ Dynamic unchanged** (no new routes); impeccable design hook clean on every changed component.
> **Live against the real `gm` report** (minted admin cookie): set `GM-*`, a real Jira refresh
> populated **145/233** bugs' `jiraSprintName` (real names `GM-2026_AUG_S1` …), classifying
> **Ours 136 · Dependencies 9 · No sprint 88**; `/bugs/gm` renders 200 with the callout, KPI card and
> drill; and **read-time reclassification proven with no refresh** — `GM-*, AEP-*` → 141/4/88,
> `AEP-*` → 5/140/88, empty → section+KPI hidden.

## Overview

On `/bugs`, both the External and Internal universes mix bugs that are **ours** with bugs that only
touch us as **dependencies owned by other teams**. The distinguishing signal is the Jira **Sprint
field**: a bug sitting in a sprint whose name matches a per-report pattern (e.g. `GM-*`) belongs to
us; everything else is a dependency that has to be chased with the owning team. This feature calls
that out and groups by it, **config-driven per report** (each report specifies its own sprint
pattern).

It is a near-exact mirror of the shipped **"Bugs by scrum team"** feature (enhancing-bug-board.md):
add one raw-fact column (`BugReportIssue.jiraSprintName`), a read-time pattern-driven grouping, a
drill section + a KPI card, and a PDF appendix. The `extractSprintName` extractor already exists
(`src/lib/jira/transform.js:67-81`) and handles every Jira sprint value shape.

## Decisions (ratified with Naveen 2026-08-04)

1. **Signal = the Jira Sprint field**, matched against a per-report `sprintOwnershipPattern`
   (e.g. `GM-*`). Three buckets, fixed order: **Ours** (matches) → **Dependencies** (has a sprint,
   no match) → **No sprint** (field empty). Un-sprinted bugs get their **own group** (not folded into
   Dependencies) — it doubles as a hygiene signal for bugs missing a sprint.
2. **Matcher semantics:** `*` is a wildcard; a pattern with **no `*` is a prefix** (`GM-` ≡ `GM-*`).
   Case-insensitive, anchored. Comma/newline-separated patterns are OR'd (any match ⇒ Ours), so a
   report can own several sprint prefixes.
3. **Surface = a dedicated drill section + a top KPI card**, both scope-toggle-aware for free (they
   live in the per-scope pre-rendered body subtree). Ours in the accent tone, Dependencies in warn.
4. **Include in the `/bugs` PDF export** in this change (an ownership appendix, scope-aware, with
   clickable Jira links — the bug-report-pdf-export.md precedent).
5. **Read-time derivation, config-driven, graceful empty state.** Computed at read time from cached
   `jiraSprintName` + the report's pattern — no snapshot, no denormalization; a config edit
   re-renders instantly (the matrix.mjs / by-team.mjs precedent). When the pattern is unset the
   section + KPI card are hidden (the app ships empty-config).
6. **Sprint field id resolution** mirrors the sub-component 3-tier pattern:
   `JIRA_SPRINT_FIELD_ID` env override → `/field` discovery (name/clause = "sprint") →
   `DEFAULT_SPRINT_FIELD = "customfield_10020"`.

**Non-goals:** the matrix stays `category × scope × band` (ownership is a separate grouping, not a
matrix axis); no new API route (config rides the existing config-document Save); no snapshot change.

**Data note:** existing cached bugs have `jiraSprintName = null` until the next Refresh/cron — they
all read "No sprint" until a refresh repopulates the cache (expected, same as `subComponent`).

## Scope (file-by-file)

- **(a) Schema** — `BugReportIssue.jiraSprintName String?` (raw fact) + `BugReport.sprintOwnershipPattern
  String?` (config); migration `add_bug_report_sprint_ownership`; §9 byte-synced. `prisma/schema.prisma`.
- **(b) Refresh** — new pure `src/lib/bug-report/sprint-field.mjs` (`resolveSprintFieldId`,
  `extractSprintName` ported, `DEFAULT_SPRINT_FIELD`); `src/lib/bug-report/refresh.js` resolves the
  field id (env → discovery → default), appends it to `issueFields`, sets `jiraSprintName` in
  `toBugIssueRow`; `JIRA_SPRINT_FIELD_ID` documented in `.env.example`. Missing field → null, never throws.
- **(c) Pure logic** — new `src/lib/bug-report/sprint-ownership.mjs`
  (`compileSprintMatcher`, `groupBySprintOwnership`), reusing `isBreached`/`daysOverSla` from `matrix.mjs`.
- **(d) Read path** — `src/lib/bug-report-data.js`: `buildView` adds `bySprintOwnership` (no extra query).
- **(e) UI** — new `src/components/bugs/bug-sprint-ownership-section.jsx` (clone bug-team-section.jsx:
  split-header + bucket → sprint → issue drill); `ownership` card in `bug-kpi-cards.jsx`; wire both +
  `exportViews` in `bugs-page.jsx` (section directly under the matrix). No new routes (44 ƒ Dynamic).
- **(f) PDF** — ownership appendix in `bug-export-dialog.jsx` + pagination helpers in `pdf-layout.mjs`.
- **(g) Config** — `sprintOwnershipPattern` in `bugReportConfigSchema` (`src/lib/schemas/bug-report.js`),
  persisted in the config PUT route's final `tx.bugReport.update`, edited via a new "Sprint ownership"
  section in `src/components/admin/bug-report-config.jsx`.

## `groupBySprintOwnership` return shape

```
{ configured: boolean, pattern,
  buckets: [ { key, label, kind:"ours"|"dependency"|"none", count, breachedCount,
               keys:[jiraKey...],
               sprints:[ { name|null, count, breachedCount, issues:[
                  { jiraKey, title, priority, jiraStatus, scopeId, sprintName, daysOverSla } ] } ] } ],
  oursCount, dependencyCount, noSprintCount, breachedTotal, total }
```
Buckets fixed order (ours → dependency → no-sprint); sprints worst-first (count desc); issues
most-over-SLA first. "No sprint" bucket = one `sprints` entry with `name: null` (rendered flat).
`configured:false` when no pattern → section + KPI card hidden.

## Acceptance criteria

- `yarn lint` clean; impeccable `detect.mjs` clean on the changed components.
- Plain-Node fixtures: `sprint-field.mjs` (`resolveSprintFieldId`; `extractSprintName` for
  array/object/legacy-string/null) and `sprint-ownership.mjs` (glob vs prefix vs comma matcher;
  ours/dependency/no-sprint bucketing; breach reuse; empty-pattern → `configured:false`; sort order).
- `prisma validate` + `migrate status` up to date (8 → **9 migrations**).
- Cold `rm -rf .next` DB/env-free build green — **44 ƒ Dynamic unchanged** (no new routes).
- Live against the real `gm` report: set the pattern in `/admin`, Refresh, confirm `jiraSprintName`
  populates, the section + KPI card render the ours/dependency/no-sprint split per the active scope
  toggle, and the PDF export generates with the ownership appendix + clickable `/URI` links.

## Doc-sync

- `context/current-feature.md`: Status/Goals/Notes/History.
- `project-overview.md`: §5 bug-report row addendum, §9 schema block + ER diagram (byte-sync with
  `schema.prisma`), §11 dated **[BUILT]** note, §16 ratified-decision entry, `Last reviewed` bump.

## As-built notes (vs. the spec)

- **PDF appendix reuses the team appendix rather than cloning it.** The plan implied a new print
  component; in practice a bucket reads as a "team" and a sprint as a "developer", so
  `paginateOwnershipAppendix` shapes buckets→teams and the existing `BugTeamAppendix`/`TeamSection`
  were **parametrized** with `title`/`caption`/`subgroupNoun` (default "developer") — the ownership
  page passes `subgroupNoun="sprint"`, title "Sprint ownership appendix". `paginateTeamAppendix` was
  refactored to call a shared `packSections(orderedTeams, bodyHeight, pageType)`; it still risk-sorts
  (regression-tested), while ownership preserves the fixed Ours → Dependencies → No sprint order.
- **Single `/field` fetch.** `refresh.js` now fetches Jira field metadata **at most once** and shares
  it between the sub-component and sprint-field discovery (was one fetch each), so adding sprint
  discovery costs no extra Jira round-trip. The sprint id always falls back to
  `DEFAULT_SPRINT_FIELD = "customfield_10020"`, so `jiraSprintName` is always requested; a missing
  field just yields null → the "No sprint" bucket.
- **Real-Jira finding.** On Tekion's instance the standard Sprint field resolves cleanly (discovery
  by name, or the `customfield_10020` default), no env override needed — `JIRA_SPRINT_FIELD_ID` is
  documented but unset. A real refresh tagged 145/233 bugs; GM sprints are named `GM-2026_AUG_S1`
  etc. (so `GM-*` is the right pattern), and dependencies surfaced as `AEP-*`/`AI-*`/`ZEB-*`/
  `DRP_PCHK_*` sprints.
- **KPI grid.** The card row grows from `xl:grid-cols-6` to `xl:grid-cols-7` only when a pattern is
  configured (the 6th "Ours / dependencies" card); both literals are in source so Tailwind emits them.
- **The real `gm` report was left configured with `GM-*`** (the requested value) and a real refresh
  ran as part of verification — so the feature is live on it immediately. Adjust/clear the pattern in
  `/admin` → the report's "Sprint ownership" section at any time (read-time, no refresh needed).
- **Verification gotcha (documented house hazard).** `prisma migrate dev` applied the migration but
  the already-running dev server held a **pre-migration generated client**, so the first refresh 500'd
  with `Unknown argument jiraSprintName` (the Jira extraction itself was correct — the row already
  carried `jiraSprintName: "GM-2026_AUG_S1"`). Fixed by `prisma generate` + restarting the dev server
  — the same stale-dev-server pattern this repo has hit before.
- **PDF not generated headless.** The on-screen section + KPI + read-time behavior were verified live;
  the PDF ownership appendix was verified **structurally** (paginator fixtures + reuse of the shipped,
  clickable-link `BugTeamAppendix`) but a full browser PDF render (html2canvas is browser-only, the
  Chrome extension isn't connected) is left for **Naveen's authed pass** — consistent with how this
  whole /bugs arc's visual/PDF acceptance has been.

## References

- enhancing-bug-board.md, bug-report-pdf-export.md, gm-bug-report.md (the /bugs precedents).
- `src/lib/bug-report/by-team.mjs` — grouping-helper template (shape, sort rules, `buildSlaByScope`,
  `isBreached`/`daysOverSla` reuse).
- `src/lib/jira/transform.js:67-81` — `extractSprintName` + `DEFAULT_SPRINT_FIELD`.
- `src/lib/bug-report/sub-component-field.mjs` + `refresh.js` — env→discovery→default field-id pattern.
- `src/components/bugs/bug-team-section.jsx` — the drill component to clone.
- `src/components/bugs/bug-bar.jsx` / `panel.jsx` — the visual grammar.
