# Current Feature

**Scaffold Prisma 7 + Postgres (Neon) data layer in `web/`** — full spec:
@context/features/scaffload-prisma.md

Feature 3 of the production migration: add the **persistence foundation** to the `web/` Next.js
app — Prisma 7 + the Postgres (Neon) data model from @context/project-overview.md §9, a Prisma
Client singleton wired for the App Router, and the first migration. Infrastructure only — **no**
data-access functions, Server Actions, route handlers, auth, localStorage importer, or background
sync (those consume this layer later). The `web/` app must still build, lint, and coexist with the
running Vite + Express app.

## Status

**Done 2026-06-15** — re-verified: `yarn prisma validate` valid, `yarn lint` and `yarn build` pass
(health route `ƒ Dynamic`, `/` static), build is DB-free, and `prisma migrate status` reports the
Neon dev DB up to date. Prisma 7.8.0 + Postgres data layer scaffolded in `web/`: §9 ported verbatim
to `web/prisma/schema.prisma`, `init` migration created and applied to Neon, client singleton +
driver adapter wired (modern `prisma-client` generator). See **As-built deviations** below and the
History. Versions frozen + `web/.yarnrc` shim added; Node-22 bump deferred to Vite retirement (§16).

### As-built deviations (Prisma 7 reality vs. the spec, which assumed Prisma 5/6)

- **`url` removed from the schema `datasource` block.** Prisma 7 disallows it; the Migrate/CLI
  connection string moved to `web/prisma.config.mjs` (`datasource.url`, loaded via `dotenv`). §9
  updated to match. The spec's "datasource → `url = env(...)`" line is therefore superseded.
- **Runtime connects via a driver adapter.** Prisma 7's query compiler needs `@prisma/adapter-pg`
  (added dep; pulls `pg`) — `new PrismaClient()` alone no longer connects. The singleton in
  `src/lib/db.js` passes `adapter: new PrismaPg({ connectionString: DATABASE_URL })`.
- **Generator: modern `prisma-client`** (Prisma 7 `init` default; legacy `prisma-client-js` is
  deprecated). Chosen with Naveen (2026-06-14) to use the latest Prisma — overriding the spec's "no
  `.ts`/`.tsx`" criterion, which the generated client necessarily breaks. It emits TypeScript to
  `src/generated/prisma` (gitignored; recreated by `postinstall`/`db:generate`); imported from
  `@/generated/prisma/client`. Next 16 + Turbopack compiles the generated `.ts` with **no
  `tsconfig.json` needed** (the `@/*` alias stays in `jsconfig.json`); the generated dir is
  ESLint-ignored. Authored app source remains `.js`/`.jsx`.
- **`dotenv` added (devDep)** so `prisma.config.mjs` can `import "dotenv/config"` (Prisma 7 stops
  auto-loading `.env` once a config file exists).
- **`ignore-engines` shim (`web/.yarnrc`).** `prisma`/`@prisma/client` 7.8.0 support Node 20.19 (we
  run 20.19.4), but a transitive `@prisma/streams-local@0.1.2` (via `@prisma/dev`, the unused
  `prisma dev` local server) declares Node >=22, and yarn 1 enforces engines for all packages. A
  `web/.yarnrc` with `ignore-engines true` lets a plain `yarn install` succeed without the flag.
  **Temporary** — remove when we move to Node 22 (≥22.12, Prisma 7's floor), a deferred follow-up
  tied to retiring the root Vite app (see project-overview §16). On 22.12+ the check passes natively.
- **`!.env.example` added to `web/.gitignore`** so the committed template isn't swept up by `.env*`.
- **NextAuth models NOT added** (confirmed with Naveen 2026-06-14; the spec's Requirements bullet was
  dropped). They conflicted with the authoritative instruction to port §9 **verbatim** (no such
  models), with §16's ratified **Jira-token auth** (`JiraCredential`, not email/OAuth-link auth), and
  with "auth wiring" being out of scope.

> Migration was applied to the **Neon** dev DB (`migrate deploy`, since the endpoint is pooled and
> `migrate dev` wants a shadow DB). Local-Postgres fallback was used first; both verified.

## Goals

- **Deps (in `web/` only):** add `prisma` (dev) + `@prisma/client`, pinned to **7.x**. Nothing
  added to the root Vite app.
- **`web/prisma/schema.prisma`:** port the full §9 data model **verbatim** — all 12 models
  (`User`, `JiraCredential`, `Team`, `TeamMembership`, `Sprint`, `Filter`, `FilterTemplate`,
  `Issue`, `IssueProgress`, `StatusStageMapping`, `SharedView`, `SprintSnapshot`) and 4 enums
  (`Role`, `SprintState`, `WorkflowType`, `FilterSourceType`), keeping the `///` design-decision
  doc comments. `provider = "postgresql"`, `url = env("DATABASE_URL")`. `yarn prisma validate` must
  pass and stay byte-consistent with §9 (reconcile both in the same change).
- **Generator decision:** default to whatever the installed Prisma 7 `prisma init` scaffolds —
  legacy `prisma-client-js` (emits to `node_modules`, matches §9 as-written) vs. the new
  ESM-first `prisma-client` (explicit `output` path, gitignore the generated dir). Record the
  choice as an as-built deviation and reconcile §9 + the singleton import.
- **Prisma Client singleton** at [src/lib/db.js](web/src/lib/db.js) using the global-cache pattern
  (no connection storm on hot reload); the single `@/lib/db` module the app imports for DB access.
- **Config & secrets:** committed `web/.env.example` documenting the Neon connection-string shape
  (pooled `DATABASE_URL`; optional `DIRECT_URL`/`directUrl` for migrations); real `web/.env` stays
  uncommitted. If Prisma 7 needs a config file, use `prisma.config.mjs` (JS-only, no `.ts`) and
  ensure env loads for CLI commands.
- **First migration + scripts:** `yarn prisma generate` succeeds; `yarn prisma migrate dev --name
  init` produces `web/prisma/migrations/<ts>_init/` (never `db push`). Add `db:generate`,
  `db:migrate`, `db:deploy`, `db:studio` scripts + `postinstall: prisma generate`.
- **Acceptance:** `yarn prisma validate`/`generate`, `yarn build`, `yarn lint` all pass with **no
  DB access at build time**; dev still on :3002; all three dev servers coexist; no `.ts`/`.tsx`,
  no `tailwind.config.*`, root Vite app untouched; `.env` not committed, `.env.example` committed.

## Notes

- Read the installed Prisma 7 docs/release notes in `web/node_modules/prisma/` (and the upgrade
  guide) **before** writing schema or config — Prisma 7 has breaking changes vs. training-data
  Prisma 5/6, same as the Next.js 16 / Tailwind v4 warning in CLAUDE.md.
- **Prisma 7 `.env` gotcha:** when a `prisma.config.*` file exists, Prisma stops auto-loading
  `.env`; CLI commands may not see `DATABASE_URL` unless env is loaded explicitly. Most likely
  cause of a "missing DATABASE_URL" migration failure.
- **Build must not touch the DB:** keep any DB read in a `force-dynamic` route or server action,
  never in a statically-rendered page, so `yarn build` stays green without `DATABASE_URL`.
- **Live-DB fallback (Neon likely unreachable in this sandbox):** point `DATABASE_URL` at a
  throwaway local Postgres, or use `migrate dev --create-only` + offline `validate`/`generate` and
  record applying to Neon as a deferred follow-up. **Never** substitute `db push`.
- Only add files under `web/`; do not modify the root Vite app, `server.js`, or root
  `package.json`.

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
  validate`/`lint`/`build` green, build DB-free, `migrate status` up to date on Neon. No next feature
  picked yet.
