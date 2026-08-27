# StoryBoard — Project Overview

> **Status of this document:** This is the canonical reference for the StoryBoard project.
> Every future feature, refactor, or AI-assisted change should be consistent with this file.
> When reality and this doc diverge, **fix the doc in the same change**. Sections are marked
> **[BUILT]**, **[PARTIAL]**, **[PLANNED]**, or **[GAP]** so the as-built state is never confused
> with the target state.
>
> Last reviewed: 2026-08-27 · Owner: Naveen · Audience: engineers + Claude Code.
>
> **Rename note (2026-07-31):** the product was renamed to **StoryBoard** (was "Sprint Tracker",
> earlier codename "Tek Tracker" / "TekTracker"). The rename is display/branding only — no schema,
> route, cookie, or storage-key change. In-body references to the old names in the **dated history
> and decision entries below are deliberately not rewritten** (same convention as the path note),
> so read "Sprint Tracker"/"TekTracker" there as "StoryBoard".
>
> **Path note (cutover, 2026-07-18):** the Next.js app was promoted from the `web/` subfolder to
> the **repo root**, and the legacy Vite/Express app was backed up into **`legacy/`**. Historical
> `web/...` paths in dated entries below refer to the pre-cutover layout — read them as today's
> repo root. They are deliberately not rewritten.
>
> **History archive (2026-08-11):** to keep this canonical doc scannable, the verbatim dated build
> entries — §11's UI/UX log, §16's ratified-decision bodies, the §5 feature-note history, and the
> Production Migration Plan's step-10 completion narrative — were moved, untouched, into
> **[project-overview-history.md](project-overview-history.md)**. This file keeps a one-line
> current-state summary + a pointer (to that archive and to the per-feature `context/features/*.md`
> spec) for each. Append new dated detail to the archive; keep these summaries current.

---

## 1. Product vision

One fast, comprehensive view of an entire sprint — from roadmap to backlog — in one place,
without hunting through multiple Jira filters. StoryBoard sits *on top of* Jira and adds the
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
   PR review/deployment → deployment`. StoryBoard models these **stages** so an EM/Lead can give
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
- **Program** (BUILT 2026-08-12, program-rollup.md) — a first-class grouping one level **above** the
  scrum team (e.g. GM → AI Agentic, Configurator & Website Setup, DX & SCX, PCX; other programs are
  Honda, AEP). A team belongs to at most one program. Leadership (ED/TPM/EM/VIEWER + admin) can scope
  `/rollup` to a program to see the aggregate across **all** its teams regardless of their own
  memberships — the cross-membership view the ED/TPM/VP personas need. Still one implicit org.

> **[GAP — legacy app only; moot since cutover 2026-07-18]** The **legacy Vite build** (retired
> to `legacy/`) has no team, role, or multi-team concept — it is single-user and
> localStorage-scoped. In `web/` the team/membership model + RBAC landed in step 4 (2026-07-07)
> and the **multi-team roll-up view (`/rollup`) is BUILT (step 6b, 2026-07-08)** —
> membership-derived per §9. VP *trend* is **BUILT (2026-07-19)** — the snapshot-fed burndown
> panel on `/` and `/rollup` (context/features/trend-burndown.md). See §9, §10, §15.

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
- **Sprint / Gate** — A named release window with a fixed **dev cycle** (`developmentStart` →
  `developmentEnd`) and a **release date**. The sprint runs **dev cycle → QA/UAT
  (`developmentEnd → releaseDate`) → released**, and **ends at the release date, not dev end**
  (2026-07-24; see §12). Tekion calls monthly releases "Gates" (e.g. *June 2026 Release*). All
  filters and progress are **scoped to a sprint**.
- **Health** — Per-issue and per-sprint status (On Track / At Risk / Behind / Blocked / Ahead / Done),
  computed from weighted stage completion vs. time-elapsed expectation (see §12). **Sprint** health
  is the **delivery lens** — roadmap + tech-debt only, against the dev cycle (§12 two-lens).
- **Velocity** — Story points completed per week (**all work — throughput lens**, §12), with a naive
  linear projection to sprint end (superseded by snapshot velocity where ≥2 daily snapshots exist).
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
| Add Jira filters (by filter ID or JQL) | **[BUILT]** | AddFilter dialog → CRUD POST + immediate sync. |
| Update stages per work item | **[BUILT]** | Manual checklist (idempotent PUT, server-owned cascade), hybrid-seeded on sync; a per-track **"Sync stages"** button overwrites stages from live Jira status. See context/features/sync-stages-from-jira.md. |
| Mark work item as blocked | **[BUILT]** | Health chip → PUT blocked. |
| Remove Jira filter | **[BUILT]** | DELETE; progress survives by design (§9). |
| Sync Jira (pull live status) | **[BUILT]** | Server-side sync engine + `POST …/sync` with hybrid stage seeding. See context/features/sync-hybrid-seeding.md. |
| Configure sprint (dates, name) | **[PARTIAL]** | Admin-gated API + admin-only UI (SprintConfig dialog + `/admin`); field-discovery UI still absent. |
| Reorder filters | **[BUILT]** | Drag → PUT `…/filters/order`. |
| Export PDF / PNG | **[BUILT]** | Offscreen A4 pages → PDF/PNG via `html2canvas-pro` + `jsPDF` (dynamic-imported); shares the `/bugs` PDF design system via the shared export kit (`lib/export/`, `components/export/print-kit.jsx`) with clickable Jira-key chips. See context/features/export-visual-consistency.md. |
| Share view | **[BUILT]** | Server-persisted `SharedView` → public read-only `/share/[token]` (192-bit token, live or frozen w/ `asOf`-pinned metrics, expiry, revocation). See context/features/share-view-export.md. |
| Multi-team / ED roll-up | **[BUILT]** | Read-only `/rollup` server page (combined `MetricGrid` + per-team table via pure `aggregateRollup`), membership-derived, no Sync. See context/features/ed-rollup.md. |
| Trend / burndown / "projected by end of sprint" | **[BUILT]** | Daily per-team `SprintSnapshot` (cron) → burndown panel (ideal/actual/projection SVG + snapshot velocity) on `/` and `/rollup`. See context/features/trend-burndown.md. |
| AI summary (pluggable provider) | **[BUILT in part]** | Provider-agnostic `src/lib/ai/` (Gemini + Anthropic, `AI_PROVIDER` env) behind the on-demand **"AI Digest"** on `/` and `/rollup` (risk call-outs + leadership narrative); Q&A + stage suggestions open. See context/features/ai-insights.md. |
| Risk call-out comments + roll-up all-risks dialog | **[BUILT]** | `IssueProgress.riskComment` annotates a known/agreed risk (managed context, not a fresh alarm); `/rollup` shows every team's comments + a "View all risks" dialog. See context/features/risk-comments-rollup-digest.md. |
| Bug report dashboards (`/bugs`) | **[BUILT]** | Config-driven bug matrix + executive dashboard (categories × scope × priority band, SLA-breach overlay) — all admin config, so a second report (Honda) is configuration not code; External/Internal/All scope toggle, Bugs-by-scrum-team drill, sprint-ownership grouping, and a landscape executive PDF. See context/features/gm-bug-report.md, enhancing-bug-board.md, bug-report-pdf-export.md, bug-sprint-ownership.md. |
| Admin settings / RBAC | **[PARTIAL]** | Server-side RBAC (`User.isAdmin` + `TeamMembership.role`, `lib/rbac.js`) on all domain routes; admin UI for teams/members/sprints + bug-report config; broader settings UI still absent. |
| One-Click Sprint Start | **[BUILT]** | Admin `JiraComponent`/`JiraSubComponent` catalog + per-team Issue Type overrides + `Sprint.fixVersions`; a dashboard action (`TEAM_MANAGER_ROLES`) generates a team's missing tracks against an existing Sprint from generated JQL. See context/features/one-click-sprint-start.md. |
| Velocity / LeaderBoard (`/leaderboard`) | **[BUILT]** | Team velocity leaderboard (`completedPoints ÷ Team.developerCount`) + org-wide developer leaderboard, sprint-scoped + all-time, computed live (no snapshot table); gated to `LEADERBOARD_ROLES` (TPM excluded), LEAD/MEMBER get a personal "my stats" card. See context/features/leaderboard.md. |
| Committed / Tech Debt / Unplanned work breakdown + per-sprint capacity | **[BUILT]** | Delivery scoreboard on `/`, `/rollup`, `/share/[token]`, export: composition rail (Committed=`FEATURE`, Tech Debt=`TECH_DEBT`, Unplanned Bugs = External `SUPPORT` + Internal `INTERNAL_BUG`) vs an admin per-team-per-sprint `SprintCapacity` target. Display-only/additive (never wired into §12); `/rollup` adds a "By team" chart. See context/features/committed-unplanned-work.md, unplanned-split-and-chart.md. |
| Default scrum team & release (per-user board default) | **[BUILT]** | Each user pins a default team + release (`User.defaultTeamId`/`defaultSprintId`), resolved server-side in `getDashboardData`/`getSprintSelection`; set via a **star** in the top bar (`PATCH /api/me`). Board-only, additive. See context/features/default-team-release.md. |
| Program grouping + Program roll-up | **[BUILT]** | First-class `Program` groups scrum teams (`Team.programId`, SetNull); admins CRUD programs + assign teams (Programs admin section + team-dialog picker). Leadership (`PROGRAM_ROLES` + admin) scope `/rollup` to a program via a picker → aggregate across **all** its teams; reuses the entire roll-up stack (only the team-set source changes). See context/features/program-rollup.md. |
| Scrum-team member roster + auto "Needs attention" track | **[BUILT]** | Admin-entered per-team `Team.memberEmails String[]` (Jira assignee identities, distinct from RBAC `TeamMembership`) power an always-on `WorkflowType.NEEDS_ATTENTION` board track auto-generated/refreshed inside `syncTeamSprint` from `assignee in (roster) AND ("sub-component[dropdown]" IS EMPTY OR fixVersion IS EMPTY)` — the team's own items missing a sub-component/fix version that every sub-component-scoped filter misses. Partitioned out of the delivery matrix into its own panel; excluded from all §12 metrics (one additive no-op guard). See context/features/needs-attention-roster.md. |

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

> **[Amended 2026-08-10]** The always-on sync stays create-only, but a **user-triggered, per-track
> override** now ships: the delivery matrix's **"Sync stages" button** (one per track) pulls the
> latest Jira status for that filter and re-derives every one of its issues' stages from it,
> **overwriting** existing rows behind a confirm (resetting `updatedById` to null so it's
> idempotent; an unmapped status never wipes a row). This is the deferred "re-seed forward" shipped
> as an explicit, scoped action. See context/features/sync-stages-from-jira.md.

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
  ├─ AI provider (pluggable)               ← AI Digest narrative (BUILT 2026-07-20: lib/ai/, Gemini/Anthropic)
  └─ Bug report read path (non-sprint)     ← BUILT 2026-07-21: BugReport* models + /bugs (gm-bug-report.md)
```

> **[BUILT in `web/` 2026-07-09, step 7]** — the "Background sync (cron/queue)" line: an external
> cron (Tekion infra) hits the secret-gated `POST /api/cron/daily`, which refreshes every
> filter-bearing team's Issue cache through the step-5 sync engine and upserts the daily per-team
> `SprintSnapshot` for each ACTIVE sprint (see context/features/background-sync-snapshots.md).
> §8 stays [PLANNED] overall — Redis and Gemini remain optional-future.

> **[PACKAGED 2026-08-09 — office-infra deployment; not yet deployed]** — the app is now
> containerized for Tekion office infra: a multi-stage `Dockerfile` (`node:22-alpine`, Next.js
> `output: "standalone"`, JFrog npm proxy, baked `.env`), `.dockerignore`, a dependency-free
> liveness route `GET /p/health`, and `DEPLOY.md` (runbook). Target: a dedicated subdomain
> `storyboard.stage.aecloud.io` (stage), internal Tekion Postgres, migrations as a separate
> `yarn db:deploy` step, daily cron → `POST /api/cron/daily`. Service creation filed as RELB-28979.
> This is packaging + a filed ticket, **not** a live deployment — §8 stays [PLANNED]. See
> context/features/office-deployment.md.

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
  // Personal "default board view" (default-team-release.md, 2026-08-11): the team + release the `/`
  // board opens on with no ?team/?sprint param. Bare ids, no FK — resolution tolerates a stale id
  // (deleted team ⇒ first visible team; deleted release ⇒ ACTIVE gate), mirroring the `.find(id) ??
  // fallback` selection chain. A pinned release is honored even once CLOSED. Self-service via
  // PATCH /api/me; only read on `/`, never a metric input.
  defaultTeamId    String?
  defaultSprintId  String?
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

/// A Program groups several scrum Teams — one level ABOVE the team (e.g. "GM" → AI Agentic,
/// Configurator & Website Setup, DX & SCX, PCX…; other programs are Honda, AEP…). It is the first
/// grouping above Team in the otherwise "single implicit org" model (see the Team note below):
/// still ONE implicit org, but teams now roll up into an admin-defined Program. Admin-managed CRUD;
/// a Team carries at most one Program (Team.programId, SetNull on delete). Powers the program-scoped
/// roll-up on /rollup (program-rollup.md). No sprint/metric coupling — purely a grouping key.
model Program {
  id          String   @id @default(cuid())
  name        String
  key         String   @unique         // short handle, e.g. "GM"
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  teams       Team[]
}

/// A scrum team. ED roll-ups are just "the set of teams a user is an ED/TPM member of".
/// Single implicit org (decided 2026-06-10): no Org table; sprints are global. A team may belong to
/// one admin-defined Program (program-rollup.md) — the first grouping above Team; still one org.
model Team {
  id                 String           @id @default(cuid())
  name               String
  key                String           @unique         // short handle, e.g. "GM"
  description        String?
  /// Owning Program (program-rollup.md), or null when unassigned. SetNull on program delete so
  /// deleting a Program orphans its teams rather than cascading (mirrors JiraSubComponent.teamId).
  programId          String?
  program            Program?         @relation(fields: [programId], references: [id], onDelete: SetNull)
  jiraProjectKeys    String[]                         // projects this team owns
  storyPointsFieldId String?                          // Jira custom field override (default customfield_10008)
  sprintFieldId      String?                          // Jira custom field override (default customfield_10020)
  /// Per-track Jira Issue Type overrides (one-click-sprint-start.md). Empty ⇒ fall back to the
  /// DEFAULT_*_ISSUE_TYPES constants in lib/jira/issue-type-defaults.mjs (mirrors the
  /// storyPointsFieldId/sprintFieldId pattern). Arrays because a track may map to >1 Issue Type.
  /// supportIssueTypes is the "External Bug" track; its PROJECT stays the fixed ENG default in v1
  /// — only the issue-type list is per-team overridable.
  featureIssueTypes     String[]
  techDebtIssueTypes    String[]
  internalBugIssueTypes String[]
  supportIssueTypes     String[]
  /// Admin-entered scrum-team headcount — the Team Velocity Leaderboard's "points ÷ developers"
  /// divisor (leaderboard.md decision 3). Mirrors storyPointsFieldId/sprintFieldId: a per-team,
  /// admin-entered value, not derived from Jira/distinct assignees. `null` ⇒ the team is excluded
  /// from the TEAM leaderboard's ranking (its developers still appear on the developer leaderboard).
  developerCount        Int?
  /// Admin-entered scrum-team roster: the Jira ASSIGNEE email addresses of the developers who own
  /// this team's work (needs-attention-roster.md). DISTINCT from TeamMembership — these are plain
  /// Jira identities used only to scope the "Needs attention" hygiene track (`assignee in (...)`),
  /// NOT app users and grant NO access; they need not have signed in. Empty ⇒ no NA track is
  /// generated for this team (an empty roster deletes any existing NA filter on next sync).
  memberEmails          String[]
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt

  memberships     TeamMembership[]
  filters         Filter[]
  filterTemplates FilterTemplate[]
  progress        IssueProgress[]
  snapshots       SprintSnapshot[]
  statusMappings  StatusStageMapping[]
  subComponents   JiraSubComponent[]
  capacities      SprintCapacity[]

  @@index([programId])
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
// Jira component catalog (one-click-sprint-start.md)
// ─────────────────────────────────────────────────────────────

/// Master catalog of a Jira project's top-level Component field value, admin-entered by hand
/// (v1: one at a time, no bulk import, no live Jira lookup). Jira has no true parent/child
/// component hierarchy — "sub-component" is purely an org naming convention (`DR_GM-VSR` prefixed
/// by parent `DR_GM`) over otherwise-flat Component field values.
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
  /// Manually entered Jira Fix Version names this Gate spans (release train + hotfix patches),
  /// e.g. ["Release-2026.07.1.0", "Release-2026.07.1.1"]. No live Jira lookup. JQL scopes with
  /// `fixVersion in (...)`.
  fixVersions      String[]
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
  capacities       SprintCapacity[]

  @@index([state])
}

enum WorkflowType {
  FEATURE
  TECH_DEBT
  SUPPORT
  INTERNAL_BUG
  CUSTOM
  /// The auto-generated "Needs attention" hygiene track (needs-attention-roster.md): items
  /// assigned to a team's memberEmails roster that lack a sub-component or fix version. Has NO
  /// stages (WORKFLOWS entry is stages:[]), is excluded from SEEDABLE_WORKFLOW_TYPES and from all
  /// §12 metrics, and is partitioned out of the normal board filter list for separate rendering.
  NEEDS_ATTENTION
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
  riskComment      String?                         // known/agreed-risk note (presence = acknowledged); never a metric input
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

/// Admin-configured "planned/dedicated track capacity" (committed-unplanned-work.md) — the
/// Committed (FEATURE workflow) point target for one team in one sprint. Cadence is PER SPRINT:
/// unlike Team.developerCount, committed capacity can change release to release, so it is NOT a
/// static per-team constant — it lives on this join row, mirroring SprintSnapshot's (team, sprint)
/// shape minus the daily capturedOn axis. No row for a (team, sprint) ⇒ capacity is UNCONFIGURED,
/// not zero — only Committed work is ever compared against a target; Tech Debt/Unplanned Bugs
/// never have one.
model SprintCapacity {
  id              String   @id @default(cuid())
  sprintId        String
  sprint          Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  teamId          String
  team            Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  committedPoints Float
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([sprintId, teamId])
  @@index([sprintId])
}

// ─────────────────────────────────────────────────────────────
// Bug report dashboards (gm-bug-report.md, 2026-07-21)
// ─────────────────────────────────────────────────────────────

/// A configurable bug-report dashboard (e.g. "GM", "Honda") rendered at /bugs/[slug].
/// ORG-LEVEL, not team-scoped: its categories deliberately cut across teams. The first read
/// path in the app that is NOT sprint-scoped — the unit is counts across (category x scope x band).
model BugReport {
  id                   String   @id @default(cuid())
  name                 String
  slug                 String   @unique
  description          String?
  ownerName            String?
  targetDate           DateTime?
  targetLabel          String?
  /// Unmatched statuses land here; null = they fall into the derived `__unattributed__` row.
  fallbackCategoryId   String?
  /// Optional glob (e.g. `GM-*`) grouping bugs by Jira sprint ownership (bug-sprint-ownership.md):
  /// a bug whose jiraSprintName matches is "ours", else a dependency. Null/empty ⇒ grouping hidden.
  sprintOwnershipPattern String?
  isActive             Boolean  @default(true)
  lastRefreshedAt      DateTime?
  lastRefreshedByEmail String?
  lastRefreshError     String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  scopes     BugReportScope[]
  bands      BugReportBand[]
  categories BugReportCategory[]
  issues     BugReportIssue[]
  snapshots  BugReportSnapshot[]
}

/// One universe of bugs = the column GROUP (e.g. "External", "Internal"). Class is decided by
/// WHICH universe a bug lives in (external is a different Jira project), never by issue type.
model BugReportScope {
  id           String           @id @default(cuid())
  reportId     String
  report       BugReport        @relation(fields: [reportId], references: [id], onDelete: Cascade)
  name         String
  sortOrder    Int              @default(0)
  sourceType   FilterSourceType
  jql          String?
  jiraFilterId String?
  resolvedJql  String?                         // last JQL resolved from jiraFilterId
  resolvedAt   DateTime?                       // ...and when (surfaces Jira-side edits)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  slaTargets BugSlaTarget[]
  issues     BugReportIssue[]

  @@unique([reportId, name])
  @@index([reportId, sortOrder])
}

/// SLA days per Jira PRIORITY NAME within a scope. Breached when `jiraCreatedAt + days < asOf`.
/// App-computed, NOT a Jira filter. No row for a priority ⇒ never breached.
model BugSlaTarget {
  id           String         @id @default(cuid())
  scopeId      String
  scope        BugReportScope @relation(fields: [scopeId], references: [id], onDelete: Cascade)
  priorityName String
  days         Int

  @@unique([scopeId, priorityName])
}

/// A priority band = the display COLUMN within each scope (P0..P4 by default). Membership is a
/// configured set of Jira priority names; at most one band is the catch-all. Never parse strings.
model BugReportBand {
  id            String    @id @default(cuid())
  reportId      String
  report        BugReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  label         String
  sortOrder     Int       @default(0)
  priorityNames String[]
  isCatchAll    Boolean   @default(false)

  @@unique([reportId, label])
  @@index([reportId, sortOrder])
}

/// A matrix ROW = an ordered list of Jira statuses ("QA Team -> status = Testing"). First match
/// wins by sortOrder so rows always partition; a status in two categories is rejected at save.
model BugReportCategory {
  id          String    @id @default(cuid())
  reportId    String
  report      BugReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  name        String
  sortOrder   Int       @default(0)
  statuses    String[]
  accentColor String?

  @@unique([reportId, name])
  @@index([reportId, sortOrder])
}

/// Replace-on-refresh mirror of a scope's universe. RAW JIRA FACTS ONLY: band, category and SLA
/// breach are pure functions of (issue, config, asOf) computed at READ time, so admin config
/// edits re-render instantly with no Jira refresh and this stays a dumb mirror.
model BugReportIssue {
  id             String         @id @default(cuid())
  reportId       String
  report         BugReport      @relation(fields: [reportId], references: [id], onDelete: Cascade)
  scopeId        String
  scope          BugReportScope @relation(fields: [scopeId], references: [id], onDelete: Cascade)
  jiraKey        String
  title          String
  issueType      String
  jiraStatus     String                        // drives category resolution
  statusCategory String?
  priority       String?                       // drives band + SLA resolution
  assigneeName   String?
  reporterName   String?
  components     String?                       // comma-joined standard Jira Component (coarse parent, e.g. DR_GM)
  subComponent   String?                       // custom "sub-component[dropdown]" → Team via JiraSubComponent (read-time, FK-less join; enhancing-bug-board.md)
  jiraSprintName String?                       // Jira Sprint field → matched vs BugReport.sprintOwnershipPattern at read time (ours vs dependency; bug-sprint-ownership.md)
  labels         String?
  jiraCreatedAt  DateTime?                     // drives SLA breach + ageing
  jiraUpdatedAt  DateTime?
  lastSyncedAt   DateTime       @default(now())

  @@unique([scopeId, jiraKey])
  @@index([reportId])
}

/// Daily history of the CLASSIFIED matrix. Self-describing: every dimension carries a key AND the
/// label as it read that day, so renaming/deleting a category, scope or band never orphans
/// history. Derived rows use the sentinels `__total__` / `__unattributed__` (NULL-free unique key).
model BugReportSnapshot {
  id            String    @id @default(cuid())
  reportId      String
  report        BugReport @relation(fields: [reportId], references: [id], onDelete: Cascade)
  capturedOn    DateTime                        // UTC midnight — one set of rows per day
  rowKey        String                          // categoryId | "__total__" | "__unattributed__"
  rowLabel      String
  scopeKey      String
  scopeLabel    String
  bandKey       String                          // bandId | "__all__" (the scope Total column)
  bandLabel     String
  count         Int
  breachedCount Int

  @@unique([reportId, capturedOn, rowKey, scopeKey, bandKey])
  @@index([reportId, capturedOn])
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

    PROGRAM |o--o{ TEAM : "groups"

    TEAM ||--o{ TEAM_MEMBERSHIP : "has"
    TEAM ||--o{ FILTER_TEMPLATE : "owns"
    TEAM ||--o{ FILTER : "owns"
    TEAM ||--o{ ISSUE_PROGRESS : "owns"
    TEAM |o--o{ STATUS_STAGE_MAPPING : "overrides"
    TEAM ||--o{ SPRINT_SNAPSHOT : "rolled up in"
    TEAM |o--o{ JIRA_SUB_COMPONENT : "claims"

    JIRA_COMPONENT ||--o{ JIRA_SUB_COMPONENT : "has"

    SPRINT ||--o{ FILTER : "scopes"
    SPRINT ||--o{ ISSUE_PROGRESS : "scopes"
    SPRINT ||--o{ SHARED_VIEW : "scopes"
    SPRINT ||--o{ SPRINT_SNAPSHOT : "scopes"

    FILTER ||--o{ ISSUE : "caches"

    BUG_REPORT ||--o{ BUG_REPORT_SCOPE : "has"
    BUG_REPORT ||--o{ BUG_REPORT_BAND : "has"
    BUG_REPORT ||--o{ BUG_REPORT_CATEGORY : "has"
    BUG_REPORT ||--o{ BUG_REPORT_ISSUE : "caches"
    BUG_REPORT ||--o{ BUG_REPORT_SNAPSHOT : "history"
    BUG_REPORT_SCOPE ||--o{ BUG_SLA_TARGET : "SLA days by priority"
    BUG_REPORT_SCOPE ||--o{ BUG_REPORT_ISSUE : "universe of""

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
    PROGRAM {
        string id PK
        string key UK
        string name
    }
    TEAM {
        string id PK
        string key UK
        string name
        string programId FK "null = unassigned"
        string_arr jiraProjectKeys
    }
    TEAM_MEMBERSHIP {
        string id PK
        string userId FK
        string teamId FK
        Role role
    }
    JIRA_COMPONENT {
        string id PK
        string name
        string projectKey
    }
    JIRA_SUB_COMPONENT {
        string id PK
        string componentId FK
        string name
        string teamId FK "null = unassigned"
    }
    SPRINT {
        string id PK
        string name UK
        datetime developmentStart
        datetime developmentEnd
        string_arr fixVersions
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
    BUG_REPORT {
        string id PK
        string slug UK
        string name
        string fallbackCategoryId
        string sprintOwnershipPattern
        bool isActive
    }
    BUG_REPORT_SCOPE {
        string id PK
        string reportId FK
        string name
        FilterSourceType sourceType
        string jiraFilterId
    }
    BUG_SLA_TARGET {
        string id PK
        string scopeId FK
        string priorityName
        int days
    }
    BUG_REPORT_BAND {
        string id PK
        string reportId FK
        string label
        string_arr priorityNames
        bool isCatchAll
    }
    BUG_REPORT_CATEGORY {
        string id PK
        string reportId FK
        string name
        string_arr statuses
        int sortOrder
    }
    BUG_REPORT_ISSUE {
        string id PK
        string reportId FK
        string scopeId FK
        string jiraKey
        string jiraStatus
        string priority
        string subComponent
        string jiraSprintName
        datetime jiraCreatedAt
    }
    BUG_REPORT_SNAPSHOT {
        string id PK
        string reportId FK
        datetime capturedOn
        string rowKey
        string scopeKey
        string bandKey
        int count
        int breachedCount
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
- **`Team.memberEmails` (added 2026-08-11) is a roster, NOT membership.** A plain `String[]` of Jira
  assignee emails (mirroring `jiraProjectKeys`/`fixVersions`), deliberately decoupled from
  `TeamMembership`: a scrum team's developers rarely all sign into StoryBoard, and this list is only a
  JQL scoping input (`assignee in (...)`) for the auto-generated `NEEDS_ATTENTION` hygiene track — it
  grants no access and is never an RBAC subject. Kept as a scalar array (not a child table) because it
  is only ever consumed as JQL literals. See context/features/needs-attention-roster.md.
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
- **`IssueProgress.riskComment`** (added 2026-07-21) is a known/agreed-risk annotation — its
  presence *is* the acknowledgement (e.g. "QA hand-off intentionally slips one week") so a called-out
  risk can be communicated up to ED/VP as managed context instead of a fresh alarm. It rides the
  same `(teamId, sprintId, jiraKey)` row as `blockedReason`, so it survives re-syncs and is never
  merged across teams; it is purely a display annotation and is never read by the §12 metrics
  (health/velocity/percent are unaffected by its presence). See
  context/features/risk-comments-rollup-digest.md.
- **SharedView** replaces URL-encoded state with a short token + optional live rendering + expiry.
- **SprintSnapshot** is what makes leadership trend/burndown possible — write one row per day per
  team per active sprint from the background sync job.
- **The `BugReport*` cluster (added 2026-07-21) is deliberately unlinked from `Team` and `Sprint`.**
  A bug report has no sprint, no stages and no per-issue lifecycle — its unit is *counts across
  (category × scope × band)* — so it is org-level and joins nothing in the sprint spine. It repeats
  the proven **cache vs history** split (`BugReportIssue` mirrors Jira like `Issue`;
  `BugReportSnapshot` accrues daily like `SprintSnapshot`), with one deliberate difference: the
  cache stores **raw Jira facts only** and band/category/SLA-breach are computed at READ time from
  current config, so an admin config edit re-renders the dashboard instantly with no Jira refresh.
  Snapshot rows are self-describing (key + label per dimension) so renaming or deleting a category
  never orphans history. **[Amended 2026-08-02, enhancing-bug-board.md]** the cluster gained ONE raw
  fact column — `BugReportIssue.subComponent` — and, with it, its first link to `Team`: the "Bugs by
  scrum team" section joins `subComponent → JiraSubComponent.name → teamId` **at read time, with no
  FK** (exactly like `Issue ↔ IssueProgress` is joined by `jiraKey`, and like the read-time
  band/category/SLA classification). The cache stays a dumb Jira mirror; claiming a sub-component in
  `/admin` re-renders the section instantly. So "unlinked" now means "no FK / no schema relation to
  the sprint spine", not "never joined" — the read-time join is deliberate and preserves every
  instant-config property above. **[Amended 2026-08-04, bug-sprint-ownership.md]** the cluster gained
  a second raw-fact column — `BugReportIssue.jiraSprintName` — plus a per-report config scalar
  `BugReport.sprintOwnershipPattern` (e.g. `GM-*`); the "Bugs by sprint ownership" section classifies
  each bug **at read time** by matching its sprint against the pattern (ours vs a dependency on
  another team's sprint vs no sprint), so editing the pattern in `/admin` re-renders instantly with
  no Jira refresh — the same read-time discipline as the sub-component join and band/category/SLA
  classification. This one is not even a join (no `Team`); it is pure config-vs-fact matching.
- **The `JiraComponent`/`JiraSubComponent` cluster (added 2026-07-26) is a small, admin-maintained
  catalog behind One-Click Sprint Start.** A `JiraSubComponent` is claimed by **at most one** `Team`
  (`teamId` nullable — unassigned until claimed), mirroring the real org data where every scrum
  team maps to a distinct, non-overlapping set of Jira Component field values. `Team` gained 4
  per-track Issue Type override arrays (`featureIssueTypes`/`techDebtIssueTypes`/
  `internalBugIssueTypes`/`supportIssueTypes`) following the existing
  `storyPointsFieldId`/`sprintFieldId` override-with-hardcoded-default pattern, and `Sprint` gained
  `fixVersions` (manually entered Jira Fix Version names a Gate spans — no live Jira lookup, same
  as the sub-component catalog). See context/features/one-click-sprint-start.md.
- **`SprintCapacity` (added 2026-07-29) mirrors `SprintSnapshot`'s (team, sprint) shape minus the
  daily axis** — one row per team per sprint, not one per day. Deliberately **not** a `Team` column
  like `developerCount`: committed capacity is a per-*sprint* budget (a team's non-negotiable
  customer-committed scope can differ release to release), so it needed its own join table. A
  missing row means unconfigured, not zero — the Committed/Tech Debt/Unplanned Bugs breakdown it
  feeds is a display-only composition lens and never an input to Sprint Health/Completion/velocity.
  See context/features/committed-unplanned-work.md.
- **`Program` (added 2026-08-12) is the first grouping ABOVE `Team`** — a plain admin-managed entity
  (name + unique key) with `Team.programId` (`onDelete: SetNull`, so deleting a program un-assigns
  its teams rather than cascading, mirroring `JiraSubComponent.teamId`). It carries **no** sprint,
  metric, or lifecycle coupling — it exists only to define the team set for a program-scoped
  `/rollup`. "Single implicit org" still holds (no `Org` table); a Program is a grouping key, not a
  tenant boundary. The roll-up reuses `aggregateRollup` unchanged — a program roll-up is just
  `getRollupData` with the team set sourced from `program.teams` instead of the viewer's
  memberships. See context/features/program-rollup.md.

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
| AI | **Pluggable provider** (amended 2026-07-20; was "Gemini") | Provider-agnostic `src/lib/ai/` platform switched by `AI_PROVIDER` env (Gemini + Anthropic adapters ship). **[BUILT in part 2026-07-20]** — risk call-outs + leadership narrative ("AI Digest" dialog on `/`); Q&A over sprint data + stage suggestions remain post-v1. |
| Styling | **Tailwind CSS v4 + shadcn/ui** | CSS-var token theme in `globals.css` `@theme`. **Two themes (Tekion + Modern) BUILT 2026-07-24** — a `theme-modern` class on `<html>` swaps palette AND layout (blue + a dark nav sidebar via `AppShell`), localStorage-backed (modern-theme.md). Dark mode still post-v1 (dormant `.dark`). |

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

**Login page:** "StoryBoard — Connect your Jira account to get started." Inputs: **Jira Email**,
**API Token** (with "create token" hint → `id.atlassian.com → Security → API Tokens`), **Connect to
Jira** button. Footer: "Engineering Internal Tool @ Tekion Corp."

> Current components live under `src/components/{atoms,molecules,organisms,modals}` and are wired in
> `src/App.jsx`. Re-skin with Tailwind + shadcn during the Next.js migration rather than rewriting the
> logic in the hooks.

**UI/UX build log.** Every shipped UI/UX change, summarized; full dated entries live in
[project-overview-history.md](project-overview-history.md) and each linked feature spec. (The app's
UI/UX *direction* is the spec above; this table is the *history* of what shipped.)

| Date | Change | Detail (`context/features/…`) |
|---|---|---|
| 2026-07-08 | Login + team dashboard + minimal `/admin` re-skin (step 6a) | ui-port.md |
| 2026-07-08 | `/rollup` ED/TPM/EM multi-team roll-up (step 6b) | ed-rollup.md |
| 2026-07-10 | Full re-skin to the legacy design system (ui-polish) | ui-polish.md |
| 2026-07-19 | Trend/burndown + risk call-outs row on `/` and `/rollup` | trend-burndown.md |
| 2026-07-21 | Risk comments + roll-up all-risks dialog + roll-up AI Digest | risk-comments-rollup-digest.md |
| 2026-07-21 | `/bugs` bug-report dashboard (hero · matrix · charts) | gm-bug-report.md |
| 2026-07-24 | Modern theme (2nd theme: blue + dark nav sidebar) | modern-theme.md |
| 2026-07-24 | Sprint timeline (dev → QA/UAT → release) + two-lens metrics | sprint-phases-delivery-lens.md |
| 2026-07-25 | Hero timeline UI + live release countdown; density fixed | modern-theme.md · sprint-phases-delivery-lens.md |
| 2026-07-26 | Sidebar promoted to Tekion too + `ui/select.jsx` redesign | modern-theme.md |
| 2026-07-26 | One-Click Sprint Start admin + dashboard UI | one-click-sprint-start.md |
| 2026-07-27 | Real Tekion favicon + brand icon in sidebar | _(inline; see history archive)_ |
| 2026-07-27 | Velocity / LeaderBoard page + rank-1 podium treatment | leaderboard.md |
| 2026-07-28 | Story Points Delivered highlight card (micro-animation) | committed-unplanned-work.md |
| 2026-07-29 | Committed/Tech-Debt/Unplanned breakdown → delivery scoreboard | committed-unplanned-work.md |
| 2026-08-02 | `/bugs` scope toggle + Bugs-by-scrum-team drill | enhancing-bug-board.md |
| 2026-08-02 | `/bugs` PDF export with clickable Jira links | bug-report-pdf-export.md |
| 2026-08-04 | `/bugs` PDF reworked to a landscape executive report | bug-report-pdf-export.md |
| 2026-08-04 | `/bugs` sprint-ownership grouping (ours vs dependencies) | bug-sprint-ownership.md |
| 2026-08-07 | Sprint export adopts the `/bugs` PDF design system | export-visual-consistency.md |
| 2026-08-09 | Unplanned bifurcation + per-team composition chart | unplanned-split-and-chart.md |
| 2026-08-12 | Program picker + program-scoped roll-up hero; admin Programs section | program-rollup.md |
| 2026-08-11 | Admin roster editor + board "Needs attention" hygiene panel | needs-attention-roster.md |
| 2026-08-27 | Points display boundary + filter-card Jira quick-link + shared program chip | board-polish-points-and-links.md |

---

## 12. Metrics & calculations

Reference implementation: [`src/lib/metrics.mjs`](src/lib/metrics.mjs) (the pure port;
legacy `src/workflows.js` + `src/utils/sprintMetricsCompute.js` in `legacy/`).

> **Two lenses — delivery vs. throughput (BUILT 2026-07-24; sprint-phases-delivery-lens.md).**
> Sprint *delivery health* and *team throughput/capacity* are different questions, deliberately
> scoped differently:
> - **Delivery lens** = roadmap `FEATURE` + tech-debt `TECH_DEBT`, measured against the **dev cycle**
>   (`developmentStart → developmentEnd`). Feeds **Sprint Health**, **Completion %**, the **At-Risk**
>   card, the **risk call-outs**, and the hero phase-bar dev frontier. Support/internal-bug issues are
>   *reactive* — mostly surfaced during QA — so they never move this "is the committed sprint on
>   track" signal; they stay Delivery-Matrix rows with their own per-issue health.
> - **Throughput lens** = **all work** (roadmap + tech debt + support + internal bugs). Feeds
>   **velocity** and **Issues in scope**, because bugs consume real team capacity.
> `computeSprintMetrics` returns both sets (`delivery*` fields for the delivery lens; the all-work
> `points`/`avgProgress`/`healthCounts`/`velocity*` for throughput), and `aggregateRollup` mirrors
> them. The **burndown / `SprintSnapshot` / trend deliberately stay all-work (throughput)** so the
> snapshot contract and history stay continuous — no schema change (decision 4).

- **Weighted completion %** = Σ(weight of completed stages) / Σ(all weights), per issue.
- **Per-issue health** (`getHealthStatus`): compare completion % to *expected* progress
  `elapsedDays / totalDays`. Bands by delta: `≥+10 Ahead`, `−10..+10 On Track`, `−25..−10 At Risk`,
  `<−25 Behind`; plus `Blocked`, `Done` (100%), `Not Started` (0% & <5% expected). **[Fixed
  2026-07-28]** — once `asOf` is past `developmentEnd`, an incomplete issue can no longer read
  Ahead/On Track (delta-vs-expected alone let a 93%-complete issue past its deadline still badge
  "On Track", and the sprint overall "Excellent"): it's now At Risk (≥90%) or Behind (<90%), full
  stop. The Sprint Health card's "N/M delivery on track" line — which hid Done/At Risk/Behind
  entirely — was also replaced with the full worst-first breakdown (mirrors the `rollup`
  team-summary-table's band vocabulary), in the live card and the PDF/PNG export alike.
- **Sprint timeline** (`getSprintPhase`/`formatSprintWindow`, BUILT 2026-07-24; hero UI refreshed
  2026-07-25): a sprint runs **dev cycle** (`developmentStart → developmentEnd`) → **QA/UAT**
  (`developmentEnd → releaseDate`) → **released** (after `releaseDate`) — it **ends at the release
  date, not dev end**. The readout is a live, phase-aware **release countdown** — a progress ring +
  a ticking `d·h·m·s` clock (dev-cycle countdown → QA/UAT countdown to release → "Released"; only
  "Sprint ended" when a sprint has no release date) — and the hero phase bar is a **sprint timeline**
  with two macro-cycle status chips (Dev cycle → QA/UAT, `✓ Completed` / `● In progress`) over the
  seven phases, **hybrid**: delivery completion % drives the four dev phases during the dev cycle,
  then QA/UAT/Release light up **by date**. Metric *time math* is unchanged — `getSprintPhase` itself
  is untouched (the refresh is presentation); delivery is still measured against the dev cycle.
- **Sprint health** (**delivery lens — roadmap `FEATURE` + tech-debt `TECH_DEBT`**, since
  2026-07-24; was FEATURE-only): `Critical` if any blocked or >30% behind; `At Risk` if
  (atRisk+behind) >20%; `Complete`/`Excellent`/`Healthy`/`Fair` otherwise. The At-Risk card + risk
  call-outs are delivery-scoped the same way (support/bug blocks are not "sprint risks").
- **Velocity** (`getWeeklyVelocity`): `completedPoints / weeksElapsed`; projects `weeksNeeded =
  remainingPoints / velocity`. Velocity counts **all work** (throughput lens) since 2026-07-24 —
  bugs consume real capacity; it previously counted `feature` + `techdebt` only. This is
  a **naive linear** model. **The snapshot swap landed 2026-07-19 (trend-burndown):** `/` and
  `/rollup` pass `snapshotVelocity` (trailing-7-day burn off `SprintSnapshot` rows, shared basis
  with the chart projection) into the velocity card whenever ≥ 2 daily snapshots exist — the
  naive model is **deliberately retained** as the fallback and the only model on share/export
  paths (frozen-share pin, §12 asOf).
- **Trend series** (`buildTrendSeries` / `combineSnapshotsByDay`, 2026-07-19): pure burndown
  series off snapshot rows — ideal from the *latest* total (scope grows mid-sprint), actuals per
  captured day (gaps never zero-filled), projection at the trailing-7-day rate (none with < 2
  snapshots or past `developmentEnd`); roll-up days are summed as-is over the teams that captured,
  tagged `teamCount`.
- **Explicit clock (`asOf`) — `web/` only, step 8 (2026-07-12):** the time-dependent functions
  (`getHealthStatus`, `getWeeklyVelocity`, `computeSprintMetrics`, `getSprintPhase`) take an
  optional `asOf` (default: now). Frozen shared views pass their snapshot's `capturedAt` so
  health/velocity can't drift after capture; all other callers pass nothing and behave as before.

> **Display boundary — `formatPoints` (added 2026-08-27, board-polish-points-and-links.md).**
> Story points are summed in JS at several levels (track → team → sprint → roll-up), so IEEE-754
> addition can leak artifacts like `41.260000000000005` into the UI wherever a binary-inexact point
> value participates (live data holds `0.13` and `0.38`). `formatPoints` rounds to ≤2dp and drops
> trailing zeros at **render time only**. It is **not** a metric: no value in this section moves,
> and its result must never be fed back into a calculation.

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
   matrix — all still re-checked server-side per request. **[Reaffirmed 2026-07-26,
   one-click-sprint-start.md decision 4]** — Sprint creation stays global-admin-only with **no
   carve-out**: the new "One-Click Sprint Start" dashboard action can only *select* an existing
   Sprint, never create one, so it needs exactly the `TEAM_MANAGER_ROLES` gate that already governs
   manual filter creation — zero new RBAC surface. **[Extended 2026-07-27, leaderboard.md decision
   5]** — a new, deliberately NARROWER role group `LEADERBOARD_ROLES = [EM, ED, VIEWER]` (+ global
   admin bypass) gates the `/leaderboard` page; unlike every other role group in `rbac.js`, TPM is
   NOT included (LEAD/MEMBER get a personal, non-competitive stats card instead of the full board).
   The same feature also hardened `syncTeamSprint` (`lib/sync/engine.js`) to reject syncing an
   already-`CLOSED` sprint (409 via the existing `ConflictError`) — a data-integrity fix, not a new
   mutation surface, protecting the historical `Issue`/`IssueProgress` rows the leaderboard's
   all-time view depends on.
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
   see context/features/ed-rollup.md. VP *trend* closed 2026-07-19 (burndown panel, §14.8);
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
   leadership signal §2.2 demands. *Fix:* `SprintSnapshot` daily job (§9). **[Fixed — data
   2026-07-09 (step 7), UI 2026-07-19]** — daily per-team snapshots written by `POST /api/cron/daily`
   (context/features/background-sync-snapshots.md); rendered by the burndown panel on `/` and
   `/rollup` incl. the projected-finish signal (context/features/trend-burndown.md). Real trend
   *density* still depends on scheduling the cron on Tekion infra (deploy-time task).
9. **No caching; sequential Jira calls.** An ED viewing N teams triggers many paginated live calls and
   risks Jira rate limits. *Fix:* background sync into the Issue cache + optional Redis.
   **[Partially addressed in `web/` 2026-07-09, step 7]** — the daily cron refreshes Issue caches in
   the background, so ED reads hit a warm cache; Redis is still open (optional/post-v1).
10. **Gemini has no defined use case.** Listed in the stack with no feature. *Decide scope* (proposed:
    auto-write the leadership narrative for exports) before building. **[Fixed 2026-07-20]** — scope
    decided AND built for the first two §16 use cases (risk call-outs + leadership narrative): the
    on-demand "AI Digest" dialog on `/`, atop a **provider-agnostic** platform (`src/lib/ai/` —
    Gemini is the first adapter, not load-bearing; switch providers via `AI_PROVIDER` env).
    Export-embedded narrative, Q&A, and stage suggestions remain open post-v1 ideas.
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
- **Gemini → provider-agnostic AI platform: post-v1; first two use cases BUILT.** All four AI use
  cases (risk call-outs, narrative, Q&A, stage suggestions) approved in principle; risk call-outs +
  leadership narrative shipped as the "AI Digest" (`src/lib/ai/`, `AI_PROVIDER`-switched Gemini/Anthropic),
  plus known/agreed `riskComment`s and a roll-up all-risks dialog. Q&A + stage suggestions remain open.
  Full amendment history in the archive. See context/features/ai-insights.md, risk-comments-rollup-digest.md.
- **Bug report dashboards (ratified 2026-07-21).** A config-driven bug matrix + executive dashboard at
  `/bugs`: rows/columns/cells are all admin config (nothing hardcoded), a new non-sprint-scoped route,
  cached + daily cron + manual Refresh, read-time SLA-breach + category/band classification, multi-report
  from day one. Full 10-point ratification in the archive. See context/features/gm-bug-report.md.
- **Sprint timeline + two-lens metrics (ratified 2026-07-24).** A sprint ends at the release date (dev
  cycle → QA/UAT → released), and metrics split into a **delivery lens** (roadmap + tech debt → Sprint
  Health / Completion / At-Risk / risk call-outs) vs a **throughput lens** (all work → velocity /
  Issues-in-scope); burndown/snapshot/trend stay all-work. Full rationale in the archive. See
  context/features/sprint-phases-delivery-lens.md.
- **One-Click Sprint Start (ratified 2026-07-26; JQL amended 2026-07-27).** Generate a team's four missing
  tracks from an admin `JiraComponent`/`JiraSubComponent` catalog + per-team Issue Type overrides +
  `Sprint.fixVersions`, against an **existing** Sprint (never creates one — no RBAC carve-out). Generated
  JQL scopes via the custom `"sub-component[dropdown]"` field (External Bug ANDs parent Component + the
  sub-component). Full 7-point + amendment detail in the archive. See context/features/one-click-sprint-start.md.
- **Velocity / LeaderBoard (ratified 2026-07-26/27).** Team + org-wide developer story-point leaderboard,
  sprint-scoped + all-time, computed **live** off persisted `Issue`/`IssueProgress` (no snapshot table),
  divisor `Team.developerCount`; gated to `LEADERBOARD_ROLES` (TPM excluded), LEAD/MEMBER get a personal
  "my stats" card; bundled bugfix gates manual sync away from CLOSED sprints. Full 9-point ratification in
  the archive. See context/features/leaderboard.md.
- **Committed / Tech Debt / Unplanned breakdown + per-sprint capacity (ratified 2026-07-28/29).** A
  display-only three-way point composition (Committed=`FEATURE`, Tech Debt=`TECH_DEBT`, Unplanned
  Bugs=`SUPPORT`+`INTERNAL_BUG`) vs a per-team-per-sprint `SprintCapacity` target; never wired into §12;
  redesigned the same day into the ink-surface **delivery scoreboard** (condensed/relaxed). Full 10-point
  + design amendment in the archive. See context/features/committed-unplanned-work.md.
- **Enhancing the Bug Board (ratified 2026-08-02).** External/Internal/All scope toggle driving the whole
  page (instant client-side), a read-time FK-less sub-component → team join ("Bugs by scrum team"), and a
  per-developer drill with an "Unassigned" bucket; `JIRA_SUBCOMPONENT_FIELD_ID` env override for ambiguous
  fields. Full 5-point ratification in the archive. See context/features/enhancing-bug-board.md.
- **Bug Board sprint-ownership grouping (ratified 2026-08-04).** Classify each bug ours / dependency /
  no-sprint by matching `jiraSprintName` against a per-report `sprintOwnershipPattern` (e.g. `GM-*`),
  read-time and config-driven; a drill section + KPI card + PDF appendix. Full 6-point ratification in the
  archive. See context/features/bug-sprint-ownership.md.
- **Unplanned work bifurcation + chart view (ratified 2026-08-09).** Split Unplanned Bugs into External
  (`SUPPORT`) + Internal (`INTERNAL_BUG`) across all four scoreboard surfaces; a first-attempt composition
  donut was rejected ("not adding any value") and replaced by a per-team composition chart on `/rollup`
  only (a lens the totals can't show). Full decision + palette rationale in the archive. See
  context/features/unplanned-split-and-chart.md.
- **Scrum-team member roster + auto "Needs attention" track (ratified 2026-08-11).** A per-team
  admin-entered `Team.memberEmails String[]` (Jira assignee identities, deliberately separate from RBAC
  `TeamMembership`) drives an always-on `WorkflowType.NEEDS_ATTENTION` board track. Two ratified calls:
  filter scope = missing **sub-component OR fix version** (broad hygiene net); trigger = **always
  present, auto-refreshed** by every Sync + the daily cron when a roster exists (no button — generation
  folds into `syncTeamSprint`, so **no new API route**). Realized as a real Filter of a dedicated enum
  value, excluded from all §12 metrics by one additive no-op guard and partitioned into its own panel;
  untagged items never seed `IssueProgress`. See context/features/needs-attention-roster.md.
- **Program grouping + Program roll-up (ratified 2026-08-12).** Four AskUserQuestion calls: (1) a
  **first-class `Program` model** (admin CRUD) over a free-text field; (2) the program picker lives on
  the **existing `/rollup`** (`?program=` scope) not a separate page, with "my teams" the default; (3)
  **view access = leadership + admins** — new `PROGRAM_ROLES = [ED, TPM, EM, VIEWER]` (+ admin), TPM
  included unlike `LEADERBOARD_ROLES`, and a non-leadership viewer's `?program=` is silently ignored
  (never a 403); (4) **one program per team** (`Team.programId`, `onDelete: SetNull`). A program
  roll-up reuses the entire roll-up pipeline unchanged — only the team-set source swaps from
  `getMembershipContext` to `program.teams`; §12 metrics untouched. See
  context/features/program-rollup.md.

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
10. **Cutover, then post-v1 — DONE.** `web/` was promoted to the repo root and the Vite app retired into
    `legacy/` (2026-07-18, with the Node 22 bump); every post-v1 feature since has shipped — trend/burndown
    UI, AI Digest, risk comments, the `/bugs` bug-report suite, sprint timeline + two-lens metrics,
    One-Click Sprint Start, Leaderboard, the delivery scoreboard + unplanned split, and per-track
    Sync-stages. Per-feature state is in §5 and §11's build log; the full step-by-step completion
    narrative is in [project-overview-history.md](project-overview-history.md). See context/features/cutover.md.
