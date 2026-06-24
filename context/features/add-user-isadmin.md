# Add `User.isAdmin` (global admin flag)

## Overview

Small schema feature: add a persistent **global admin** flag to `User`. Decided with Naveen
(2026-06-15) to resolve the gap surfaced while drafting the bootstrap seed —
[bootstrap-seed.md](./bootstrap-seed.md), open question 1.

**Why:** in §9, `Role` lives **only on `TeamMembership`**, so "admin" was only expressible per-team.
But §16 says the seeded ADMIN *creates* teams, and at bootstrap time **no team exists** — a
chicken-and-egg: the first admin has no membership to carry an `ADMIN` role. A global `isAdmin`
column on `User` makes app-level admin a first-class, team-independent fact the RBAC layer can check.

This feature is the **schema change + migration only**. It does not seed any admin (that's
[bootstrap-seed.md](./bootstrap-seed.md)) and does not enforce RBAC (auth/admin feature). Ordering:
**add-user-isadmin → bootstrap-seed → importer**.

## Status

**Done 2026-06-15.** `isAdmin Boolean @default(false)` added to `User` in
`web/prisma/schema.prisma`; §9 doc-synced (User block, `Role` note, ER-diagram USER entity, rationale
bullet). Migration `20260615042100_add_user_isadmin` created and applied to Neon; client regenerated.
Verified: `prisma validate` valid, `migrate status` up to date (2 migrations), `yarn lint` clean,
`yarn build` green and DB-free (`/` static, `/api/health/db` dynamic), `isAdmin` present in the
generated client (`src/generated/prisma/models/User.ts`).

## Requirements

### Scope

- Add to `web/prisma/schema.prisma`, on `model User`:
  ```prisma
  isAdmin Boolean @default(false)  // global app admin (team-independent); RBAC checks this
  ```
  Place it near identity fields; keep a `///` or `//` note explaining it's the team-independent
  admin signal (distinct from `TeamMembership.role` ADMIN).
- **Doc-sync §9** in [project-overview.md](../project-overview.md) in the **same change** — add the
  field to the `User` model block and a one-line rationale (the schema and §9 must stay
  byte-consistent, §17). Also tighten the §9/`Role` enum note so it's clear `ADMIN` on a membership
  is a team-scoped role while `User.isAdmin` is the global flag.
- Create the migration with `yarn prisma migrate dev --name add_user_isadmin` →
  `web/prisma/migrations/<ts>_add_user_isadmin/` (**never** `db push`). Regenerate the client
  (`postinstall`/`db:generate` already do this).

### Acceptance criteria

- `yarn prisma validate` passes; `yarn lint` and `yarn build` in `web/` stay green and the build
  remains **DB-free** (no `DATABASE_URL` needed to build).
- `prisma migrate status` reports the new migration applied (use `migrate deploy` against the pooled
  Neon endpoint if `migrate dev`'s shadow DB is unreachable — the Feature 3 pattern).
- `web/prisma/schema.prisma` and project-overview §9 `User` block are byte-consistent (both list
  `isAdmin`).
- A pre-existing `User` row migrates without data loss (column defaults to `false`).

### Out of scope

- **Seeding** the bootstrap admin (`isAdmin = true`) — [bootstrap-seed.md](./bootstrap-seed.md).
- **RBAC enforcement** (route guards / server-side checks reading `isAdmin`) — auth/admin feature.
- Any UI to grant/revoke admin.

## Notes

- Prisma 7 / Neon migration gotchas are the same as Feature 3: `dotenv` loads env for the CLI; the
  pooled Neon endpoint may force `migrate deploy` over `migrate dev` (shadow DB). Reuse that
  known-good flow.
- This is additive and backward-compatible — no existing column changes, default `false`.

## As-built deviations from the spec

- **No shadow-DB workaround needed.** Unlike Feature 3's `init` migration (which needed
  `migrate deploy` because the pooled Neon endpoint rejected `migrate dev`'s shadow DB),
  `yarn prisma migrate dev --name add_user_isadmin` applied **directly** to Neon this time — so the
  offline-diff fallback was not required. Migration is a single additive statement:
  `ALTER TABLE "User" ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;`.
- The DB had **0 `User` rows** (Feature 3's `/api/health/db` reported `users:0`), so the "existing
  row migrates with default false" case is covered both by the absence of rows and by the column's
  `NOT NULL DEFAULT false` (any future/existing row backfills to `false`).

## References

- @context/project-overview.md (§9 `User` / `Role`, §16, §17 doc-sync rule)
- @context/coding-standards.md (`prisma migrate dev`, never `db push`; migrate status before commit)
- @context/features/scaffload-prisma.md (Prisma 7 + Neon migration pattern to reuse)
- @context/features/bootstrap-seed.md (consumes this flag)
