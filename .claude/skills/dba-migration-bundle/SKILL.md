---
name: dba-migration-bundle
description: Build, rehearse and hand over the hand-run SQL bundle that applies a release's new Prisma migrations to the office StoryBoard database (reached only via the jumpserver, where Naveen runs psql himself). Use after every release or feature that adds a directory under prisma/migrations, after /finish-feature verification and before the image is rolled out. Triggers on "migration script for office infra", "DB bundle", "office DB migration", "psql bundle for the release".
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
`04-runtime-access.sql` was never run and was never needed. Bundles contain only `00`–`02` (plus a
reviewed `02b-seed.sql` when data is needed). Running as a *different* role (a DBA or `postgres`) is
the one way to break this: the new tables would be unreadable by the app. The README tells Naveen to
connect as the `DATABASE_URL` user.

Claude **never** connects to the office DB (it can't reach it). The job is to produce a bundle that
is correct, guarded and rehearsed, so Naveen's run is mechanical.

**Two committed scripts do the mechanical work:**
- `scripts/dba-migration-bundle.mjs` **generates** the bundle (`00-preflight` · `01-migrate` ·
  `02-verify` · `README.md` · `migration-manifest.json` · `SHA256SUMS`).
- `scripts/dba-migration-rehearse.sh` **rehearses** it on a throwaway PostgreSQL 15 and prints a
  PASS/FAIL summary; `--finalize` re-hashes and zips. Always run it with `bash` (zsh doesn't
  word-split, and macOS bash is 3.2; the script is written for 3.2).

Bundles live in `output/` (gitignored; artifacts). History so far:

| Bundle (`output/…`) | Applies | On top of |
| --- | --- | --- |
| `storyboard-dba-bootstrap-2026-09-22/` | 1–13 (all history, one-time) | empty DB |
| `storyboard-dba-migration-2026-09-29-add_claude_connector/` | 14 | 13 |
| `storyboard-dba-migration-2026-10-20-add_security_tracker/` (+ `02b-seed`) | 15 | 14 |
| `storyboard-dba-migration-2026-11-01-add_support_oncall/` | 16 | 15 |

The rehearsal script rebuilds the office state by chaining these, so **never delete an old bundle
from `output/`**. Add a row here for each new one.

## When

After every release or feature that added a directory under `prisma/migrations/` (the
`prisma-change` and `finish-feature` skills list it). Run it after verification passes, ideally
after the migration is committed, so the bundle records the commit hash. Uncommitted is fine if the
`migration.sql` bytes won't change: the checksum is of the bytes, not the commit.

## Steps

1. **Find the office DB's current head: `--applied-through`. Never guess it.**
   - Start from `context/current-feature.md` → carry-forward → **"Office DB head"**. It tells you
     the last confirmed head and whether a newer bundle is still **pending Naveen's run**.
   - If a bundle is pending (or the head is unconfirmed), ask Naveen with AskUserQuestion whether
     it ran. Offer both answers: "yes, at N" → bundle only the new migration; "no, still at N-1"
     → one combined bundle (several pending migrations go into one transaction; carry over the
     earlier bundle's `02b-seed.sql`). If he doesn't know, give him:
     `SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name DESC LIMIT 1;`
   - A wrong value is caught by the `00`/`01` guards, but it wastes a jumpserver trip.
2. **Generate** (from the repo root):
   `node scripts/dba-migration-bundle.mjs --applied-through <name>`
   → `output/storyboard-dba-migration-<date>-<last>/`. **Never** use the default output path for a
   throwaway bundle: the same date + last migration overwrites the real one (use `--out <scratch>`).
3. **Review what the generator can't know.** Read `01-migrate.sql` end to end, then check:
   - **Non-transactional SQL.** `CREATE INDEX CONCURRENTLY`, `VACUUM`, or `ALTER TYPE … ADD VALUE`
     whose new value is *used* in the same transaction cannot run inside `01`'s single
     `BEGIN/COMMIT`. Split them into their own file, with their own bookkeeping row.
   - **Seed or backfill data.** The generator emits DDL only. If production needs rows the app
     can't create itself, add a reviewed, idempotent `02b-seed.sql` with a history-guard
     precondition (copy the shape of the 2026-10-20 bundle's) whose last line is
     `SELECT 'SEEDED: …'`, and document it in `README.md`. Otherwise say **"No seed step"** and why
     in `README.md` (e.g. a nullable column falls back to a code default).
   - **Long locks.** `lock_timeout` is 10 s and `statement_timeout` is 5 min. A table rewrite on a
     big table, such as a `NOT NULL` column with a volatile default, needs an off-peak note in the
     README. A nullable column with no default is metadata-only; FKs on a new, empty table are
     instant.
4. **Rehearse:** `bash scripts/dba-migration-rehearse.sh output/<bundle-dir>`
   (prefix `TMPDIR=<scratchpad>` so the throwaway cluster lives there). It:
   - rebuilds today's office state as the app role `storyboard_app`: bootstrap `00`–`03` (never
     `04`), then every earlier bundle that chains to this one's `appliedThrough`, incl. `02b`;
   - runs the happy path (`00` → PREFLIGHT PASSED, `01` → MIGRATED, `02` → VERIFY PASSED, `02b` twice
     for idempotency) and checks each new table is owned by, and writable by, the app role with no
     grants;
   - runs Prisma as the app role: `migrate status` (up to date), `migrate deploy` (nothing pending),
     `migrate diff … --exit-code` (no drift from `prisma/schema.prisma`);
   - runs the refusals: re-run `01`, re-run `00`, an error injected before `COMMIT` (full
     rollback), a pre-created new table (partial state), a bundle generated with an earlier
     `--applied-through`, and `02b` before `01`;
   - deletes the cluster on exit, pass or fail, and exits non-zero on any FAIL.
   
   It must end with **`REHEARSAL PASSED`**. Two failures are environmental, not the bundle:
   - **"Prisma checks skipped: the repo's newest migration is …"**: the checkout is ahead of the
     bundle. Rehearse from the branch/commit whose newest migration is the bundle's last.
   - **"Cannot reproduce the office state"**: an earlier bundle is missing from `output/` or the
     chain has a gap. Find or regenerate it; don't hand-apply SQL around it.
   
   Add bundle-specific checks by hand only when the change needs them (e.g. a backfill's row
   counts, or a cascade a feature relies on), in a transaction that rolls back.
5. **Write `VALIDATION.md`** in the house format (copy the newest bundle's): the
   `--applied-through` and who confirmed it, the pending migration + checksum (copied from the
   manifest, never hand-typed), the environment line, "the office model was reproduced" with the
   chain, **PASS** bullets transcribed from the script's output (Happy path · Prisma · Refusals),
   any review notes from step 3, and the **"Not covered"** section. Then:
   `bash scripts/dba-migration-rehearse.sh --finalize output/<bundle-dir>`
   (re-hashes `SHA256SUMS` incl. `VALIDATION.md` and rebuilds the zip).
6. **Hand over.** Give Naveen:
   - the bundle path and zip
   - the pending migrations and the new objects
   - the `psql -X -v ON_ERROR_STOP=1 -f` commands in order (`00` → `01` → `02` [→ `02b`]), with the
     expected last line of each
   - to connect as the **`DATABASE_URL` user**, not a DBA or superuser
   - the rule: **apply before the image rollout**
   - if the migration files are uncommitted: commit `migration.sql` byte-for-byte as bundled
   
   The bundle's `README.md` carries the jumpserver steps (scp via `-J`, or a quoted-heredoc paste),
   the credential handling (`read -rs PGPASSWORD`) and the failure table.
7. **Record it.**
   - The feature spec (Status / Pending): bundle generated and rehearsed, with its path.
   - `context/current-feature.md` carry-forward → "Office DB head": the confirmed head, and the new
     bundle as **pending Naveen's run**. When he confirms it ran, move the head forward (that value
     is the next bundle's `--applied-through`).
   - Add the bundle's row to the history table above.

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
- Point the rehearsal script at anything but its own throwaway cluster, or delete an old bundle
  from `output/` (the next rehearsal chains through it).
