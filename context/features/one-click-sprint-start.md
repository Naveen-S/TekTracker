# One-Click Sprint Start

## Overview

Sprint Tracker was piloted against a single scrum team's worth of manual setup (DR_GM). Every
sprint, onboarding a team today means hand-typing 4 JQL strings into `AddFilterDialog` (Roadmap /
Tech Debt / Internal Bug / External Bug), one filter at a time, per sprint, forever — and there is
no place in the app that knows a scrum team is really "a Jira project + a specific set of Jira
Component field values" (sub-components), or that releases are tracked by Jira Fix Version, not
just date ranges. Naveen's own org spreadsheet (`context/SprintTracker - Project Spec/Tekion JIRA
Book - 2025-26.xlsx`, sheets "Scrum Teams" / "Component Masterlist v2") already encodes this
mapping for the whole org — this feature brings a slice of that (component → sub-component → team)
into the app itself so a team's setup is entered once, and every subsequent monthly Gate's 4
filters are generated automatically instead of retyped.

Confirmed against the real spreadsheet + a Jira screenshot during planning (2026-07-26):
- A scrum team = a Jira **project** (e.g. `GM`) + a subset of that project's literal Jira
  **Component** field values (e.g. `DR_GM-VSR`, `DR_GM-FE_Platform`) — Jira has no true
  parent/child component hierarchy; "sub-component" is purely an org naming convention
  (`DR_GM-*` prefixed by the parent `DR_GM`).
- Fix Versions follow `Release-YYYY.MM.X.Y` (e.g. `Release-2026.07.1.0`, with hotfix patches like
  `.1.1`/`.1.2` and a second release-train `.2.0`/`.2.1` per month) — a Gate can span more than one.
- The four tracks map to Jira **Issue Type**, confirmed directly by Naveen: Roadmap = `Story`,
  Tech Debt = `Tech Story`, Internal Bug = `Bug` — all within the team's own project. External Bug
  is a **different**, fixed project: `ENG` ("Tekion Engineering"), Issue Type `Tap Ticket` — this
  matches the existing `/bugs` dashboard's precedent for DR_GM (`gm-bug-report.md`).

> **Key architectural point:** there is still only **one global Sprint** (Gate) for the whole org,
> created only by an admin — exactly as today (§13/§16). This feature does not add any new way to
> create a Sprint. It adds a component/sub-component **catalog** (admin-maintained) that a Team
> claims sub-components from, and a **one-click action** that, given an EXISTING Sprint, generates
> up to 4 Filters for a team from that catalog + a per-track Jira Issue Type mapping + the Sprint's
> Fix Version(s) — replacing hand-typed JQL with generated JQL, nothing else about the Sprint/RBAC
> model changes.

Requested by Naveen 2026-07-26, drafted through several rounds of clarifying questions plus two
correction rounds after an initial draft plan (see Decisions below — corrections are called out
explicitly since they reversed real assumptions in that first draft).

## Status

**Done 2026-07-26.** Implemented as specced, with the two post-draft corrections (decisions 4 and
7) fully carried through — no RBAC carve-out anywhere, and External Bug scopes by the parent
Component name rather than the team's sub-components.

Added: 2 new Prisma models (`JiraComponent`, `JiraSubComponent`) + 5 new `Team`/`Sprint` fields, one
migration (`20260726111546_add_component_catalog_and_track_config`); 3 new pure modules
(`lib/jira/issue-type-defaults.mjs`, `lib/sprint-start/track-jql.mjs`, `lib/accent-palette.mjs` —
the last extracted out of `add-filter-dialog.jsx`, which now imports it); a shared
`lib/filters/priority-insert.js` (extracted out of the existing filters route so it and the new
sprint-start route share one implementation); 6 new API routes (`/api/jira-components[/…]`,
`/api/jira-sub-components/[id]`, `/api/teams/[teamId]/sub-components`,
`/api/teams/[teamId]/sprint-start`) plus a new `ConflictError` (409) in `route-helpers.js`; 3 new
UI components (`jira-components-config.jsx`, `team-config-dialog.jsx`, `sprint-start-dialog.jsx`)
and `fixVersions` inputs added to both existing Sprint forms.

**Verified:** `yarn lint` clean; **9/9 pure-fixture checks** for `track-jql.mjs` +
`accent-palette.mjs` (the DR_GM worked example incl. the parent-component-only External Bug
clause, per-team override precedence, no-fixVersions, multi-component-group `project IN (...)`,
JQL-quote escaping, accent-color wraparound); `prisma validate` + `migrate status` up to date (6
migrations); **DB/env-free cold build green — 41 ƒ Dynamic (35 → 41, the 6 new routes)**, `.env`
genuinely moved aside and restored; **30/30 SSR/API smoke checks** against a fabricated 3-team
fixture (RBAC gates incl. the 409 double-claim conflict, 400s for a closed sprint / zero
sub-components, hand-verified JQL/sortOrder/accentColor for all 4 tracks, idempotent re-run
creating 0 new filters, and confirmation that `POST/PATCH /api/sprints` are untouched — still
admin-only, no bypass introduced); fixture torn down to 0 leftovers, harness deleted. **Runtime
smoke against Naveen's real production data** (not fixtures): a minted admin cookie against `/admin`
and `/` both returned 200 with no error markers, the new "Jira components" catalog section
rendered, and the new Hero "Sprint Start" button rendered — render-only, no writes to real data.

**2026-07-27 follow-up — Naveen's real Jira run caught a genuine JQL bug, now fixed.** Naveen ran
the actual one-click flow against his real Jira instance (closing the loop on this spec's
"pending human acceptance" item) and reported the generated JQL was wrong, supplying an accurate
real sample. Root cause: two wrong assumptions in the original `buildTrackJql` — (1) his Jira
instance tags a team's own sub-components via a **custom field** (`"sub-component[dropdown]"`),
not the standard Jira `component` field the spec assumed for all four tracks; (2) field naming
(`type`/`fixversion`, not `issuetype`/`fixVersion`), clause order, and quoting (bare unless a value
has whitespace) all needed to match his instance's actual JQL conventions, plus a trailing
`ORDER BY issuetype ASC`. Fixed in `track-jql.mjs`/`issue-type-defaults.mjs` (see As-built notes). Also added, same session:
a per-sprint **Edit** button in `/admin`'s Sprints list (fixVersions editable on any sprint,
including ACTIVE, without leaving `/admin`).

**Same-day follow-up amendment:** Naveen then clarified External Bug should **also** AND in the
sub-component clause (*"Even the external filter should use subcomponent in the filter
creation"*) — a partial reversal of decision 7's "parent Component only" framing, confirmed via a
follow-up question (**"Add sub-component alongside parent component"**, not a replacement).
`buildTrackJql` was generalized from a single `componentField`/`componentValues` pair to an ordered
`componentClauses: [{ field, values }]` list so a track can AND together more than one
component-ish field; External Bug now supplies both `{ field: "component", values:
parentComponentNames }` and `{ field: SUB_COMPONENT_FIELD, values: ownSubComponentNames }`.

**Re-verified**: a standalone pure-fixture check of the corrected `buildAllTrackJql` — both the
FEATURE track against Naveen's exact real sample, and the SUPPORT track's new dual-clause shape —
is a **byte-for-byte match** for both; `yarn lint` clean; `prisma validate` + `migrate status` up
to date (still 5 migrations, no schema change this pass); **DB/env-free cold build green — 41 ƒ
Dynamic, unchanged**, `.env` genuinely moved aside and restored; live dev-server smoke confirms the
admin Sprints list renders exactly one "Edit" button per sprint row. **Still open**: Naveen
re-running the one-click flow against real Jira to confirm the corrected JQL (both amendments)
actually returns the expected issues in each of the 4 tracks.

## Decisions (RATIFIED 2026-07-26, via clarifying-question rounds + two post-draft corrections)

1. **Component/sub-component catalog is a reusable master list, admin-maintained, one-at-a-time
   entry.** No bulk/CSV import in v1, no live Jira discovery (Naveen explicitly didn't want to
   guess/auto-fetch this — manual entry, matching the `/bugs` admin config precedent of
   admin-typed lists rather than Jira-derived ones). A Component (name + Jira project key, e.g.
   `DR_GM` / `GM`) has many Sub-components (name, e.g. `DR_GM-VSR`); each sub-component is
   unassigned or claimed by exactly one Team (matches the real org data — every `DR_GM-X` maps to
   exactly one scrum team today).
2. **Per-track Jira Issue Type mapping (and the External Bug project) is a global default, editable
   per team.** Mirrors the existing `Team.storyPointsFieldId`/`sprintFieldId`
   override-with-hardcoded-default pattern. Confirmed defaults: Roadmap → `Story`, Tech Debt →
   `Tech Story`, Internal Bug → `Bug` (all within the team's own project); External Bug → project
   `ENG`, Issue Type `Tap Ticket` (project fixed in v1, not per-team overridable — only its issue
   type list is).
3. **Fix Version(s) are manually typed onto the Sprint** (`Sprint.fixVersions String[]`) — no live
   Jira version-list lookup, consistent with decision 1. A Gate can span multiple versions (e.g. a
   base release plus its hotfix patches).
4. **"One-Click Sprint Start" is triggered by the team's own EM/Lead from the dashboard**, not
   gated behind `/admin` — but it only ever **selects an existing Sprint**, it **never creates
   one**. **Correction from Naveen after reviewing the first draft:** the first draft proposed
   letting the action also create a brand-new Sprint (with an RBAC carve-out allowing team
   managers to do so). Naveen reversed this: *"There is only one sprint for all, only admin
   creates the sprint, don't allow individual EM or lead create the sprint."* So there is **no RBAC
   change anywhere in this feature** — the action needs exactly the permission tier
   (`TEAM_MANAGER_ROLES`) that already governs manual filter creation via `.../filters`, nothing
   new, because all it automates is generating up to 4 filters for a Sprint an admin already
   created.
5. **Re-running it is safe.** Any of the 4 tracks that already has a Filter for that (team, sprint)
   is left untouched; only the missing tracks are created — never duplicated or overwritten.
6. If no `PLANNING`/`ACTIVE` Sprint exists yet, the dialog has nothing to offer and tells the
   EM/Lead to ask an admin to create one in `/admin` first — matching the existing admin-only
   Sprint-creation gate exactly.
7. **External Bug scoping starts from the parent Component, not the team's sub-components alone.**
   **Correction from Naveen after reviewing the first draft (2026-07-26):** the first draft scoped
   the External Bug filter by the team's fine-grained sub-components (same as the other 3 tracks)
   and flagged this as an unverified risk. Naveen corrected it directly: *"ENG would be the
   project, DR_GM will be added as a component, subComponent can be missing."* — i.e. `ENG` issues
   are tagged with the parent Component (e.g. `DR_GM`) but may not carry any sub-component tag at
   all, so External Bug JQL needed `component = "<parent component name>"` as its baseline, not the
   sub-component list alone. Naveen also flagged that **`/bugs` (a separate, existing feature)
   should eventually call out ENG issues missing a sub-component tag** — an explicit `/bugs`-tab
   follow-up, **out of scope here**.
   **Amendment (2026-07-27):** Naveen clarified the External Bug filter should **also** AND in the
   sub-component clause: *"Even the external filter should use subcomponent in the filter
   creation."* Confirmed via a follow-up question — the sub-component clause is **added alongside**
   the parent-Component clause (both must match), not a replacement for it. External Bug JQL is now
   `... AND component = "<parent>" AND "sub-component[dropdown]" IN (<team's sub-components>) AND
   ...` (see the worked example above and As-built notes).

## Requirements

### Data model

New models (new section in `prisma/schema.prisma` between `TeamMembership` and the Sprint/Filter
block), plus additive fields on `Team` and `Sprint`. One migration (`yarn db:migrate`, never
`db push`), regenerate the client, doc-sync §9 byte-consistently.

```prisma
/// Master catalog of a Jira project's top-level Component field value, admin-entered by hand
/// (v1: one at a time, no bulk import, no live Jira lookup — matches the manual sub-component/
/// fix-version entry decisions). Jira has no true parent/child component hierarchy —
/// "sub-component" is purely an org naming convention (`DR_GM-VSR` prefixed by parent `DR_GM`)
/// over otherwise-flat Component field values.
model JiraComponent {
  id            String             @id @default(cuid())
  name          String                              // parent Component's Jira value, e.g. "DR_GM"
  projectKey    String                              // Jira project key hosting it, e.g. "GM"
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt

  subComponents JiraSubComponent[]

  @@unique([projectKey, name])
}

/// A literal Jira Component field value scoped under a JiraComponent (e.g. "DR_GM-VSR"), entered
/// one at a time. Claimed by AT MOST ONE Team — teamId = null means unassigned. Claiming also
/// folds the parent's projectKey into Team.jiraProjectKeys (additive dedup; never pruned on
/// unclaim — nothing else reads that field today).
model JiraSubComponent {
  id          String        @id @default(cuid())
  componentId String
  component   JiraComponent @relation(fields: [componentId], references: [id], onDelete: Cascade)
  name        String                                // e.g. "DR_GM-VSR"
  teamId      String?
  team        Team?         @relation(fields: [teamId], references: [id], onDelete: SetNull)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([componentId, name])
  @@index([teamId])
}
```

`Team` gains 4 override arrays (unqualified `String[]`, same "empty = unset" convention as the
existing `jiraProjectKeys`) plus the `subComponents` back-relation:

```prisma
  /// Per-track Jira Issue Type overrides. Empty ⇒ fall back to the DEFAULT_*_ISSUE_TYPES constants
  /// in lib/jira/issue-type-defaults.mjs (mirrors the storyPointsFieldId/sprintFieldId pattern).
  /// Arrays because a track may map to >1 Issue Type. supportIssueTypes is the "External Bug"
  /// track; its PROJECT stays the fixed ENG default in v1 — only the issue-type list is per-team
  /// overridable.
  featureIssueTypes     String[]
  techDebtIssueTypes    String[]
  internalBugIssueTypes String[]
  supportIssueTypes     String[]
  subComponents         JiraSubComponent[]
```

`Sprint` gains:

```prisma
  /// Manually entered Jira Fix Version names this Gate spans (release train + hotfix patches),
  /// e.g. ["Release-2026.07.1.0", "Release-2026.07.1.1"]. No live Jira lookup. JQL scopes with
  /// `fixVersion in (...)`.
  fixVersions String[]
```

### New pure modules

**`src/lib/jira/issue-type-defaults.mjs`** — hardcoded global defaults + resolver, mirroring
`DEFAULT_STORY_POINTS_FIELD` in `jira/transform.js`:
```js
DEFAULT_ROADMAP_ISSUE_TYPES = ["Story"]
DEFAULT_TECH_DEBT_ISSUE_TYPES = ["Tech Story"]
DEFAULT_INTERNAL_BUG_ISSUE_TYPES = ["Bug"]
DEFAULT_SUPPORT_ISSUE_TYPES = ["Tap Ticket"]
DEFAULT_EXTERNAL_BUG_PROJECT_KEY = "ENG"        // fixed, not per-team overridable in v1
SUB_COMPONENT_FIELD = '"sub-component[dropdown]"' // custom field for a team's own sub-component
                                                    // scoping (added 2026-07-27); fixed, not
                                                    // per-team overridable, same posture as ENG
resolveIssueTypes(team, workflowType)           // override if non-empty, else the default
```

**`src/lib/sprint-start/track-jql.mjs`** — pure JQL builder, following the `IN (...)`-composition
idiom already established in `src/lib/bug-report/matrix.mjs` (deliberately *without* that module's
"resolve a saved filter's live JQL" complexity — every track here is fresh generated text, never a
filter-id reference):
```js
buildTrackJql({ projectKeys, issueTypes, componentClauses, fixVersions })
buildAllTrackJql({ team, componentGroups, fixVersions }) // → { FEATURE, TECH_DEBT, INTERNAL_BUG, SUPPORT }
```
`componentGroups` is `[{ projectKey, componentName, subComponentNames }]` (one entry per parent
`JiraComponent` the team has sub-components claimed under — normally just one, e.g.
`{ projectKey: "GM", componentName: "DR_GM", subComponentNames: ["DR_GM-VSR", "DR_GM-FE_Platform"] }`).
`componentClauses` is an ordered `[{ field, values }]` list, AND'd together, letting a track combine
more than one component-ish field. Roadmap/Tech Debt/Internal Bug scope by the **fine-grained
sub-component names** alone, via the custom `SUB_COMPONENT_FIELD` (`"sub-component[dropdown]"`, not
Jira's standard `component` field — see the 2026-07-27 correction below) in the team's own project.
External Bug ANDs **both**: the standard `component` field with the **parent** Component name
(decision 7 — how ENG issues are coarsely tagged) **and** `SUB_COMPONENT_FIELD` with the team's own
fine-grained sub-component names (per Naveen, 2026-07-27 — see As-built notes).

Worked example (DR_GM, no per-team overrides, one fix version) — pinned to a real generated JQL
sample from Naveen's Jira instance (FEATURE) plus the External Bug follow-up correction (SUPPORT):
```
FEATURE:      type = Story AND project = GM AND "sub-component[dropdown]" IN (DR_GM-Configurator, DR_GM-WebsiteSetup) AND fixversion = Release-2026.08.1.0 ORDER BY issuetype ASC
TECH_DEBT:    type = "Tech Story" AND project = GM AND "sub-component[dropdown]" IN (...) AND fixversion = Release-2026.08.1.0 ORDER BY issuetype ASC
INTERNAL_BUG: type = Bug AND project = GM AND "sub-component[dropdown]" IN (...) AND fixversion = Release-2026.08.1.0 ORDER BY issuetype ASC
SUPPORT:      type = "Tap Ticket" AND project = ENG AND component = DR_GM AND "sub-component[dropdown]" IN (DR_GM-Configurator, DR_GM-WebsiteSetup) AND fixversion = Release-2026.08.1.0 ORDER BY issuetype ASC
```
Field order is `type` → `project` → component/sub-component → `fixversion`, then a trailing
`ORDER BY issuetype ASC`; a literal is quoted only when it contains whitespace (e.g. `"Tech Story"`,
`"Tap Ticket"`) — bare identifiers (project keys, sub-component names, Fix Version strings) are
left unquoted. A single value renders as `field = value`; more than one renders as
`field IN (v1, v2, ...)`.

Track → display name → `WorkflowType`: `FEATURE`→"Roadmap", `TECH_DEBT`→"Tech Debt",
`INTERNAL_BUG`→"Internal Bugs", `SUPPORT`→"External Bugs".

**`src/lib/accent-palette.mjs`** — extract the `ACCENT_PALETTE` + `existingCount % length` logic
currently inlined in `add-filter-dialog.jsx` into a shared module (`accentColorForIndex`), so both
the existing client dialog and the new server route assign identical deterministic colors.

### API routes

| Route | Method | Gate | Notes |
|---|---|---|---|
| `/api/jira-components` | GET, POST | `requireAdmin()` | list catalog incl. sub-components + claimed-by; create a Component |
| `/api/jira-components/[componentId]` | PATCH, DELETE | `requireAdmin()` | rename/rekey; delete cascades sub-components |
| `/api/jira-components/[componentId]/sub-components` | POST | `requireAdmin()` | add one sub-component |
| `/api/jira-sub-components/[subComponentId]` | PATCH, DELETE | `requireAdmin()` | rename / admin manual reassign / delete |
| `/api/teams/[teamId]/sub-components` | PATCH | `requireTeamRole(teamId, [ADMIN])` | full-replacement claim set `{ subComponentIds }`; 409 if any id is already claimed by a **different** team |
| `/api/teams/[teamId]/sprint-start` | POST | `requireTeamRole(teamId, TEAM_MANAGER_ROLES)` | same gate as manual filter creation today — **no RBAC change** |
| `/api/teams`, `/api/teams/[teamId]` | POST, PATCH | *(unchanged)* | 4 new issue-type arrays ride through the existing `teamCreateSchema`/`teamPatchSchema` — no route code change |
| `/api/sprints`, `/api/sprints/[sprintId]` | POST, PATCH | *(unchanged, still admin-only)* | `fixVersions` rides through the existing sprint schemas — no route code change; **this stays the only way a Sprint is created** |

`POST /api/teams/[teamId]/sprint-start` body: `{ sprintId }` — the id of an existing Sprint (looked
up, 404 if missing, rejected if `state === "CLOSED"`). **This route never creates a Sprint** (decision
4) — the route needs exactly the permission tier (`TEAM_MANAGER_ROLES`) that already governs manual
filter creation via `.../filters`, nothing new. Flow: load the Sprint → load the team's claimed
`JiraSubComponent`s grouped by parent `JiraComponent` (400 if none configured yet) → build all 4
track JQLs → diff against existing Filters for `(teamId, sprintId)`, skip tracks that already exist
→ create the missing ones inside the **existing priority-insertion transaction** (extract that
block out of `.../filters/route.js` into a shared `insertFilterAtPriority` helper so both routes
call one implementation) with `accentColorForIndex` → immediately call the existing `syncTeamSprint`
(`src/lib/sync/engine.js`) once, server-side, for the whole batch (the one deliberate deviation from
today's two-client-round-trips add-filter-then-sync pattern, justified because up to 4 filters need
syncing atomically as one user action) → return
`{ sprint, createdFilters, skippedWorkflowTypes, syncSummary }`.

### UI changes

- **Admin — "Jira Components" catalog** (new `jira-components-config.jsx`, same `SectionCard`
  pattern as the existing `bug-report-config.jsx`): Components list, each expandable to its
  sub-components with an "Unassigned" / "Claimed by `<Team>`" badge, one-at-a-time add forms for
  both levels — no bulk import.
- **Admin — Team create/edit dialog** (new `team-config-dialog.jsx`, `create`/`edit` modes like
  `sprint-config-dialog.jsx`; today's admin panel has no team-edit affordance at all): name/key/
  description, a Component picker, a checkbox list of that Component's sub-components (disabled +
  labeled for ones claimed elsewhere), and a collapsed "Advanced: Issue Type Overrides" section
  (4 comma-separated inputs, placeholder shows the live default, e.g. `Story (default)`). Submits
  team fields then `PATCH .../sub-components` for the claim set.
- **`fixVersions` input** added to both existing Sprint forms (admin inline create form,
  `SprintConfigDialog`) — comma-separated free text, trimmed to an array client-side.
- **Admin — per-sprint "Edit" button** (added 2026-07-27, follow-up): each row in `/admin`'s
  "Sprints (Gates)" list gained an `Edit` button opening the existing `SprintConfigDialog` in
  `edit` mode for that row (reused as-is from `components/dashboard/`, not duplicated) — so
  `fixVersions` (and name/dates/state) can be edited on **any** sprint, including an already-ACTIVE
  one, directly from the admin list. Previously the only edit path was the dashboard's
  admin-gated "Configure Sprint" button, which only ever targets whichever sprint happens to be
  selected in that page's own sprint dropdown — functionally sufficient but not discoverable from
  `/admin` itself, which is where an admin naturally goes to manage Sprint data.
- **Dashboard — "One-Click Sprint Start" dialog** (new `sprint-start-dialog.jsx`): a dropdown of
  existing `PLANNING`/`ACTIVE` sprints (already available in the `Dashboard`'s props — no new GET
  route) — **no "create a new sprint" mode**; a preview of the team's resolved project/
  sub-components/issue-types and which of the 4 tracks will be created vs. skipped; disabled with
  an inline pointer to Admin if the team has no sub-components claimed yet, or if no
  `PLANNING`/`ACTIVE` sprint exists yet ("ask an admin to create a sprint in /admin first"). Trigger
  point: a new Hero action next to Share/Export/Configure-Sprint, gated on the existing
  `can.manage` (`TEAM_MANAGER_ROLES`) flag — same as manual filter creation. The "no sprint
  configured yet" `EmptyState` is unaffected (still admin-only, since only admin creates sprints).
- `dashboard-data.js` extended to include each team's claimed sub-components (+ parent component)
  and issue-type overrides when loading the selected team, so the dialog's preview and the server
  route's own resolution agree.

## Open risks / known limitations

1. **External Bug's sub-component clause can under-match ENG issues with no sub-component tag**
   (decision 7's original rationale). Since the 2026-07-27 amendment ANDs `SUB_COMPONENT_FIELD`
   alongside the parent-Component clause, an ENG ticket tagged with the right parent Component but
   *missing* a sub-component value will now be **excluded** from the External Bug filter even
   though decision 7 was originally adopted specifically because that gap is common. Accepted as a
   known trade-off per Naveen's explicit amendment, not a bug — but `/bugs` calling out ENG issues
   with no sub-component tag (already flagged as a natural, explicitly-out-of-scope follow-up)
   becomes more valuable as a result: those excluded tickets are exactly what it would surface.
2. **The sub-component custom field name is hardcoded** (`SUB_COMPONENT_FIELD =
   '"sub-component[dropdown]"'`), same fixed-not-per-team-overridable posture as
   `DEFAULT_EXTERNAL_BUG_PROJECT_KEY`. If a future team's project uses a differently-named custom
   field for this, it needs a per-team override — mirroring the existing issue-type override
   pattern — which is not built.
3. **`Team.jiraProjectKeys` stays additive-only** on unclaim (never pruned) — fine since nothing
   else reads it yet, but worth revisiting if that changes.

## Verification plan

1. Pure-fixture tests (throwaway script, deleted after) for `track-jql.mjs`: the DR_GM worked
   example, a per-team override winning over the default, no-fix-versions, multi-component-group
   `project IN (...)`, and `accent-palette.mjs`'s wraparound.
2. `yarn lint`; `prisma validate` + `migrate status`; `yarn build` green with `.env` absent (new
   routes should appear as `ƒ Dynamic` like every other route).
3. SSR/API smoke against a fabricated fixture: non-manager → 403 on sprint-start; manager with zero
   claimed sub-components → 400; manager targeting a nonexistent/closed sprint → 404/400; manager
   with sub-components + an existing `sprintId` → 4 filters created with hand-verified
   JQL/sortOrder/accentColor (confirm External Bug's JQL uses the parent Component name, not the
   sub-component list); identical re-run → 0 newly created (all skipped); claiming an
   already-claimed sub-component → 409; catalog routes 401/403 for non-admins; confirm
   `POST/PATCH /api/sprints` are untouched (still admin-only, no new bypass); global-admin bypass
   still works everywhere.
4. **Human acceptance**: run the real flow against Naveen's actual DR_GM Jira data — confirms real
   Fix Version strings match what gets typed in, and that the External Bug filter's parent-component
   scoping returns the expected ENG tickets.

## As-built notes (vs. the spec)

- **2026-07-27 — JQL builder corrected against Naveen's real Jira instance, twice, same day.**
  `buildTrackJql`/`buildAllTrackJql` (`track-jql.mjs`) and `issue-type-defaults.mjs` changed from
  the original spec in ways that only surfaced once Naveen ran the real flow:
  1. **Field naming, order, quoting, and a trailing `ORDER BY`** all changed to match his instance's
     actual JQL conventions: `type`/`fixversion` (not `issuetype`/`fixVersion`); clause order
     `type → project → component(s) → fixversion`; a literal is quoted only when it contains
     whitespace (was: always quoted); single-value fields render `field = value`, only 2+ values
     render `field IN (...)`; every generated track now ends with `ORDER BY issuetype ASC`.
  2. **A team's own sub-components are tagged via a *custom* Jira field**, not the standard
     `component` field the spec assumed — new constant `SUB_COMPONENT_FIELD =
     '"sub-component[dropdown]"'` in `issue-type-defaults.mjs`, same fixed/not-per-team-overridable
     posture as `DEFAULT_EXTERNAL_BUG_PROJECT_KEY`. Roadmap/Tech Debt/Internal Bug switched to it.
  3. **External Bug ANDs two component-ish clauses, not one** (same-day amendment to decision 7,
     confirmed via a follow-up clarifying question): `buildTrackJql`'s signature generalized from a
     single `componentField`/`componentValues` pair to an ordered `componentClauses: [{ field,
     values }]` list, so External Bug supplies both the parent-Component clause (decision 7's
     original "coarse" rationale) and the `SUB_COMPONENT_FIELD` clause (the amendment) — the other
     3 tracks pass a single-entry array, unaffected in shape.
  Verified via a standalone pure-fixture script (not committed) reproducing Naveen's exact sample
  text byte-for-byte, plus a hand-derived expectation for the new SUPPORT dual-clause shape;
  `yarn lint` clean; env-free cold build green, 41 ƒ Dynamic unchanged (no schema/route shape
  changed by this correction). No other track's public contract changed — `buildAllTrackJql`'s
  return shape (`{ FEATURE, TECH_DEBT, INTERNAL_BUG, SUPPORT }`, each a plain JQL string) is
  unchanged, so `sprint-start-dialog.jsx`'s client-side preview and the `sprint-start` route's
  generation stay byte-identical to each other with no call-site changes needed.
- **2026-07-27 — admin-side sprint "Edit" button.** `/admin`'s "Sprints (Gates)" list previously
  offered only a state-change dropdown per row; a per-row `Edit` button was added, reusing
  `components/dashboard/sprint-config-dialog.jsx`'s existing `edit` mode as-is (no new dialog, no
  server-side change — `PATCH /api/sprints/[sprintId]` already accepted `fixVersions`). Not in the
  original spec; added because the only prior edit path (`/`'s admin-gated "Configure Sprint")
  requires first selecting the target sprint in that page's own dropdown, which is not
  discoverable from `/admin` itself.
- **`groupSubComponentsByComponent` lives in `track-jql.mjs`, shared** — the spec described the
  grouping logic inline in the sprint-start route; it was factored into one exported pure function
  so `dashboard-data.js` (for the dialog's preview) and the API route compute `componentGroups`
  identically, rather than two hand-written copies drifting apart.
- **`dashboard-data.js` gained `sprintStartConfig: { issueTypeOverrides, componentGroups }`** on the
  selected team (via a new `getTeamSprintStartConfig` helper) — not explicitly named in the spec's
  route/UI sections, but required so the dialog's live JQL preview and submit-disable logic have
  data to work with without a new GET route.
- **The dialog's JQL preview is computed fully client-side**, importing `buildAllTrackJql` directly
  from `track-jql.mjs` (a plain pure module, no Prisma/fetch) — the same pattern
  `add-filter-dialog.jsx` already uses for `WORKFLOWS`. What the dialog shows before submit is
  therefore guaranteed byte-identical to what the server generates, with no server round-trip.
- **`ConflictError` (409) added to `route-helpers.js`**, next to `ValidationError` — the spec called
  for a 409 on double-claiming a sub-component but didn't name where the error class should live;
  it follows the existing `ValidationError`/`NotFoundError` convention exactly (thrown, mapped in
  `handleRouteError`).
- **Admin's inline Sprint form was restructured from one row to two** (dates row, then a
  fixVersions + submit row) to fit the new field without cramming a 5th column into the existing
  `sm:grid-cols-[1fr_auto_auto_auto_auto]` template.
- **Eleven `react/no-unescaped-entities` lint errors** (apostrophes/quotes in new JSX copy) were
  fixed with HTML entities (`&rsquo;`, `&ldquo;`/`&rdquo;`) — routine, not a design change.
- Verification surfaced a **pre-existing, unrelated stale `next-server` process** already holding
  :3002 from before this session (serving 500s against the old Prisma client) — killed and
  restarted with a fresh `yarn dev`, the same stale-dev-server hazard this project's history has
  hit repeatedly on schema-change features.
- The runtime smoke against real data incidentally confirmed **Naveen already has real scrum teams
  synced** (e.g. "GM PreCheckout", "Configurator & Website Setup") — useful context for the human
  acceptance step, which should claim sub-components for one of these real teams rather than a
  fresh one.

## Doc-sync (§17 — same PR)

- **§5**: new feature-list row.
- **§9**: `JiraComponent`/`JiraSubComponent` blocks + `Team`/`Sprint` field additions, byte-consistent.
- **§11**: admin catalog screen + dashboard one-click dialog notes.
- **§13**: note that filter-creation RBAC is unchanged (no carve-out — decision 4).
- **§16**: append this feature's decisions, especially decision 4 (no RBAC change) and decision 7
  (External Bug is component-scoped, not sub-component-scoped).
- **Master plan**: post-v1 addition (not a numbered step — the plan is complete, like `gm-bug-report.md`).
- **current-feature.md**: Status/History per the finish-feature ritual.

## References

- `context/features/gm-bug-report.md` — the External Bug (`ENG`/`Tap Ticket`) precedent, and the
  "admin config, not Jira-discovered, not AI" philosophy this feature also follows.
- `context/features/sync-hybrid-seeding.md` — `syncTeamSprint`, called server-side from the new route.
- `context/features/ed-rollup.md` / `domain-apis.md` — `requireTeamRole`/`TEAM_MANAGER_ROLES` RBAC precedent.
- `Tekion JIRA Book - 2025-26.xlsx` (sheets "Scrum Teams", "Component Masterlist v2", "Fix Versions")
  — the org-wide source data this feature's admin catalog is a scoped-down, manually-entered slice of.
