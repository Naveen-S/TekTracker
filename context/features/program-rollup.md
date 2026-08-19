# Program grouping + Program roll-up

**Status:** Done 2026-08-12 · Branch `feature/program-rollup` (off `main` @ `52d5fc0` "Need
attention.") · Owner: Naveen · Post-v1, not a master-plan step.

## Overview

Tekion's org has a level **above** the scrum team: a **Program** (e.g. **GM**) contains several
scrum teams (AI Agentic, Configurator & Website Setup, DX & SCX, PCX…); other programs are Honda,
AEP… StoryBoard was flat — `Team` was the top of the hierarchy ("single implicit org, no Org
table"). This feature adds a first-class **Program** entity, lets admins **associate each team to a
program**, and lets leadership **scope the `/rollup` page to a program** to see the aggregate across
**all** of that program's teams (regardless of the viewer's own memberships).

The existing `/rollup` aggregation stack is team-set-agnostic, so the whole pipeline
(`getRollupData` → `aggregateRollup` → `MetricGrid`/`TeamSummaryTable`/`TrendPanel`/risks/story-
points/composition) is reused verbatim. The only new seam is *which set of teams* the roll-up spans.

## Decisions (ratified with Naveen via AskUserQuestion, 2026-08-12)

1. **First-class `Program` model** (admin-managed CRUD), not a free-text `Team.program` string.
   Stable identity powers a clean picker + admin management, mirroring how Sprint became first-class.
2. **Program picker on the existing `/rollup`** (a `?program=` scope), not a separate page. "My
   teams" (membership-derived, the pre-existing behavior) stays the default scope.
3. **View access = leadership + admins.** New `PROGRAM_ROLES = [ED, TPM, EM, VIEWER]` (+ `User.isAdmin`
   bypass). Includes **TPM** (unlike `LEADERBOARD_ROLES`, which excludes it) — TPMs run programs.
   LEAD/MEMBER keep the my-teams roll-up but get no program picker. A non-leadership viewer's stray
   `?program=` is **silently ignored** (falls back to my-teams), never 403'd off the read-only page.
4. **One program per team** — nullable FK `Team.programId`, `onDelete: SetNull` (deleting a program
   un-assigns its teams, never deletes them; mirrors `JiraSubComponent.teamId`).

## Scope / as-built

**Data model** (§9; migration `20260812113054_add_program_model`, 11 → 12) — pure additive:
- New `model Program { id, name, key @unique, description?, createdAt, updatedAt, teams Team[] }`.
- `Team.programId String?` + `program Program? @relation(onDelete: SetNull)` + `@@index([programId])`.
- Doc-synced: §9 schema block + ERD (PROGRAM entity + `PROGRAM |o--o{ TEAM` relationship + the
  `programId FK` on the TEAM entity) kept byte-consistent.

**RBAC** (`src/lib/rbac.js`): `PROGRAM_ROLES` + `hasProgramAccess(user)` (mirrors
`hasLeaderboardAccess` — page-level, admin bypass, any-team membership check).

**Schemas**: new `src/lib/schemas/program.js` (`programCreateSchema`/`programPatchSchema`, `key`
uppercased `/^[A-Z][A-Z0-9]{0,9}$/`); `teamFields` gained `programId: z.string().cuid().nullish()`
so the association rides the existing team POST/PATCH (no dedicated route). `rollupDigestBodySchema`
gained optional `programId`.

**API** (+2 route files, 38 → 40): `POST/GET /api/programs` (GET gated to `hasProgramAccess`, lists
with `_count.teams`; POST `requireAdmin`) and `PATCH/DELETE /api/programs/[programId]` (`requireAdmin`).
Team↔program association reuses `PATCH /api/teams/[teamId]`. `POST /api/rollup/ai-digest` now accepts
`programId` and re-scopes via `getRollupData` (which re-checks access) so a program view's digest
matches the screen.

**Data loader** (`getRollupData`, `src/lib/dashboard-data.js`): signature grew `{ programId }`; when
a leadership/admin viewer passes a valid `programId`, the team set becomes
`prisma.team.findMany({ where: { programId } })` instead of `getMembershipContext(user).teams` —
everything downstream is unchanged. Returns `programs` / `selectedProgram` / `canViewPrograms`. With
no `programId` it is byte-identical to before (verified).

**UI (impeccable, Operate-mode extension — incumbent design preserved):**
- `rollup-top-bar.jsx`: a Program `<Select>` (default variant, "My teams" + `{key · name}`) before
  the sprint select, shown only when the viewer has program access. Both selects preserve each
  other's `?program`/`?sprint` param via `URLSearchParams`.
- `rollup/page.jsx`: program-aware hero — a `Layers` "Program" scope chip + the program name as the
  title + program-scoped copy when a program is selected; unchanged "Multi-team roll-up" my-teams
  hero otherwise. Program-aware empty state for a program with no teams.
- Admin: new self-contained `programs-config.jsx` section (create / inline rename / delete-with-
  confirm, team-count badge) modeled on `jira-components-config.jsx`; wired into `admin/page.jsx`
  (loads `programs` with `_count.teams`) + `admin-panel.jsx` (new section + program count in the
  hero summary). `team-config-dialog.jsx` gained a Program `<Select>` (grouped with Name/Key),
  submitting `programId` (empty → null).

**No nav change** (picker lives on the already-linked `/rollup`). **§12 metrics untouched**
(`metrics.mjs`/`aggregateRollup` reused as-is — additive only).

**Finetuning round (2026-08-13, from Naveen's visual review):**
- **Select control box** (`src/components/ui/select.jsx`) — the base variant now matches `Input`
  (`h-9 rounded-md py-1`) so a bare `<Select>` lines up with Inputs/Buttons in a row; sized call
  sites still override height via `h-7`/`h-8`. App-wide consistency fix.
- **Loading feedback** in `programs-config.jsx` — a top `ProgressBar` (house sub-2s async vocab)
  fires the instant any create/rename/delete starts and holds through the `router.refresh()`, plus
  `Spinner` + "Adding…"/"Saving…" on the create/rename buttons (no more "jarring" no-op click).
- **Program shown on the team's own surfaces:** the admin **team card** carries a brand `Layers`
  badge with its program name (or a muted "No program"); the **scrum-team board hero** (`/`) shows
  a "{program} program" chip above the eyebrow. Both fed by a `program { id, name, key }` include
  added to the admin team query and to `getMembershipContext` (harmless for the selectors).

## Acceptance / verification

- `yarn lint` clean; `yarn build` passes **with `.env` absent** (DB/env-free invariant) over a fresh
  `.next`; route list shows `/api/programs` + `/api/programs/[programId]` (40 ƒ Dynamic total).
- `prisma migrate status` up to date; §9 byte-consistent with `schema.prisma`.
- **SSR/API smoke** (minted iron-session cookies vs Neon, fixtures torn down to 0) — **30/30 pass**
  (re-run against `next start` on the finish-feature build): leadership/admin see programs (member
  403); program CRUD (admin-only, dup→409, bad key→400); `/rollup?program=` shows all program teams
  incl. one the viewer isn't on, excludes unassigned; my-teams path unchanged; member's `?program=`
  ignored (200, not 403); team↔program PATCH; DELETE → teams SetNull (not deleted); no-`programId`
  regression; **+3 finetuning checks** — board hero shows the "{program} program" chip, `/admin`
  renders with the program include (badge + section).
- **Env note:** a transient Google Fonts CDN outage (v20 Inter woff2 → 404) briefly failed the dev
  server AND `next build` mid-verify; it is external and pre-existing (the font import lives in the
  untouched root layout, so it hits `main` too), and a retry once the CDN recovered built + smoked
  clean. Not a code regression.
- **Visual acceptance = Naveen** (authed browser pass of the program picker, program-scoped hero,
  and the admin Programs section) — the browser extension has never been connected in this repo.

## Doc-sync

`context/project-overview.md`: §3 personas note, §5 feature-list row, §9 schema + ERD + rationale
bullet, §11 UI/UX build-log row, §16 ratified decision. This spec. `context/current-feature.md`.

## References

- Reused seam: `getMembershipContext` / `getRollupData` (`src/lib/dashboard-data.js`),
  `aggregateRollup` (`src/lib/metrics.mjs`).
- Precedents: `hasLeaderboardAccess` (rbac), `jira-components-config.jsx` (self-contained admin
  section), `/api/teams` routes (CRUD template), `ed-rollup.md` (the roll-up decisions this extends).
