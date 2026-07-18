# Sprint Tracker (Tek Tracker) — Project Overview

> **Status of this document:** This is the canonical reference for the Sprint Tracker project.
> Every future feature, refactor, or AI-assisted change should be consistent with this file.
> When reality and this doc diverge, **fix the doc in the same change**. Sections are marked
> **[BUILT]**, **[PARTIAL]**, **[PLANNED]**, or **[GAP]** so the as-built state is never confused
> with the target state.
>
> Last reviewed: 2026-07-18 · Owner: Naveen · Audience: engineers + Claude Code.
>
> **Path note (cutover, 2026-07-18):** the Next.js app was promoted from the `web/` subfolder to
> the **repo root**, and the legacy Vite/Express app was backed up into **`legacy/`**. Historical
> `web/...` paths in dated entries below refer to the pre-cutover layout — read them as today's
> repo root. They are deliberately not rewritten.

---

## 1. Product vision

One fast, comprehensive view of an entire sprint — from roadmap to backlog — in one place,
without hunting through multiple Jira filters. Sprint Tracker sits *on top of* Jira and adds the
**software-development lifecycle (SDLC) granularity** that raw Jira status cannot express, plus
roll-ups that leadership can actually read.

It is an **internal engineering tool at Tekion Corp.**

---

## 2. Problem statement

1. **Filter sprawl.** ED, EM, TPM, QA and developers juggle many Jira filters throughout a sprint —
   roadmap, tech debt, internal bugs, support bugs, UAT issues — each needing constant attention.
2. **No leadership visibility.** VPs & EDs only see a sprint go from `0 → 1` between start and end.
   They have no signal mid-sprint about whether it is **on track**.
3. **Jira status is too coarse.** A single Jira status doesn't capture the real delivery lifecycle:
   `PM clarification → HLD/LLD → coding → API contract → FE/BE integration → E2E testing → demo →
   PR review/deployment → deployment`. Sprint Tracker models these **stages** so an EM/Lead can give
   a granular, trustworthy update upward to ED/VP.

---

## 3. Personas & access model

| Persona | Scope | Primary need |
|---|---|---|
| **Lead** | **1 scrum team** | Capture the full SDLC of a scrum team's Jira work (roadmap, support, tech debt, internal bugs). |
| **EM / SEM** | **2–3 scrum teams** | Capture the full SDLC across their scrum teams; per-team and combined views. |
| **ED / TPM** | **N scrum teams** | Aggregate view across multiple scrum teams. |
| **VP** | Portfolio | High-level "is the sprint on track" health + trend. |
| **Admin** | Org/team config | Manage sprint configuration, gates, team membership. |

Key relationships:
- **Lead manages 1 scrum team; EM/SEM manages 2–3 scrum teams; ED manages N scrum teams.** A user can
  belong to many teams with different roles. EM/SEM and ED-level views are **cross-team roll-ups**, not
  a separate data source.
- Each scrum team has dedicated **filters/tracks**: Roadmap, Tech Debt, Support, Internal Bugs.

> **[GAP — legacy app only; moot since cutover 2026-07-18]** The **legacy Vite build** (retired
> to `legacy/`) has no team, role, or multi-team concept — it is single-user and
> localStorage-scoped. In `web/` the team/membership model + RBAC landed in step 4 (2026-07-07)
> and the **multi-team roll-up view (`/rollup`) is BUILT (step 6b, 2026-07-08)** —
> membership-derived per §9. VP *trend* still needs the trend UI (step 10 post-v1; snapshot data
> exists since step 7). See §9, §10, §15.

---

## 4. Core concepts & glossary

- **Scrum team** — A unit of ~10–12 developers with dedicated tracks (Roadmap, Tech Debt, Support,
  Internal Bugs).
- **Filter / Track** — A Jira source feeding the board. Either a saved **Jira filter ID** or a raw
  **JQL** string. Each filter is tagged with a **workflow type** that decides which stages apply.
- **Workflow** — The stage template for a filter. Three exist today: `feature`, `techdebt`, `support`
  (see §6). Each has ordered stages and per-stage weights.
- **Stage** — A step in the delivery lifecycle for one work item. Stages are tracked as a **manual,
  ordered checklist overlay** on each issue (checking stage *n* auto-checks `0..n`). They are **not**
  currently derived from Jira status — see the critical note in §6.
- **Sprint / Gate** — A named release window with fixed `startDate`/`endDate` (and a release date).
  Tekion calls monthly releases "Gates" (e.g. *June 2026 Release*). All filters and progress are
  **scoped to a sprint**.
- **Health** — Per-issue and per-sprint status (On Track / At Risk / Behind / Blocked / Ahead / Done),
  computed from weighted stage completion vs. time-elapsed expectation (see §14).
- **Velocity** — Story points completed per week, with a naive linear projection to sprint end (§14).
- **Sync** — Pull the latest issues for every filter from Jira Cloud (refreshes the issue list and raw
  status; **does not** change manual stage progress).
- **Share view** — Share the exact configured view with someone else (e.g. EM → senior EM/Director).
- **Export** — A PDF/PNG report (weekly/daily leadership update) with key metrics + per-item breakdown.
- **Delivery Matrix** — The main grid: rows are issues grouped by filter, columns are stages, with
  health on the right and a collapsible "connected JQL" sidebar on the left.

---

## 5. Feature list

| Feature | State | Notes |
|---|---|---|
| Add Jira filters (by filter ID or JQL) | **[BUILT]** | `useSprintData.handleAddFilter`. **`web/` UI: AddFilter dialog → CRUD POST + immediate sync** (step 6a, 2026-07-08). |
| Update stages per work item | **[BUILT]** | Manual checklist; `toggleStage`. Not Jira-derived. **`web/` UI: matrix cells → idempotent PUT w/ server-owned cascade** (step 6a, 2026-07-08; hybrid-seeded since step 5). |
| Mark work item as blocked | **[BUILT]** | `toggleBlocked`. **`web/` UI: health chip → PUT blocked** (step 6a, 2026-07-08). |
| Remove Jira filter | **[BUILT]** | `handleRemoveFilter` (wipes stages). **`web/` UI: DELETE — progress survives by design (§9)** (step 6a, 2026-07-08). |
| Sync Jira (pull live status) | **[BUILT]** | Legacy: `handleSyncAll`; diffs added/removed issues. **`web/`: server-side sync engine + `POST …/sync` route with hybrid stage seeding** (step 5, 2026-07-07). |
| Configure sprint (dates, name) | **[PARTIAL]** | Legacy modal has no gating and no first-class sprint. **`web/`: admin-gated API (step 4) + admin-only UI (SprintConfig dialog + `/admin`, step 6a, 2026-07-08)**; legacy app ungated until cutover. |
| Reorder filters | **[BUILT]** | Drag + priority default sort. **`web/` UI: drag → PUT `…/filters/order`** (step 6a, 2026-07-08). |
| Export PDF / PNG | **[BUILT]** | Legacy: client-side `html2canvas` + `jsPDF`; include/exclude filters. **`web/` port (step 8, 2026-07-12): `html2canvas-pro` (Tailwind-v4-oklch-safe) + `jsPDF` over re-skinned offscreen A4 pages, dynamic-imported.** |
| Share view | **[BUILT in `web/` — 2026-07-12, step 8]** | Legacy still encodes the dataset into a base64 URL until cutover. **`web/`: server-persisted `SharedView` → public read-only `/share/[token]`** (192-bit token, live or frozen w/ `asOf`-pinned metrics, expiry, revocation); see context/features/share-view-export.md. |
| Multi-team / ED roll-up | **[BUILT in `web/` — 2026-07-08]** | Team + membership model and admin APIs came in step 4 (2026-07-07); the roll-up *view* is step 6b: read-only `/rollup` server page (combined `MetricGrid` + per-team table via pure `aggregateRollup`), membership-derived, no Sync — staleness from `lastSyncedAt`. |
| Trend / burndown / "projected by end of sprint" | **[PARTIAL — data BUILT in `web/` 2026-07-09]** | Daily per-team `SprintSnapshot` rows written by the step-7 cron (`POST /api/cron/daily`); the trend/burndown *UI* is still unbuilt (step 10 post-v1). |
| AI summary (Gemini) | **[GAP]** | Post-v1; use cases ratified 2026-06-10 (see §16). |
| Admin settings / RBAC | **[PARTIAL]** | Server-side RBAC live in the `web/` domain APIs (step 4, 2026-07-07): `User.isAdmin` + `TeamMembership.role` guards (`lib/rbac.js`) on teams/sprints/filters/progress. No admin UI yet. |

---

## 6. Workflows & stages

Defined in [`src/workflows.js`](src/workflows.js). Stages are ordered; weights sum to 100 and drive
weighted completion %.

**`feature` — Feature Development (Roadmap), priority 1**
```
PM clarification → HLD/LLD → API contracts → Working APIs → FE integration →
E2E testing → QA/PM demo → PR approved → Release ready → 1st Stage Env deployment
weights: [15, 20, 15, 15, 15, 8, 5, 3, 2, 2]
```

**`techdebt` — Tech Debt, priority 2**
```
Triaged → In Progress → Code Review → In QA
weights: [15, 65, 15, 5]
```

**`support` — Support Bugs, priority 3**
```
Triaged → In Progress → Code Review → In QA
weights: [20, 60, 15, 5]
```

> **Spec note:** The handwritten spec lists **Internal Bugs** as a fourth track. Today internal bugs
> reuse the `support`/`techdebt` 4-stage workflow. If Internal Bugs needs its own stages/weights, add
> a `internalbug` workflow.

### ⚠️ Critical design decision: stages are manual, not synced — LEGACY ONLY (hybrid built in `web/`)

In the **legacy Vite app**, stage completion is a manual overlay stored per issue
(`issueStages[key].stages` = array of booleans) and toggled by the user. Jira **Sync** refreshes the
issue list and raw Jira status but **does not populate stage progress**. `transformJiraIssue`
computes a `stage`/`percent` from Jira status, but those values are effectively unused — the real
progress comes from manual checkboxes.

Consequences (legacy):
- All health/velocity/% metrics are only as accurate as the team's manual discipline.
- The 10-stage feature lifecycle does not map 1:1 to Jira statuses, so full automation isn't trivial.

**The hybrid target model is IMPLEMENTED in `web/` (step 5, 2026-07-07):** on sync, missing
`IssueProgress` rows are *seeded* from the `StatusStageMapping` table (team override beats global,
case-insensitive; `seededFromStatus` records the baseline); **existing rows are never touched — manual
edits win** (create-only, §16). Owning workflows are re-evaluated on sync (§9). A "re-seed forward
when a row still equals its seeded baseline" reconciliation is deferred until real usage demands it.
See context/features/sync-hybrid-seeding.md.

---

## 7. Legacy architecture (retired 2026-07-18 — backed up in `legacy/`)

> This section describes the original Vite/Express prototype. At cutover (master-plan step 10) it
> was **moved to `legacy/`, not deleted** (decided with Naveen 2026-07-18), and remains startable
> there for reference — Node 20 only, see `legacy/README.md`. It is kept as the honest map of
> what `legacy/` contains; do not rewrite it to describe the Next.js app (that lives in §8–§13).

```
Browser (Vite 2 + React 18, JSX)
  ├─ localStorage  ← ALL app state (filters, stages, sprint config, density, collapse)
  └─ fetch(credentials:'include') ──▶ Express proxy (server.js, :3001)
                                        ├─ express-session + session-file-store (.sessions/)
                                        │     stores jiraEmail + jiraToken (PLAINTEXT)
                                        └─ proxies to Jira Cloud REST v3 (Basic auth = email:token)
```

- **Auth** ([server.js](server.js)): `POST /api/auth/login` validates `email:token` against Jira
  `/myself`, then stores them in a server-side session cookie (httpOnly). `/me`, `/logout` round it out.
- **Jira proxy**: `/api/jira/filter/:id`, `/api/jira/search` (→ Jira `/search/jql`, paginated via
  `nextPageToken`), `/issue/:key`, plus dashboard/scrape endpoints.
- **Frontend data flow**: `Root` (auth gate) → `App` → hooks:
  `usePersistedSprintState` (localStorage), `useSprintData` (Jira CRUD + stage toggles),
  `useSprintMetrics` → `computeSprintMetrics`, `useExport`.
- **Hardcoded Jira fields**: story points `customfield_10008` (legacy `customfield_10016`),
  sprint `customfield_10020`.
- **Sprint identity**: `getSprintKey(config) = "${startDate}_${endDate}"` — a date range, not an ID.

This works for a single EM on one machine. It does **not** satisfy the multi-team, multi-user,
leadership-visibility goals.

---

## 8. Target / production architecture **[PLANNED]**

```
Next.js 16 (App Router) — single deployable
  ├─ Route Handlers / Server Actions      ← replaces Express proxy (server.js)
  ├─ Auth (server session)                ← Jira identity; tokens encrypted at rest
  ├─ Prisma 7 ──▶ Postgres (Neon)         ← teams, sprints, filters, issue cache, progress, shares
  ├─ Jira Cloud REST v3 client            ← per-user token OR Atlassian OAuth (see §13)
  ├─ Background sync (cron/queue)          ← refresh issue snapshots; write daily SprintSnapshot
  ├─ Redis (optional)                      ← hot reads / rate-limit smoothing for ED multi-team views
  └─ Gemini (optional)                     ← narrative summary for exports/leadership digest
```

> **[BUILT in `web/` 2026-07-09, step 7]** — the "Background sync (cron/queue)" line: an external
> cron (Tekion infra) hits the secret-gated `POST /api/cron/daily`, which refreshes every
> filter-bearing team's Issue cache through the step-5 sync engine and upserts the daily per-team
> `SprintSnapshot` for each ACTIVE sprint (see context/features/background-sync-snapshots.md).
> §8 stays [PLANNED] overall — Redis and Gemini remain optional-future.

Migration guidance:
- Port every `server.js` route to a Next.js Route Handler under `app/api/...`. Keep the same
  request/response contracts so the React layer changes minimally.
- Replace `import.meta.env.VITE_*` with Next.js env conventions; drop the dual proxy/direct mode.
- Move all `localStorage` reads/writes behind a data-access layer backed by Prisma. localStorage may
  remain only for **ephemeral UI prefs** (density, collapse), never for shared domain data.
- Strongly consider **TypeScript** for the migration: the app is data-model-heavy and Prisma emits
  types for free. The spec says JavaScript; if we keep JS, at minimum add JSDoc + `zod` validation at
  every API boundary.

---

## 9. Data model **[BUILT in `web/` — ported verbatim 2026-06-14]**

This was **missing from the original spec**; below is the production data model designed for the
multi-team personas. As of 2026-06-14 (Feature 3) it is **ported verbatim** to
[`web/prisma/schema.prisma`](web/prisma/schema.prisma) and applied as the `init` migration. Keep
this section and that file byte-consistent — change both in the same PR (doc-sync, §17).

> **As-built Prisma 7 deviations** (the schema below is Prisma 7; §9 was first drafted against
> Prisma 5/6 conventions):
> 1. **`url` is no longer allowed in the `datasource` block.** Prisma 7 removed it; the connection
>    string for Prisma Migrate/CLI lives in [`web/prisma.config.mjs`](web/prisma.config.mjs)
>    (`datasource.url`, loaded from `DATABASE_URL` via `dotenv`), and the runtime client connects via
>    the `@prisma/adapter-pg` driver adapter in [`web/src/lib/db.js`](web/src/lib/db.js). See
>    https://pris.ly/d/prisma7-client-config.
> 2. **Generator is the modern `prisma-client`** (Prisma 7's `prisma init` default; the legacy
>    `prisma-client-js` is deprecated). It is ESM-first and requires an explicit `output`, and it
>    **emits TypeScript** to `web/src/generated/prisma` (gitignored; recreated by `postinstall` /
>    `db:generate`). The runtime client is imported from `@/generated/prisma/client` in
>    [`web/src/lib/db.js`](web/src/lib/db.js). Using the latest Prisma generator was chosen
>    deliberately (with Naveen, 2026-06-14) over keeping the app strictly `.ts`-free; authored app
>    source stays `.js`/`.jsx` and Next 16 + Turbopack compiles the generated `.ts` without needing a
>    `tsconfig.json` (the `@/*` alias stays in `jsconfig.json`). The generated dir is excluded from
>    ESLint.

```prisma
// datasource + generator
datasource db {
  provider = "postgresql"
  // url moved to prisma.config.mjs in Prisma 7 (see deviation #1 above); the runtime client
  // connects through the @prisma/adapter-pg driver adapter (web/src/lib/db.js).
}

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

// ─────────────────────────────────────────────────────────────
// Identity & access
// ─────────────────────────────────────────────────────────────

model User {
  id             String           @id @default(cuid())
  jiraAccountId  String           @unique          // stable Atlassian account id
  email          String           @unique
  displayName    String
  avatarUrl      String?
  isAdmin        Boolean          @default(false)  // global app admin (team-independent); distinct from TeamMembership.role = ADMIN. RBAC checks this.
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  credential     JiraCredential?
  memberships    TeamMembership[]
  createdSprints Sprint[]         @relation("SprintCreatedBy")
  progressEdits  IssueProgress[]  @relation("ProgressUpdatedBy")
  sharedViews    SharedView[]
}

/// Personal Jira access. Token is ENCRYPTED at rest (app-layer AES-GCM, key from KMS/secret).
/// Never store the raw token. Prefer Atlassian OAuth (3LO) for production — see §13.
model JiraCredential {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  jiraEmail       String
  encryptedToken  String                        // AES-GCM ciphertext (or OAuth refresh token)
  cloudId         String
  baseUrl         String                        // e.g. https://tekion.atlassian.net
  lastValidatedAt DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

enum Role {
  ADMIN      // team-scoped admin role (a TeamMembership). Global app admin is User.isAdmin, not this.
  ED         // engineering director — many teams
  TPM        // technical program manager — many teams
  EM         // engineering manager — one team
  LEAD
  MEMBER
  VIEWER     // read-only (share-view recipients, VPs)
}

/// A scrum team. ED roll-ups are just "the set of teams a user is an ED/TPM member of".
/// Single implicit org (decided 2026-06-10): no Org table; sprints are global.
model Team {
  id                 String           @id @default(cuid())
  name               String
  key                String           @unique         // short handle, e.g. "GM"
  description        String?
  jiraProjectKeys    String[]                         // projects this team owns
  storyPointsFieldId String?                          // Jira custom field override (default customfield_10008)
  sprintFieldId      String?                          // Jira custom field override (default customfield_10020)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  memberships     TeamMembership[]
  filters         Filter[]
  filterTemplates FilterTemplate[]
  progress        IssueProgress[]
  snapshots       SprintSnapshot[]
  statusMappings  StatusStageMapping[]
}

model TeamMembership {
  id       String   @id @default(cuid())
  userId   String
  teamId   String
  role     Role
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  team     Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, teamId])
  @@index([teamId])
}

// ─────────────────────────────────────────────────────────────
// Sprint, filters, issues, progress
// ─────────────────────────────────────────────────────────────

enum SprintState {
  PLANNING
  ACTIVE
  CLOSED
}

/// First-class, GLOBAL sprint (a.k.a. Gate). One shared cadence for all teams
/// (org-wide sprint calendar decided 2026-05-29; single implicit org decided 2026-06-10).
/// Replaces the "startDate_endDate" string key. If a team ever needs a different window,
/// add an optional per-team override table — don't move dates onto Filter.
model Sprint {
  id               String      @id @default(cuid())
  name             String      @unique           // "June 2026 Release"
  developmentStart DateTime
  developmentEnd   DateTime
  releaseDate      DateTime?
  state            SprintState @default(PLANNING)
  isGate           Boolean     @default(true)
  createdById      String?
  createdBy        User?       @relation("SprintCreatedBy", fields: [createdById], references: [id])
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  filters          Filter[]
  progress         IssueProgress[]
  snapshots        SprintSnapshot[]
  sharedViews      SharedView[]

  @@index([state])
}

enum WorkflowType {
  FEATURE
  TECH_DEBT
  SUPPORT
  INTERNAL_BUG
  CUSTOM
}

enum FilterSourceType {
  JQL
  JIRA_FILTER
}

/// Reusable per-team definition of a track (the JQL/filter + which workflow's stages apply).
/// Instantiated into a sprint as a Filter. Optional convenience — you can also create Filters directly.
model FilterTemplate {
  id           String           @id @default(cuid())
  teamId       String
  team         Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  name         String
  workflowType WorkflowType
  sourceType   FilterSourceType
  jql          String?
  jiraFilterId String?
  accentColor  String?
  createdAt    DateTime         @default(now())
}

/// A track owned by a TEAM within a shared SPRINT. Spec: "all sprint filters are specific to a
/// sprint"; cadence is org-wide so a filter is scoped by (team, sprint). An ED roll-up is the union
/// of filters across the teams they belong to, for the selected sprint.
model Filter {
  id           String           @id @default(cuid())
  teamId       String
  team         Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  sprintId     String
  sprint       Sprint           @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  name         String
  workflowType WorkflowType     @default(FEATURE)
  sourceType   FilterSourceType
  jql          String?
  jiraFilterId String?
  accentColor  String?
  sortOrder    Int              @default(0)        // drives delivery-matrix ordering
  lastSyncedAt DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  issues       Issue[]

  @@index([teamId, sprintId, sortOrder])
}

/// Cached snapshot of a Jira issue as it appeared at last sync. Source of truth stays in Jira.
model Issue {
  id               String   @id @default(cuid())
  filterId         String
  filter           Filter   @relation(fields: [filterId], references: [id], onDelete: Cascade)
  jiraKey          String                          // e.g. "GM-1234"
  title            String
  issueType        String
  jiraStatus       String                          // raw Jira status at last sync
  assigneeName     String?
  assigneeAccountId String?
  storyPoints      Float    @default(0)
  priority         String?
  dueDate          DateTime?
  jiraSprintName   String?
  fixVersions      String?
  lastSyncedAt     DateTime @default(now())

  @@unique([filterId, jiraKey])
  @@index([jiraKey])
}

/// The stage overlay (hybrid: seeded from Jira status, manual edits win) + blocked flag.
/// Keyed by (team, sprint, jiraKey) so it SURVIVES re-syncs even when the Issue cache row is
/// replaced, and so an issue keeps progress if it moves between filters within the same
/// team+sprint. (Keying decided 2026-05-29; ONE shared row per issue decided 2026-06-10.)
/// If the same key appears under filters of different workflow types, the OWNING workflow is the
/// highest-priority filter containing it (feature > techdebt > support); `workflowType` and the
/// `stageCompletion` length follow the owning workflow, re-evaluated on sync.
model IssueProgress {
  id               String       @id @default(cuid())
  teamId           String
  team             Team         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  sprintId         String
  sprint           Sprint       @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  jiraKey          String
  workflowType     WorkflowType @default(FEATURE)  // owning workflow; defines stageCompletion shape
  stageCompletion  Boolean[]                       // length = workflow stage count
  blocked          Boolean  @default(false)
  blockedReason    String?
  seededFromStatus String?                         // last Jira status used to seed stages (hybrid model)
  updatedById      String?
  updatedBy        User?    @relation("ProgressUpdatedBy", fields: [updatedById], references: [id])
  updatedAt        DateTime @updatedAt

  @@unique([teamId, sprintId, jiraKey])
  @@index([sprintId])
}

/// Jira-status → stage seeding table for the hybrid stage model (decided 2026-06-10).
/// Seeding checks stage `stageIndex` (auto-checking 0..n per the checklist rule) the FIRST time an
/// IssueProgress row is created for an issue; after that, manual edits always win. Global defaults
/// (teamId = null) seeded at install; admins may add per-team overrides.
model StatusStageMapping {
  id           String       @id @default(cuid())
  workflowType WorkflowType
  jiraStatus   String                              // raw Jira status name (matched case-insensitively)
  stageIndex   Int                                 // index into the workflow's ordered stages
  teamId       String?                             // null = global default
  team         Team?        @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([workflowType, jiraStatus, teamId])
}

// ─────────────────────────────────────────────────────────────
// Sharing & trends
// ─────────────────────────────────────────────────────────────

/// Server-persisted shared view → a SHORT token instead of a giant base64 URL.
/// `isLive=true` renders current data; otherwise `snapshot` holds a frozen copy.
model SharedView {
  id            String   @id @default(cuid())
  token         String   @unique @default(cuid())
  sprintId      String
  sprint        Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  createdById   String
  createdBy     User     @relation(fields: [createdById], references: [id])
  isLive        Boolean  @default(true)
  includedFilterIds String[]
  viewDensity   String   @default("dense")
  snapshot      Json?                              // frozen state when isLive=false
  expiresAt     DateTime?
  createdAt     DateTime @default(now())

  @@index([sprintId])
}

/// Daily roll-up for burndown / trend / "projected by end of sprint" (solves VP visibility, §2.2).
/// PER TEAM per sprint (decided 2026-06-10) so ED/VP views get team-level trend lines;
/// org-wide totals are the sum over teams.
model SprintSnapshot {
  id              String   @id @default(cuid())
  sprintId        String
  sprint          Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  teamId          String
  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  capturedOn      DateTime                         // date (one row per day)
  totalPoints     Float
  completedPoints Float
  avgProgress     Int
  healthCounts    Json                             // { blocked, behind, atRisk, onTrack, ahead, done }
  totalIssues     Int

  @@unique([sprintId, teamId, capturedOn])
  @@index([sprintId])
}
```

### Entity-relationship diagram

Relationship view of the §9 schema (crow's-foot; `||` one, `o{` zero-or-many, `o|`/`|o`
zero-or-one). Attributes are trimmed to identity, foreign keys, and a few domain-critical
columns — the Prisma block above remains the source of truth.

```mermaid
erDiagram
    USER ||--o| JIRA_CREDENTIAL : "has"
    USER ||--o{ TEAM_MEMBERSHIP : "joins via"
    USER |o--o{ SPRINT : "created"
    USER |o--o{ ISSUE_PROGRESS : "last edited"
    USER ||--o{ SHARED_VIEW : "created"

    TEAM ||--o{ TEAM_MEMBERSHIP : "has"
    TEAM ||--o{ FILTER_TEMPLATE : "owns"
    TEAM ||--o{ FILTER : "owns"
    TEAM ||--o{ ISSUE_PROGRESS : "owns"
    TEAM |o--o{ STATUS_STAGE_MAPPING : "overrides"
    TEAM ||--o{ SPRINT_SNAPSHOT : "rolled up in"

    SPRINT ||--o{ FILTER : "scopes"
    SPRINT ||--o{ ISSUE_PROGRESS : "scopes"
    SPRINT ||--o{ SHARED_VIEW : "scopes"
    SPRINT ||--o{ SPRINT_SNAPSHOT : "scopes"

    FILTER ||--o{ ISSUE : "caches"

    USER {
        string id PK
        string jiraAccountId UK
        string email UK
        string displayName
        bool isAdmin
    }
    JIRA_CREDENTIAL {
        string id PK
        string userId FK,UK
        string encryptedToken
        string cloudId
        string baseUrl
    }
    TEAM {
        string id PK
        string key UK
        string name
        string_arr jiraProjectKeys
    }
    TEAM_MEMBERSHIP {
        string id PK
        string userId FK
        string teamId FK
        Role role
    }
    SPRINT {
        string id PK
        string name UK
        datetime developmentStart
        datetime developmentEnd
        SprintState state
        string createdById FK
    }
    FILTER_TEMPLATE {
        string id PK
        string teamId FK
        WorkflowType workflowType
        FilterSourceType sourceType
    }
    FILTER {
        string id PK
        string teamId FK
        string sprintId FK
        WorkflowType workflowType
        FilterSourceType sourceType
        int sortOrder
    }
    ISSUE {
        string id PK
        string filterId FK
        string jiraKey
        string jiraStatus
        float storyPoints
    }
    ISSUE_PROGRESS {
        string id PK
        string teamId FK
        string sprintId FK
        string jiraKey
        WorkflowType workflowType
        bool_arr stageCompletion
        bool blocked
        string updatedById FK
    }
    STATUS_STAGE_MAPPING {
        string id PK
        WorkflowType workflowType
        string jiraStatus
        int stageIndex
        string teamId FK "null = global"
    }
    SHARED_VIEW {
        string id PK
        string token UK
        string sprintId FK
        string createdById FK
        bool isLive
    }
    SPRINT_SNAPSHOT {
        string id PK
        string sprintId FK
        string teamId FK
        datetime capturedOn
        float totalPoints
        float completedPoints
    }
```

> **Note — `Issue` ↔ `IssueProgress` are intentionally decoupled.** There is no FK between them; the
> cache (`Issue`, keyed by `filterId + jiraKey`) and the product data (`IssueProgress`, keyed by
> `teamId + sprintId + jiraKey`) are joined by `jiraKey` at read time. This is what lets manual stage
> edits survive a re-sync that replaces the `Issue` row, and lets progress follow an issue across
> filters within the same team+sprint (see §6, §9 rationale). Enum types (`Role`, `SprintState`,
> `WorkflowType`, `FilterSourceType`) are omitted from the diagram.

**Entity rationale & tweak points**
- **User / TeamMembership** model "EM = 1 team, ED = N teams" naturally: ED roll-ups are *"all teams
  where my membership role ∈ {ED, TPM}"*. Single implicit org (decided 2026-06-10): no `Org` table;
  add one later only if a deployment must host multiple portfolios. **Global app admin is the
  team-independent `User.isAdmin` flag** (added 2026-06-15), not a `TeamMembership` role — the first
  admin must create teams before any membership exists, so admin can't be team-scoped.
- **JiraCredential is separate** so tokens are isolated and encrypted; one place to swap to OAuth.
- **Sprint is first-class and global** (stable id, one shared cadence for all teams — decided
  2026-05-29), replacing the brittle `startDate_endDate` key. Renaming a sprint no longer loses data.
- **Filter is scoped by (team, sprint)** — org-wide cadence, team-owned tracks. `FilterTemplate` kept
  (decided 2026-06-10) so EMs don't re-type JQL every release.
- **Issue is a cache**; **IssueProgress is the real product data**, keyed by `(teamId, sprintId, jiraKey)`
  so manual stage edits survive re-syncs and never collide across teams. Fixes the "stages wiped on sync"
  risk. One shared progress row per issue (decided 2026-06-10); the owning `workflowType` is the
  highest-priority filter containing the key.
- **StatusStageMapping** powers the hybrid model (decided 2026-06-10): seed stages from Jira status on
  first sync; manual edits win thereafter (`seededFromStatus` records the baseline).
- **SharedView** replaces URL-encoded state with a short token + optional live rendering + expiry.
- **SprintSnapshot** is what makes leadership trend/burndown possible — write one row per day per
  team per active sprint from the background sync job.

---

## 10. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | **Migration complete (2026-07-18, step 10):** the Next app now lives at the repo root; the Vite 2 + React 18 prototype is backed up in `legacy/`. |
| Language | **JavaScript** (decided 2026-06-10) | With **zod validation at every API boundary** + JSDoc `@typedef`s on domain shapes. |
| Database | **Neon (PostgreSQL)** | Serverless Postgres; app itself runs on Tekion internal infra (decided 2026-06-10). |
| ORM | **Prisma 7** | Schema in §9. |
| Caching | **Redis** (optional) | For ED multi-team reads + Jira rate-limit smoothing. |
| Auth | **Jira email + API token, encrypted at rest** (decided 2026-06-10) | AES-GCM, key from a secret store; OAuth 3LO remains a later option (§13). **[BUILT in `web/` 2026-06-29]** iron-session cookie + AES-256-GCM `JiraCredential` (auth-layer.md). |
| AI | **Gemini** (post-v1) | Candidates ranked: risk/blocker call-outs, leadership narrative, Q&A over sprint data, stage suggestions. |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Current build uses hand-written CSS (`src/styles.css`). |

---

## 11. UI / UX

**Direction:** modern, minimal, in sync with Tekion standards. Dark + light mode. Clean typography,
generous whitespace, subtle borders and shadows. Desktop-first, mobile-usable.

**Micro-interactions:** smooth transitions, hover states, toast notifications, loading skeletons.

**Layout (main dashboard):**
- **Header:** Tekion logo · app name · 2–4 action buttons · search · **Add filter** · **Sync Jira** ·
  user name · **Logout**.
- **Hero:** sprint details + **Configure sprint**, **Export**, **Share view**.
- **Metric cards:** Health · Issues in scope · Weekly Velocity · At-Risk work.
- **Delivery Matrix:** collapsible **Connected JQL** sidebar (left); rows = issues grouped by filter;
  columns = **stages**; **Health** + at-risk indicator (right). Grouped under the sprint/gate name.

**Login page:** "Sprint Tracker — Connect your Jira account to get started." Inputs: **Jira Email**,
**API Token** (with "create token" hint → `id.atlassian.com → Security → API Tokens`), **Connect to
Jira** button. Footer: "Engineering Internal Tool @ Tekion Corp."

> Current components live under `src/components/{atoms,molecules,organisms,modals}` and are wired in
> `src/App.jsx`. Re-skin with Tailwind + shadcn during the Next.js migration rather than rewriting the
> logic in the hooks.
>
> **[BUILT in `web/` 2026-07-08, step 6a]** — login + team dashboard + minimal `/admin` re-skinned
> with Tailwind v4 + hand-written shadcn-style components on **server data**
> (`usePersistedSprintState` retired; localStorage keeps only density/collapse): `/login`, `/`
> (server component + client leaves: TopBar w/ team+sprint selectors, Hero, MetricGrid, FilterPanel,
> PlannerPanel matrix, AddFilter/SprintConfig/Alert dialogs), `/admin`. Export/Share buttons
> **landed with step 8 (2026-07-12)** — Hero "Share View" (ShareDialog: live/frozen, expiry,
> manage/revoke list, clipboard+toast) and "Export" (ExportDialog: filter toggles, paged preview,
> PDF/PNG via `html2canvas-pro`+`jsPDF`), plus the public read-only `/share/[token]` page; ED
> roll-up views are step 6b; dark-mode toggle and loading skeletons stay post-v1. See
> context/features/ui-port.md and context/features/share-view-export.md.
>
> **[BUILT in `web/` 2026-07-10 — ui-polish, step-6 addendum]** — the deferred polish landed as a
> full re-skin to the **legacy design system** (`src/styles.css` is the reference): legacy type
> stack (Manrope display / Inter body / JetBrains Mono via `next/font/google`), `#F4F7FA` canvas +
> ink-tinted shadow scale + motion tokens + health-triplet tokens in `globals.css` `@theme`, one
> shared ink Hero (`ui/hero-shell.jsx` + `hero-panel` utility: dual teal radial glows, glass
> `onDark` buttons, days-remaining pill) reused by `/` and `/rollup`, legacy matrix treatment
> (accent spines + `color-mix` section tints, teal key chips, 3-state bordered stage badges w/
> hover glow rings, bordered health pills, frozen first column), metric cards w/ tone stripes +
> icon tiles + display numerals, lucide icons replacing text glyphs, **success toasts**
> (`ui/toast.jsx`; errors keep the alert modal; admin `window.confirm` → styled confirm), and
> deterministic accent-palette assignment on filter creation (`accentColor`, the only
> non-presentation change). **Dark-mode toggle and loading skeletons remain post-v1** (the `.dark`
> token set stays dormant). See context/features/ui-polish.md.
>
> **[BUILT in `web/` 2026-07-08, step 6b]** — **`/rollup`**, the ED/TPM/EM multi-team roll-up:
> a read-only server page (one client leaf: sprint selector + "My board" + logout) rendering the
> **combined `MetricGrid`** (via pure `aggregateRollup`) over an SSR **per-team summary table**
> (key/name, my role, issues, pts done/total, avg %, health chip, 5-band counts, blocked,
> `lastSyncedAt` staleness, "Open board →" into `/?team=&sprint=`), sorted worst health first.
> Entry: a TopBar "Roll-up" link on `/` when the user has ≥2 teams or is admin (the URL renders a
> harmless 1-team roll-up otherwise). Deliberately **no Sync** here (§14.9 rate-limit storm) —
> freshness is step 7's cron. See context/features/ed-rollup.md.

---

## 12. Metrics & calculations

Reference implementation: [`src/workflows.js`](src/workflows.js) and
[`src/utils/sprintMetricsCompute.js`](src/utils/sprintMetricsCompute.js).

- **Weighted completion %** = Σ(weight of completed stages) / Σ(all weights), per issue.
- **Per-issue health** (`getHealthStatus`): compare completion % to *expected* progress
  `elapsedDays / totalDays`. Bands by delta: `≥+10 Ahead`, `−10..+10 On Track`, `−25..−10 At Risk`,
  `<−25 Behind`; plus `Blocked`, `Done` (100%), `Not Started` (0% & <5% expected).
- **Sprint health** (feature issues only): `Critical` if any blocked or >30% behind; `At Risk` if
  (atRisk+behind) >20%; `Complete`/`Excellent`/`Healthy`/`Fair` otherwise.
- **Velocity** (`getWeeklyVelocity`): `completedPoints / weeksElapsed`; projects `weeksNeeded =
  remainingPoints / velocity`. Velocity counts `feature` + `techdebt` only (support excluded). This is
  a **naive linear** model — replace with snapshot-based actuals once `SprintSnapshot` exists.
  (Snapshot rows exist as of step 7, 2026-07-09 — the UI still computes the naive model; the swap
  is step 10.)
- **Explicit clock (`asOf`) — `web/` only, step 8 (2026-07-12):** the time-dependent functions
  (`getHealthStatus`, `getWeeklyVelocity`, `computeSprintMetrics`) take an optional `asOf`
  (default: now). Frozen shared views pass their snapshot's `capturedAt` so health/velocity can't
  drift after capture; all other callers pass nothing and behave as before.

> All of the above depend on **manual stage completion** today. They become trustworthy only once the
> hybrid seed-from-Jira model (§6) lands.

---

## 13. Authentication & security

**Current:** `email:token` Basic auth to Jira, validated via `/myself`, stored in an `express-session`
file store. Token is **plaintext on disk** in `.sessions/`. Acceptable for a local single-user tool;
**not** acceptable for a shared deployment.

> **[BUILT in `web/` — 2026-06-29, migration step 3]** Items 1 & 5 below are implemented in the Next
> app (the legacy Vite/Express snapshot above is unchanged — both apps coexist until cutover). See
> [auth-layer.md](features/auth-layer.md): route handlers `app/api/auth/{login,me,logout}`,
> iron-session cookie (payload `{ userId }` only), `User` + `JiraCredential` upsert.

**Target hardening:**
1. **Encrypt tokens at rest** (AES-GCM, key from a secret manager / KMS) — model `JiraCredential`.
   **[BUILT in `web/`]** AES-256-GCM in `web/src/lib/crypto.js` (`iv ‖ authTag ‖ ciphertext`, key
   `TOKEN_ENCRYPTION_KEY`); written on login, raw token never persisted.
2. **Evaluate Atlassian OAuth 2.0 (3LO)** instead of personal API tokens. Personal tokens mean each
   user sees only what their token can see (fine for per-user data scoping, but tokens are long-lived
   secrets and a support burden). OAuth gives revocable, scoped access and refresh tokens.
3. **RBAC**: gate **Configure Sprint** and admin settings behind `Role.ADMIN` (+ ED) — the spec
   explicitly says sprint config is "for certain set of users (admin)". **[BUILT in `web/`
   2026-07-07, step 4]** — server-side guards (`requireAdmin`/`requireTeamRole`,
   `web/src/lib/rbac.js`) on every domain route; sprint mutations are **global-admin only** (the
   "+ ED" idea is deferred: `Sprint` is global while `ED` is a team-scoped role, so there is no
   principled team to check it against). **UI-level gating landed with step 6a (2026-07-08)**:
   Configure Sprint is admin-only chrome, `/admin` 404s for non-admins, VIEWERs get a read-only
   matrix — all still re-checked server-side per request.
4. **Share links**: short token, optional expiry, optional auth requirement; never embed the dataset.
   **[BUILT in `web/` 2026-07-12, step 8]** — `/share/[token]` over `SharedView`: app-generated
   192-bit token (the schema's cuid default is too guessable for a capability URL), read-time expiry,
   creator/admin revocation, dataset never in a URL. The "optional auth requirement" is deliberately
   **NOT built** (needs a schema column; deferred until a concrete need — the token is the bearer
   capability, and the page is `robots: noindex`).
5. Move `SESSION_SECRET` and all secrets to the platform's secret store; rotate. **[PARTIAL in `web/`]**
   the legacy `SESSION_SECRET` is **retired** — `web/` reads `SESSION_PASSWORD` (iron-session sealing)
   and `TOKEN_ENCRYPTION_KEY` from env/secret store and **fails loudly** if absent (no `dev-secret`
   fallback). Rotation still TODO.

---

## 14. Known flaws, gaps & risks (call-outs)

Ordered by impact. These are the things the spec implies but the current build does not deliver, plus
spec-internal ambiguities to resolve.

1. **No multi-team / ED roll-up (core value gap).** The ED/TPM/VP personas — arguably the main reason
   the product exists ("VPs & EDs have no idea of sprint progress") — are unbuilt. Single-user
   localStorage cannot aggregate N teams. *Fix:* team model + Postgres (§9) + server-rendered roll-ups.
   **[Fixed in `web/` 2026-07-08, step 6b]** — membership-derived `/rollup` server page: per-team
   `computeSprintMetrics` + pure `aggregateRollup` (never merges per-team progress maps, §9);
   see context/features/ed-rollup.md. VP *trend* remains open until `SprintSnapshot` (step 7, §14.8);
   legacy app retired to `legacy/` at cutover (2026-07-18).
2. **Stages are manual and Jira sync doesn't touch them.** Metrics are only as good as manual upkeep,
   and the 10-stage lifecycle doesn't map to Jira status. *Fix:* hybrid seed-from-status model (§6).
   **[Fixed in `web/` 2026-07-07, step 5]** — sync seeds missing progress from `StatusStageMapping`,
   manual edits win thereafter; legacy app retired to `legacy/` at cutover (2026-07-18).
3. **Share view encodes the whole dataset in the URL.** Base64 of all filters + issues + stages will
   exceed URL limits for real sprints, leaks a snapshot into browser history, and is not live. *Fix:*
   `SharedView` token (§9). **[Fixed in `web/` 2026-07-12, step 8]** — token route `/share/[token]`,
   live or frozen (frozen snapshots pin metrics to `capturedAt` via the new metrics `asOf` clock);
   legacy app retired to `legacy/` at cutover (2026-07-18). See context/features/share-view-export.md.
4. **Jira tokens stored in plaintext.** *Fix:* encrypt at rest / OAuth (§13).
5. **Sprint identity is derived from mutable dates.** `getSprintKey = startDate_endDate` makes a
   sprint's identity its own dates — there's no stable handle to roll up or share by, and editing the
   dates orphans all data bucketed under the old key. *Fix:* first-class **org-level** `Sprint` rows
   (§9) with a stable id and one shared cadence for all teams. **[Fixed in `web/` 2026-07-07,
   step 4]** — `/api/sprints` CRUD over first-class rows; legacy app retired to `legacy/` at cutover (2026-07-18).
6. **Sprint config has no admin gating.** Spec wants admin-only; today anyone can change dates, which
   silently re-buckets all data. *Fix:* RBAC (§13). **[Fixed in `web/` 2026-07-07, step 4]** —
   sprint mutations require `User.isAdmin`; legacy app retired to `legacy/` at cutover (2026-07-18).
7. **Hardcoded Jira custom-field IDs** (`customfield_10008`, `_10020`). Brittle if projects differ.
   *Fix:* per-team field config; discover via Jira field metadata. **[Fixed in `web/` 2026-07-07,
   step 5]** — sync reads `Team.storyPointsFieldId`/`sprintFieldId` (those ids remain the global
   defaults; legacy `customfield_10016` still read as points fallback). Field discovery UI still TODO.
8. **No history / burndown.** Can't answer "projected by end of sprint" or show a trend — exactly the
   leadership signal §2.2 demands. *Fix:* `SprintSnapshot` daily job (§9). **[Fixed in `web/` (data
   side) 2026-07-09, step 7]** — daily per-team snapshots written by `POST /api/cron/daily`
   (context/features/background-sync-snapshots.md); the trend *UI* is still open (step 10).
9. **No caching; sequential Jira calls.** An ED viewing N teams triggers many paginated live calls and
   risks Jira rate limits. *Fix:* background sync into the Issue cache + optional Redis.
   **[Partially addressed in `web/` 2026-07-09, step 7]** — the daily cron refreshes Issue caches in
   the background, so ED reads hit a warm cache; Redis is still open (optional/post-v1).
10. **Gemini has no defined use case.** Listed in the stack with no feature. *Decide scope* (proposed:
    auto-write the leadership narrative for exports) before building.
11. **JavaScript for a data-heavy, multi-persona app.** Higher bug surface. *Recommend* TypeScript for
    the migration, or `zod` validation at every boundary if staying on JS.
12. **Internal Bugs lacks its own workflow** (reuses support/techdebt stages). Add `internalbug` if it
    needs distinct stages.

---

## 15. Recommended production architecture (summary)

1. **Migrate to Next.js 16 App Router**, one deployable; port `server.js` routes to Route Handlers.
2. **Postgres (Neon) + Prisma 7** with the §9 schema; localStorage only for ephemeral UI prefs.
3. **Team-scoped multi-tenancy** with `Role`-based access; ED/VP views are server-side roll-ups.
4. **Hybrid stage model**: seed from Jira status on sync, manual override persisted per `(team, sprint, key)`.
5. **Background sync** (cron/queue) refreshing the Issue cache and writing `SprintSnapshot` daily.
   **[BUILT in `web/` 2026-07-09]** — secret-gated `POST /api/cron/daily` + `lib/cron/daily.js`.
6. **Encrypted credentials** (or Atlassian OAuth); secrets in a managed store.
7. **Token-based shared views** with expiry + optional auth.
8. **Optional Redis** for ED multi-team read performance; **optional Gemini** for export narratives.
9. **TypeScript** (or strict JSDoc + zod) for the rewrite.

---

## 16. Decisions (ratified 2026-06-10 with Naveen)

All previously open decisions are now resolved:

- **Stage model: HYBRID.** Seed `stageCompletion` from `StatusStageMapping` on first sync; manual
  edits win and persist thereafter (`seededFromStatus` keeps the baseline).
- **Auth: personal Jira API tokens, encrypted at rest** (AES-GCM, key in a secret store). Atlassian
  OAuth 3LO deferred, not rejected.
- **Language: JavaScript**, with zod validation at every API boundary + JSDoc typedefs on domain shapes.
- **Hosting: app on Tekion internal infra; database on Neon.**
- **Migration: fresh Next.js App Router app in a `web/` subfolder of this repo**; port hooks/components
  over; both apps runnable until parity, then promote `web/` to root and delete the Vite app.
  *(Amended 2026-07-18 with Naveen, executed at cutover: the Vite app was **backed up into
  `legacy/`, not deleted** — it stays startable there for reference, Node 20 only. See
  context/features/cutover.md.)*
  - **Deferred follow-up (added 2026-06-14): bump the runtime to Node 22 (≥22.12) once the Vite app is
    retired.** Today both apps share one Node and the legacy Vite 2 app pins us to Node 20.19.4; a
    transitive Prisma dep wants Node ≥22, worked around by `ignore-engines true` in `web/.yarnrc`.
    **[DONE 2026-07-18 at cutover]** — `.nvmrc` (22) + `engines >=22.12` added, the `.yarnrc` shim
    deleted; fresh install under Node 22.22.2 passes the engine check natively. The "re-verify the
    Vite app on 22" clause is void — the legacy app is retired-in-place on Node 20.
- **Filter templates: keep** (team-level `FilterTemplate`).
- **Roll-up grouping: single implicit org** — no `Org` table; sprints are global; ED views are
  membership-derived.
- **IssueProgress: one shared row per (team, sprint, jiraKey)**; owning workflow = highest-priority
  filter containing the key.
- **localStorage data: one-time importer** into Sprint/Filter/IssueProgress (don't lose current sprints).
  *(Dropped 2026-07-18 — no legacy localStorage data remains to import; master-plan step 9 skipped.)*
- **Internal Bugs: reuse the 4-stage workflow** (no dedicated stage set).
- **Provisioning: admin-managed** — seeded ADMIN creates teams and assigns members/roles; users sign in
  with Jira and wait to be added to a team.
- **Gemini: post-v1**, all four candidate use cases approved in principle (risk call-outs, narrative,
  Q&A, stage suggestions); start with risk call-outs + narrative since they need no new data plumbing
  beyond snapshots.

---

## 17. Conventions for future development

- **Update this doc** in the same PR whenever behavior, data model, or architecture changes; keep the
  `[BUILT]/[PARTIAL]/[PLANNED]/[GAP]` tags honest.
- **Domain data goes to Postgres**, never localStorage. localStorage is for ephemeral UI prefs only.
- **Validate at boundaries** (zod or schema validation) for every API route and Jira response.
- **Keep Jira specifics isolated** in a single client/service module (field IDs, JQL, pagination).
- **Metrics are pure functions** of (filters, progress, sprint) — keep `computeSprintMetrics` pure and
  unit-tested; never read storage inside it.
- **Respect RBAC**: any mutation (sprint config, admin settings) checks role server-side, not just UI.

---------



------- Production Migration Plan ---------

The plan — exact next steps, in order

1. Scaffold web/ — Next.js (App Router, JS), Tailwind v4 + shadcn, Prisma 7 pointed at Neon, zod. Both apps runnable side-by-side.
2. Schema + migrations — copy the §9 schema into prisma/schema.prisma, run the first migration, seed: you as ADMIN, the global default StatusStageMapping rows, and the three workflows' metadata.
3. Auth layer — port server.js login/me/logout to route handlers; validate against Jira /myself, upsert User + JiraCredential with AES-GCM-encrypted token (key from env/secret store); cookie sessions (e.g. iron-session) replacing the file store. **[DONE 2026-06-29]** — `app/api/auth/{login,me,logout}`, iron-session `{ userId }` cookie, AES-256-GCM `crypto.js`, isolated `lib/jira/client.js` (`fetchMyself`/`fetchCloudId`); `cloudId` discovered via `_edgeProxy/tenant_info`; secrets fail loudly. See context/features/auth-layer.md.
4. Domain APIs — zod-validated route handlers for teams/memberships (admin), sprints (admin), filter templates + filters, stage toggle/blocked writes to IssueProgress. **[DONE 2026-07-07]** — 14 route files under `web/src/app/api/` (`teams`+`members`, `sprints` (no DELETE — close via `state`), `filter-templates`, sprint-scoped `filters` incl. priority insertion + `order` reorder, `progress/[jiraKey]` idempotent PUT with the checklist cascade + owning-workflow derivation, admin `users`); `web/src/lib/rbac.js` (`requireAdmin`/`requireTeamRole`, global-admin bypass) + `web/src/lib/api/route-helpers.js` (`{ error }` + status mapping, P2002→409/P2025→404); per-resource zod schemas. No schema change. Verified by a 68-check curl matrix against Neon. See context/features/domain-apis.md.
5. Sync with hybrid seeding — port the Jira client (keep field IDs/pagination isolated in one module); on sync, upsert the Issue cache and create missing IssueProgress rows seeded via StatusStageMapping; never touch rows that already exist. **[DONE 2026-07-07]** — `lib/jira/client.js` grown (`getJiraAuthForUser` decrypting the caller's credential, `fetchFilter`, paginated `searchIssues` via `/search/jql` + `nextPageToken`, 2000-issue safety cap), pure `lib/jira/transform.js` (per-team field ids, full assignee+accountId/priority/dueDate now kept), `lib/sync/engine.js` + pure `lib/sync/seeding.mjs`, `POST /api/teams/[teamId]/sprints/[sprintId]/sync` (writer roles). Verified: 15 standalone checks + full pipeline live over HTTP (pagination, jql refresh, seeding shapes, create-only re-sync, manual-edit survival, removed-issue progress survival, owning-workflow re-eval 10→4). ⚠️ Real-Tekion-issue sync blocked: the stored API token is **dead** (expired/revoked; Jira degrades bad Basic auth to *anonymous*, so searches return empty instead of 401 — which also hid the failure). Engine now **fail-fasts via `/myself`** before syncing (verified live: 401 + reconnect message). *Update 2026-07-09 (step 7):* the stored token is **alive again** (Naveen re-logged in) — the step-7 cron ran the engine end-to-end against real Jira (`/myself` passed; `/search/jql` answered 200). A UI-driven sync of real filters is the remaining re-verify. See context/features/sync-hybrid-seeding.md.
6. UI port — pages for login, team dashboard (the existing Delivery Matrix, re-skinned), ED roll-up, admin; swap usePersistedSprintState for server data; localStorage keeps only density/collapse. **[DONE 2026-07-08 — 6a + 6b]** — 6a: `/login` + `/` dashboard (server component + Prisma reads via `lib/dashboard-data.js`, pure `lib/metrics.mjs` fixture-parity-checked against the prototype, client leaves fetching the step-4/5 routes + `router.refresh()`) + minimal `/admin`; RBAC-aware chrome (VIEWER read-only, admin-only sprint config), two localStorage prefs via `useSyncExternalStore`; verified by lint/DB-free build + ~30-check SSR smoke (see context/features/ui-port.md). 6b: membership-derived **`/rollup`** (server page + `getRollupData` batched reads + pure `aggregateRollup`/shared `bandSprintHealth`, per-team summary table, TopBar link at ≥2 teams or admin, no Sync — staleness from `lastSyncedAt`); verified by 34/34 pure fixtures + 32/32 SSR smoke (see context/features/ed-rollup.md). ⚠️ Real-Jira acceptance still pending, narrowed 2026-07-09: the token is alive and the sync engine ran live against real Jira (step 7), but the UI-driven flow (login page → dashboard Sync on real filters) hasn't been exercised.
7. Background job — a cron on your internal infra hitting an internal route: refresh issue caches + write the daily per-team SprintSnapshot for active sprints. **[DONE 2026-07-09]** — secret-gated `POST /api/cron/daily` (`CRON_SECRET` bearer, timingSafeEqual over sha256 digests; first session-less route) → `lib/cron/daily.js` `runDailyJob`: per ACTIVE sprint, sequential per-team refresh via the step-5 engine with the `CRON_SYNC_USER_EMAIL` service credential (absent/dead → refresh skipped, snapshots still written; per-team errors isolated), then batched per-team metrics → UTC-midnight `SprintSnapshot` upsert; pure `snapshotValues` in `lib/metrics.mjs`. Verified: 23/23 pure fixtures, DB/env-free build, 30/30 live dev+Neon checks (gates, hand-computed rows, PLANNING/filterless skips, degrade path, idempotent re-run, unset-secret 500). Scheduling on Tekion infra is a deploy-time task. See context/features/background-sync-snapshots.md.
8. Share view + export — SharedView token route (/share/[token], live or frozen, expiry) replacing the base64 URL; port PDF/PNG export. **[DONE 2026-07-12]** — public session-less `/share/[token]` (192-bit app-generated token, `robots: noindex`, generic invalid/expired state; live = current rows, frozen = input snapshot w/ metrics pinned to `capturedAt` via the new optional `asOf` clock threaded through `lib/metrics.mjs` + the MetricGrid/PlannerPanel/IssueRow props); writer-gated `POST/GET …/shares` (filterIds validated ⊆ team+sprint) + creator/admin `DELETE /api/shares/[shareId]`; ShareDialog (live/frozen, expiry presets, manage/revoke, clipboard+toast) + ExportDialog (filter toggles, paged preview, offscreen A4 pages → PDF/PNG) behind new Hero buttons. Deps `html2canvas-pro@2.2.3` (stock html2canvas can't parse the Tailwind-v4 oklch/`color-mix` theme — proven by a headless-Chrome capture spike) + `jspdf@2.5.2`, dynamic-imported (verified absent from the dashboard chunk). No schema change, no migration. Verified: lint; DB/env-free build (27 ƒ Dynamic); 25/25 asOf fixtures; 37/37 SSR smoke on dev+Neon incl. frozen-vs-live divergence, list scoping, revoke/expiry → generic page. Human acceptance (browser share open + real PDF/PNG) pending with the ui-polish eyeball. See context/features/share-view-export.md.
9. Importer — one-time script that takes the localStorage JSON (sprintTracker_sprintData + config) and writes Sprint/Filter/IssueProgress rows so your current sprints carry over. **[SKIPPED 2026-07-18]** — Naveen no longer has older sprint data in localStorage (current work already lives in `web/` via real syncs), so there is nothing to import; decided with Naveen 2026-07-18. Spec draft kept for reference at context/features/seed.md.
10. Cutover, then post-v1 — promote web/ to repo root, delete the Vite app; then burndown/trend UI from snapshots, then Gemini (risk call-outs + narrative first). **[DONE 2026-07-18 (cutover half)]** — two-phase `git mv` on `feature/cutover`: the Vite app (src/, server.js, docs/, lockfiles, untracked .env/node_modules/dist) **retired into `legacy/` instead of deleted** (ratified with Naveen 2026-07-18; startable there under Node 20 — verified :3000/:3001 answer) with plaintext-token `.sessions/` deleted; then `web/*` promoted to root (101 renames, history follows via `git log --follow`). Node 22 bump landed with it (`.nvmrc`, `engines >=22.12`, `.yarnrc` shim deleted, fresh install under 22.22.2). Config/docs: root `.gitignore` = web's + re-added `.claude/*` rules, `turbopack.root` pin kept (dual lockfile with `legacy/yarn.lock`), package renames (`sprint-tracker` / `sprint-tracker-legacy`), CLAUDE.md/AGENTS.md/README.md rewritten for the single-app root, `.claude/skills` `web/`-path sweep (+ `verify-web` renamed `verify`, per Naveen), `legacy/**` added to ESLint ignores (the only config-behavior change). Zero app-code changes; no schema change, no migration. Verified at root under Node 22: lint clean; `prisma validate` + `migrate status` up to date; **DB/env-free build green, 27 ƒ Dynamic (same as step 8)**; dev-server smoke on :3002 — unauth 307, login 200, unknown share → generic page, cron bad-bearer 401, `health/db` ok against Neon, minted-admin dashboard SSR with full chrome. **Deployment re-pointing (build from repo root) is a deploy-time task; post-v1 items (trend UI, Gemini) remain open.** See context/features/cutover.md.