---
name: dba-migration-bundle
description: Build, rehearse and hand over the hand-run SQL bundle that applies a feature's new Prisma migrations to the office StoryBoard database (reached only via the jumpserver, where Naveen runs psql himself). Use whenever a feature or branch adds a directory under prisma/migrations, after /finish-feature verification and before the image is rolled out.
---

# Office DB migration bundle

Production (`storyboard-stage.aecloud.io`) runs on **internal Tekion Postgres**, reached only from an
office machine behind the **jumpserver**. Neon is the dev database only.

Naveen applies every release's pending migrations **by hand with `psql`**, connected as the **app's
own database user** (the user in `DATABASE_URL`). That user ran the 2026-09-22 bootstrap and owns
every table. He does this **before** the image that needs them is rolled out. That image's code
queries the new objects, and started first it answers `DB_MIGRATION_MISSING` (`P2021`).

**No runtime-access / grants file.** Tables belong to the role that creates them, and the office DB
is always migrated as the app's own role, so the app already has full access. The bootstrap's
`04-runtime-access.sql` was never run and was never needed. Bundles contain only `00`–`02`. Running
as a *different* role (a DBA or `postgres`) is the one way to break this: the new tables would be
unreadable by the app. The README tells Naveen to connect as the `DATABASE_URL` user.

Claude **never** connects to the office DB (it can't reach it). The job is to produce a bundle that
is correct, guarded and rehearsed, so Naveen's run is mechanical.

Reference bundles:
- `output/storyboard-dba-bootstrap-2026-09-22/`: the one-time, all-history bootstrap (13 migrations).
- `output/storyboard-dba-migration-2026-09-29-add_claude_connector/`: the first incremental bundle
  (migration 14).

`output/` is gitignored. Bundles are artifacts. The generator
`scripts/dba-migration-bundle.mjs` is committed.

## When

A feature added a new directory under `prisma/migrations/`. The trigger is being listed by the
`prisma-change` and `finish-feature` skills. Run it after verification passes, ideally after the
migration is committed, so the bundle records the commit hash.

## Steps

1. **Find the office DB's current head: `--applied-through`. Never guess it.** In order of
   preference:
   1. The newest bundle's `migration-manifest.json`: its last `pending` entry (or last `applied`
      entry for the bootstrap), **if** Naveen confirmed that bundle was run.
   2. Ask Naveen to run this on the office DB:
      `SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name DESC LIMIT 1;`
   
   If unsure, ask via AskUserQuestion. A wrong value is caught by the `00`/`01` guards, but it
   wastes a jumpserver trip.
2. **Generate:**
   `node scripts/dba-migration-bundle.mjs --applied-through <name>`
   The output is `output/storyboard-dba-migration-<date>-<last>/`, containing `00-preflight` ·
   `01-migrate` · `02-verify` · `README.md` · `migration-manifest.json` · `SHA256SUMS`. Several pending migrations go into one bundle and one transaction, in order.
3. **Review what the generator can't know.** Read `01-migrate.sql` end to end, then check:
   - **Non-transactional SQL.** `CREATE INDEX CONCURRENTLY`, `VACUUM`, or `ALTER TYPE … ADD VALUE`
     whose new value is *used* in the same transaction cannot run inside `01`'s single
     `BEGIN/COMMIT`. Split them into their own file, with their own bookkeeping row.
   - **Seed or backfill data.** The generator emits DDL only. If production needs rows the app
     can't create itself, add a reviewed, idempotent `02b-seed.sql` with a history-guard
     precondition, and document it in `README.md`. (`ClaudeAnalysisSettings` needed none: code
     defaults apply until an admin saves.)
   - **Long locks.** `lock_timeout` is 10 s and `statement_timeout` is 5 min. A table rewrite on a
     big table, such as a `NOT NULL` column with a volatile default, needs an off-peak note in the
     README.
4. **Rehearse on a throwaway PostgreSQL 15.** This mandatory local run is what `VALIDATION.md`
   reports:
   ```sh
   PGBIN=/opt/homebrew/opt/postgresql@15/bin; T=<scratchpad>/pgrehearsal
   $PGBIN/initdb -D $T/data -U postgres --auth=trust -E UTF8
   # TCP, not a Unix socket: scratchpad socket paths exceed the 103-byte limit
   $PGBIN/pg_ctl -D $T/data -o "-c unix_socket_directories='' -c listen_addresses=127.0.0.1 -p 55432" -l $T/pg.log start
   export PGHOST=127.0.0.1 PGPORT=55432
   psql -U postgres -d postgres -c "create role storyboard_app login password 'app'" \
     -c "create database storyboard owner storyboard_app"
   export PGUSER=storyboard_app PGDATABASE=storyboard   # the office model: the app role owns + migrates
   ```
   - **Reproduce today's office state, all as `storyboard_app`.** Apply
     `output/storyboard-dba-bootstrap-2026-09-22/` `00`–`03` (**not** its `04`). Then apply every
     earlier incremental bundle that Naveen has already run, in date order. Snapshot the result as
     `postgres`: `create database sb_template template storyboard owner storyboard_app`.
   - **Happy path:** run `00` → PREFLIGHT PASSED, `01` → MIGRATED, `02` → VERIFY PASSED. Confirm
     every new table's `tableowner` is `storyboard_app`, and that the role can
     INSERT/UPDATE/DELETE on them with no grants.
   - **Prisma, as the app role** (`DATABASE_URL=postgresql://storyboard_app:app@127.0.0.1:55432/storyboard`):
     - `npx prisma migrate status` → up to date
     - `npx prisma migrate deploy` → "No pending migrations to apply", exit 0
     - `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
       → "No difference detected"
   - **Negative tests,** each on `create database sb_neg template sb_template owner storyboard_app`:
     1. Re-run `01` → refused, history unchanged.
     2. Re-run `00` → refused.
     3. Inject `SELECT 1/0;` before `COMMIT` in a copy of `01` → full rollback.
     4. Pre-create one new table → `00` and `01` refuse.
     5. A bundle generated with an earlier `--applied-through` → refused.
   - **Tear down:** `pg_ctl stop`, then remove `$T`.
5. **Write `VALIDATION.md`** in the house format: PASS bullets and a "Not covered" section.
   - Don't hand-type checksums; copy them from the manifest.
   - Then re-hash and zip:
     `(cd <dir> && shasum -a 256 00-*.sql 01-*.sql 02-*.sql README.md VALIDATION.md migration-manifest.json > SHA256SUMS && shasum -a 256 -c SHA256SUMS)`
     and `(cd output && zip -qr <dir>.zip <dir>)`.
6. **Hand over.** Give Naveen:
   - the bundle path and zip
   - the pending migrations and the new objects
   - the three `psql -X -v ON_ERROR_STOP=1 -f` commands in order (`00` → `01` → `02`), with the
     expected last line of each
   - to connect as the **`DATABASE_URL` user**, not a DBA or superuser
   - the rule: **apply before the image rollout**
   
   The bundle's `README.md` carries the jumpserver steps (scp via `-J`, or a quoted-heredoc paste),
   the credential handling (`read -rs PGPASSWORD`) and the failure table.
7. **Record it.** Note in the feature spec (Status or as-built) that the bundle was generated and
   rehearsed. Once Naveen confirms he has run it, update `current-feature.md`'s carry-forward with
   the office DB head, e.g. "office DB at 14 migrations (`…add_claude_connector`)". That value is
   the next bundle's `--applied-through`.

## Never

- Run anything against the office DB, or suggest `prisma migrate dev` / `db push` / `migrate reset`
  for it.
- Hand-write DDL or edit a checksum. `_prisma_migrations.checksum` must be the sha256 of the exact
  `migration.sql` bytes, or every future container boot fails.
- Reuse the all-history bootstrap bundle for an upgrade.
- Write a DROP or down-migration into a bundle. Rollback is a reviewed change or a restore.
- Put a password, `DATABASE_URL` or real role name into any bundle file.
- Add a grants / runtime-access file. If Naveen ever has to migrate as a different role, that is a
  new, explicit decision to make with him, not a default.
