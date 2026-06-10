# Sprint Tracker / Tek Tracker - Project Overview

> Canonical reference for future Sprint Tracker development.
>
> Codex should use this file before building any new feature in this repository. If behavior,
> data shape, architecture, or product direction changes, update this document in the same change.
>
> Last reviewed: 2026-06-08. Source: handwritten project spec images plus the current working app.

---

## 1. Executive Summary

Sprint Tracker is an internal Tekion engineering tool that gives one fast, comprehensive view of a
sprint from roadmap to backlog without forcing EMs, EDs, TPMs, QA, and developers to jump across many
Jira filters.

The product sits on top of Jira. Jira remains the source of truth for issue metadata, ownership,
status, story points, and source JQL. Sprint Tracker adds the SDLC delivery-stage overlay, sprint
health metrics, exportable leadership reports, and eventually ED/VP multi-team roll-ups.

The working application exists today, but it is not yet production architecture. Current state is a
Vite + React + Express single-user app backed by localStorage. The target architecture in the spec is
Next.js + Prisma + Neon Postgres with persisted teams, sprints, filters, progress, sharing, and
historical snapshots.

Use these labels throughout this document:

- **[BUILT]** exists in the current repo.
- **[PARTIAL]** exists but does not fully satisfy the spec.
- **[PLANNED]** is target architecture or intended behavior.
- **[GAP]** is implied by the spec but missing today.

---

## 2. Product Vision

One view should answer:

- What is in the sprint across roadmap, tech debt, support, internal bugs, and UAT work?
- Which items are progressing through the actual delivery lifecycle?
- Is the sprint on track, at risk, blocked, or trending behind?
- What should an EM share with an ED/VP today without rebuilding a report manually?

The handwritten spec frames the core pain clearly: leadership often sees only a `0 -> 1` sprint
transition from start to end. Sprint Tracker should expose progress while the sprint is in flight.

---

## 3. Personas and Access Model

| Persona | Scope | Primary need |
|---|---|---|
| Lead / EM | One scrum team | Track full SDLC progress for team work across roadmap, tech debt, support, and internal bugs. |
| ED / TPM | Multiple scrum teams | View and compare sprint health across teams. |
| VP | Portfolio / org | Quickly understand whether the sprint is on track and where leadership attention is needed. |
| Admin | Org / team setup | Configure sprint gates, teams, filters, workflows, and permissions. |

Relationships from the spec:

- An EM manages one scrum team.
- An ED manages N scrum teams.
- A scrum team usually has 10-12 developers.
- Each scrum team has dedicated tracks/filters for Roadmap, Tech Debt, Support, and Internal Bugs.

Current implementation gap: there is no team, membership, role, or multi-team model today. The app is
single-user and localStorage-scoped.

---

## 4. Core Concepts

- **Scrum Team**: Delivery unit of roughly 10-12 engineers.
- **Sprint / Gate**: A named release window with fixed development start/end dates and an optional
  release date. Tekion examples include "June 2026 Release" and "July 2026 Release".
- **Filter / Track**: A Jira saved filter ID or raw JQL query that feeds work into Sprint Tracker.
- **Workflow**: Ordered delivery-stage template for a track. Current workflow types are Feature,
  Tech Debt, and Support.
- **Stage**: Manual SDLC progress marker for an issue, separate from raw Jira status.
- **Delivery Matrix**: Main work view. Rows are issues grouped by filter. Columns are workflow stages.
  Health appears on the right.
- **Health**: Computed status such as Not Started, On Track, At Risk, Behind, Blocked, Ahead, or Done.
- **Velocity**: Completed story points per week plus a simple projection to sprint end.
- **Sync Jira**: Pull latest issue metadata from Jira Cloud into the app. It does not currently update
  manual stage progress.
- **Export**: PDF/PNG leadership report.
- **Share View**: Share the configured sprint view with others.

---

## 5. Current Feature State

| Feature | State | Current behavior |
|---|---|---|
| Jira login with email + API token | **[BUILT]** | Express validates credentials against Jira `/myself`; session cookie is used by the frontend. |
| Add Jira filter by filter ID | **[BUILT]** | Pulls saved Jira filter JQL, then searches issues. |
| Add direct JQL source | **[BUILT]** | User provides JQL and display name. |
| Choose workflow per filter | **[BUILT]** | Feature, Support, or Tech Debt. |
| Update stages per issue | **[BUILT]** | Manual ordered checklist; clicking stage N checks/unchecks surrounding stages. |
| Mark issue blocked | **[BUILT]** | Manual blocked flag stored beside stage state. |
| Remove filter | **[BUILT]** | Removes filter and deletes stage data for its issues. |
| Reorder filters | **[BUILT]** | Drag/drop in the Connected JQL panel. |
| Search | **[BUILT]** | Searches filters, issue keys, owners, titles, and Jira statuses. |
| Sync Jira | **[BUILT]** | Re-fetches issues and reports added/removed counts. |
| Configure sprint | **[PARTIAL]** | Modal updates name/start/end locally. No admin gating or server persistence. |
| Export PDF / PNG | **[BUILT]** | Client-side export with include/exclude filter selection. |
| Share view | **[PARTIAL]** | Encodes full app state into a base64 URL query param. Fragile for real usage. |
| Multi-team ED/VP roll-up | **[GAP]** | No persisted teams, roles, or org-level aggregation. |
| Historical trend / burndown | **[GAP]** | No snapshot table or scheduled capture. |
| Gemini / AI summary | **[GAP]** | Mentioned in stack, but no concrete product use case exists yet. |
| RBAC / admin settings | **[GAP]** | No roles; every logged-in user can configure sprint locally. |

---

## 6. Current Workflows and Stages

Defined in `src/workflows.js`. Stage weights sum to 100 and drive weighted completion.

### Feature Development / Roadmap

Priority: 1

```text
PM clarification -> HLD/LLD -> API contracts -> Working APIs -> FE integration ->
E2E testing -> QA/PM demo -> PR approved -> Release ready -> 1st Stage Env deployment
```

Weights:

```text
[15, 20, 15, 15, 15, 8, 5, 3, 2, 2]
```

### Tech Debt

Priority: 2

```text
Triaged -> In Progress -> Code Review -> In QA
```

Weights:

```text
[15, 65, 15, 5]
```

### Support Bugs

Priority: 3

```text
Triaged -> In Progress -> Code Review -> In QA
```

Weights:

```text
[20, 60, 15, 5]
```

Spec gap: the handwritten notes mention Internal Bugs separately. The current app does not have a
dedicated Internal Bug workflow. It reuses Support or Tech Debt behavior depending on what the user
selects.

---

## 7. Critical Product Decision: Stage Sync Model

Current behavior is manual-only:

- Jira sync refreshes issue metadata and raw Jira status.
- Manual stage completion lives in `issueStages[issueKey].stages`.
- `transformJiraIssue` derives `stage` and `percent` from Jira status, but the dashboard metrics use
  the manual stage overlay instead.

This means every metric is only as accurate as the team's manual updates.

Recommended target: use a **hybrid stage model**.

- On first sync, seed stage progress from a configurable Jira status -> Sprint Tracker stage mapping.
- After a user edits stages manually, treat that issue as manually overridden.
- Future syncs should update the Jira baseline but must not clobber manual progress.
- Store the last status used for seeding so the app can show when Jira and manual progress diverge.

This decision affects the database schema, sync service, health metrics, audit logging, and UX copy.
Resolve it before any production migration.

---

## 8. Current Architecture: As Built

```text
Browser
  Vite 2 + React 18 + JSX
  localStorage for filters, sprint config, stages, density, collapse state
  fetch(..., credentials: "include")
      |
      v
Express proxy server (server.js, default :3001)
  express-session + session-file-store in .sessions/
  stores jiraEmail + jiraToken in plaintext session files
  calls Jira Cloud REST API with Basic auth email:token
```

Current source map:

- `src/Root.jsx`: auth gate, loads `/api/auth/me`, shows login or app.
- `src/App.jsx`: main app shell, modal state, share URL generation, top-level wiring.
- `src/hooks/usePersistedSprintState.js`: localStorage persistence and share-link import.
- `src/hooks/useSprintData.js`: add/remove/sync filters, stage toggles, blocked toggles.
- `src/hooks/useSprintMetrics.js`: derives visible filters and dashboard metrics.
- `src/utils/sprintMetricsCompute.js`: pure metric aggregation used by dashboard and export.
- `src/workflows.js`: workflow stages, weights, hardcoded sprint gates.
- `src/jiraService.js`: frontend Jira API client and Jira issue transformation.
- `src/components/...`: presentational UI grouped as atoms, molecules, organisms, and modals.
- `server.js`: Express auth/session/Jira proxy.
- `src/styles.css`: hand-written app styling.

Current localStorage keys:

- `sprintTracker_sprintData`
- `sprintTracker_sprintConfig`
- `sprintTracker_viewDensity`
- `sprintTracker_filtersPanelCollapsed`

Current Jira fields:

- Story points: `customfield_10008`
- Legacy story points fallback: `customfield_10016`
- Sprint field: `customfield_10020`
- Fix versions: `fixVersions`

Current scripts:

```bash
npm run dev
npm run dev:server
npm run dev:all
npm run build
npm run preview
```

Important: the app currently has no Prisma schema, no database, no Next.js app directory, and no
server-persisted domain data.

---

## 9. Target Production Architecture

The handwritten spec proposes:

- Framework: Next.js 16
- Language: JavaScript
- Database: Neon Postgres
- ORM: Prisma 7
- Caching: Redis, optional
- Auth: Jira email + API token, needs evaluation
- AI: Gemini
- Styling: Tailwind CSS v4 + shadcn/ui

Recommended production shape:

```text
Next.js App Router application
  app routes and server components for dashboard pages
  route handlers for auth, Jira sync, export/share APIs
  server-side RBAC checks for every mutation
      |
      v
Postgres on Neon via Prisma
  users, credentials, orgs, teams, memberships
  sprints/gates, filters, workflows, workflow stages
  Jira issue cache, progress overlay, stage edits
  shared views, daily snapshots, sync runs, audit events
      |
      v
Jira integration service
  per-user Jira access through OAuth 2.0 3LO or encrypted API token
  field mapping per team
  status-to-stage seeding
  rate-limit aware background sync
      |
      v
Optional Redis
  cache hot ED/VP rollups
  throttle Jira sync fan-out
  queue status for long syncs
```

Migration guidance:

- Port `server.js` routes to Next.js route handlers under `app/api/...`.
- Keep frontend request/response contracts stable at first, then move localStorage-backed domain state
  behind server APIs.
- Keep localStorage only for ephemeral UI preferences such as density, collapsed panels, and the last
  selected view if needed.
- Introduce Prisma and Postgres before building ED/VP rollups or production share links.
- Strongly consider TypeScript for the migration even though the handwritten spec says JavaScript.
  This project is data-model heavy and Prisma-generated types will prevent entire classes of bugs.
- If staying in JavaScript, use JSDoc and schema validation at every API/Jira boundary.
- Verify the exact latest Next.js/Prisma installation steps at migration time. This document preserves
  the user's target stack, but package versions will move.

---

## 10. Sample Data Model

The original handwritten spec leaves the data model blank. This schema is a production-ready starting
point for Prisma + Postgres. It is intentionally normalized around teams, shared sprint gates,
configurable workflows, stage-level progress, short share tokens, sync history, and trend snapshots.

Use this as the basis for `prisma/schema.prisma` when the app migrates off localStorage.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  ED
  TPM
  EM
  LEAD
  MEMBER
  VIEWER
}

enum JiraAuthProvider {
  API_TOKEN
  ATLASSIAN_OAUTH
}

enum SprintState {
  PLANNING
  ACTIVE
  CLOSED
  ARCHIVED
}

enum FilterSourceType {
  JQL
  JIRA_FILTER
}

enum WorkflowKind {
  FEATURE
  TECH_DEBT
  SUPPORT
  INTERNAL_BUG
  CUSTOM
}

enum StatusMapMode {
  SEED_UP_TO_STAGE
  MARK_STAGE_ONLY
  MARK_ALL_DONE
}

enum SyncStatus {
  RUNNING
  SUCCESS
  PARTIAL_FAILED
  FAILED
}

enum ShareMode {
  LIVE
  SNAPSHOT
}

enum AuditAction {
  CREATED
  UPDATED
  DELETED
  SYNCED
  EXPORTED
  SHARED
  LOGIN
  LOGOUT
}

model User {
  id            String   @id @default(cuid())
  jiraAccountId String?  @unique
  email         String   @unique
  displayName   String
  avatarUrl     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  credential      JiraCredential?
  memberships     TeamMembership[]
  createdSprints  Sprint[]             @relation("SprintCreatedBy")
  progressUpdates IssueProgress[]      @relation("ProgressUpdatedBy")
  stageUpdates    IssueStageProgress[] @relation("StageUpdatedBy")
  syncRuns        SyncRun[]            @relation("SyncStartedBy")
  sharedViews     SharedView[]         @relation("SharedViewCreatedBy")
  auditEvents     AuditEvent[]
}

model JiraCredential {
  id                    String           @id @default(cuid())
  userId                String           @unique
  user                  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider              JiraAuthProvider @default(API_TOKEN)
  jiraEmail             String
  siteUrl               String
  cloudId               String?
  encryptedAccessToken  String?
  encryptedRefreshToken String?
  tokenExpiresAt        DateTime?
  scopes                String[]
  lastValidatedAt       DateTime?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt
}

model Org {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  teams       Team[]
  sprints     Sprint[]
  workflows   Workflow[]
  auditEvents AuditEvent[]
}

model Team {
  id              String   @id @default(cuid())
  orgId           String
  org             Org      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name            String
  key             String
  description     String?
  jiraProjectKeys String[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  memberships     TeamMembership[]
  fieldConfig     JiraFieldConfig?
  workflows       Workflow[]
  filterTemplates FilterTemplate[]
  filters         Filter[]
  progress        IssueProgress[]
  snapshots       SprintSnapshot[]
  auditEvents     AuditEvent[]

  @@unique([orgId, key])
  @@index([orgId])
}

model TeamMembership {
  id        String   @id @default(cuid())
  userId    String
  teamId    String
  role      Role
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([userId, teamId])
  @@index([teamId, role])
}

model JiraFieldConfig {
  id                       String   @id @default(cuid())
  teamId                   String   @unique
  team                     Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  storyPointsFieldId        String   @default("customfield_10008")
  legacyStoryPointsFieldId  String?
  sprintFieldId             String   @default("customfield_10020")
  fixVersionsFieldId        String   @default("fixVersions")
  customFieldAliases        Json?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt
}

model Sprint {
  id               String      @id @default(cuid())
  orgId            String
  org              Org         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name             String
  developmentStart DateTime
  developmentEnd   DateTime
  releaseDate      DateTime?
  state            SprintState @default(PLANNING)
  isGate           Boolean     @default(true)
  createdById      String?
  createdBy        User?       @relation("SprintCreatedBy", fields: [createdById], references: [id])
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  filters     Filter[]
  progress    IssueProgress[]
  snapshots   SprintSnapshot[]
  sharedViews SharedView[]

  @@unique([orgId, name])
  @@index([orgId, state])
}

model Workflow {
  id          String       @id @default(cuid())
  orgId       String?
  org         Org?         @relation(fields: [orgId], references: [id], onDelete: Cascade)
  teamId      String?
  team        Team?        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  kind        WorkflowKind
  name        String
  description String?
  version     Int          @default(1)
  isDefault   Boolean      @default(false)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  stages         WorkflowStage[]
  statusMappings JiraStatusStageMap[]
  filterTemplates FilterTemplate[]
  filters         Filter[]
  progress        IssueProgress[]

  @@index([orgId, kind, isDefault])
  @@index([teamId, kind, isDefault])
}

model WorkflowStage {
  id            String   @id @default(cuid())
  workflowId    String
  workflow      Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  name          String
  description   String?
  sortOrder     Int
  weightPercent Int
  terminal      Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  progressMappings IssueStageProgress[]
  statusMappings   JiraStatusStageMap[]

  @@unique([workflowId, sortOrder])
  @@unique([workflowId, name])
}

model JiraStatusStageMap {
  id             String        @id @default(cuid())
  workflowId     String
  workflow       Workflow      @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  jiraStatusName String
  stageId        String
  stage          WorkflowStage @relation(fields: [stageId], references: [id], onDelete: Cascade)
  mode           StatusMapMode @default(SEED_UP_TO_STAGE)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([workflowId, jiraStatusName])
}

model FilterTemplate {
  id           String           @id @default(cuid())
  teamId       String
  team         Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  workflowId   String
  workflow     Workflow         @relation(fields: [workflowId], references: [id])
  name         String
  sourceType   FilterSourceType
  jql          String?
  jiraFilterId String?
  accentColor  String?
  sortOrder    Int              @default(0)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  filters Filter[]

  @@index([teamId, sortOrder])
}

model Filter {
  id           String           @id @default(cuid())
  teamId       String
  team         Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  sprintId     String
  sprint       Sprint           @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  templateId   String?
  template     FilterTemplate?  @relation(fields: [templateId], references: [id])
  workflowId   String
  workflow     Workflow         @relation(fields: [workflowId], references: [id])
  name         String
  sourceType   FilterSourceType
  jql          String?
  jiraFilterId String?
  accentColor  String?
  sortOrder    Int              @default(0)
  lastSyncedAt DateTime?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  issues   Issue[]
  syncRuns SyncRun[]

  @@unique([teamId, sprintId, name])
  @@index([teamId, sprintId, sortOrder])
}

model Issue {
  id                String   @id @default(cuid())
  filterId          String
  filter            Filter   @relation(fields: [filterId], references: [id], onDelete: Cascade)
  jiraIssueId       String?
  jiraKey           String
  title             String
  issueType         String
  jiraStatus        String
  statusCategory    String?
  assigneeName      String?
  assigneeAccountId String?
  storyPoints       Decimal  @default(0) @db.Decimal(8, 2)
  priority          String?
  dueDate           DateTime?
  jiraSprintName    String?
  fixVersions       String[]
  raw               Json?
  lastSyncedAt      DateTime @default(now())
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([filterId, jiraKey])
  @@index([jiraKey])
  @@index([filterId, jiraStatus])
}

model IssueProgress {
  id               String   @id @default(cuid())
  teamId           String
  team             Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  sprintId         String
  sprint           Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  workflowId       String
  workflow         Workflow @relation(fields: [workflowId], references: [id])
  jiraKey          String
  blocked          Boolean  @default(false)
  blockedReason    String?
  jiraSeededStatus String?
  jiraSeededAt     DateTime?
  manualOverride   Boolean  @default(false)
  updatedById      String?
  updatedBy        User?    @relation("ProgressUpdatedBy", fields: [updatedById], references: [id])
  updatedAt        DateTime @updatedAt

  stages IssueStageProgress[]

  @@unique([teamId, sprintId, jiraKey])
  @@index([sprintId])
  @@index([teamId, sprintId])
}

model IssueStageProgress {
  id          String        @id @default(cuid())
  progressId  String
  progress    IssueProgress @relation(fields: [progressId], references: [id], onDelete: Cascade)
  stageId     String
  stage       WorkflowStage @relation(fields: [stageId], references: [id], onDelete: Cascade)
  completed   Boolean       @default(false)
  completedAt DateTime?
  updatedById String?
  updatedBy   User?         @relation("StageUpdatedBy", fields: [updatedById], references: [id])
  updatedAt   DateTime      @updatedAt

  @@unique([progressId, stageId])
  @@index([stageId])
}

model SyncRun {
  id           String     @id @default(cuid())
  filterId     String
  filter       Filter     @relation(fields: [filterId], references: [id], onDelete: Cascade)
  startedById  String?
  startedBy    User?      @relation("SyncStartedBy", fields: [startedById], references: [id])
  status       SyncStatus @default(RUNNING)
  startedAt    DateTime   @default(now())
  finishedAt   DateTime?
  addedCount   Int        @default(0)
  updatedCount Int        @default(0)
  removedCount Int        @default(0)
  errorMessage String?
  errorPayload Json?

  @@index([filterId, startedAt])
}

model SharedView {
  id                String    @id @default(cuid())
  token             String    @unique // generate with crypto.randomBytes/randomUUID in application code
  sprintId          String
  sprint            Sprint    @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  createdById       String
  createdBy         User      @relation("SharedViewCreatedBy", fields: [createdById], references: [id])
  mode              ShareMode @default(LIVE)
  includedTeamIds   String[]
  includedFilterIds String[]
  viewDensity       String    @default("dense")
  viewState         Json?
  expiresAt         DateTime?
  lastAccessedAt    DateTime?
  createdAt         DateTime  @default(now())

  @@index([sprintId])
  @@index([createdById])
}

model SprintSnapshot {
  id              String   @id @default(cuid())
  teamId          String
  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  sprintId        String
  sprint          Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  capturedOn      DateTime
  totalPoints     Decimal  @default(0) @db.Decimal(8, 2)
  completedPoints Decimal  @default(0) @db.Decimal(8, 2)
  projectedPoints Decimal? @db.Decimal(8, 2)
  avgProgress     Int
  totalIssues     Int
  healthCounts    Json
  filterBreakdown Json
  createdAt       DateTime @default(now())

  @@unique([teamId, sprintId, capturedOn])
  @@index([sprintId, capturedOn])
}

model AuditEvent {
  id          String      @id @default(cuid())
  actorUserId String?
  actorUser   User?       @relation(fields: [actorUserId], references: [id])
  orgId       String?
  org         Org?        @relation(fields: [orgId], references: [id])
  teamId      String?
  team        Team?       @relation(fields: [teamId], references: [id])
  entityType  String
  entityId    String?
  action      AuditAction
  metadata    Json?
  createdAt   DateTime    @default(now())

  @@index([teamId, createdAt])
  @@index([actorUserId, createdAt])
}
```

Model rationale and tweak points:

- **Org + Team + Membership** model the EM/ED relationship naturally. EMs view one team; ED/TPM users
  view all teams where their membership role grants access.
- **Sprint is org-scoped** so one gate can be shared across teams. Filters and progress remain
  team-scoped inside that shared gate.
- **Workflow and WorkflowStage are rows**, not only enums. This supports future stage edits, Internal
  Bug workflow, per-team custom workflows, and versioned stage weights.
- **Issue is a Jira cache**. Jira stays the source of truth for issue metadata.
- **IssueProgress is product-owned data** keyed by `(teamId, sprintId, jiraKey)` so manual progress
  survives Jira re-sync and issue movement between filters in the same team/sprint.
- **IssueStageProgress** is normalized instead of `Boolean[]`. This is more verbose but safer for
  audits, stage versioning, and per-stage timestamps.
- **JiraStatusStageMap** enables the recommended hybrid seed-from-Jira model.
- **SharedView** replaces base64 URLs with short server-side tokens and optional snapshots. Generate
  tokens with application crypto, not user-controlled input or predictable IDs.
- **SprintSnapshot** enables trend, burndown, projected completion, and ED/VP reporting.
- **SyncRun and AuditEvent** are production observability primitives. They are optional for a prototype
  but should exist before a shared internal deployment.

Migration from current localStorage:

- Convert each `sprintTracker_sprintData` key into a `Sprint` plus `Filter` records.
- Convert each dynamic filter into a `Filter` with `sourceType`, `jql`/`jiraFilterId`, `workflowId`,
  `sortOrder`, and cached `Issue` rows.
- Convert each `issueStages[jiraKey]` object into one `IssueProgress` and N `IssueStageProgress` rows.
- Keep `viewDensity` and `filtersPanelCollapsed` in localStorage as user preferences.

---

## 11. UI and UX Direction

The UI should be modern, minimal, and aligned with Tekion standards:

- Dark and light mode.
- Clean typography.
- Generous whitespace where it helps scanning.
- Subtle borders and shadows.
- Desktop-first layout, mobile usable.
- Smooth transitions, hover states, toast notifications, and loading skeletons.

Expected dashboard layout:

- Header: Tekion logo, Sprint Tracker name, search, Add Filter, Sync Jira, user name, Logout.
- Sprint hero: selected sprint/gate details, Configure Sprint, Export, Share View.
- Metrics: Health, Issues in Scope, Weekly Velocity, At Risk Work.
- Delivery Matrix: collapsible Connected JQL sidebar, grouped filter sections, stage columns, health
  column, blocked/at-risk markers.

Login page:

- Title: Sprint Tracker.
- Subtitle: Connect your Jira account to get started.
- Inputs: Jira Email, API Token.
- Link/hint to create token at Atlassian account security page.
- CTA: Connect to Jira.
- Footer: Engineering Internal Tool - Tekion Corp.

Frontend implementation note:

- Current app uses hand-written CSS and React components under `src/components`.
- Tailwind + shadcn/ui should be introduced during the Next.js migration, not by randomly restyling
  the current Vite app unless the task is explicitly a UI refresh.

---

## 12. Metrics and Calculations

Reference files:

- `src/workflows.js`
- `src/utils/sprintMetricsCompute.js`
- `src/utils/sprintUtils.js`

Current formulas:

- **Issue weighted completion** = sum of completed stage weights / sum of workflow weights.
- **Completed points** = story points * completion percent.
- **Average progress** = average issue completion percent.
- **Per-issue health** compares completion percent to expected progress based on elapsed sprint time.
- **Sprint health** is based on feature issues only.
- **Dashboard velocity** includes Feature and Tech Debt only; Support is excluded.
- **Export velocity** currently uses all selected export filters, which can diverge from dashboard
  velocity.

Current health bands:

- Blocked overrides all other statuses.
- 100% completion = Done.
- 0% completion and very early sprint = Not Started.
- Progress delta >= +10 = Ahead.
- Progress delta from -10 to +10 = On Track.
- Progress delta from -25 to -10 = At Risk.
- Progress delta below -25 = Behind.

Production metric recommendations:

- Preserve `computeSprintMetrics` as a pure function.
- Add unit tests for all health and velocity edge cases.
- Use `SprintSnapshot` for burndown and projected-by-sprint-end calculations.
- Validate sprint date ranges; start and end dates must not be equal and end must be after start.
- Decide whether support work should count toward velocity consistently across dashboard and export.

---

## 13. Authentication and Security

Current behavior:

- Users enter Jira email and API token.
- Express validates credentials against Jira `/myself`.
- `express-session` stores `jiraEmail`, `jiraToken`, and display name in `.sessions`.
- Session cookie is `httpOnly`; secure cookies are enabled only in production.
- Token is plaintext on disk in the local session store.

This is acceptable only for a local/single-user prototype. It is not acceptable for production.

Production requirements:

- Prefer Atlassian OAuth 2.0 3LO for a shared internal app.
- If API tokens remain, encrypt tokens at rest with app-layer encryption and a managed secret/KMS key.
- Store only encrypted credentials or OAuth refresh tokens.
- Add server-side RBAC for sprint configuration, team settings, workflow changes, sync permissions,
  exports, and shared views.
- Add CSRF protection for cookie-authenticated mutations.
- Add audit events for login, sync, configuration, share, export, and progress edits.
- Never put issue data or credentials into share URLs.
- Keep secrets in the deployment platform's secret manager, not `.env` in production.

Official references checked on 2026-06-08:

- Next.js Route Handlers: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers
- Prisma supported databases, including Neon Serverless Postgres: https://www.prisma.io/docs/orm/reference/supported-databases
- Atlassian OAuth 2.0 3LO: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/
- Atlassian Jira basic auth for REST APIs: https://developer.atlassian.com/cloud/jira/platform/basic-auth-for-rest-apis/
- Atlassian OAuth scopes: https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/

---

## 14. Known Flaws, Gaps, and Spec Risks

These are the main call-outs to address before production.

1. **No multi-team roll-up.** The ED/TPM/VP value proposition depends on multi-team aggregation, but
   the current app is single-user localStorage.
2. **Manual-only stages.** Jira sync does not update stage progress, so metrics depend on manual EM
   discipline.
3. **Share view is not production-safe.** The current base64 query param can exceed URL limits, leak
   data into browser history, and cannot show live updates.
4. **Jira token storage is insecure.** Tokens are plaintext in `.sessions`.
5. **Sprint identity is brittle.** `getSprintKey(config)` uses `startDate_endDate`; renaming or date
   edits silently move data into another bucket.
6. **No admin gating.** Any authenticated local user can configure sprint dates.
7. **Hardcoded Jira fields.** Story points and sprint fields are Tekion-specific custom fields and
   should move into team-level config.
8. **No historical snapshots.** Without snapshots, the app cannot produce real burndown, trend, or
   projected end-state analytics.
9. **Default sprint is stale.** New localStorage state defaults to "May Sprint" with May 2026 dates.
   As of 2026-06-08 this is already past and can make new work appear behind unless configured.
10. **Removing a filter deletes issue progress.** If the same Jira issue appears in another filter,
    removing one filter can still delete its stage data because progress is keyed only by issue key in
    a global object.
11. **Velocity differs between dashboard and export.** Dashboard excludes Support from velocity, while
    export computes velocity over all selected filters.
12. **No date validation.** Equal or inverted sprint start/end dates can break health calculations.
13. **No Jira rate-limit strategy.** ED rollups will fan out across many filters and teams.
14. **No workflow versioning.** Changing stage weights today would reinterpret old progress.
15. **Internal Bugs workflow is undefined.** The spec names it as a track, but current code has no
    separate workflow.
16. **Gemini has no defined product outcome.** Do not build AI features until the exact output is
    defined, such as export narrative, risk summary, or leadership digest.
17. **Current stack differs from target stack.** Do not assume Next.js, Prisma, Tailwind, shadcn/ui, or
    Neon exist in this repo until the migration is explicitly implemented.

---

## 15. Recommended Production Roadmap

1. **Stabilize current app behavior.**
   Fix obvious product bugs first: stale default sprint, date validation, filter removal progress loss,
   dashboard/export velocity mismatch, and safer share failure handling.

2. **Introduce a server-side domain model.**
   Add Prisma + Neon with the schema in this document. Move filters, sprints, progress, and share views
   out of localStorage.

3. **Add roles and teams.**
   Model users, teams, memberships, and admin/ED/EM permissions. Gate sprint configuration server-side.

4. **Implement hybrid Jira sync.**
   Add workflow-stage mappings from Jira statuses. Seed stage progress on first sync, preserve manual
   overrides, and write sync runs.

5. **Implement production sharing and export.**
   Replace base64 share URLs with `SharedView` tokens. Keep PDF/PNG export, then optionally add
   server-rendered or queued export for large sprints.

6. **Add snapshots and leadership rollups.**
   Capture daily `SprintSnapshot` rows for active sprints. Build ED/VP views from snapshots and issue
   cache, not live Jira fan-out.

7. **Migrate to Next.js target architecture.**
   Once data and auth boundaries are clear, port Express routes to route handlers and migrate UI to
   Tailwind + shadcn/ui intentionally.

8. **Evaluate AI only after reporting is stable.**
   Gemini should produce a concrete artifact, ideally a leadership summary over current metrics,
   blockers, changed scope, and projected completion.

---

## 16. Open Decisions

- Stage model: manual-only, automatic from Jira, or hybrid? Recommendation: hybrid.
- Auth: Atlassian OAuth 2.0 3LO or encrypted personal API tokens? Recommendation: OAuth for shared
  deployment, encrypted API tokens only as an interim internal step.
- Sprint cadence: one org-level gate for all teams or team-specific sprint windows? Recommendation:
  org-level gate with optional team overrides only if real teams diverge.
- Workflow customization: global defaults only or team-level workflow overrides? Recommendation:
  global defaults plus optional team overrides.
- Internal Bugs: should it have its own workflow and weights?
- Velocity: should support work count in sprint velocity or only in scope/health?
- Gemini: what exact output should AI generate?
- Language: continue JavaScript or migrate to TypeScript with Next.js and Prisma?

---

## 17. Development Conventions for Future Codex Work

- Read this file before making product or architecture changes.
- Keep current-state and target-state separate in code comments, docs, and implementation plans.
- Do not assume database persistence exists in the current app.
- Do not add new domain data to localStorage unless the task is explicitly scoped to the current
  prototype. Target production storage is Postgres.
- Keep Jira integration isolated behind service modules.
- Keep metric calculations pure and covered with unit tests.
- Validate all API inputs and Jira responses.
- Respect RBAC server-side for every mutation once roles exist.
- Update this document when a new feature changes workflows, data shape, metrics, auth, or architecture.
- Prefer small migrations that preserve a working app over a broad rewrite.

---

## 18. Current Repo Reality Check

As of this review:

- Current app: Vite 2, React 18, JavaScript, Express.
- Current persistence: localStorage plus session files.
- Current styling: hand-written CSS.
- Current auth: Jira email + API token through Express proxy.
- Current database: none.
- Current ORM: none.
- Current tests: no dedicated automated test script in `package.json`.
- Current production target: Next.js, Neon Postgres, Prisma, optional Redis, optional Gemini,
  Tailwind CSS v4, shadcn/ui.

Any future feature should state whether it is:

- a prototype feature for the current Vite/localStorage app, or
- part of the production migration path.

That distinction matters because data ownership, auth, sharing, and metrics are different in each
world.
