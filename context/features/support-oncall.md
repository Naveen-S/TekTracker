# Support On-call — per-sprint Support POCs + Primary POC directory

## Overview

Every release (Gate), each scrum team nominates one or a few people as **Support POCs**. During
that rotation they handle the production issues that come in for the team's modules. Today this
lives in a hand-made Confluence page that is copied for each release, e.g. *"AEC Support POD POC
Details — Nov Dev (Dec 26 Release)"* (AEC space, page 6877021047; the earlier "Sep (Oct 25
Release)" and "Oct (Nov 25 Release)" editions are pages 4982603802 / 5097848833). Those pages
have a component/track table with FE and BE POCs (name + phone), a "(Primary)" marker, EM and
PM columns, a "Final Headcount" column, and a rotation window of **dev cycle start → dev
completion**. When a P0 or high-P1 incident comes in, the Support team looks up the module's POC
on that page and triggers a PagerDuty call.

On top of the POCs there is a **Primary POC**. They are the first contact when any issue comes
in, and their job is to pull people in, keep tickets moving, and keep the team's **External and
Internal bugs** under control. In practice there is one Primary in PCX, one in Integrations and
one in DX (covering DX / SCX / OX).

This feature moves the page into StoryBoard:
- managers record each team's POCs for each sprint, and flag a Primary;
- a new **`/oncall`** directory lets anyone signed in (Support included) find the right person
  by team, module or name, in a couple of seconds, on a phone or a laptop;
- next to each team's Primary, the directory shows the team's **open External and Internal bug
  counts** for that sprint (the "bug pulse").

Source: the handwritten note `context/SprintTracker - Project Spec/OnCall.jpg` (2026-10-22) and
Naveen's answers in the planning session.

**Where it sits:** a post-v1 feature, not a master-plan step. It is **queued behind
`modern-artifact-theme.md`**, the current feature. Both touch `app-sidebar.jsx`, `hero-shell.jsx`
and the admin team dialog, so cut this branch from `main` **after** the Modern theme PR merges.
That way the new page is built on the new tokens once instead of being re-skinned later.

Canonical-doc sections touched: project-overview §5 (feature row), §9 (schema + ERD + rationale),
§11 (build log), §13 (phone numbers are PII → redactor), §16 (ratified decision), §17 (nothing new).

> **Key shift:** this is the first StoryBoard data about **people's support duty**, not about
> Jira work. It is keyed **(team, sprint)**, like `SprintCapacity`, and joins the sprint spine. It
> stays **display-only**: no §12 metric reads it, and the bug pulse reuses the existing per-issue
> completion. `metrics.mjs` is imported, never changed.

## Status

Planned 2026-10-22. Not started. Branch to be `feature/support-oncall`, cut from `main` after
`feature/modern-artifact-theme` merges.

## Decisions

Ratified with Naveen via AskUserQuestion, 2026-10-22:

1. **POCs are per team, per sprint.** Each team nominates its Support POCs for each Sprint (Gate),
   per the handwritten note. Nothing carries over from one sprint to the next.
2. **Primary POC: optional, at most one per team per sprint.** A team may flag 0 or 1 of its POCs
   as Primary. PCX, INT and DX each flag one, and DX's Primary covers DX / SCX / OX. Teams without
   one (e.g. CALM, D360, AAI today) simply list POCs. No new grouping entity ("support pod"),
   which was considered and set aside.
3. **Audience: any signed-in user.** Same rule as `/security` (C1): everyone who can sign in sees
   every team's POCs, including Support staff. There is no public or tokenized link.
4. **Headcount: an admin-set cap per team.** `Team.onCallHeadcount` is entered in the admin team
   dialog next to `developerCount`. It mirrors the Confluence "Final Headcount" column. Managers can
   nominate up to that many POCs per sprint, and the server enforces it.
5. **Bug pulse is included.** Each team card shows "External bugs N open / M · Internal bugs N
   open / M" for the selected sprint. It is read from the team's existing `SUPPORT` and
   `INTERNAL_BUG` board tracks (Issue cache + IssueProgress) and links to the team board. It is
   read-only, makes no Jira call, and feeds no metric.

PROPOSED (defaults chosen; none of them block implementation):

6. **Which rotation is "now".** The Confluence pages define the rotation window as the
   **dev cycle** (`developmentStart → developmentEnd`). With no `?sprint=`, `/oncall` resolves the
   **latest sprint whose `developmentStart` ≤ now**. That sprint's POCs stay on duty until the next
   Gate's dev cycle starts, even if the next Gate hasn't been created yet. (Today on dev: November
   2026 Release, dev ended Oct 14, still the current rotation.) A sprint picker shows any other
   sprint.
   *Alternatives:* the ACTIVE sprint (there can be more than one, or none); a stored per-sprint
   rotation window (needs schema; parked).
7. **Edit gate = `TEAM_MANAGER_ROLES` on that team (+ global admin).** The note asks for
   "Admin / TPM / Manager". `TEAM_MANAGER_ROLES` = ADMIN, ED, TPM, EM, LEAD, the group that already
   governs filter creation and One-Click Sprint Start. *Alternative:* a new, narrower
   `ONCALL_EDITOR_ROLES` that leaves out LEAD.
8. **If `onCallHeadcount` is null, the cap is `DEFAULT_ONCALL_HEADCOUNT = 2`** (FE + BE, the
   Confluence shape). An admin can raise or lower it per team. *Alternative:* null means nobody can
   be nominated, which would block every team until an admin acts.
9. **Contact fields:** email (required, lowercased, unique per team + sprint), display name
   (required), phone (optional), area (optional free text such as "BE", "FE", "SCX", "OX"; it
   replaces the Confluence FE/BE columns without fixing a vocabulary). No Slack or PagerDuty field
   in v1.
10. **Who can be picked:** suggestions come from the team's `memberEmails` roster plus its
    `TeamMembership` users, with names prefilled from `User.displayName` where known. Free entry is
    always allowed, because a POC need not be a StoryBoard user. There is no live Jira user search
    (it would add a Jira call and a new client function; parked).
11. **"Open" bug = per-issue weighted completion < 100**, which is the board's own definition of
    Done (§12 per-issue health). The counts therefore match what the board shows. *Gotcha
    accepted:* stage seeding is create-only, so a bug closed in Jira after it was first seeded still
    counts as open until someone ticks its stages or runs "Sync stages". The card says "as on the
    board". *Alternative:* store Jira `statusCategory` on `Issue` (schema + transform change;
    parked).
12. **CLOSED sprints are read-only** (409 via `ConflictError`), the same rule `syncTeamSprint`
    applies. Past rotations stay as a record.
13. **The write is one replace-all `PUT`** for a team + sprint, in one transaction. This keeps "at
    most one Primary", the cap and dedupe as checks over a single list. It is an API route rather
    than a Server Action, following house precedent (every mutation is a `withRoute` handler).
14. **Board hero chip:** the `/` hero shows "On call: {Primary} +N" for the selected team and
    sprint, linking to `/oncall?team=…&sprint=…`. Managers usually start from the board. It can be
    dropped without affecting anything else.

## Requirements

### Scope

**(a) Schema** (`prisma/schema.prisma`; migration `add_support_oncall`, 15 → **16**). Use the
`prisma-change` skill: schema and §9 in the same change, a named migration, then
`prisma generate`.
```prisma
/// A team's Support on-call POC for one sprint's rotation (support-oncall.md). Display-only —
/// never a §12 metric input. ≤ 1 isPrimary per (team, sprint), enforced by the replace-all PUT.
model SupportPoc {
  id          String   @id @default(cuid())
  teamId      String
  team        Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  sprintId    String
  sprint      Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  email       String                       // lowercased Jira identity; need not be an app User
  displayName String
  phone       String?                      // PII — redacted at the logging boundary (§13)
  area        String?                      // free text: "BE", "FE", "SCX", "OX"…
  isPrimary   Boolean  @default(false)
  sortOrder   Int      @default(0)
  updatedById String?                      // no FK (ErrorLog reasoning: survive user deletion)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([teamId, sprintId, email])
  @@index([sprintId])
}
```
Also add `Team.onCallHeadcount Int?` (admin-entered, same pattern as `developerCount`), plus the
`supportPocs SupportPoc[]` back-relations on `Team` and `Sprint`.
- **Do not hand-write a partial unique index** for `isPrimary`. Prisma would see it as drift. The
  rule is enforced by the single validated list (d). Check the installed Prisma 7 docs before
  assuming any partial-index support.

**(b) Pure logic** (`src/lib/oncall/rotation.mjs`, `src/lib/oncall/pulse.mjs`; relative imports
only, no `@/`):
- `resolveOnCallSprint(sprints, now)` implements decision 6. It returns null when every sprint
  starts in the future.
- `formatRotationWindow(sprint)` returns "Sep 17 → Oct 15 · dev cycle of {name}". Reuse
  `formatDateUTC` from `metrics.mjs`.
- `bugPulse(filters, progressByKey)` returns `{ external: { open, total }, internal: { open,
  total } }` over `SUPPORT` and `INTERNAL_BUG` filters. It uses `resolveProgress` and
  `calculateWeightedCompletion` from `metrics.mjs` (imported unchanged) and dedupes by `jiraKey`
  within each kind.

**(c) Zod** (`src/lib/schemas/oncall.js`):
- `supportPocSchema` for one row.
- `supportPocListSchema` for the array, with refinements: at most one `isPrimary`; emails unique
  case-insensitively; length ≤ 50 (a hard ceiling; the per-team cap is checked in the route
  because it needs the DB).
- `teamFields` in `src/lib/schemas/team.js` gains
  `onCallHeadcount: z.coerce.number().int().min(1).max(20).nullish()`.

**(d) API** (+1 route file): `PUT /api/teams/[teamId]/sprints/[sprintId]/oncall`.
- Wrapped in `withRoute("teams.sprints.oncall.put", …)`.
- Order of checks: `requireTeamRole(teamId, TEAM_MANAGER_ROLES)`; sprint exists (404); sprint not
  CLOSED (`ConflictError`, 409); list length ≤ the cap (`ValidationError`, 400, with `details.cap`).
- Then, in one `$transaction`: `deleteMany` for the team + sprint, then `createMany` with
  `sortOrder` set from the list order and `updatedById` set to the caller.
- Returns the saved rows.
- Throw typed errors; **no inner try/catch** (house rule).
- No GET route: the page renders on the server and the dialog uses page data plus
  `router.refresh()`.

**(e) Data loader** (`src/lib/oncall/data.js`): `getOnCallData(user, { sprintId })`.
- Loads the sprints (for the picker) and the resolved sprint.
- Loads **all** teams (decision 3), each with: program `{ id, key, name }`; the names of its
  claimed `JiraSubComponent`s (searchable "modules"); `onCallHeadcount`; its `SupportPoc` rows for
  the sprint; and its bug pulse. The pulse needs one batched query for the `SUPPORT` and
  `INTERNAL_BUG` filters with their issues, plus one for IssueProgress. Avoid N+1.
- Computes a per-team `canEdit` (global admin, or a `TEAM_MANAGER_ROLES` membership).
- Editor-only data (roster emails, members' email + name suggestions) is sent **only for teams
  where `canEdit` is true**. Viewers never receive a team's full roster.

**(f) `/oncall` page** (`src/app/oncall/page.jsx` server component + `loading.jsx`;
`src/components/oncall/*`). Run `/impeccable` and follow the house kit.
- Signed out → redirect to login (`requireUser`).
- Hero (`HeroShell`): "Support on-call", the sprint `<Select>` (preserves `?sprint`), the rotation
  window line, and a search box. Search runs client-side and matches team name/key, program,
  module (sub-component) names, and POC names or emails. With `?team=`, the page scrolls to that
  team and highlights it.
- Teams are grouped by program (`ProgramChip`), with "No program" last. Each team card shows:
  - the Primary first, visually distinct, with name, area, `mailto:`, `tel:` and a copy button
    (`CopyStateIcon`);
  - the other POCs;
  - the modules covered (sub-component names, collapsed after ~4);
  - the bug pulse line linking to `/?team=…&sprint=…`;
  - "N of cap nominated";
  - an **Edit** button when `canEdit`.
- Empty states: "No POCs nominated for {sprint}" on a team card (with Edit for managers);
  "No rotation yet" when `resolveOnCallSprint` returns null.
- Works at **390 px**: Support uses phones, so `tel:` is the main action there.

**(g) Edit dialog** (`src/components/oncall/oncall-edit-dialog.jsx`):
- `Dialog` with `hero` and `footer`; Cancel via `DialogClose`, Save as the primary action.
- Rows use `Field` + `Input`. Email has suggestions (roster ∪ members); choosing one prefills the
  name.
- Primary is a single choice across rows, with a "No primary" option.
- Add row is disabled at the cap and shows the cap. Remove row; reorder is optional (row order
  becomes `sortOrder`).
- Errors use the existing toast + error-reference pattern.

**(h) Admin** (`src/components/admin/team-config-dialog.jsx`): an "On-call headcount" number
field next to `developerCount`, with placeholder "2 (default)". It is submitted through the
existing team PATCH. No new route.

**(i) Navigation** (`src/components/ui/app-sidebar.jsx`): an "On-call" item (lucide `LifeBuoy`)
for every signed-in user, placed after "Bug report".

**(j) Board hero chip** (decision 14; `src/components/dashboard/hero.jsx` +
`getDashboardData`): one extra `supportPoc.findMany` for the selected team + sprint, rendered as a
small chip. It is hidden when there are no POCs. It can be dropped without touching (a)–(i).

**(k) Redaction** (`src/lib/log.js`): add `phone` to the `SECRET_KEY` key list as default-deny PII,
next to `email`, so a phone number never reaches stdout or `ErrorLog.details`. Update the comment
above the list.

### Mechanism / gotchas

- **Read the installed docs first.** Next 16 (async `params` / `searchParams`), Prisma 7 (client
  from `@/generated/prisma/client`; after `migrate dev`, run `prisma generate` explicitly), and
  Tailwind v4 (`@theme` tokens; never hard-code a hex; the Modern theme's tokens apply here too).
- **The office DB is migrated by hand.** Migration 16 needs a `dba-migration-bundle` psql bundle
  that Naveen runs on the jumpserver **before** the image rolls out. The office head must already
  be 15 (`add_security_tracker`). Confirm that first.
- **Invariants move: 65 → 67 ƒ Dynamic** (`/oncall` + the PUT route) **and 15 → 16 migrations.**
  Declare both in the PR and in current-feature carry-forward.
- **§12 is untouched.** `bugPulse` imports `resolveProgress` and `calculateWeightedCompletion` and
  changes nothing. It must exclude `NEEDS_ATTENTION` (it only reads `SUPPORT` / `INTERNAL_BUG`, so
  that holds by construction).
- **An issue can appear under two filters of the same kind.** Dedupe by `jiraKey` within each
  kind. Progress is per (team, sprint, jiraKey), so the owning-workflow rule still applies through
  `resolveProgress`.
- **Phone numbers are PII.** Never log the request body. (k) is the safety net, not permission.
- **Never derive names from `constructor.name`** (minification). Use the explicit `withRoute`
  name.
- **Smoke tests:** Next 16 renders `redirect()` with a 200, so assert on content. Minted
  iron-session cookies; tear fixtures down to 0 rows.

### Acceptance criteria

- `/verify` passes:
  - `yarn lint` clean;
  - `prisma validate` and `prisma migrate status` up to date at **16**;
  - a **cold, env-free build** (`rm -rf .next`, `.env*` moved aside) exits 0 with **67 ƒ
    Dynamic** and 0 warnings (grep the log; don't restate it);
  - §9 byte-consistent with `schema.prisma`.
- **Pure fixtures** (`node` scratch script inside the repo, not committed):
  - `resolveOnCallSprint`: between two dev cycles (previous sprint stays current); all sprints in
    the future (null); several started (latest wins); exact boundary instant.
  - `bugPulse`: mixed done/open; the same key under two SUPPORT filters counted once; an empty
    track gives 0/0; a missing progress row is treated as not started.
  - zod: two primaries → error; duplicate email differing only in case → error; 0 rows valid
    (clears the team).
- **API smoke** (minted cookies against Neon):
  - EM of team A: PUT A → 200, PUT B → 403.
  - MEMBER of A → 403. Global admin → 200 on any team.
  - Over the cap → 400 with `details.cap`. Two primaries → 400.
  - CLOSED sprint → 409. Unknown sprint → 404.
  - A second PUT replaces the first (row count equals the new list).
  - A forced 500 containing a phone number shows it redacted in `ErrorLog.details`.
- **Page smoke:**
  - Signed out → login content.
  - A MEMBER of no team sees every team's POCs and no Edit button.
  - An EM sees Edit only on their own team.
  - A viewer's HTML contains no roster emails from other teams.
  - The `?sprint=` and `?team=` deep links work.
  - The bug pulse numbers equal a hand count from the board for one live team.
- **Headless Chrome** at 390 and 1440 px, in Tekion and Modern: 0 horizontal overflow, 0 console
  errors.
- **Naveen's acceptance:** an authed browser pass, plus entering one real rotation (the Nov Dev /
  Dec 26 page) end-to-end and comparing it with the Confluence page.

### Out of scope (parked)

- **PagerDuty integration** (trigger a call or link a schedule from the card): a later spec. Needs
  PagerDuty credentials and a service map.
- **Non-StoryBoard rows** in the Confluence page (Platform/Core dependency, TAP, ARC-Chat, Galaxy,
  DevOps, DBA, ARC Integrations): they have no `Team`. A later "external contacts" list if needed.
- **Escalation matrix** (Level 1 Support POC → Lead → EM → Director → VP → CTO → CEO) and the
  EM/PM columns. A later step could show the team's EM from `TeamMembership`.
- **Sub-sprint rotations.** The DR on-call calendar rotates every two weeks (MAR_S2, APR_S1…), and
  this model is one rotation per Gate. Adding optional `startsOn` / `endsOn` per POC would be its own
  change.
- **Secondary-POC role, Slack handle, live Jira user search, copy from the previous sprint,
  Confluence/CSV export, a public share link, Ask StoryBoard "who's on call for X?" pack,
  notifications.**
- **Storing Jira `statusCategory` on `Issue`** to make the bug pulse independent of stage upkeep
  (decision 11's alternative).

## Doc-sync (same PR)

- `context/project-overview.md`:
  - §5: a new row "Support on-call directory (`/oncall`)" marked **[BUILT]** only for what ships.
    If (j) is dropped, don't mention the board chip.
  - §9: the `SupportPoc` model + `Team.onCallHeadcount` in the schema block; in the ERD, a
    `SUPPORT_POC` entity plus `TEAM ||--o{ SUPPORT_POC` and `SPRINT ||--o{ SUPPORT_POC`; a
    rationale bullet (keyed (team, sprint) like `SprintCapacity`; display-only; FK-less
    `updatedById`).
  - §11: a build-log row.
  - §13: a new item saying phone is PII and is on the redactor key list.
  - §16: this ratified decision (decisions 1–5 plus the proposed ones as built).
- `CLAUDE.md` Structure: add `/oncall` to the page list.
- `context/current-feature.md` carry-forward: invariants **67 ƒ / 16 migrations**; office DB head
  after Naveen runs the bundle.
- This spec: as-built notes, and Status → Done summary.
- **Don't over-claim:** PagerDuty, escalation and external contacts stay unbuilt. The bug pulse is
  "as on the board", not a Jira-status truth.

## References

- Source note: `context/SprintTracker - Project Spec/OnCall.jpg`.
- Confluence (AEC space): Nov Dev (Dec 26 Release) page 6877021047; Oct (Nov 25 Release)
  5097848833; Sep (Oct 25 Release) 4982603802; DR On-call support calendar (Mar–Jun 2026)
  5918982230 (Primary/Secondary, two-week rotations, escalation order).
- RBAC: `TEAM_MANAGER_ROLES` `src/lib/rbac.js:25`, `requireTeamRole` `src/lib/rbac.js:71`.
- Auth: `requireUser` `src/lib/auth.js:138`.
- Metrics (import only): `calculateWeightedCompletion` `src/lib/metrics.mjs:61`, `resolveProgress`
  `src/lib/metrics.mjs:120`, `formatDateUTC` `src/lib/metrics.mjs:761`.
- Loaders: `getSprintSelection` `src/lib/dashboard-data.js:92`, `getDashboardData`
  `src/lib/dashboard-data.js:128`.
- Team schema: `developerCount` `src/lib/schemas/team.js:46`; admin dialog
  `src/components/admin/team-config-dialog.jsx:37`.
- Redactor: `SECRET_KEY` `src/lib/log.js:34`.
- Nav: `src/components/ui/app-sidebar.jsx:42`.
- UI kit: `src/components/ui/{hero-shell,dialog,field,input,select,program-chip,copy-state-icon,callout}.jsx`.
- Precedents: `SprintCapacity` (per (team, sprint) admin data), `program-rollup.md` (self-contained
  admin data + picker), `security-vulnerability-tracker.md` (any-signed-in audience),
  `needs-attention-roster.md` (`Team.memberEmails`).
