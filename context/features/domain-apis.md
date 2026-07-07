# Domain APIs (migration step 4)

## Overview

**Production Migration Plan step 4**, verbatim: *"zod-validated route handlers for teams/memberships
(admin), sprints (admin), filter templates + filters, stage toggle/blocked writes to IssueProgress."*

This is the first feature to put **RBAC** into effect (auth-layer surfaced `User.isAdmin` and
`requireUser()` but gated nothing) and the first CRUD surface over the §9 domain models. It turns the
schema + auth we have into something the importer (step 9), sync (step 5), and the UI port (step 6)
can actually call:

1. **Provisioning** (§16: "admin-managed — seeded ADMIN creates teams and assigns members/roles"):
   teams + memberships, admin-gated.
2. **Sprint config** (§13.3: "gate Configure Sprint behind admin"): first-class global `Sprint` CRUD,
   admin-gated — closing flaw §14.6 (anyone can change dates) *for the new app*.
3. **Tracks**: `FilterTemplate` and `Filter` CRUD scoped by team (+ sprint), including reorder —
   the server-side of the prototype's `handleAddFilter`/`handleRemoveFilter`/drag-reorder.
4. **Progress writes**: the stage checklist + blocked flag onto `IssueProgress`, porting the
   prototype's `toggleStage`/`toggleBlocked` semantics ([useSprintData.js:152-175](../../src/hooks/useSprintData.js#L152-L175))
   with `updatedById` attribution.

**No schema changes** — every model this touches already exists (Feature 3); there is **no new
migration** in this step.

> **Prototype parity note:** the prototype's "Add filter" *also fetches issues from Jira*
> immediately. Here that splits: step 4 is the **CRUD** half (create the `Filter` row); populating
> its `Issue` cache is **Sync (step 5)**. A freshly created filter legitimately has zero issues
> until the first sync (or the importer, which writes the cache directly).

## Status

**Done 2026-07-07.** Implemented all of (a)–(d): `web/src/lib/rbac.js`
(`ForbiddenError`/`NotFoundError`, `requireAdmin`, `requireTeamRole` with global-admin bypass, role
groups), `web/src/lib/api/route-helpers.js` (`ValidationError`, `parseJsonBody`, `handleRouteError`
incl. P2002→409/P2025→404), schemas `web/src/lib/schemas/{team,sprint,filter,progress}.js`, and the
14 route files. Decisions 1–9 implemented as proposed. **Verified:** `yarn lint` clean; `yarn build`
green + **DB/env-free** (`web/.env` hidden, all secrets unset — all 14 routes `ƒ (Dynamic)`);
**68-check curl acceptance matrix passed** against the dev server + Neon covering the auth wall, the
full RBAC matrix (VIEWER read-only / MEMBER progress-only / LEAD manager / non-admin 403s /
global-admin bypass), provisioning incl. membership-by-email (unknown → 404, dup → 409), sprint
gating + merged-date PATCH check + no-DELETE (405), priority insertion (`FEATURE:0, TECH_DEBT:1,
SUPPORT:2` from scrambled creation), reorder + wrong-set 400, template instantiation, the progress
cascade both directions, owning-workflow derivation (FEATURE 10-stage / SUPPORT 4-stage / both-filters
→ FEATURE), `seededFromStatus:null` + `updatedById` attribution, out-of-range index 400, unknown key
404, blockedReason lifecycle, progress surviving filter delete, and cross-team isolation (403/404).
Test users/rows fabricated via a temporary tsx harness (minted iron-session cookies with `sealData`)
and **cleaned up from Neon**; harness deleted. See "As-built deviations" below. **Next:** importer
(seed.md, step 9 — now fully unblocked) or Sync (step 5).

## Decisions (PROPOSED 2026-07-07)

1. **Route Handlers, not Server Actions — for all of step 4.** The master plan says "route handlers"
   for this step, and the deciding practical fact is ordering: step 4 lands **before any UI**
   (step 6), so Server Actions would be untestable (they only run from React), while Route Handlers
   get the same curl-verified acceptance treatment as auth. coding-standards also routes "endpoints
   for future mobile/CLI clients" to API routes. *This refines the auth-layer.md decision-7 aside*
   ("`{ success, data, error }` … lands later for in-app mutations (step 4)"): when the UI lands,
   client components call these routes via `fetch` exactly as the prototype does (§8 "keep
   contracts"); thin Server-Action wrappers can be added in step 6 **if** form ergonomics want them
   — they'd wrap this API, not replace it.
2. **Error contract matches auth: HTTP status + `{ error }` body; success returns the resource JSON
   directly.** No `{ success, data, error }` envelope (that stays the Server-Action shape). A shared
   mapper (`lib/api/route-helpers.js`) converts typed errors: zod → `400`, `UnauthorizedError` →
   `401`, `ForbiddenError` → `403`, not-found (incl. Prisma `P2025`) → `404`, unique-violation
   (`P2002`) → `409`, else `500` (logged, generic body).
3. **RBAC matrix** (server-side per §17; helpers in `web/src/lib/rbac.js`):

   | Action | Allowed |
   |---|---|
   | Team create / delete | global admin (`User.isAdmin`) |
   | Team update; membership add/change/remove | global admin **or** that team's `ADMIN` membership |
   | Team / membership read | any member of the team (any role) |
   | List teams (`GET /api/teams`) | any authed user → **their** teams (+role); admins → all |
   | Sprint create / update (incl. `state`) | global admin only |
   | Sprint read | any authenticated user (sprints are global) |
   | FilterTemplate CRUD; Filter create/update/delete/reorder | team **manager** roles: `ADMIN, ED, TPM, EM, LEAD` |
   | Progress write (stages / blocked) | team **writer** roles: manager roles + `MEMBER` (all but `VIEWER`) |
   | Filters / templates / progress read | any member of the team (incl. `VIEWER`) |

   **Global admin bypasses team-role checks** (the seeded admin must be able to provision before
   any membership exists). §13.3's "(+ ED)" for sprint config is **deferred**: `Sprint` is global
   while `ED` is a team-scoped role, so there's no principled team to check it against — global
   admin only until real usage demands otherwise.
4. **URL design: nested by ownership.** Team-owned things live under `/api/teams/[teamId]/…`;
   sprint-scoped things under `/api/teams/[teamId]/sprints/[sprintId]/…`; progress addressed by its
   natural key `…/progress/[jiraKey]` (mirrors the §9 `(teamId, sprintId, jiraKey)` unique). RBAC
   derives from path params, never from the body. Global collections: `/api/sprints`, `/api/teams`,
   `/api/users`.
5. **Progress write is an idempotent `PUT` of target state, not a "toggle" RPC.** Body carries
   `{ stage: { index, completed } }` and/or `{ blocked, blockedReason? }` (≥1 required). The server
   enforces the **checklist cascade rule** (§4) exactly as the prototype does: setting stage *n*
   `true` also sets `0..n-1` `true`; setting it `false` also sets `n+1..end` `false`
   ([useSprintData.js:158-164](../../src/hooks/useSprintData.js#L158-L164)). Sending state (not
   "toggle") keeps retries/double-clicks harmless. Every write sets `updatedById` to the caller.
6. **Progress create-on-first-write; owning workflow derived server-side; unknown key → 404.** If no
   `IssueProgress` row exists, create it with an all-`false` array sized to the **owning workflow**
   — the highest-priority (per `WORKFLOWS[type].priority`) filter in that team+sprint whose `Issue`
   cache contains the `jiraKey` (§9 rule) — then apply the write, with **`seededFromStatus = null`**
   (manual creation is *not* status-seeding; that's sync's job, step 5). If **no** cached issue
   matches the key in that team+sprint → `404` — the §9 invariant stays server-owned, and after the
   importer/step 5 the cache is always populated for real work. Reconciling an *existing* row whose
   array length no longer matches the owning workflow is sync's re-evaluation job (§9), not this
   route's.
7. **Filter ordering: port the prototype's priority insertion + an explicit reorder endpoint.** On
   create, default `sortOrder` inserts the filter after the last filter of same-or-higher workflow
   priority (port of `insertFilterInOrder`, [useSprintData.js:5-14](../../src/hooks/useSprintData.js#L5-L14)),
   shifting subsequent rows in the same transaction. Drag-reorder persists via
   `PUT …/filters/order` with the full ordered id list (validated: exactly the filter set of that
   team+sprint) → `sortOrder = index`.
8. **Delete semantics.** `DELETE /api/teams/[id]` is admin-only and relies on schema cascades.
   **`Sprint` has no DELETE** — closing a sprint is `PATCH state: CLOSED`; deleting one cascades
   filters/progress/shares/snapshots and is too destructive for v1 (DB-level operation if ever
   truly needed). `DELETE …/filters/[id]` cascades its `Issue` cache but **leaves `IssueProgress`
   intact** — deliberate §9 behavior (progress survives re-syncs and filter moves), a designed
   deviation from the prototype, which wiped stages on filter removal
   ([useSprintData.js:54-62](../../src/hooks/useSprintData.js#L54-L62)).
9. **Membership creation is by `email`** (`{ email, role }`): per §16, users first log in with Jira
   (which creates their `User` row) and *then* get added to teams — so the route resolves
   email → `User` and returns `404 "No user with that email has signed in yet"` if absent. A minimal
   admin-only `GET /api/users` (id, email, displayName, isAdmin) supports the future provisioning
   UI. Changing `User.isAdmin` via API is **out of scope** (seed/DB-managed for now).

## Requirements

### Scope

**(a) RBAC module — `web/src/lib/rbac.js`**
- `ForbiddenError` (maps to `403`; sibling of auth.js's `UnauthorizedError`).
- `requireAdmin()` — `requireUser()` + `isAdmin` check.
- `requireTeamRole(teamId, allowedRoles)` — `requireUser()`, then global-admin bypass, else look up
  the caller's `TeamMembership` for `teamId` and check `role ∈ allowedRoles`; throws
  `ForbiddenError` (or 404-style error for nonexistent team — see gotchas). Returns
  `{ user, membership }` so handlers can attribute writes.
- Role-group constants: `TEAM_MANAGER_ROLES = [ADMIN, ED, TPM, EM, LEAD]`,
  `TEAM_WRITER_ROLES = [...TEAM_MANAGER_ROLES, MEMBER]`.

**(b) Route error mapper — `web/src/lib/api/route-helpers.js`**
- `handleRouteError(error)` implementing decision 2, plus a tiny `parseJsonBody(request)` (the
  try/`null` dance from the login route). Keeps every handler small (coding-standards ≤50 lines).

**(c) Zod schemas — `web/src/lib/schemas/{team,sprint,filter,progress}.js`**
- Follow `schemas/auth.js` conventions (schema + JSDoc typedef; consumed via `validate()`).
- `team`: `name` (1–80), `key` (trimmed, uppercased, `^[A-Z][A-Z0-9]{0,9}$`), optional
  `description`, `jiraProjectKeys` (string[]), `storyPointsFieldId`/`sprintFieldId`
  (`^customfield_\d+$`). Partial variant for PATCH.
- `membership`: `{ email (lowercased), role (Role enum) }`; PATCH: `{ role }`.
- `sprint`: `name` (1–120), `developmentStart`/`developmentEnd` (ISO → `Date`, refine
  `start < end`), optional `releaseDate`, `state` (enum), `isGate`. Partial for PATCH (re-refine
  date order when either date present — against the merged result of existing + patch).
- `filter` / `filterTemplate`: `name`, `workflowType` (enum), `sourceType` + conditional
  requirement (`JQL` ⇒ `jql` nonempty; `JIRA_FILTER` ⇒ `jiraFilterId` nonempty — zod
  `superRefine`/discriminated union), optional `accentColor` (`^#[0-9a-fA-F]{6}$`). Filter create
  alternatively accepts `{ fromTemplateId }` to instantiate a template (name/fields copied, then
  optional overrides). Reorder: `{ filterIds: string[] }` (nonempty, unique).
- `progress`: `{ stage?: { index: int ≥0, completed: boolean }, blocked?: boolean,
  blockedReason?: string|null }`, refine ≥1 of `stage`/`blocked` present; `blockedReason` only
  meaningful with `blocked` (cleared when `blocked: false`). `stage.index` bounds-checked **in the
  handler** against the owning workflow's `stageCountFor()` (schema can't know the workflow).

**(d) Route handlers — all under `web/src/app/api/`, all `force-dynamic` (house pattern)**

| Route file | Methods → action (guard) |
|---|---|
| `teams/route.js` | `GET` my teams w/ my role — admins: all (authed) · `POST` create team (admin) |
| `teams/[teamId]/route.js` | `GET` (member) · `PATCH` (admin ∨ team-ADMIN) · `DELETE` (admin) |
| `teams/[teamId]/members/route.js` | `GET` (member) · `POST` add by email (admin ∨ team-ADMIN) |
| `teams/[teamId]/members/[userId]/route.js` | `PATCH` role · `DELETE` (admin ∨ team-ADMIN) |
| `sprints/route.js` | `GET` list, opt. `?state=` (authed) · `POST` create, `createdById`=caller (admin) |
| `sprints/[sprintId]/route.js` | `GET` (authed) · `PATCH` incl. state (admin) — **no DELETE** (dec. 8) |
| `teams/[teamId]/filter-templates/route.js` | `GET` (member) · `POST` (manager) |
| `teams/[teamId]/filter-templates/[templateId]/route.js` | `PATCH` · `DELETE` (manager) |
| `teams/[teamId]/sprints/[sprintId]/filters/route.js` | `GET` ordered by `sortOrder`, each w/ cached `issues` (member) · `POST` (manager, dec. 7 ordering) |
| `teams/[teamId]/sprints/[sprintId]/filters/[filterId]/route.js` | `PATCH` · `DELETE` (manager; progress survives, dec. 8) |
| `teams/[teamId]/sprints/[sprintId]/filters/order/route.js` | `PUT` reorder (manager) |
| `teams/[teamId]/sprints/[sprintId]/progress/route.js` | `GET` all progress rows (member) |
| `teams/[teamId]/sprints/[sprintId]/progress/[jiraKey]/route.js` | `PUT` stage/blocked write (writer; decisions 5–6) |
| `users/route.js` | `GET` minimal user list (admin) |

- Scoped resources verify ownership on **every** item op (e.g. the filter belongs to that
  team+sprint; the membership belongs to that team) — `404` on mismatch, never cross-team leakage.
- Filters `GET` includes cached issues (the cache is per-filter and small); the assembled
  matrix/metrics read-model is step 6's concern.

**(e) No new env, no new deps, no migration.** Prisma client, zod, iron-session are all in place.

### Mechanism / gotchas

- **Next 16: route-handler `params` is async** — `const { teamId } = await params`. Same class of
  breakage as the async `cookies()` caught in step 3; verify against
  `node_modules/next/dist/docs/` (`web/AGENTS.md`) before writing the first handler.
- **Transactions:** priority-insertion + `sortOrder` shifting (dec. 7), reorder writes, and the
  progress "derive owning workflow → upsert → apply cascade" sequence (dec. 6) each run inside
  `prisma.$transaction` — concurrent stage clicks or reorders must not interleave.
- **Owning-workflow lookup** (dec. 6) is: `Issue.findMany({ where: { jiraKey, filter: { teamId,
  sprintId } }, include: { filter } })` → min by `WORKFLOWS[filter.workflowType].priority`. Uses
  `workflows.mjs` (`stageCountFor`) — keep it the single stage-shape source (per bootstrap-seed).
- **Prisma error mapping:** `P2025` (update/delete on missing row) → `404`; `P2002` (e.g. duplicate
  team `key`, sprint `name`, membership `(userId, teamId)`) → `409` with a readable message — not a
  `500`.
- **Existence vs. permission:** `requireTeamRole` on a team the caller can't see returns… decide
  once, uniformly: **`404` for nonexistent team, `403` for existing-but-no-role** (internal tool;
  team existence isn't secret — favor debuggability).
- **RBAC freshness is free** — auth-layer decision 8 already reads the user per request; membership
  lookups here are per-request too (indexed `@@unique([userId, teamId])`). No caching.
- **Build must stay DB/env-free** (Feature-3 invariant): all handlers `force-dynamic`; `yarn build`
  green with `DATABASE_URL`/secrets unset, all routes `ƒ (Dynamic)`.

### Acceptance criteria

Verified via `curl` against the dev server + Neon (no UI until step 6), plus a scratch script where
a second (non-admin) user/membership or a cached `Issue` row is needed — real multi-user login isn't
available, so RBAC-matrix checks may fabricate a `User` + `TeamMembership` and a test `Issue` row
directly via Prisma (clean up after; note what was fabricated).

- **Auth wall:** every route `401`s without a cookie.
- **Provisioning flow (as the seeded admin):** create team → `200` with the row; duplicate `key` →
  `409`. Add member by email → `200`; unknown email → `404`. Change role, remove member → `200`.
- **RBAC:** non-admin `POST /api/teams` → `403`. `VIEWER` membership: reads `200`, progress `PUT` →
  `403`, filter `POST` → `403`. `MEMBER`: progress `PUT` `200`, filter `POST` `403`. Cross-team id
  in the path (filter of another team) → `404`.
- **Sprints:** non-admin `POST`/`PATCH` → `403`; `start ≥ end` → `400`; duplicate name → `409`;
  `PATCH state: ACTIVE→CLOSED` works; `GET /api/sprints` needs only auth.
- **Filters:** `sourceType: JQL` without `jql` → `400`. Create FEATURE/TECH_DEBT/SUPPORT filters in
  scrambled order → list comes back priority-ordered (dec. 7); `PUT …/order` with a permuted list
  persists; with a wrong id set → `400`. Template → `{ fromTemplateId }` instantiation copies fields.
- **Progress (the §9 invariants, on a fabricated `Issue` cache row):** `PUT` with
  `stage {index: 4, completed: true}` on a FEATURE-owned key creates the row — `stageCompletion`
  length 10, stages 0–4 `true`, `seededFromStatus: null`, `workflowType: FEATURE`, `updatedById` =
  caller. Then `{index: 2, completed: false}` → 2..9 `false`, 0–1 still `true`. `index: 10` → `400`.
  Unknown `jiraKey` → `404`. `blocked: true` + reason persists; `blocked: false` clears the reason.
  **Deleting the filter leaves the progress row** (dec. 8).
- **Hygiene:** `yarn lint` clean; `yarn build` green + DB/env-free; no route handler over ~50 lines
  (logic lives in lib).

### Out of scope

- **Jira calls of any kind** — filter CRUD never validates JQL/filter-ids against Jira and never
  fetches issues; **Sync + hybrid `StatusStageMapping` seeding is step 5** (it also owns
  re-evaluating `IssueProgress.workflowType`/array length when filters change).
- **UI** — pages, team switcher, matrix wiring: step 6. (Hence curl-only acceptance.)
- **Assembled read-models** (delivery-matrix payload, metrics/roll-ups, ED multi-team views) — step
  6 planning decides their shape; this step ships resource CRUD reads only.
- **Sprint DELETE**, **`User.isAdmin` management API**, **self-service team join** — deliberate
  omissions (decisions 8–9).
- **Importer** ([seed.md](./seed.md), step 9) — unblocked by this step (admin can provision the
  target team via API), but separate.
- **Rate limiting / audit log** — internal tool; `updatedById`/`updatedAt` is the audit story for now.

## Doc-sync (§17 — same PR)

- **§5 feature table:** "Admin settings / RBAC" **[GAP] → [PARTIAL]** (server-side RBAC live for
  provisioning/sprints/filters/progress in `web/`; no admin UI). "Configure sprint" note: admin
  gating now enforced by the `web/` API (legacy Vite app still ungated until cutover).
- **§13 item 3 (RBAC):** mark **implemented in `web/`** for these routes (UI gating pending step 6).
- **§14 flaws 5–6** (sprint identity / ungated sprint config): note both are fixed *in `web/`* by
  first-class `Sprint` + admin gating; legacy app unchanged.
- **Production Migration Plan step 4:** record done + as-built decisions.
- **§7 stays as-is** (legacy snapshot, per the auth-layer precedent). §9 needs **no** edit (no
  schema change).
- Fill "As-built deviations" below; update current-feature.md Status/History.

## As-built deviations from the spec

- **`NotFoundError` lives in `lib/rbac.js`, not route-helpers** — `requireTeamRole` throws it for
  nonexistent teams, and route-helpers already imports from rbac, so defining it there keeps the
  import graph acyclic (route-helpers → rbac → auth/db). Routes import it from rbac for ownership
  404s.
- **`parseJsonBody(request, schema)` folds the zod validation in** (throws `ValidationError` → 400)
  rather than only doing the JSON-parse dance — handlers shrink to guard → parse → prisma.
- **`TEAM_ALL_ROLES` added** alongside the spec'd MANAGER/WRITER groups (read access = any
  membership).
- **`requireTeamRole` returns the admin's membership too when one exists** (spec implied
  `membership: null` for admins); `user.id` is still what writes attribute to.
- **Creates return 200, not 201** — matches the auth-route convention; `DELETE` returns
  `{ ok: true }` (logout convention).
- **Filter POST returns `include: { issues: true }`** (shape-consistent with the collection GET);
  reorder PUT returns the reordered filter list without issues.
- **Priority insertion renumbers all rows to 0..n** in the transaction (not minimal shifts) —
  self-heals any sortOrder gaps; trivial cost at ≤10 filters/sprint.
- **zod 4 specifics:** enums via `z.enum(Object.values(<PrismaEnum>))`; dates via `z.coerce.date()`;
  the filter create union is a single object + `superRefine` (readable 400s, per the spec note).
- **Verification harness:** non-admin sessions were minted with iron-session `sealData` + the dev
  `SESSION_PASSWORD` (no second real Jira login exists); fabricated users
  (`*@st-domain-api-test.local`), team, sprint, and Issue rows were created via a temporary
  `web/scripts/tmp-domain-api-test.mjs` (tsx) and fully deleted afterwards (team cascade + explicit
  sprint/user cleanup); the script itself was removed.
- **Next 16 async `params` confirmed** against the installed route.md docs (`await params` in every
  dynamic handler) — no surprises beyond the known Promise change.

## References

- @context/project-overview.md — §3 personas, §4 checklist rule, §9 data model (`Team`,
  `TeamMembership`, `Sprint`, `FilterTemplate`, `Filter`, `Issue`, `IssueProgress` + keying
  rationale), §13.3 RBAC, §14 flaws 5–6, §16 provisioning decision, Migration Plan step 4
- @context/coding-standards.md — API-routes-vs-Server-Actions, zod at boundaries, ≤50-line functions
- @context/features/auth-layer.md — decisions 7–9 (route-handler precedent, `{ error }` contract,
  RBAC freshness), `requireUser`/`UnauthorizedError`
- Prototype semantics to port: [src/hooks/useSprintData.js](../../src/hooks/useSprintData.js)
  (`insertFilterInOrder`, `toggleStage` cascade, `toggleBlocked`, `handleRemoveFilter`)
- `web/src/lib/{auth.js,validation.js,workflows.mjs,db.js}` · `web/prisma/schema.prisma` ·
  `web/AGENTS.md` (Next 16 doc-check discipline)
