# Import Vite localStorage data into Postgres

## Status

**SKIPPED 2026-07-18 (decided with Naveen) — never implemented.** No older sprint data remains in
the Vite app's localStorage (current work already lives in `web/` via real syncs), so there is
nothing to import. Master-plan step 9 is marked skipped in project-overview.md and the §16
"one-time importer" decision is annotated as dropped. This draft (written 2026-06-15, before
steps 3–8 landed — its prerequisites/idempotency notes predate the live Neon data) is kept for
reference only. The next in-order step is **10 (cutover)**.

## Overview

One-time **importer** that lifts the current Vite app's `localStorage` sprint data into the new
Prisma/Postgres schema, so existing sprints, filters, and **manually-tracked stage progress** carry
over to the production app. This is the "Importer" step of the
[Production Migration Plan](../project-overview.md) (master-plan step 9), pulled forward and run as a
small standalone feature now that the schema exists (Feature 3, done 2026-06-15).

It is a **CLI script**, not UI and not the install/bootstrap seed. The bootstrap seed (ADMIN user,
global `StatusStageMapping` defaults, workflow metadata) is a **separate** feature and a
**prerequisite** here — see _Prerequisites_.

> **Why an importer and not the hybrid seeder:** the hybrid model (§6/§9) seeds `stageCompletion`
> from Jira *status* on first sync. This importer is the opposite — it carries the **real manual
> edits** the user already made in the Vite app, verbatim. So imported `IssueProgress` rows set
> `seededFromStatus = null` (genuine manual data, never seeded) and the importer never consults
> `StatusStageMapping`.

## Source → target shapes

### Source (localStorage, written by `usePersistedSprintState`)

Two **domain** keys are imported; two ephemeral UI-pref keys are **ignored** (§17: localStorage is
for UI prefs only):

| Key | Imported? | Shape |
|---|---|---|
| `sprintTracker_sprintData` | ✅ | `{ [sprintKey]: { filters: Filter[], stages: { [issueKey]: { stages: boolean[], blocked: boolean } } } }` |
| `sprintTracker_sprintConfig` | ✅ | `{ name, startDate, endDate }` — the **current** sprint only |
| `sprintTracker_viewDensity` | ❌ ignored | `"dense" \| "comfortable"` (ephemeral) |
| `sprintTracker_filtersPanelCollapsed` | ❌ ignored | `"true" \| "false"` (ephemeral) |

- `sprintKey = \`${startDate}_${endDate}\`` (see `getSprintKey`). `sprintData` may hold **multiple**
  sprint keys, but only the one matching `sprintConfig` carries a stored **name**.
- `Filter` (from `transformFilter` + `useSprintData`): `{ id, name, jql, accent, workflow, issues[] }`
  where `workflow ∈ {feature, techdebt, support}` (default `feature`), and `id` is a numeric Jira
  filter id **or** a synthetic `jql-<timestamp>` for raw-JQL filters.
- `Issue` (from `transformJiraIssue`): `{ key, title, owner, jiraStatus, type, points, sprint,
  fixVersions, ... }`. **Lossy fields** — see below.
- `stages` is keyed by `issueKey` at the **sprint** level (already one row per issue per sprint), so
  it maps cleanly onto the `(team, sprint, jiraKey)` unique key of `IssueProgress`.

### Target (Prisma schema §9 / `web/prisma/schema.prisma`)

| localStorage | → Prisma | Notes |
|---|---|---|
| each distinct `sprintKey` | **Sprint** | `developmentStart`=startDate, `developmentEnd`=endDate; `name` from config or recovered (see _Naming_); `state` inferred from dates; `releaseDate` from `SPRINT_GATES` match else null |
| `filter` (per sprint) | **Filter** | `workflowType` = enum(workflow); `sourceType` = `id` startsWith `jql-` ? `JQL` : `JIRA_FILTER`; `jiraFilterId`/`jql` set accordingly; `accentColor`=`accent`; `sortOrder`=array index |
| `filter.issues[]` | **Issue** (cache) | `jiraKey`=`key`, `title`, `issueType`=`type`, `jiraStatus`, `assigneeName`=`owner` (first name only), `storyPoints`=`points`, `jiraSprintName`=`sprint`, `fixVersions` |
| `stages[issueKey]` | **IssueProgress** (product data) | `stageCompletion`=`stages`, `blocked`; `workflowType`=**owning workflow** (see below); `seededFromStatus`=null; `blockedReason`=null |

**Owning workflow for `IssueProgress.workflowType`** (one shared row per issue, §9): among the
filters in that sprint that contain the key, pick the **highest-priority** workflow
(`feature` > `techdebt` > `support`). Assert `WORKFLOWS[workflow].stages.length ===
stageCompletion.length`; on mismatch, pad/truncate with `false` and warn (techdebt/support are both
4-stage, so the booleans are shape-compatible — only the enum label differs).

**Lossy fields (cannot be reconstructed from localStorage — document, don't fake):**
- `Issue.priority` → `null` (`transformJiraIssue` never stored it).
- `Issue.dueDate` → `null` (`due` was a formatted `"Jun 05"` string with no year).
- `Issue.assigneeAccountId` → `null`; `assigneeName` keeps the **first name only**.
- These are cache fields; the next real Jira **Sync** backfills them. No product data is lost.

## Requirements

### Prerequisites (call out before running)

1. **Schema migrated** on the target DB (`prisma migrate deploy`). ✅ done for Neon dev.
2. **A target `Team` exists** (provisioning is admin-managed, §16). The importer attaches **all**
   imported data to **one** team (localStorage has no team concept). Pass it with `--team <key>`.
   `--create-team "<name>"` is a dev convenience that upserts the team first.
3. **An ADMIN `User` exists** for `createdById`/`updatedById` (both nullable, so optional). Defaults
   to the first `ADMIN`; override with `--created-by <email>`.

### The script

- Location: `web/scripts/import-localstorage.mjs` (Node ESM). Added package script
  `"db:import": "node scripts/import-localstorage.mjs"`.
- Reuses the **Prisma 7 adapter pattern** from `src/lib/db.js` (`PrismaPg` + `DATABASE_URL`) and
  loads env explicitly via `dotenv` (Prisma 7 stops auto-loading `.env` once `prisma.config.mjs`
  exists). A plain Node script can't use the `@/` alias — import the generated client by relative
  path.
- **Input file** (the user's exported data): `--file <path>`, default
  `web/scripts/seed-data/localstorage-dump.json`. This path is **gitignored** (it contains internal
  Jira keys/titles). Export snippet for the Vite app's browser console is in _Notes_.
- **Validate the dump with zod** at the boundary (§17) via the existing `validate()` helper +
  `src/lib/schemas/localstorage-dump.js`. Reject malformed input with a readable error before any
  write.
- **CLI flags:** `--file`, `--team` (req), `--create-team "<name>"`, `--created-by <email>`,
  `--force` (overwrite existing `IssueProgress`), `--dry-run` (summarize, write nothing).

### Idempotency (safe to re-run)

Wrap each sprint in a `prisma.$transaction`:
- **Sprint** — `upsert` by unique `name`.
- **Filter + Issue (cache, replaceable)** — delete existing `Filter`s for `(teamId, sprintId)` (this
  cascades their `Issue` rows) and recreate. `IssueProgress` is decoupled (no FK to Filter/Issue), so
  it is untouched by this.
- **IssueProgress (product data, preserve)** — `upsert` by `(teamId, sprintId, jiraKey)` with an
  **empty `update`** (create-only) so a re-run never clobbers edits made in the new app. `--force`
  switches `update` to overwrite. Mirrors the sync rule "never touch rows that already exist."

### Sprint naming & state

- Name: use `sprintConfig.name` for the matching key; otherwise match `(developmentStart,
  developmentEnd)` against `SPRINT_GATES` (workflows.js) to recover e.g. "June 2026 Release"; else
  synthesize `"<startDate> – <endDate>"`. `name` is `@unique`, so collisions can't silently merge.
- `state`: infer from dates vs. today (`endDate` past → `CLOSED`, spans today → `ACTIVE`, future →
  `PLANNING`); admin can correct later.

### Acceptance criteria

- `yarn db:import --file <dump.json> --team <key> --dry-run` prints a summary (counts of sprints,
  filters, issues, progress rows; lists lossy/derived fields) and writes **nothing**.
- A real run creates the rows; **running it twice produces no duplicates**, and an `IssueProgress`
  row edited in the new app survives the second run (unless `--force`).
- A malformed dump is rejected by zod with a human-readable message and **no partial writes**.
- The Vite app and its localStorage are **untouched** (export is read-only); ephemeral prefs
  (density, collapse) are not imported.
- `yarn build` and `yarn lint` in `web/` are unaffected (the script and `scripts/seed-data/` are
  outside the Next build; lint stays green).

### Out of scope

- The **bootstrap/install seed** (ADMIN user, global `StatusStageMapping` defaults, workflow
  metadata) — separate feature, and a prerequisite here.
- Hybrid Jira-status → stage seeding (this importer carries real manual stages; `seededFromStatus`
  stays null).
- Any in-app "Import" UI button; multi-team splitting (all data lands on one `--team`).
- Backfilling lossy cache fields (priority/dueDate/assignee id) — the first real Sync does that.

## Notes

**Browser export snippet** (run in the Vite app tab's devtools console; saves a download):

```js
const dump = {
  sprintConfig: JSON.parse(localStorage.getItem('sprintTracker_sprintConfig') || 'null'),
  sprintData:   JSON.parse(localStorage.getItem('sprintTracker_sprintData')   || '{}'),
};
const a = Object.assign(document.createElement('a'), {
  href: URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })),
  download: 'localstorage-dump.json',
});
a.click();
```

Drop the downloaded file at `web/scripts/seed-data/localstorage-dump.json` (gitignored) before
running `yarn db:import`.

- **I can write/run the importer from the code shapes alone** (done above). I only need the actual
  exported `localstorage-dump.json` to run it against your real sprints — share it when we implement,
  or run the snippet yourself and point `--file` at it.

## As-built deviations from the spec

_(fill in during implementation)_

## References

- @context/project-overview.md (§6 stage model, §9 data model, §16 decisions, Production Migration
  Plan step 9 "Importer")
- @context/coding-standards.md (zod-at-boundaries, Prisma conventions)
- `web/prisma/schema.prisma` · `web/src/lib/db.js` · `web/src/lib/validation.js`
- Source shapes: `src/hooks/usePersistedSprintState.js`, `src/hooks/useSprintData.js`,
  `src/jiraService.js`, `src/workflows.js`, `src/utils/sprintUtils.js`
