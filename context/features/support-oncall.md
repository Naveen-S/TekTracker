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

Planned 2026-10-22.

**Done 2026-10-24 · verified · uncommitted** on `feature/support-oncall`, **stacked on
`feature/modern-artifact-theme`** (cb7891a): that branch is pushed but not yet merged to `main`, so
retarget this PR to `main` once it merges (as-built 1).

- **Built:**
  - (a) `SupportPoc` + `Team.onCallHeadcount`, migration `20261024122757_add_support_oncall`;
  - (b) `src/lib/oncall/{rotation,pulse}.mjs`;
  - (c) `src/lib/schemas/oncall.js` + `teamFields.onCallHeadcount`;
  - (d) `PUT /api/teams/[teamId]/sprints/[sprintId]/oncall`;
  - (e) `src/lib/oncall/data.js`;
  - (f) `src/app/oncall/{page,loading}.jsx` + `src/components/oncall/{oncall-directory,team-card,poc-contact}.jsx`;
  - (g) `oncall-edit-dialog.jsx`;
  - (h) the admin team dialog field;
  - (i) the sidebar "On-call" item;
  - (j) the board-hero chip (`getDashboardData.onCall`, `hero.jsx`);
  - (k) `phone` on the redactor key list.
- **Verified:**
  - `yarn lint` clean;
  - `prisma validate` + `migrate status`: **16 migrations, up to date**;
  - §9 `SupportPoc` block and `Team.onCallHeadcount` **byte-identical** to `schema.prisma` (diffed);
  - **cold, env-free build on Node 22.22.2** (scratch copy, no `.env*`): exit 0, **67 ƒ Dynamic**,
    **0 warnings** (grepped from the log);
  - **12/12 pure fixtures** (`resolveOnCallSprint` between cycles / all future / latest wins /
    exact boundary / 1 ms before; `bugPulse` mixed / duplicate key / empty / missing progress) and
    **7/7 zod checks**;
  - **API + page smoke 28/28** on `next start` + Neon:
    - EM A→200, EM B→403, MEMBER→403, admin→200, signed out→401;
    - over cap → 400 `details.cap = 2`; two primaries / case-duplicate email → 400;
    - CLOSED → 409; unknown sprint or team → 404;
    - failed PUTs leave rows untouched; the admin PATCH raises the cap to 3; a second PUT replaces;
    - a no-team viewer sees every POC with no `canEdit` and no roster or member emails;
    - an EM can edit only their own team and sees only their own roster;
    - the `?sprint=` and `?team=` deep links work, and the hero chip data is right;
    - the bug-pulse fixture reads 1/2 and 1/1;
    - **live team "GM Integrations" pulse = an independent SQL hand count** (External 3 open / 11,
      Internal 2 open / 3);
    - fixtures torn down to **0 rows**;
  - a forced `ErrorLog` write with `phone` / `phoneNumber` keys reads **`[redacted]`** (row
    deleted);
  - **headless Chrome**, 6 views (`/oncall`, `?team=` focus, edit dialog, search, board, admin) × 2
    themes × 390 / 1440 px = **24 renders, 0 horizontal overflow, 0 console errors**, re-shot after
    the polish fixes.
- **Pending:**
  - Naveen's authed browser pass and one real rotation (Nov Dev / Dec 26) entered end to end;
  - Naveen runs the **office DB bundle for migration 16**, before the image rolls out. It was
    generated with `--applied-through …add_security_tracker` (office head confirmed at 15,
    2026-11-01) and rehearsed on a throwaway PostgreSQL 15.17 (happy path, Prisma status/deploy/diff
    clean, 5/5 refusals): `output/storyboard-dba-migration-2026-11-01-add_support_oncall/`;
  - the commit.

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

## As-built notes (vs. the spec)

1. **Branch base.** The spec said to cut from `main` after the Modern theme PR merged. That PR is
   pushed (`tekion/feature/modern-artifact-theme`) but not merged, so this branch is stacked on it
   (cb7891a) to build on the new tokens as intended. Retarget the PR to `main` after Modern merges.
   The merge commit cb7891a also re-added `src/components/security/look.jsx`, which Modern had
   deleted; it is unrelated to this feature and left untouched here.
2. **`formatRotationWindow` uses local time, not `formatDateUTC`.** Sprint dates are entered as an
   IST midnight and stored as 18:30Z, so a UTC-pinned label read one day early ("Sep 16" for a
   Sep 17 start). It now formats like the board's `formatDate` / `formatSprintWindow`, and is
   called in the client directory (as the board hero does) instead of being shipped from the
   loader.
3. **`DEFAULT_ONCALL_HEADCOUNT` and `onCallCap(team)` live in `rotation.mjs`**, because the route,
   the loader and the admin dialog's placeholder all need them, and that module is client-safe.
4. **Program groups use a plain heading** (Layers icon + name + team count), not `ProgramChip`.
   `ProgramChip` draws in `on-hero` tokens, which are white tints under Tekion and would be
   invisible on the page background.
5. **The hero search box** reuses the `onDark` glass treatment of `Select` (Input has no `onDark`
   variant); under Modern it becomes a plain light input like the select.
6. **Edit dialog details:** email suggestions use a native `<datalist>` (roster ∪ members; picking
   one prefills an empty name). The Primary is a radio across rows plus "No primary". A fully blank
   row is dropped on save rather than failing validation. Footer-start shows "N of cap". Add row
   reads "Cap of N reached" at the cap. Reorder was not built (optional in the spec); row order is
   `sortOrder`.
7. **Phone validation:** optional, ≤ 40 chars, digits, spaces and `+ - ( ) .` only. Blank phone and
   area are stored as null.
8. **Copy button** copies "Name · phone · email" (one paste for PagerDuty or Slack). It sits in the
   POC's name row so it never wraps onto its own line at 390 px.
9. **Board chip without a Primary** shows the first POC by `sortOrder` with "+N".
10. **Loader** restricts the pulse's progress query to the keys in the SUPPORT / INTERNAL_BUG
    filters, and computes `canEdit` as manager AND sprint not CLOSED (so a closed rotation shows no
    Edit button, and no suggestions are loaded for it).
11. **The redaction check** used a direct `recordError` write with `phone` keys, the exact path a
    route 500 takes, rather than a real 500 from this route, because the route never puts phone
    numbers in error details.
12. **Verification ran on a scratch copy** (`next start -p 3010`, built with no `.env*`). Naveen's
    running dev server had the pre-migration Prisma client cached (`Unknown field supportPocs`), and
    building in place would clobber its `.next`, so it was left alone. **Restart `yarn dev` before
    opening `/oncall` locally.**
13. **Gap, not built (spec scope only named the sidebar):** the mobile top bars have no "On-call"
    link. Below `lg`, people reach `/oncall` through the board-hero chip or a bookmark. Worth a
    one-line follow-up if Support uses phones heavily.
14. **Program picker (added 2026-10-25, Naveen).** Teams grow to 40–60 once all six programs are
    onboarded, so the hero gained a program dropdown ("All programs", each program, "No program"),
    in the `/rollup` picker's shape. It filters instantly on the client (every team is already
    loaded) and is kept in `?program=` via `history.replaceState`. It opens on the viewer's own
    program when all their teams share one (`defaultProgramId` from the loader), else All.
    **Search always spans every program**, with a "Search covers every program." note, because
    Support rarely knows which program owns a module. `?team=` overrides `?program=` so the focused
    card is always on screen; an unknown `?program=` falls back to the default. Verified: env-free
    build (67 ƒ, 0 warnings), 15/15 headless behaviour checks, no overflow at 390/768/1280/1440 in
    both themes.
15. **Roster contacts and a member picker (added 2026-10-25, Naveen).** Admins will put every
    developer on the team roster, so the POC dialog now picks from that list instead of retyping.
    - **Storage:** a new `RosterContact` (email `@unique`, optional `displayName` and `phone`,
      FK-less `updatedById`), keyed **per person** so one phone serves every roster that lists them.
      `Team.memberEmails` is untouched, so the Needs-attention JQL can't be affected.
    - **Admin:** the team dialog keeps the roster textarea and adds a "Contact details" list derived
      live from it (email, name, phone per row; edits survive retyping the textarea). Saved through
      the existing team POST/PATCH as `rosterContacts`, split off before `prisma.team.*` and written
      in the same interactive transaction (`lib/teams/roster-contacts.js`). Only emails on the saved
      roster are written; a row with neither name nor phone deletes that person's contact; contacts
      for emails dropped from this roster are kept. No new route (still **67 ƒ**).
    - **Picker:** each POC row has a "Person" dropdown listing everyone an admin added to the team
      (roster ∪ memberships), **signed in or not**, name from the contact first, then
      `User.displayName`, email as a second line. A pick fills name and phone (copied into the POC,
      still editable; past rotations keep the number on duty then). Members picked in another row
      are disabled. "Someone not on the roster…" brings back the typed email. The `<datalist>` is gone.
    - **Privacy:** suggestions (now with phones) are still sent only for teams the viewer can edit;
      admin-only `/admin` carries the rest. `phone` keys were already redacted (re-verified with
      `rosterContacts` in a forced `ErrorLog` write).
    - **Migration:** folded into migration 16. It was uncommitted and not on the office DB, and Neon
      held 0 `SupportPoc` rows and 0 headcounts, so 16 was reverted by hand on Neon (drop table,
      drop column, delete the `_prisma_migrations` row) and regenerated as
      `20261025180446_add_support_oncall` (Team column + `SupportPoc` + `RosterContact`). Still
      **16 migrations**; one office bundle.
    - **Verified:** 18/18 API and loader checks (upsert, clear, off-roster ignored, bad phone /
      duplicates / > 200 → 400, LEAD → 403, team ADMIN → 200, POST, editor sees phones, viewer
      doesn't); headless picker and admin-dialog flows at 1440 Tekion and 390 Modern (pick fills,
      duplicates disabled, keyboard pick, someone-else email, saves persist); the earlier 28/28
      on-call smoke still passes.
16. **Themed dropdown everywhere** (Naveen: no native dropdowns). The picker needed a real list with
    a second line, so the shared `Select` was rebuilt app-wide; see `themed-select.md`.
