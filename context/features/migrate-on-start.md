# Migrate on start (container applies its own migrations)

## Overview

The container applies pending Prisma migrations before it serves traffic, replacing the separate
`yarn db:deploy` release step that `DEPLOY.md` §5 prescribed.

The trigger was a real outage, not a refactor. The first production rollout onto office infra
(**2026-09-22**, `storyboard-stage.aecloud.io`) shipped **without** the separate migrate step, so
the internal Postgres had no schema and every login answered:

```
DB_MIGRATION_MISSING · VIZaebOt
The database is missing a table or column — migrations have not been applied to this environment
{ code: "DB_MIGRATION_MISSING", details: { stage: "database", prismaCode: "P2021", … } }
```

Two things are worth separating. The **error contract worked perfectly** — `P2021` was classified,
named, given a `requestId` and rendered on the login card, which is exactly what
observability-and-errors.md was built for; triage took seconds, from the response alone. What
failed is the **deployment design**: a step that is trivial to skip, whose omission is discovered by
a user at a login screen, in an environment where nobody can reach the database. The fix is to
remove the step, not to document it harder.

A second, quieter gap surfaced while fixing the first: even with the schema applied, a fresh
environment had **no way to mint its first admin**. `prisma db seed` needs `tsx` + the TypeScript
Prisma client, neither of which exists in the runtime image, so where only the container can reach
Postgres, `User.isAdmin` was unreachable and every `/admin` page 404s.

## Decisions (confirmed with Naveen, 2026-09-18 / 2026-09-22)

1. **Migrations run in the image, at container start** (2026-09-18) — asked for explicitly after the
   separate step was skipped in the real deploy. `SKIP_DB_MIGRATE=1` restores the manual flow.
2. **Fail closed.** A failing migration exits non-zero and never serves; on a rolling deploy the old
   pods keep serving, so a bad migration halts the rollout rather than running new code against a
   half-migrated schema.
3. **The bootstrap admin is granted at login from `SEED_ADMIN_EMAIL`** (2026-09-22, AskUserQuestion)
   — chosen over keeping the seed a manual step, and over an entrypoint-run `bootstrap.sql` (which
   would have duplicated `STATUS_STAGE_SEED` as SQL: two sources of truth). Accepted trade-off,
   stated at the time: an env var becomes an admin-granting surface (§13.3).
4. **The manual path stays documented** as recovery, because production Postgres *is* reachable over
   VPN/bastion (confirmed 2026-09-22) — so an environment on an older image can be fixed without a
   rebuild.

## Scope / implementation

**`docker-entrypoint.sh`** (written 2026-09-18, first wired up 2026-09-22) — runs
`prisma migrate deploy` from `/app/migrate`, then `exec "$@"`. `set -e`, so a failure aborts the
boot. Points the CLI at the baked `.env` via `DOTENV_CONFIG_PATH`; a real `DATABASE_URL` env var
still wins, because dotenv never overrides an existing variable.

**`Dockerfile`** — a new **`migrator`** stage builds the CLI tree the entrypoint needs, and the
runner copies it to `/app/migrate` plus sets `ENTRYPOINT` (keeping `CMD ["node", "server.js"]`, so
the entrypoint execs it).

**`src/lib/rbac.js`** — `isBootstrapAdminEmail(email)`: trimmed, case-insensitive, single address,
false when the variable is blank or unset.

**`src/app/api/auth/login/route.js`** — spreads `{ isAdmin: true }` into both the `update` and
`create` branches of the existing `user.upsert` when that predicate holds, and logs
`auth.bootstrap_admin_granted`.

### Why the CLI needs its own tree

`next build --standalone` traces only the app's **runtime** imports. The bundle therefore carries
the generated client and `@prisma/adapter-pg` but **no CLI, no `node_modules/.bin`, and no
`prisma/` directory at all** — while still inheriting a `package.json` whose `scripts` lists
`db:deploy`. That script is a trap: in the pod it dies on `prisma: command not found`, and there
would be no schema or migration history to apply even if it resolved. Hence a separate tree,
deliberately **not** copied from the builder's `node_modules` (837 MB to obtain one binary).

### Do not try to slim the migrate tree

The tree adds **224 MB**. Pruning the obviously-unused subtrees (`@prisma/studio-core`,
`@prisma/dev` and their `effect` / `@electric-sql` / `react-dom` dependants) gets it to **107 MB**
and **breaks the CLI**: Prisma 7.8's require graph is eager, so it fails at *module load*, before
argument parsing —

```
Error: Cannot find module 'effect'                      ← required by @prisma/config
Error: Cannot find module '@prisma/studio-core/data/bff' ← required by the CLI bundle
```

An image pruned that way boots straight into `MODULE_NOT_FOUND`, i.e. a total outage, to save
117 MB. The migrator stage therefore ends with a **build-time probe** that renders the schema to
SQL with no database:

```dockerfile
RUN node node_modules/prisma/build/index.js migrate diff \
      --from-empty --to-schema prisma/schema.prisma --script > /dev/null
```

It loads the config, the CLI and the migrate engine, so a tree that cannot migrate fails
`docker build` instead of production. (Note the Prisma 7 flag rename: `--to-schema-datamodel` was
removed in favour of `--to-schema`.)

### Deliberately not changed

- **No schema change, no migration, no new route** — the invariants hold at **50 ƒ Dynamic** and
  **13 migrations**.
- **§12 metrics untouched.**
- **`prisma/seed.mjs` unchanged.** The login grant covers only `isAdmin`; the global
  `StatusStageMapping` rows still come from `yarn db:seed`, so it remains the tidiest bootstrap
  wherever the database is reachable.
- **The grant never clears `isAdmin`** — a spread, not `isAdmin: bootstrapAdmin`. Writing `false` on
  every other login would demote every admin promoted through `/admin`.

## Status

**Done 2026-09-22** on branch `feature/migrate-on-start` (off `main` @ `03602d7`). Uncommitted —
Naveen runs commits (gitleaks hook).

**Verified** (Node 22). No Docker CLI locally, so the container was emulated exactly: an `/app`
layout with the baked `.env`, the entrypoint, and a `/app/migrate` tree built the way the `migrator`
stage builds it, then the real `docker-entrypoint.sh` invoked with a stand-in CMD.

| Check | Result |
|---|---|
| **Fresh empty schema** (the production case) | all **13 migrations applied**, then CMD exec'd |
| Second boot, same schema | *"No pending migrations to apply"*, CMD exec'd — idempotent |
| `SKIP_DB_MIGRATE=1` | skipped, CMD exec'd |
| **Failure halts boot** | a cold-DB `P1001` exited non-zero, CMD **never** exec'd |
| Injected `DATABASE_URL` vs baked `.env` | injected wins (dotenv does not override) |
| Build-time probe, full tree | exit 0, 24 `CREATE TABLE` statements, no DB |
| Build-time probe, pruned tree | fails at module load — pruning rejected |
| `yarn lint` | clean |
| Cold env-free build (`.env` + `.env.production` moved aside, absence asserted) | exit 0 · **50 ƒ Dynamic** · 0 static API routes · **0 warnings** · no `Environments:` line |
| Standalone contents (the trap, confirmed on a real build) | `node_modules/prisma` absent · `.bin` empty · `prisma/` absent · `scripts.db:deploy` present |

**Not yet verified:** a real `docker build` (no Docker CLI available here) and the boot-time
migration against internal Postgres — both land with the Jenkins rebuild. Watch
`kubectl logs <pod> | grep '\[entrypoint\]'`.

**Incident note.** Verification used `?schema=migrate_probe` against the dev Neon branch to get a
genuinely empty target; both probe schemas were dropped afterwards. A `SET search_path` then leaked
onto a pooled Neon backend and made `migrate status` report all 13 migrations unapplied — alarming
and harmless: nothing was persisted (`pg_db_role_setting` empty), it cleared once connections
cycled, and `public` was confirmed intact (13 migrations, 1022 issues, 1029 progress rows, 6 teams).
**A `?schema=` probe through a transaction pooler can dirty a shared backend — prefer a throwaway
database.**

## Doc-sync

- **`DEPLOY.md`** — §5 rewritten (container migrates itself: idempotency + advisory lock,
  fail-closed, the startup-probe window, `SKIP_DB_MIGRATE`, the "cannot run `yarn db:deploy` in the
  pod" warning, the manual recovery path, `migrate resolve` for a failed migration, and the
  post-manual-migration pod restart); §6 rewritten (admin at login vs. the seed's mapping rows);
  §8's `DB_MIGRATION_MISSING` row now says what the code means *after* this change; §9 checklist
  reconciled against the real rollout.
- **Host correction** — the real host is **`storyboard-stage.aecloud.io`** (one hyphenated label),
  not the `storyboard.stage.aecloud.io` this runbook specified in 7 places. Fixed in `DEPLOY.md` +
  `CLAUDE.md`; the dated entries in `project-overview.md` §8, `office-deployment.md` and
  `legacy-history.md` keep the old name per append-don't-rewrite, with an amendment appended.
- **`project-overview.md`** — §8 packaging note amended (migrations no longer a separate step);
  §13.3 records the new admin-granting surface; §5 feature table entry.
- **`CLAUDE.md`** — structure list now names `docker-entrypoint.sh` and the live host.

## References

- `Dockerfile` (`migrator` stage) · `docker-entrypoint.sh`
- `src/lib/rbac.js` (`isBootstrapAdminEmail`) · `src/app/api/auth/login/route.js`
- `DEPLOY.md` §5, §6, §8, §9
- context/features/office-deployment.md (the packaging this completes)
- context/features/observability-and-errors.md (the contract that made the outage self-describing)
- project-overview.md §8, §13.3
