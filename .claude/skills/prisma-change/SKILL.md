---
name: prisma-change
description: Prisma 7 schema-change workflow for web/ — edit schema.prisma and project-overview §9 together, create a named migration against Neon (never db push), regenerate the client, verify. Use for any data-model change, new model, column, or enum.
---

# Prisma schema change (web/)

## Iron rules

- `web/prisma/schema.prisma` and project-overview.md **§9** (Prisma block AND the mermaid ER
  diagram) must stay **byte-consistent** — change both in the same PR (§17 doc-sync).
- Schema changes go through `prisma migrate dev` — **never `db push`** (coding-standards).
- `prisma migrate status` must be "up to date" before committing.
- The keying decisions are deliberate, ratified product decisions — don't "normalize" them:
  `IssueProgress` keyed by `(teamId, sprintId, jiraKey)`; `Issue` ↔ `IssueProgress` intentionally
  have **no FK** (joined by `jiraKey` at read time so manual stage edits survive re-syncs);
  `Sprint` is global (no Org table); global `StatusStageMapping` rows use `teamId = null`.

## Steps (from `web/`)

1. Read the affected model's block + rationale bullets in project-overview §9 before editing.
2. Edit `web/prisma/schema.prisma` — keep the `///` doc-comment style on models/fields.
3. `yarn prisma validate`
4. `yarn db:migrate --name <snake_case_change>` — runs against Neon via `web/.env`
   (`DATABASE_URL` is in `prisma.config.mjs`, not the schema). Additive changes have run clean
   directly on the pooled endpoint (`add_user_isadmin` did); if `migrate dev` demands a shadow DB
   (as the `init` migration did), flag it rather than improvising against Neon.
5. `yarn db:generate` — the modern `prisma-client` generator emits **TypeScript** into
   `web/src/generated/prisma` (gitignored + ESLint-ignored; recreated by `postinstall`). App code
   imports only via the singleton `web/src/lib/db.js` (`import { prisma } from "@/lib/db"`).
6. Seed impact: if the change touches seeded data (admin user, `StatusStageMapping`, workflow
   constants in `web/src/lib/workflows.mjs`), update `web/prisma/seed.mjs` (zod-validated,
   idempotent — re-runs must not dupe; global mapping rows are delete-then-`createMany` because of
   Postgres NULL-unique) and run `yarn db:seed`.
7. Doc-sync §9 (schema block + ER diagram + rationale bullet if behavior changed), then /verify-web.

## Prisma 7 gotchas (differ from training data)

- **No `url` in the `datasource` block** — Prisma 7 removed it. CLI connection lives in
  `web/prisma.config.mjs` (dotenv); runtime connects through `@prisma/adapter-pg` in
  `web/src/lib/db.js`.
- Generator is the modern **`prisma-client`** (not the deprecated `prisma-client-js`); explicit
  `output` required.
- Constructing `PrismaClient` opens **no** connection — only queries do. Keep queries out of
  build-time paths so `yarn build` stays DB-free.
- The seed command is wired in `prisma.config.mjs` (`migrations.seed = "tsx prisma/seed.mjs"`),
  not `package.json`.
