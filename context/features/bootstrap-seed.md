# Bootstrap seed (completes migration step 2)

## Overview

The **install/bootstrap seed** for the `web/` Postgres DB — the third and only unbuilt clause of
[Production Migration Plan](../project-overview.md) **step 2** ("Schema + migrations — … seed: you as
ADMIN, the global default `StatusStageMapping` rows, and the three workflows' metadata"). Schema and
the `init` migration landed in Feature 3 (2026-06-15); this feature finishes step 2 by populating the
rows a fresh DB needs before any team data exists.

It is a repeatable **Prisma seed script** (`prisma/seed.mjs`), wired so `prisma migrate reset` and
`yarn db:seed` both run it. It writes three things:

1. a bootstrap **ADMIN `User`** (`isAdmin = true`),
2. the **global default `StatusStageMapping`** rows (the hybrid model's Jira-status → stage seeding,
   `teamId = null`),
3. a **workflow-constants module** (`web/src/lib/workflows.mjs`) ported from the Vite app's
   `src/workflows.js` — the "three workflows' metadata," which has **no DB table** and so lives as
   code (decision 3 below).

> **Prerequisite:** [add-user-isadmin.md](./add-user-isadmin.md) must land first — this seed sets
> `isAdmin = true`, which doesn't exist on `User` until that migration is applied.
>
> **Naming:** this is **not** [`seed.md`](./seed.md). That file is the *localStorage importer*
> (master-plan step 9). This bootstrap seed is a **prerequisite** of that importer (the importer
> needs an ADMIN user and a Team to exist). Ordering: **add-user-isadmin → bootstrap-seed → importer**.

## Status

**Done 2026-06-15.** Implemented `web/src/lib/workflows.mjs` (constants keyed by `WorkflowType`),
`web/prisma/seed.mjs` (zod-validated, idempotent), wired `migrations.seed` in `prisma.config.mjs`
+ a `db:seed` script, and documented `SEED_ADMIN_EMAIL` in `.env.example`. Ran against Neon:
**1 ADMIN user** (`isAdmin=true`) + **35 global `StatusStageMapping` rows** (FEATURE 11,
TECH_DEBT/SUPPORT/INTERNAL_BUG 8 each; CUSTOM skipped). Verified idempotent (re-run → still 1 user /
35 rows, no duplicates), the out-of-range `stageIndex` guard fails loudly before any write, and
`yarn lint` + `yarn build` stay green and DB-free. See **As-built deviations**.

## Decisions (ratified 2026-06-15) & remaining validation

1. **Global ADMIN → resolved: add `User.isAdmin`.** Split out as the prerequisite
   [add-user-isadmin.md](./add-user-isadmin.md) (schema + migration). This seed simply sets
   `isAdmin = true` on the bootstrap user. `SEED_ADMIN_EMAIL` env tells the seed **which** email to
   create/flag — it is the seed's *input*, no longer an RBAC mechanism (the column is). The
   chicken-and-egg is gone: admin-ness no longer needs a team.
2. **Jira status mapping — partly confirmed, rest ships as defaults.** Naveen confirmed (2026-06-15)
   for `FEATURE`: **Code Review → E2E testing** and **Testing/In QA → QA/PM demo** (applied below).
   The remaining rows are still **best-effort** (from the prototype's `transformJiraIssue` map +
   §6 stage names) and should be validated against the **real** Tekion Jira status set per project
   (discoverable via the Jira API) before metrics are trusted.
3. **Workflow metadata → resolved: code port, no table.** `WorkflowType` is an enum;
   stages/weights/priority live in code. Create `web/src/lib/workflows.mjs` keyed by `WorkflowType`
   (no `Workflow` table — the values are static and unit-testable as constants).

## Requirements

### Scope

**(a) Workflow-constants module** — `web/src/lib/workflows.mjs`
- Port `stages`, `weights`, `priority`, `name` from `src/workflows.js`, keyed by `WorkflowType`:
  `FEATURE` (10 stages), `TECH_DEBT` (4), `SUPPORT` (4), `INTERNAL_BUG` (4, **reuses** the
  techdebt/support stage set per §16), `CUSTOM` (no stages — excluded from seeding).
- This is the single source the seed uses to know each workflow's stage **count** (to bounds-check
  `stageIndex`) and stage names. Pure data + a couple of helpers; no storage reads (§17).

**(b) ADMIN `User`** (requires [add-user-isadmin.md](./add-user-isadmin.md) applied)
- Upsert by `email` (unique). Fields: `email` (from `SEED_ADMIN_EMAIL`), `displayName`,
  `jiraAccountId`, and **`isAdmin: true`**. **We don't know the real `jiraAccountId` offline** and
  it's a required unique column → seed a placeholder (`seed-pending:<email>`); the **auth layer
  reconciles it on first Jira login** (upsert by email, set the real
  `jiraAccountId`/`displayName`/`avatarUrl`, preserving `isAdmin`).
- No `JiraCredential` is seeded (created at first login, encrypted — auth feature).

**(c) Global `StatusStageMapping` rows** (`teamId = null`)
- Upsert by the schema's unique key `(workflowType, jiraStatus, teamId)`. Matched
  **case-insensitively** at read time (schema comment) — store canonical-cased status names.
- `stageIndex` checks that stage **and auto-checks `0..n`** (the checklist rule), so map each status
  to the **highest** lifecycle stage it implies. Statuses meaning "not started" get **no row**
  (issue seeds to all-false). Seed `FEATURE`, `TECH_DEBT`, `SUPPORT`, `INTERNAL_BUG`; skip `CUSTOM`.
- **Proposed defaults (PROPOSED — confirm against real statuses, Open question 2):**

  `FEATURE` (stages 0–9: PM clarification, HLD/LLD, API contracts, Working APIs, FE integration, E2E
  testing, QA/PM demo, PR approved, Release ready, 1st Stage Env deployment)
  | Jira status | → stageIndex | stage |
  |---|---|---|
  | Groomed / Ready for Dev | 0 | PM clarification |
  | In Progress / In Development | 3 | Working APIs |
  | Code Review / In Review | 5 | E2E testing |
  | Testing / In QA | 6 | QA/PM demo |
  | Done / Released / Closed | 9 | 1st Stage Env deployment |

  > Code Review → 5 and Testing/In QA → 6 are **confirmed by Naveen (2026-06-15)**; the mapping is now
  > monotonic. `Groomed→0`, `In Progress→3`, `Done→9` remain best-effort defaults pending validation
  > against real Tekion statuses (decision 2 above).

  `TECH_DEBT` / `SUPPORT` / `INTERNAL_BUG` (stages 0–3: Triaged, In Progress, Code Review, In QA) —
  clean and monotonic:
  | Jira status | → stageIndex |
  |---|---|
  | Triaged | 0 |
  | In Progress | 1 |
  | Code Review / In Review | 2 |
  | In QA / Testing | 3 |
  | Done / Closed | 3 |

### Mechanism

- `web/prisma/seed.mjs` (Node ESM, run via **tsx** — see deviations). Build a `PrismaClient` with the
  **Prisma 7 adapter pattern** (`PrismaPg` + `DATABASE_URL`), mirroring `src/lib/db.js` — a standalone
  script can't use the `@/` alias, so import the generated client by relative path
  (`../src/generated/prisma/client.ts`) and `import "dotenv/config"` (Prisma 7 stops auto-loading
  `.env` once `prisma.config.mjs` exists).
- Wire the seed command in **`web/prisma.config.mjs`** under `migrations.seed`
  (`"tsx prisma/seed.mjs"`) — Prisma 7's config, not `package.json`'s `prisma.seed`. Add a
  `"db:seed": "prisma db seed"` script; `prisma migrate reset` also auto-seeds.
- **Validate the seed data with zod** before writing (§17): assert every `stageIndex` is within
  `[0, stageCount-1]` for its workflow (using module (a)); fail loudly on an out-of-range index.
- **Idempotent**: all writes are `upsert`s on the unique keys above → re-running creates no
  duplicates and doesn't disturb hand-edited rows.

### Acceptance criteria

- `yarn db:seed` on a migrated DB creates exactly: one ADMIN `User`, and the global
  `StatusStageMapping` rows for `FEATURE`/`TECH_DEBT`/`SUPPORT`/`INTERNAL_BUG` (none for `CUSTOM`).
- **Re-running `yarn db:seed` produces no duplicates** (upserts); `prisma migrate reset` runs the
  seed automatically and ends green.
- The seed **fails with a clear error** if any `stageIndex` is out of range for its workflow.
- `web/src/lib/workflows.mjs` exists, is keyed by `WorkflowType`, and is the module the seed imports
  for stage counts; `INTERNAL_BUG` resolves to the 4-stage set.
- `yarn build` and `yarn lint` in `web/` stay green and **build remains DB-free** (the seed is not
  imported by any app/build path).

### Out of scope

- **Auth wiring** — how first login upserts the real `jiraAccountId` + encrypted `JiraCredential`
  (step 3 / auth feature). The seed only leaves a placeholder to reconcile.
- **RBAC enforcement** (admin route guards, the `SEED_ADMIN_EMAILS` check) — consumed later; this
  feature only seeds the row and documents the env var.
- **Per-team `StatusStageMapping` overrides** and any admin UI to manage them.
- **Teams / memberships / sprints** seeding — provisioning is admin-managed (§16); not bootstrap data.
- Porting the **metrics compute** functions (`computeSprintMetrics`, health/velocity) — later feature;
  this only ports the workflow **constants** the seed needs.
- The **localStorage importer** ([seed.md](./seed.md)) — depends on this.
- The **`User.isAdmin` schema change + migration** — split out as its own prerequisite feature
  ([add-user-isadmin.md](./add-user-isadmin.md)); this seed only *sets* the flag.

## Notes

- Add `SEED_ADMIN_EMAIL` to `web/.env.example` (the bootstrap admin's email — the seed's input for
  which `User` to create and flag `isAdmin: true`; RBAC itself reads the column, not this var).
- Prisma 7 seed + ESM + adapter is the same gotcha set as Feature 3: load `dotenv`, use the adapter,
  import the generated client by relative path. Reuse that known-good pattern.
- Keep the proposed `StatusStageMapping` table and any §6 status changes **doc-synced** — if the
  mappings change after validation, update both the seed and this doc in the same PR (§17).

## As-built deviations from the spec

- **Workflow-constants module is `web/src/lib/workflows.mjs`, not `.js`.** The seed runs as a plain
  Node/tsx script, and `web/package.json` has no `"type": "module"`, so a `.js` import is treated as
  **CommonJS** — its ESM named exports (`SEEDABLE_WORKFLOW_TYPES`, `stageCountFor`) weren't visible
  and the seed crashed. The `.mjs` extension forces ESM. (Future metrics code imports
  `@/lib/workflows.mjs`; Turbopack resolves `.mjs`.) Spec text saying `workflows.js` is superseded.
- **Seed runner: `tsx` (new devDep, exact `4.22.4`).** The modern `prisma-client` generator emits
  **TypeScript-only** client code and this Node (20.19.4) can't strip types, so a plain
  `node prisma/seed.mjs` can't import the generated client. `tsx` transpiles on the fly; the seed
  imports the client by relative path (`../src/generated/prisma/client.ts`). This is the same
  "Prisma 7 reality" class of deviation as Feature 3.
- **Seed command lives in `prisma.config.mjs` (`migrations.seed`), not `package.json`'s
  `prisma.seed`.** Prisma 7 reads the seed command from the config file (`@prisma/config` type
  `migrations.seed?: string`); the legacy `package.json` `prisma.seed` key is not used. Set to
  `tsx prisma/seed.mjs`; `prisma db seed` (the `db:seed` script) and `prisma migrate reset` both run it.
- **Global `StatusStageMapping` uses delete-then-create, not per-row `upsert`.** Postgres treats
  `NULL` as distinct in a unique index, so `@@unique([workflowType, jiraStatus, teamId])` does **not**
  dedupe when `teamId IS NULL` — a per-row upsert would create duplicate global rows. The seed instead
  deletes all `teamId = null` rows then `createMany`s them inside a transaction: idempotent, no
  duplicates, and per-team overrides (`teamId != null`) are untouched. (Admin user still upserts by
  `email`, which is non-null unique.)
- **Status synonyms are separate rows.** Each "A / B" cell in the proposed tables expands to one row
  per status name (35 total: FEATURE 11, the three 4-stage workflows 8 each), since matching is per
  raw status name.

## References

- @context/project-overview.md (§6 stage model + critical caveat, §9 `StatusStageMapping` /
  `User` / `Role`, §16 decisions, Production Migration Plan step 2)
- @context/coding-standards.md (zod-at-boundaries, Prisma conventions, `prisma migrate` not `db push`)
- @context/features/scaffload-prisma.md (Prisma 7 adapter/dotenv/ESM pattern to reuse)
- @context/features/add-user-isadmin.md (prerequisite — the `User.isAdmin` flag this seed sets)
- @context/features/seed.md (the importer that depends on this bootstrap seed)
- Source: `src/workflows.js` (stages/weights/priority), `src/jiraService.js` (prototype status map),
  `web/prisma/schema.prisma`, `web/src/lib/db.js`
