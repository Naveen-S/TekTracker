# Scaffold Prisma 7 + Postgres data layer in `web/`

## Overview

Feature 3 of the production migration (the migration is broken into small, independently
verifiable features). Builds on Feature 1 (@context/features/scaffold-nextjs.md, the Next.js app)
and Feature 2 (@context/features/scaffold-tailwind-shadcn-zod.md, styling + zod). This feature
adds the **persistence foundation**: Prisma 7 ORM + the Postgres (Neon) data model from
@context/project-overview.md §9, a Prisma Client singleton wired for the Next.js App Router, and
the first migration — per §8 (target architecture), §10 (stack: "Prisma 7 → Neon Postgres") and
§16 ("Hosting: app on Tekion internal infra; database on Neon").

This is the first feature that crosses into the database (Features 1–2 were explicitly "no
database"). It is still **infrastructure only**: we stand up the schema, client, and migration —
**no data-access functions, no Server Actions, no route handlers, no auth, no localStorage
importer, no background sync.** Those consume this layer in later features. The `web/` app must
still build, lint, and coexist with the running Vite + Express app.


## Requirements

- Use Neon PostgreSQL (serverless)
- Create initial schema based on data models in project-overview.md (this will evolve)
- Add appropriate indexes and cascade deletes

### Scope

**Dependencies (yarn, in `web/` only)**
- Add `prisma` (devDependency) and `@prisma/client` (dependency). Pin to Prisma **7.x**
  (`prisma@^7`, currently 7.8.0 on the registry; Node 20.19.4 satisfies its `engines`).
- Do **not** add anything to the root Vite app — Prisma lives entirely under `web/`.

**`prisma/schema.prisma` (port §9)**
- Create `web/prisma/schema.prisma`. **Port the full data model from
  @context/project-overview.md §9 verbatim** (all models: `User`, `JiraCredential`, `Team`,
  `TeamMembership`, `Sprint`, `Filter`, `FilterTemplate`, `Issue`, `IssueProgress`,
  `StatusStageMapping`, `SharedView`, `SprintSnapshot`; all enums: `Role`, `SprintState`,
  `WorkflowType`, `FilterSourceType`). Keep the `///` doc comments — they encode the ratified
  design decisions and the keying rules.
- `datasource db` → `provider = "postgresql"`, `url = env("DATABASE_URL")`. The Postgres-native
  `String[]` / `Boolean[]` array fields (`jiraProjectKeys`, `includedFilterIds`, `stageCompletion`)
  rely on the `postgresql` provider — confirm it stays Postgres.
- **Generator — verify against the installed Prisma 7 docs before committing** (see Notes; §9 was
  written against the legacy `prisma-client-js` generator). Two valid paths:
  - *Legacy, minimal-change:* `generator client { provider = "prisma-client-js" }` — emits to
    `node_modules/.prisma/client`, imported as `@prisma/client` (matches §9 as-written, simplest).
  - *New Prisma 7 generator:* `provider = "prisma-client"` with an explicit
    `output = "../src/generated/prisma"` (ESM-first; required output path) and imports from the
    generated path. If chosen, **gitignore the generated dir** and update §9 + the import in the
    singleton accordingly.
  - **Decision rule:** default to whichever the installed Prisma 7's `prisma init` scaffolds /
    recommends; record the choice + reasoning as an as-built deviation and reconcile §9 in the same
    PR (doc-sync convention, §17).
- After porting, **`yarn prisma validate` must pass** and the schema must stay byte-for-byte
  consistent with §9 (if you adjust the schema, update §9 in the same change, and vice-versa).

**Config & secrets**
- `DATABASE_URL` comes from the environment. Add `web/.env.example` (committed) documenting the
  Neon connection-string shape (`postgresql://USER:PASSWORD@HOST/DB?sslmode=require`) and any
  pooled-vs-direct URL split Neon needs (`DATABASE_URL` pooled for the app; optional
  `DIRECT_URL` / `directUrl` for migrations — wire `directUrl` in the datasource only if used).
- The real `web/.env` (with the secret) stays **uncommitted** — `web/.gitignore` already ignores
  `.env*`; do not commit it. Verify nothing secret lands in git.
- If Prisma 7 uses a `prisma.config.*` file (see Notes), add it as `prisma.config.mjs` (JS project —
  no `.ts`) and ensure env is loaded for CLI commands (Prisma 7 disables auto-`.env` loading once a
  config file exists). Keep it JS-only — **no `.ts`/`.tsx`** is introduced by this feature.

**Prisma Client singleton (Next.js integration)**
- Add `web/src/lib/db.js` exporting a single shared `PrismaClient` using the standard global-cache
  pattern, so dev hot-reload doesn't spawn a new client (and connection storm) per reload:
  ```js
  import { PrismaClient } from "@prisma/client";
  const globalForPrisma = globalThis;
  export const prisma = globalForPrisma.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  ```
  (Adjust the import source if the new `prisma-client` generator is chosen.) This is the single
  module the rest of the app imports for DB access (`@/lib/db`); keep Prisma usage funnelled
  through it (mirrors the "keep Jira specifics isolated" convention, §17).

**First migration + client generation**
- Generate the client: `yarn prisma generate` (must succeed; produces the typed client).
- Create the initial migration: **`yarn prisma migrate dev --name init`** (coding-standards:
  always `migrate dev`, never `db push`) → produces `web/prisma/migrations/<ts>_init/migration.sql`
  and applies it to the dev database. Commit the `migrations/` directory.
- **Live-DB fallback (this sandbox may not reach Neon):** if no reachable Postgres/`DATABASE_URL`
  is available in this environment, do **not** silently skip. Either (a) point `DATABASE_URL` at a
  throwaway local Postgres (e.g. Docker) to apply the migration, or (b) run
  `yarn prisma migrate dev --create-only --name init` to generate the migration SQL **without
  applying**, plus `yarn prisma validate` + `yarn prisma generate` offline, and **record applying
  to Neon as a deferred follow-up** (as-built deviation). Never use `db push` as the workaround.

**package.json scripts & build hooks**
- Add convenience scripts in `web/package.json`:
  - `"db:generate": "prisma generate"`
  - `"db:migrate": "prisma migrate dev"`
  - `"db:deploy": "prisma migrate deploy"` (production — coding-standards: run before app start)
  - `"db:studio": "prisma studio"` (optional, dev only)
  - `"postinstall": "prisma generate"` so a fresh `yarn install` always has a current client.
- Keep `dev` pinned to `-p 3002` and `build` unchanged. `build` must remain green **without a live
  DB** — Prisma client generation is fine offline, but nothing in this feature may query the DB at
  build/prerender time (see smoke-test note).

**Smoke test (prove the pipeline, no live DB required at build)**
- Mirror the Feature 1/2 "prove it resolves" approach. Acceptable smoke test that keeps `build`
  green offline: import the singleton from `@/lib/db` and instantiate it (proves the generated
  client + import path resolve), **without executing a query during build/prerender**.
- Optionally add a clearly-marked delete-me **dynamic** route (`src/app/api/health/db/route.js`,
  `export const dynamic = "force-dynamic"`) that does a trivial `await prisma.$queryRaw\`SELECT 1\``
  / `prisma.user.count()` — runs only when hit, never at build. Mark it as a sample to remove when
  real routes land (same spirit as the `example.js` zod placeholder).

**zod ↔ Prisma boundary note (convention only, no real schemas)**
- Document (in this spec / a code comment) that domain zod schemas will mirror Prisma model inputs
  and validate at every route/action boundary via the existing `validate()` helper
  (@context/coding-standards.md, and `web/src/lib/validation.js`). **No real model schemas are
  written here** — the `example.js` placeholder from Feature 2 still stands in until routes exist.

### Acceptance criteria

- `cd web && yarn prisma validate` passes; the schema matches @context/project-overview.md §9.
- `cd web && yarn prisma generate` succeeds and `@/lib/db` imports/instantiates the client cleanly.
- An `init` migration exists under `web/prisma/migrations/` (applied to a dev DB, or `--create-only`
  + offline `validate`/`generate` with the apply-to-Neon step recorded as a deviation).
- `cd web && yarn build` and `cd web && yarn lint` both pass; **no DB access at build time**.
- `cd web && yarn dev` still serves on `http://localhost:3002`; root `yarn dev:all`
  (Vite :3000 + Express :3001) still runs unchanged — all three dev servers coexist.
- **No `.ts`/`.tsx`** source added; **no `tailwind.config.*`** introduced; the root Vite app is
  untouched.
- `web/.env` (with the secret `DATABASE_URL`) is **not** committed; `web/.env.example` **is**.
- `package.json` has `postinstall: prisma generate` + the `db:*` scripts.

### Out of scope (later features)

- Any data-access layer, repository functions, Server Actions, or route handlers that **read/write**
  through Prisma (beyond the delete-me health route) — those are per-feature work.
- Real zod domain schemas mirroring the models for actual routes/actions.
- The one-time **localStorage → Sprint/Filter/IssueProgress importer** (decided 2026-06-10) — its
  own feature.
- **Seed data:** seeding `StatusStageMapping` global defaults and the bootstrap `ADMIN`
  (§16 provisioning) is deferred. *If* a `prisma/seed.js` is added here, keep it a thin, clearly
  documented stub wired via the Prisma seed config — full seeding is a later feature.
- Background sync / `SprintSnapshot` writer, auth wiring, encrypted-token (`JiraCredential`)
  population, Redis, Gemini.
- Promoting `web/` to the repo root / deleting the Vite app (happens at parity).

## Notes

- **Read the installed Prisma 7 docs/release notes before writing schema or config** — same rule as
  Next.js 16 / Tailwind v4 in CLAUDE.md. Prisma 7 has breaking changes vs. training-data Prisma
  6/5. Check `web/node_modules/prisma/` (and the Prisma 7 upgrade guide) for the items below before
  committing.
- **Prisma 7 generator change.** The recommended generator moved from `prisma-client-js` to the new
  `prisma-client` generator, which is **ESM-first and requires an explicit `output` path**; the
  legacy `prisma-client-js` is still available but deprecated. §9 is written for the legacy one.
  Pick per the "Decision rule" above and reconcile §9 + the singleton import in the same PR.
- **Prisma 7 config + `.env` loading gotcha.** Prisma 7 prefers a `prisma.config.*` file and
  deprecates the `package.json#prisma` key. **When a `prisma.config.*` file exists, Prisma stops
  auto-loading `.env`** — CLI commands (`migrate`, `generate`) may not see `DATABASE_URL` unless env
  is loaded explicitly (via the config file or by exporting it). If migrations fail with a missing
  `DATABASE_URL`, this is almost certainly why. Use `prisma.config.mjs` (JS project, no `.ts`).
- **No live database in this sandbox is likely.** Neon is the target but may be unreachable here
  (compare: `ui.shadcn.com` was unreachable in Feature 2). Follow the live-DB fallback above; never
  substitute `db push` for a migration (coding-standards forbids it).
- **Build must not touch the DB.** Keep any DB read in a `force-dynamic` route or server action, not
  in a statically-rendered page, so `yarn build` stays green without `DATABASE_URL`.
- **Generated-client gitignore.** If the new `prisma-client` generator with `output = "../src/..."`
  is chosen, add the generated directory to `web/.gitignore` and rely on `postinstall`/`db:generate`
  to (re)create it. The legacy generator emits to `node_modules` and needs no gitignore change.
- **Coexistence.** This feature only adds files under `web/`. Do not modify the root Vite app,
  `server.js`, or root `package.json`.
- Filename note: this file is `scaffload-prisma.md` (typo preserved from the referencing
  current-feature pointer); fix the name only if also fixing every reference.
- Initial data models: `@context/project-overview.md`
- Database standards: `@context/coding-standards.md`
- Prisma docs: https://prisma.io/docs (Prisma 7 has breaking changes - fetch latest)

## References

- @context/project-overview.md (§8 target architecture, §9 **data model — port verbatim**,
  §10 stack, §16 decisions, §17 doc-sync + "keep Jira specifics isolated" conventions)
- @context/coding-standards.md (Database: `migrate dev` not `db push`, `migrate status` before
  commit, `migrate deploy` in prod; Data Fetching: server components fetch via Prisma; Zod at
  boundaries)
- @context/features/scaffold-nextjs.md (Feature 1 — base app, `turbopack.root`, `typescript`
  tooling-only deviation, :3002 port)
- @context/features/scaffold-tailwind-shadcn-zod.md (Feature 2 — styling + the `validate()` helper /
  `{ success, data, error }` convention this layer plugs into)
- @web/src/lib/validation.js, @web/src/lib/schemas/example.js (existing zod boundary convention)
- CLAUDE.md / @web/AGENTS.md (non-standard versions: read installed docs first)

## History

<!-- Keep this updated. Earliest to latest -->

- 2026-06-13 — Drafted feature plan (Feature 3 of the migration: Prisma 7 + Postgres data layer in
  `web/`). Scope: deps, port §9 schema, client singleton, first migration; verify Prisma 7 generator
  + `prisma.config` env-loading change against installed docs; live-DB fallback for the Neon-less
  sandbox. Not yet implemented.
- 2026-06-14 — **Implemented.** Installed `prisma`@7.8.0 (dev) + `@prisma/client`@7.8.0 +
  `@prisma/adapter-pg`@7.8.0 + `dotenv` in `web/` (`--ignore-engines`: transitive
  `@prisma/streams-local` wants Node 22; Prisma itself supports our Node 20.19.4). Ported §9 verbatim
  to `prisma/schema.prisma`. Verified against installed Prisma 7 (`prisma init` probe) — recorded
  three breaking changes the draft didn't fully anticipate, all reconciled into §9 + this spec:
  (1) **`url` is banned from the schema `datasource`** → moved to `prisma.config.mjs` (`datasource.url`
  + `import "dotenv/config"`); (2) **runtime needs a driver adapter** (`@prisma/adapter-pg`) — the
  singleton's `new PrismaClient()` example is updated to pass `{ adapter }`; (3) the `init`-default
  `prisma-client` generator **emits TypeScript** → chose the legacy `prisma-client-js` generator to
  stay JS-only (no `tsconfig` pulled in), keeping the `@prisma/client` import. Added `db:*` scripts +
  `postinstall`. `init` migration created and applied to the **Neon** dev DB via `migrate deploy`
  (pooled endpoint; `migrate dev` wants a shadow DB) after a local-Postgres dry run. `validate`,
  `generate`, `migrate status` (up to date), `lint`, and `build` all pass; build is **DB-free**
  (green with `DATABASE_URL` unset). Added delete-me `force-dynamic` `/api/health/db` smoke route
  (queries Neon successfully). `.env` uncommitted, `.env.example` committed (added `!.env.example`
  gitignore exception). NextAuth models (Account/Session/VerificationToken) **omitted** — confirmed
  with Naveen (and the Requirements bullet dropped): they conflict with the verbatim-§9 port and
  §16's ratified Jira-token auth (`JiraCredential`), and would be dead/contradictory tables.
- 2026-06-14 — Per Naveen ("use latest Prisma"), **switched the generator** from the deprecated
  `prisma-client-js` to the modern **`prisma-client`** (`output = ../src/generated/prisma`). This
  supersedes the spec's "no `.ts`/`.tsx`" acceptance criterion (the modern generator is TS-only and
  emits `.ts` — there is no JS-emit option), with Naveen's explicit OK. Outcome: generated `.ts` in
  the gitignored `src/generated/prisma`, imported via `@/generated/prisma/client`; ESLint ignores
  `src/generated/**`; **no `tsconfig.json` needed** (Next 16 + Turbopack compiles the generated `.ts`
  and resolves `@/*` from `jsconfig.json`). `validate`/`generate`/`lint`/`build` re-verified green,
  build still DB-free, and the `/api/health/db` route returns `{status:"ok",db:true,users:0}` from
  Neon at runtime. §9 deviation #2 + current-feature.md updated to match.
- 2026-06-14 — Froze `web/package.json` dep versions to exact (lockfile reconciled, no version
  changes). Added `web/.yarnrc` (`ignore-engines true`) so flagless `yarn install` works around the
  Node-≥22 transitive (`@prisma/streams-local`). Recorded a deferred follow-up (project-overview §16)
  to move to Node 22 (≥22.12) and drop the shim once the root Vite app is retired.
