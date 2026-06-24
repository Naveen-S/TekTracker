# Current Feature

**Bootstrap seed (completes migration step 2)** — full spec:
@context/features/bootstrap-seed.md

The install/bootstrap seed for the `web/` Postgres DB — the third and only unbuilt clause of the
Production Migration Plan **step 2** ("seed: ADMIN, global `StatusStageMapping` rows, the three
workflows' metadata"). A repeatable Prisma seed (`prisma/seed.mjs`, wired so `migrate reset` and
`yarn db:seed` both run it) that writes: (1) a bootstrap **ADMIN `User`** (`isAdmin: true`),
(2) the **global default `StatusStageMapping`** rows (hybrid Jira-status → stage seeding,
`teamId = null`), (3) a **workflow-constants module** (`web/src/lib/workflows.js`) ported from
`src/workflows.js`. Prerequisite [add-user-isadmin.md](./features/add-user-isadmin.md) is **Done**.
This unblocks @context/features/seed.md (the localStorage importer). Ordering:
**bootstrap-seed → importer**.

## Status

**Done 2026-06-15.** Added `web/src/lib/workflows.mjs` (constants keyed by `WorkflowType`) and
`web/prisma/seed.mjs` (zod-validated, idempotent); wired `migrations.seed` in `prisma.config.mjs` +
a `db:seed` script; documented `SEED_ADMIN_EMAIL`. Seeded Neon: **1 ADMIN** (`isAdmin=true`) + **35
global `StatusStageMapping` rows**; verified idempotent re-run, the out-of-range guard fails loudly,
and `yarn lint`/`yarn build` green + DB-free. As-built deviations (all in
@context/features/bootstrap-seed.md): module is `.mjs` not `.js` (ESM under tsx); seed runs via a new
`tsx` devDep (TS-only generated client); seed command lives in `prisma.config.mjs` not `package.json`;
global mappings use delete-then-create (Postgres NULL-unique gotcha). **Next:**
@context/features/seed.md (localStorage importer).

## Goals

- **(a) `web/src/lib/workflows.js`** — port `stages`/`weights`/`priority`/`name` from
  `src/workflows.js`, keyed by `WorkflowType` (`FEATURE` 10-stage; `TECH_DEBT`/`SUPPORT`/
  `INTERNAL_BUG` the shared 4-stage set; `CUSTOM` excluded). Single source for stage counts.
- **(b) ADMIN `User`** — upsert by `email` (from `SEED_ADMIN_EMAIL`), `isAdmin: true`, placeholder
  `jiraAccountId` (`seed-pending:<email>`) reconciled at first login.
- **(c) Global `StatusStageMapping`** (`teamId = null`) — upsert by `(workflowType, jiraStatus,
  teamId)`; map each status to the highest stage it implies (auto-checks `0..n`); "not started"
  statuses get no row. Seed `FEATURE`/`TECH_DEBT`/`SUPPORT`/`INTERNAL_BUG`; skip `CUSTOM`.
- **Mechanism** — `prisma/seed.mjs` (adapter + `dotenv`, relative generated-client import);
  `"prisma": { "seed": ... }` + `db:seed` script; **zod**-assert every `stageIndex` is in range;
  all writes idempotent `upsert`s.
- **Acceptance:** `yarn db:seed` creates the admin + global mappings, re-runs with no duplicates,
  `migrate reset` auto-seeds; fails loudly on an out-of-range `stageIndex`; `yarn lint` + `yarn
  build` stay green and DB-free.

## Notes

- Reuse the Feature 3 Prisma 7 + Neon pattern: `dotenv` for CLI env; the seed builds its own
  `PrismaClient` via `@prisma/adapter-pg` (a plain Node script can't use the `@/` alias).
- `SEED_ADMIN_EMAIL` is the seed's **input** (which user to flag); RBAC reads the `isAdmin` column,
  not this var.
- Proposed `StatusStageMapping` tables and any §6 status changes stay **doc-synced** (§17) — update
  the seed and bootstrap-seed.md together if the mappings change after validation.

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-06-12 — Picked @context/features/scaffold-nextjs.md as the current feature.
- 2026-06-12 — Scaffolded `web/` (Next.js 16.2.9, App Router, JS, Tailwind v4, yarn). Verified
  build, lint, and three-server coexistence. Deviations recorded in the feature spec: `web/` dev
  pinned to :3002 (root Vite app owns :3000), `turbopack.root` pinned (dual-lockfile repo),
  `typescript` devDep added (required by `eslint-config-next` under yarn 1).
- 2026-06-13 — Feature 1 (Next.js scaffold) **Done**. Picked
  @context/features/scaffold-tailwind-shadcn-zod.md as the current feature (Tailwind theme +
  shadcn/ui + zod); default theme set to **light**.
- 2026-06-13 — Implemented Feature 2: Tailwind v4 Tekion token theme (light default, dark under
  `.dark`), shadcn/ui (radix base, JS/`.jsx`) with `Button`, and zod + `validate()` helper +
  placeholder schema. Lint/build/dev verified. shadcn set up manually (`ui.shadcn.com` unreachable).
- 2026-06-14 — Feature 2 (Tailwind + shadcn/ui + zod) **Done** and re-verified (`yarn lint` +
  `yarn build` pass in `web/`; all spec files present; no `tailwind.config.*`, no source
  `.ts`/`.tsx`). Picked @context/features/scaffload-prisma.md as the current feature (Feature 3 —
  Prisma 7 + Postgres data layer).
- 2026-06-14 — Implemented Feature 3: Prisma 7.8.0 + `@prisma/client` + `@prisma/adapter-pg` +
  `dotenv` (in `web/` only, `--ignore-engines` for a Node-22 transitive). Ported §9 verbatim to
  `web/prisma/schema.prisma` (12 models, 4 enums, `///` doc comments); `url` removed from datasource
  (Prisma 7) and moved to `web/prisma.config.mjs`; legacy `prisma-client-js` generator; singleton
  at `web/src/lib/db.js` via the pg driver adapter; `db:*` scripts + `postinstall: prisma generate`;
  `.env.example` committed (+ `!.env.example` gitignore exception), `.env` uncommitted. `init`
  migration created and applied to the Neon dev DB; `validate`/`generate`/`migrate status`/`lint`/
  `build` all green; build verified DB-free (passes with `DATABASE_URL` unset). Delete-me
  `force-dynamic` `/api/health/db` smoke route added. §9 reconciled with the Prisma 7 deviations.
  NextAuth models confirmed **omitted** (conflicts with verbatim-§9 / §16 Jira-token auth).
- 2026-06-14 — Per Naveen ("use latest Prisma"), switched from the deprecated `prisma-client-js`
  generator to the modern **`prisma-client`** generator (`output = ../src/generated/prisma`,
  emits `.ts`); updated the singleton import to `@/generated/prisma/client`, gitignored
  `/src/generated/prisma`, and ESLint-ignored `src/generated/**`. No `tsconfig.json` required —
  Next 16 + Turbopack compiles the generated `.ts` and resolves `@/*` via `jsconfig.json`.
  Re-verified: `validate`/`generate`/`lint`/`build` green, build DB-free (passes with
  `DATABASE_URL` unset), and `GET /api/health/db` returns `{status:"ok",db:true,users:0}` against
  Neon at runtime. §9 deviation #2 updated to match.
- 2026-06-14 — Froze all `web/package.json` dep versions to exact (dropped `^` ranges; lockfile
  reconciled, versions unchanged). Added `web/.yarnrc` (`ignore-engines true`) so flagless
  `yarn install` works. Logged a **deferred follow-up** (project-overview §16): bump to Node 22
  (≥22.12) and drop the `ignore-engines` shim **after** the root Vite app is retired / `web/` is
  promoted to root.
- 2026-06-15 — Feature 3 (Prisma 7 + Postgres data layer) **Done**. Re-verified `yarn prisma
  validate`/`lint`/`build` green, build DB-free, `migrate status` up to date on Neon.
- 2026-06-15 — Planning session (no code): reviewed the handwritten spec + current build and
  confirmed migration **step 2 is only partially done** — schema + `init` migration yes, the
  **seed** (ADMIN user + global `StatusStageMapping` + workflow metadata) no. Drafted three feature
  plans: @context/features/seed.md (localStorage → Postgres **importer**, master-plan step 9),
  @context/features/bootstrap-seed.md (completes step 2's seed), and
  @context/features/add-user-isadmin.md. Ratified with Naveen: (1) represent global admin via a new
  **`User.isAdmin`** column (not an env allowlist); (2) `FEATURE` status→stage map uses **Code
  Review → E2E testing (5)** and **Testing/In QA → QA/PM demo (6)**; (3) workflow metadata stays a
  code-port (`web/src/lib/workflows.js`), no `Workflow` table.
- 2026-06-15 — Picked @context/features/add-user-isadmin.md as the current feature.
- 2026-06-15 — **Implemented add-user-isadmin.** Added `isAdmin Boolean @default(false)` to `User`
  in `web/prisma/schema.prisma` (with a note vs. `TeamMembership.role = ADMIN`); tightened the `Role`
  enum `ADMIN` comment; doc-synced §9 (User model block, `Role` note, ER-diagram USER entity, the
  User/TeamMembership rationale bullet). Created + applied migration
  `20260615042100_add_user_isadmin` (single additive `ALTER TABLE "User" ADD COLUMN "isAdmin"
  BOOLEAN NOT NULL DEFAULT false`) — `migrate dev` ran directly against the Neon pooled endpoint
  (no shadow-DB workaround needed, unlike the `init` migration). Regenerated client. Verified:
  `prisma validate` valid, `migrate status` up to date (2 migrations), `yarn lint` clean, `yarn
  build` green + DB-free, `isAdmin` present in the generated client. **Done.**
- 2026-06-15 — add-user-isadmin **Done**. Picked @context/features/bootstrap-seed.md as the current
  feature (completes migration step 2 — bootstrap seed: ADMIN user + global `StatusStageMapping` +
  workflow-constants port).
- 2026-06-15 — **Implemented bootstrap-seed (completes migration step 2).** Added
  `web/src/lib/workflows.mjs` (workflow stages/weights/priority keyed by `WorkflowType`) and
  `web/prisma/seed.mjs` (zod-validated, idempotent): upserts the `SEED_ADMIN_EMAIL` user with
  `isAdmin: true` (placeholder `jiraAccountId`), and replaces the global (`teamId=null`)
  `StatusStageMapping` set via delete-then-`createMany`. Wired `migrations.seed = "tsx
  prisma/seed.mjs"` in `prisma.config.mjs`, added `db:seed` script + `tsx` devDep (exact 4.22.4),
  documented `SEED_ADMIN_EMAIL` in `.env.example`. Ran against Neon: 1 admin + 35 global mappings
  (FEATURE 11; TECH_DEBT/SUPPORT/INTERNAL_BUG 8 each; CUSTOM skipped). Verified idempotent re-run (no
  dupes), out-of-range `stageIndex` fails loudly before any write, `yarn lint` + `yarn build` green +
  DB-free. As-built deviations (vs. spec): `.mjs` not `.js` (ESM under tsx), `tsx` runner (TS-only
  generated client on Node 20), seed command in `prisma.config.mjs` not `package.json`, delete-then-
  create for global rows (Postgres NULL-unique). **Done.**
