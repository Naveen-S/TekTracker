/**
 * Generate a one-shot SQL bootstrap bundle for a DBA-managed PostgreSQL database.
 *
 * Normally the container migrates itself (`docker-entrypoint.sh` → `prisma migrate deploy`, see
 * DEPLOY.md §5). This script exists for the one environment shape where that is not allowed: a DBA
 * team owns the database and no application role may run DDL. It emits a single reviewable file
 * that replays every migration in order AND records them in `_prisma_migrations`.
 *
 * ── Why the bookkeeping half is not optional ──
 * The container still runs `prisma migrate deploy` at start-up, and it decides what to apply by
 * reading `_prisma_migrations`. Schema present + bookkeeping absent ⇒ start-up tries to create
 * tables that already exist, the migration fails, and the container deliberately exits without
 * serving. So applying DDL alone turns a working database into an app that will not boot. That is
 * why this is generated rather than hand-written: `checksum` must be the sha256 of each
 * `migration.sql` (verified against a live database, 2026-09-22), which is exactly what the Prisma
 * CLI re-verifies on every subsequent boot.
 *
 * Regenerate and hand over a fresh bundle for EVERY future migration. Never let a DBA hand-write
 * the DDL — the checksums would not match and the app would refuse to start.
 *
 * Usage:
 *   yarn dba:bundle > storyboard-schema-bootstrap.sql   # or: yarn dba:bundle <out-path>
 *
 * Dependency-free (node built-ins only) so it runs anywhere, including from a checkout with no
 * `yarn install`.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations");

/** Expected end state, asserted by the verification queries at the foot of the bundle. */
const EXPECTED_TABLES = 25; // 24 models + _prisma_migrations
const EXPECTED_ENUMS = "FilterSourceType 2 | Role 7 | SprintState 3 | WorkflowType 6";

/** @returns {{ name: string, sql: string, checksum: string }[]} migrations in apply order. */
function readMigrations() {
  const names = readdirSync(MIGRATIONS_DIR)
    .filter((name) => statSync(join(MIGRATIONS_DIR, name)).isDirectory())
    .sort(); // timestamp-prefixed, so lexical order IS apply order
  return names.map((name) => {
    const file = join(MIGRATIONS_DIR, name, "migration.sql");
    const bytes = readFileSync(file);
    return {
      name,
      sql: bytes.toString("utf8").replace(/\s+$/, ""),
      // Plain sha256 of the file bytes — Prisma's own `checksum`, not a variant.
      checksum: createHash("sha256").update(bytes).digest("hex"),
    };
  });
}

function buildBundle(migrations) {
  const today = new Date().toISOString().slice(0, 10);
  const out = [];
  const w = (line = "") => out.push(line);

  w("-- ============================================================================");
  w("-- StoryBoard — one-shot schema bootstrap for a DBA-managed PostgreSQL database");
  w("-- ============================================================================");
  w("--");
  w(`-- Generated ${today} by scripts/dba-bundle.mjs from tekion-apps/storyboard.`);
  w("-- Target: the StoryBoard application database (e.g. `storyboard`), schema `public`.");
  w("-- Run as a role that may CREATE TABLE/TYPE/INDEX in that schema.");
  w("--");
  w("-- WHAT THIS DOES");
  w(`--   1. Creates the application schema: ${migrations.length} migrations replayed in order.`);
  w("--   2. Creates `_prisma_migrations` and records those migrations as applied.");
  w("--");
  w("-- WHY STEP 2 IS NOT OPTIONAL");
  w("--   The application container runs `prisma migrate deploy` at start-up and decides what to");
  w("--   apply by reading `_prisma_migrations`. If the schema exists but that bookkeeping is");
  w("--   absent, start-up tries to create tables that are already there, the migration FAILS, and");
  w("--   the container exits without serving traffic. Applying the DDL without the bookkeeping");
  w("--   rows therefore turns a working database into an application that will not boot.");
  w("--   Run this whole file, or none of it.");
  w("--");
  w("-- SAFETY");
  w("--   * One transaction — PostgreSQL DDL is transactional, so this is all-or-nothing. Nothing");
  w("--     here must run outside a transaction (no CONCURRENTLY, no VACUUM).");
  w("--   * Aborts immediately if a StoryBoard schema is already present (guard below).");
  w("--   * Creates only new objects: no DROP, no data modification, no role/permission change.");
  w("--");
  w("-- VERIFY AFTERWARDS — queries at the foot of this file, with expected values.");
  w("-- ============================================================================");
  w();
  w("\\set ON_ERROR_STOP on");
  w();
  w("-- ─── Guard: refuse to run twice ──────────────────────────────────────────────");
  w("DO $guard$");
  w("BEGIN");
  w("  IF to_regclass('public.\"User\"') IS NOT NULL");
  w("     OR to_regclass('public._prisma_migrations') IS NOT NULL THEN");
  w("    RAISE EXCEPTION 'StoryBoard objects already exist in this database - not running the bootstrap. Report the current state to the application team instead.';");
  w("  END IF;");
  w("END");
  w("$guard$;");
  w();
  w("BEGIN;");
  w();
  w("-- ─── Prisma migration bookkeeping table ──────────────────────────────────────");
  w("-- Managed by the Prisma CLI, not by any migration file, so it is created here.");
  w('CREATE TABLE "_prisma_migrations" (');
  w("    id                  VARCHAR(36)  PRIMARY KEY NOT NULL,");
  w("    checksum            VARCHAR(64)  NOT NULL,");
  w("    finished_at         TIMESTAMPTZ,");
  w("    migration_name      VARCHAR(255) NOT NULL,");
  w("    logs                TEXT,");
  w("    rolled_back_at      TIMESTAMPTZ,");
  w("    started_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),");
  w("    applied_steps_count INTEGER      NOT NULL DEFAULT 0");
  w(");");
  w();

  migrations.forEach(({ name, sql }, index) => {
    w(`-- ${"=".repeat(74)}`);
    w(`-- Migration ${index + 1} of ${migrations.length}: ${name}`);
    w(`-- ${"=".repeat(74)}`);
    w(sql);
    w();
  });

  w("-- ─── Record every migration above as applied ─────────────────────────────────");
  w("-- checksum = sha256 of the migration's migration.sql, which is exactly what the Prisma CLI");
  w("-- verifies on every subsequent start-up. Do not edit these values.");
  w('INSERT INTO "_prisma_migrations"');
  w("  (id, checksum, migration_name, started_at, finished_at, applied_steps_count)");
  w("VALUES");
  migrations.forEach(({ name, checksum }, index) => {
    const terminator = index < migrations.length - 1 ? "," : ";";
    w(`  ('${randomUUID()}', '${checksum}', '${name}', now(), now(), 1)${terminator}`);
  });
  w();
  w("COMMIT;");
  w();
  w("-- ============================================================================");
  w("-- VERIFICATION — expected values in the trailing comments");
  w("-- ============================================================================");
  w();
  w(`SELECT count(*) AS migrations_recorded FROM "_prisma_migrations";   -- expect ${migrations.length}`);
  w();
  w("SELECT count(*) AS public_tables");
  w(`  FROM information_schema.tables WHERE table_schema = 'public';      -- expect ${EXPECTED_TABLES}`);
  w();
  w("SELECT t.typname, count(e.enumlabel) AS labels");
  w("  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid");
  w(" GROUP BY 1 ORDER BY 1;");
  w(`      -- expect ${EXPECTED_ENUMS}`);
  w();
  w("-- Nothing unfinished, nothing rolled back, newest migration recorded last.");
  w('SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at');
  w('  FROM "_prisma_migrations" ORDER BY started_at;');
  w();
  return out.join("\n");
}

const migrations = readMigrations();
if (migrations.length === 0) {
  console.error(`No migrations found in ${MIGRATIONS_DIR}`);
  process.exit(1);
}

const bundle = buildBundle(migrations);
const [outPath] = process.argv.slice(2);
if (outPath) {
  writeFileSync(outPath, bundle);
} else {
  process.stdout.write(bundle);
}

// stderr, so it never pollutes a redirected bundle.
console.error(
  `${migrations.length} migrations embedded (${migrations[0].name} … ${migrations.at(-1).name})` +
    (outPath ? ` → ${outPath}` : ""),
);
