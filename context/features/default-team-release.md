# Default scrum team & release (per-user board default)

**Status:** Done + verified 2026-08-11 (branch `feature/default-team-release`, off `main` @ `5e96703`
"Sync stages", **uncommitted** — pending Naveen's commit). Post-v1, not a master-plan step.

## Problem

When a user opens the board (`/`) without `?team=&sprint=` params — which is what the sidebar
"My board" link, the logo, and every "Back to dashboard" link do — the server picks the
**alphabetically-first team by `name`** and the **currently ACTIVE gate**. There was no notion of a
user's *own* team, so an EM/Lead whose team sorts late alphabetically landed on someone else's board
every time and had to re-select. Naveen: *"set my default scrum team & release (view) so that every
time I click on board it takes me to my scrum team rather than first scrum team."*

## Ratified decisions (AskUserQuestion)

1. **Pin team + the exact release.** Save both; land on that specific release every time, honored
   even once it's CLOSED. Fall back to the ACTIVE gate only if the pinned release has been *deleted*.
   (The alternative — "team only, release auto-follows ACTIVE" — was offered and not chosen.)
2. **Set it via a star** in the top bar next to the team/release selectors: click to pin the current
   view, click again to clear; a filled star means the current view is already the default.

## Design — server-side default on `User`

The board resolves its default team/sprint **server-side** in `getDashboardData`
(`src/lib/dashboard-data.js`), so the preference lives on the `User` row (Postgres), not
localStorage: it resolves on first render with no flash/redirect, syncs across devices, and matches
the house rule "domain data → Postgres, localStorage only for ephemeral UI prefs" (§17). Every entry
point to `/` benefits with zero per-link changes.

### Schema (migration `add_user_default_view`, 9 → 10 migrations)

Two nullable bare-string columns on `User` (no FK — the selection chain already tolerates a stale
id via `.find(id) ?? fallback`, so a deleted team/release simply misses and falls back):

```prisma
defaultTeamId    String?
defaultSprintId  String?
```

### Read-side resolution (`src/lib/dashboard-data.js`)

- Team precedence: `?team=` param → `user.defaultTeamId` → first visible team.
- `getSprintSelection(sprintId, fallbackSprintId)` gained an **optional** second param, passed ONLY
  by `getDashboardData` (`user.defaultSprintId`); `/rollup` + `/leaderboard` call it with one arg and
  are unaffected. Order: `?sprint=` → pinned release (matched by id, **any state** — so a CLOSED pin
  wins) → ACTIVE → latest. A deleted pin misses the `find` and falls through.
- `getDashboardData` returns a board-only `defaults: { teamId, sprintId }` (kept out of
  `serializeUser`, which `/leaderboard` reuses) that drives the star's filled/empty state.

### Route (`PATCH /api/me`, +1 → the app's first `User`-self-mutation endpoint)

- `requireUser()` only — any signed-in user edits their OWN row.
- `mePatchSchema` (`src/lib/schemas/user.js`): `defaultTeamId` / `defaultSprintId` each
  `string().min(1).nullable().optional()`; `.refine` rejects an empty body (400). Each half is set,
  cleared (`null`), or left untouched (omitted) independently.
- Guard: pinning a team the caller isn't a member of (and isn't global admin) → `ForbiddenError` (403),
  so a pin can never point at an inaccessible team that would silently fall back anyway. Sprints are
  global → no per-user scoping (a garbage/deleted sprint id is harmless, resolution falls back).
- `prisma.user.update`, returns `{ defaultTeamId, defaultSprintId }`.

### UI (`top-bar.jsx` + `dashboard.jsx`)

- `top-bar.jsx`: a ghost `Button` with a lucide `Star` after the sprint `<Select>`, rendered only
  when a team is selected; filled + `text-primary` when `isDefaultView`, `aria-pressed`, label
  "Default" / "Set default" (hidden below `sm`).
- `dashboard.jsx`: `isDefaultView = selectedTeam && defaults.teamId === selectedTeam.id &&
  defaults.sprintId === (selectedSprint?.id ?? null)`; `setDefaultView` PATCHes `/api/me` (pin current
  or clear if already default), then `router.refresh()` + a success toast — the house two-transition
  pattern (mirrors `handleSaveRiskComment`).

## Scope / invariants

- **Board-only.** `/rollup` and `/leaderboard` keep their existing ACTIVE-gate default.
- **Additive** — no change to `metrics.mjs` / `IssueProgress` / `SprintSnapshot` (§12 core untouched).
- No RBAC change (self-scoped); no cookie/localStorage-key change; no new dependency.
- Route count **46 → 47 ƒ Dynamic** (base `main` @ `5e96703` already includes sync-stages' route;
  the sole new route here is `/api/me`).

## Verification (2026-08-11)

- `yarn lint` clean.
- **Cold DB/env-free build** (`rm -rf .next`, `.env` moved aside + confirmed absent mid-build, restored):
  green; **47 route rows = base 46 + 1** (`/api/me`).
- `prisma validate` + `migrate status` clean; migration SQL is two additive nullable columns only.
- **13/13 smoke** (tsx, minted iron-session cookie, real Neon, fixtures torn down to 0) on a fresh
  dev server: SSR of `/` selects the pinned team B (not alphabetical-first A) + the pinned CLOSED gate
  (over a newer ACTIVE gate); clearing flips to A; `PATCH /api/me` → 401 unauth / 400 empty / 403
  non-member team / 200 set (echoes + persists) / 200 clear (nulls).
- **Naveen's browser acceptance pending** (Chrome extension never connected): star fills on the
  default view; sidebar "My board" / logo / bare `/` all land on the pinned team + release; toggle-off
  clears; both Tekion + Modern themes.

## Notes / follow-ups

- A pre-existing dev server on **:3002** was stale after the migration (held an old Prisma client);
  verification ran on a throwaway **:3009** server. Any long-running dev server must be restarted
  (`prisma generate` + restart) to pick up the regenerated client — the known post-migration hazard.
- Possible extension: apply the default sprint to `/rollup` / `/leaderboard` too, or a "clear default"
  in a future profile menu. Deliberately out of scope here (the ask was "when I click on board").
